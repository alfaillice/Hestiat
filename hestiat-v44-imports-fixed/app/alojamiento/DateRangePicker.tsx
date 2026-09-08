"use client";
import { useEffect, useState } from "react";

type Day = { available: boolean; priceCents: number | null; reason?: string };
type Props = { days: Record<string, Day>; checkIn: string; checkOut: string; minNights: number; onChange: (a: string, b: string) => void };
function iso(d: Date){return d.toISOString().slice(0,10)}
function monthStart(d: Date){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1))}
function addMonths(d: Date,n:number){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1))}
function buildWeeks(month: Date){const first=monthStart(month); const start=(first.getUTCDay()+6)%7; const total=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate(); const cells:string[]=[]; for(let i=0;i<start;i++)cells.push(""); for(let d=1;d<=total;d++)cells.push(iso(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),d)))); while(cells.length%7)cells.push(""); return cells}
export default function DateRangePicker({days,checkIn,checkOut,minNights,onChange}:Props){
 const initial=checkIn?monthStart(new Date(`${checkIn}T00:00:00Z`)):monthStart(new Date()); const [cursor,setCursor]=useState(initial); const [start,setStart]=useState(checkIn); const [end,setEnd]=useState(checkOut);
 useEffect(()=>{setStart(checkIn);setEnd(checkOut);if(checkIn)setCursor(monthStart(new Date(`${checkIn}T00:00:00Z`)));},[checkIn,checkOut]);
 const months=[cursor,addMonths(cursor,1)];
 const labels=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric",timeZone:"UTC"});
 const choose=(date:string)=>{if(!date||!days[date]?.available)return; if(!start||end){setStart(date);setEnd("");onChange(date,"");return;} if(date<=start){setStart(date);setEnd("");onChange(date,"");return;} const a=new Date(`${start}T00:00:00Z`),b=new Date(`${date}T00:00:00Z`); const nights=Math.round((b.getTime()-a.getTime())/86400000); if(nights<minNights)return; for(let i=0;i<nights;i++){const x=iso(new Date(a.getTime()+i*86400000));if(!days[x]?.available)return;} setEnd(date);onChange(start,date)};
 const isBetween=(d:string)=>Boolean(start&&end&&d>start&&d<end); const prev=()=>setCursor(addMonths(cursor,-1)); const next=()=>setCursor(addMonths(cursor,1));
 return <div className="realCalendar"><div className="calendarToolbar"><button type="button" onClick={prev} aria-label="Mes anterior">←</button><strong>Selecciona tus fechas</strong><button type="button" onClick={next} aria-label="Mes siguiente">→</button></div><div className="calendarMonths">{months.map((month)=><div className="month" key={iso(month)}><h3>{labels.format(month)}</h3><div className="week"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div className="days">{buildWeeks(month).map((d,i)=>{if(!d)return <span className="empty" key={i}/>; const info=days[d]; const disabled=!info?.available; const selected=d===start||d===end; return <button type="button" key={d} disabled={disabled} onClick={()=>choose(d)} className={`${disabled?"blocked":"available"} ${selected?"selected":""} ${isBetween(d)?"between":""}`} aria-label={disabled?`${d} no disponible`:d}>{new Date(`${d}T00:00:00Z`).getUTCDate()}</button>})}</div></div>)}</div><div className="calendarSelection"><span>{start?`Entrada: ${start}`:"Elige la entrada"}</span><span>{end?`Salida: ${end}`:"Elige la salida"}</span>{minNights>1&&<small>Mínimo {minNights} noches</small>}</div></div>
}
