import { downloadCombinedReportPdf } from "./src/lib/report-pdf";
const r:any={totalRevenue:125400,todaysRevenue:2500,totalPaidAppointments:48,averageRevenue:2612.5,currency:"INR",
 byDay:Array.from({length:30},(_,i)=>({key:String(i),label:`Jul ${i+1}`,value:i%3?0:1500+i*10})),
 byMonth:Array.from({length:12},(_,i)=>({key:String(i),label:`Mon ${i+1} 2026`,value:i*1200}))};
const a:any={total:210,completed:120,upcoming:30,cancelled:50,noShow:10,
 byDoctor:[{name:"Dr. Ananya Sharma",count:150},{name:"Dr. Rohit Verma",count:60}],
 byConsultationType:[{name:"In-Clinic Consultation",count:120},{name:"Video Consultation",count:70},{name:"Reschedule Fee",count:20}],
 dailyTrend:Array.from({length:30},(_,i)=>({key:String(i),label:`Jul ${i+1}`,value:i%2?0:i}))};
const p:any={totalPatients:88,newPatients:12,returningPatients:31,totalVisits:210,
 topPatients:Array.from({length:10},(_,i)=>({name:`Patient Number ${i+1}`,email:`patient${i+1}@example.com`,visits:20-i})),
 recentRegistrations:Array.from({length:10},(_,i)=>({name:`New Patient ${i+1}`,email:`new${i+1}@example.com`,joined:new Date().toISOString()})),
 monthlyPatients:Array.from({length:12},(_,i)=>({key:String(i),label:`Mon ${i+1}`,value:i}))};
(globalThis as any).__out="";
// stub save
import fs from "fs";
const jsPDFmod:any = await import("jspdf");
jsPDFmod.default.prototype.save = function(name:string){ fs.writeFileSync("/tmp/qa/out.pdf", Buffer.from(this.output("arraybuffer"))); };
downloadCombinedReportPdf(r,a,p);
