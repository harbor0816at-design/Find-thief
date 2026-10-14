// Vercel Cron: retain private and sensitive reports only for set maximum periods.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const token=String(req.headers.authorization||'');
 if(!process.env.CRON_SECRET||token!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'Unauthorized'});
 const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!u||!k)return res.status(503).json({error:'Database not configured'});
 async function remove(path){const r=await fetch(u.replace(/\/$/,'')+'/rest/v1/'+path,{method:'DELETE',headers:{apikey:k,Authorization:'Bearer '+k,Prefer:'return=minimal'},signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Cleanup failed '+r.status);}
 const cutoff=(days)=>new Date(Date.now()-days*86400000).toISOString();
 try{
   await remove('loss_reports?status=eq.rejected&created_at=lt.'+encodeURIComponent(cutoff(30)));
   await remove('loss_reports?status=eq.pending&created_at=lt.'+encodeURIComponent(cutoff(90)));
   await remove('loss_reports?status=eq.approved&created_at=lt.'+encodeURIComponent(cutoff(365)));
   return res.status(200).json({ok:true,cleanup:'done'});
 }catch{return res.status(503).json({error:'Cleanup failed; investigate logs'});}
};
