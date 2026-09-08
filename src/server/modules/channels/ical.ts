import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma';

function clean(v: string) { return v.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim(); }
function parseDate(raw: string): Date | null {
  const v = raw.split(':').pop()!.trim();
  if (/^\d{8}$/.test(v)) return new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T00:00:00.000Z`);
  if (/^\d{8}T\d{6}Z$/.test(v)) return new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}.000Z`);
  if (/^\d{8}T\d{6}$/.test(v)) return new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}.000Z`);
  return null;
}

export type ICalReservation = { uid:string; checkIn:Date; checkOut:Date; status:string };

export function parseICal(input: string): ICalReservation[] {
  if (input.length > 2_000_000) throw new Error('Feed iCal demasiado grande.');
  const unfolded = input.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1).map(x => x.split('END:VEVENT')[0]);
  const out: ICalReservation[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const map = new Map<string,string>();
    for (const line of lines) { const i=line.indexOf(':'); if(i>0) map.set(line.slice(0,i).split(';')[0].toUpperCase(), clean(line.slice(i+1))); }
    const uid=map.get('UID'); const start=map.get('DTSTART'); const end=map.get('DTEND');
    const checkIn=start ? parseDate(start) : null; const checkOut=end ? parseDate(end) : null;
    if (!uid || !checkIn || !checkOut || checkOut <= checkIn) continue;
    out.push({uid,checkIn,checkOut,status:(map.get('STATUS')||'CONFIRMED').toUpperCase()});
  }
  return out;
}

function assertSafeUrl(raw:string) {
  const u=new URL(raw);
  if (u.username || u.password) throw new Error('La URL de calendario no puede incluir credenciales.');
  if(u.protocol!=='https:' && process.env.NODE_ENV==='production') throw new Error('El calendario externo debe usar HTTPS.');
  const host=u.hostname.toLowerCase();
  if(['localhost','127.0.0.1','::1'].includes(host) || host.endsWith('.local') || host.endsWith('.internal') || host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host.startsWith('169.254.')) throw new Error('URL de calendario no permitida.');
  return u;
}

export async function syncICalConnection(connectionId:string) {
  const connection=await prisma.listingChannelConnection.findUnique({where:{id:connectionId}});
  if(!connection || connection.provider!=='ICAL' || !connection.externalCalendarUrl) throw new Error('Conexión iCal no válida.');
  await prisma.listingChannelConnection.update({where:{id:connectionId},data:{status:'SYNCING'}});
  try {
    const u=assertSafeUrl(connection.externalCalendarUrl);
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10_000);
    const res=await fetch(u,{signal:controller.signal,headers:{Accept:'text/calendar,text/plain;q=0.9'}}).finally(()=>clearTimeout(timer));
    if(!res.ok) throw new Error(`iCal HTTP ${res.status}`);
    const text=await res.text();
    const events=parseICal(text);
    const feedHash=crypto.createHash('sha256').update(text).digest('hex');
    await prisma.channelSyncEvent.create({ data:{ connectionId, provider:'ICAL', eventType:'SYNC', externalEventId:`sync:${feedHash}`, status:'PROCESSING', attempts:1, payloadHash:feedHash } }).catch(async (e:any)=>{ if(e?.code!=='P2002') throw e; });
    const seen=new Set<string>();
    for(const ev of events){
      if(['CANCELLED','TRANSPARENT'].includes(ev.status)) continue;
      seen.add(ev.uid);
      const hash=crypto.createHash('sha256').update(`${ev.uid}|${ev.checkIn.toISOString()}|${ev.checkOut.toISOString()}|${ev.status}`).digest('hex');
      await prisma.externalReservation.upsert({
        where:{provider_externalReservationId_listingId:{provider:'ICAL',externalReservationId:ev.uid,listingId:connection.listingId}},
        create:{listingId:connection.listingId,connectionId,provider:'ICAL',externalReservationId:ev.uid,checkIn:ev.checkIn,checkOut:ev.checkOut,status:'ACTIVE',lastSeenAt:new Date(),payloadHash:hash},
        update:{connectionId,checkIn:ev.checkIn,checkOut:ev.checkOut,status:'ACTIVE',lastSeenAt:new Date(),payloadHash:hash}
      });
    }
    await prisma.externalReservation.updateMany({where:{connectionId,provider:'ICAL',status:'ACTIVE',lastSeenAt:{lt:new Date(Date.now()-60_000)},externalReservationId:{notIn:[...seen]}},data:{status:'REMOVED',lastSeenAt:new Date()}});
    await prisma.listingChannelConnection.update({where:{id:connectionId},data:{status:'CONNECTED',lastSuccessfulSyncAt:new Date(),lastError:null}});
    await prisma.channelSyncEvent.updateMany({where:{connectionId,provider:'ICAL',externalEventId:`sync:${feedHash}`},data:{status:'COMPLETED',nextAttemptAt:null,lastError:null}});
    return {events:events.length, active:seen.size};
  } catch(error){
    await prisma.channelSyncEvent.updateMany({where:{connectionId,provider:'ICAL',status:'PROCESSING'},data:{status:'FAILED',lastError:String(error).slice(0,500),nextAttemptAt:new Date(Date.now()+5*60_000)}}).catch(()=>null);
    await prisma.listingChannelConnection.update({where:{id:connectionId},data:{status:'ATTENTION',lastErrorAt:new Date(),lastError:String(error).slice(0,500)}});
    throw error;
  }
}

export function generateICal(listingId:string, bookings:{id:string;checkIn:Date;checkOut:Date;status:string}[], blocks:{date:Date}[] = []) {
  const esc=(x:string)=>x.replace(/([,;\\])/g,'\\$1');
  const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const day=(d:Date)=>d.toISOString().slice(0,10).replace(/-/g,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hestiat//Calendar//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const b of bookings.filter(x=>['PENDING','CONFIRMED'].includes(x.status))) lines.push('BEGIN:VEVENT',`UID:hestiat-${esc(b.id)}@hestiat.com`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(b.checkIn)}`,`DTEND:${stamp(b.checkOut)}`,'TRANSP:OPAQUE','SUMMARY:Hestiat reservation','END:VEVENT');
  for(const d of blocks) lines.push('BEGIN:VEVENT',`UID:hestiat-block-${day(d.date)}-${esc(listingId)}@hestiat.com`,`DTSTAMP:${stamp(new Date())}`,`DTSTART;VALUE=DATE:${day(d.date)}`,`DTEND;VALUE=DATE:${day(new Date(d.date.getTime()+86400000))}`,'TRANSP:OPAQUE','SUMMARY:Hestiat unavailable','END:VEVENT');
  lines.push('END:VCALENDAR'); return lines.join('\r\n')+'\r\n';
}
