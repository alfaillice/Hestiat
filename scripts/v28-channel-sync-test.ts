import { prisma } from '../src/server/lib/prisma';
import { generateICal, parseICal } from '../src/server/modules/channels/ical';
import { getChannelAdapter } from '../src/server/modules/channels/providers';
async function main(){
 const calendar=generateICal('listing-test',[{id:'booking-test',checkIn:new Date('2031-06-10T14:00:00Z'),checkOut:new Date('2031-06-12T10:00:00Z'),status:'CONFIRMED'}],[{date:new Date('2031-06-20T00:00:00Z')}]);
 const parsed=parseICal(calendar); if(parsed.length!==2)throw new Error(`Eventos iCal inesperados: ${parsed.length}`);
 if(!getChannelAdapter('ICAL').capabilities.includes('RESERVATIONS_READ'))throw new Error('Capacidades iCal incompletas');
 console.log('V28 channel/calendar checks: OK'); await prisma.$disconnect();
}
main().catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1)});
