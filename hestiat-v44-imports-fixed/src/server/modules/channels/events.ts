import { enqueueEvent } from '../operations/events';
import { prisma } from '../../lib/prisma';
export async function enqueueICalSync(connectionId:string){ return enqueueEvent({type:'CHANNEL_ICAL_SYNC_REQUESTED',payload:{connectionId},dedupeKey:`ical-sync:${connectionId}:${new Date().toISOString().slice(0,13)}`,provider:'ICAL'}); }
export async function enqueueAvailabilityPush(listingId:string){
 const connections=await prisma.listingChannelConnection.findMany({where:{listingId,status:'CONNECTED',provider:'ICAL'}});
 return Promise.all(connections.map(c=>enqueueEvent({type:'CHANNEL_AVAILABILITY_PUSH_REQUESTED',payload:{connectionId:c.id},dedupeKey:`ical-push:${c.id}:${new Date().toISOString().slice(0,13)}`,provider:'ICAL'})));
}
