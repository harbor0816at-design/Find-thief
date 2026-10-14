// Server-side aggregate metrics only. No cookies, IP addresses, device identifiers,
// referrers or raw query texts are persisted in the metrics table.
const events=new Set(['page_view','search','area_open','report_open','report_attempt','report_saved','source_open']);
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 // Same-origin browser events; not a security boundary; metrics are approximate and bot-prone.
 const origin=String(req.headers.origin||'');
 if(origin&&origin!=='https://find-thief.vercel.app')return res.status(204).end();
 if(Number(req.headers['content-length']||0)>512)return res.status(204).end();
 const d=req.body&&typeof req.body==='object'?req.body:{};
 if(!events.has(d.event)||typeof d.city!=='string'||d.city.length>80||/[<>\x00-\x1f]/.test(d.city))return res.status(204).end();
 const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!u||!k)return res.status(204).end();
 try{await fetch(u+'/rest/v1/rpc/count_site_metric',{method:'POST',headers:{apikey:k,...(k.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+k}),'Content-Type':'application/json'},body:JSON.stringify({event_name:d.event,event_city:d.city}),signal:AbortSignal.timeout(2500)})}catch{}
 return res.status(204).end();
};
