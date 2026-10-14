module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=45, stale-while-revalidate=60');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const out={service:'Find-thief',version:'1.1.0',time:new Date().toISOString(),data:{geographicalZones:68,verifiedIncidents:'未接通',emergencyRegions:51},pipeline:{github:'harbor0816at-design/Find-thief',branch:'main',commits:[],sourceMonitor:'来源发现/待审核，未自动发布外部事件'},backend:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)};
 try{const r=await fetch('https://api.github.com/repos/harbor0816at-design/Find-thief/commits?per_page=8',{headers:{Accept:'application/vnd.github+json','User-Agent':'Find-thief-status/1.1'},signal:AbortSignal.timeout(4000)});if(r.ok){const d=await r.json();out.pipeline.commits=d.map(x=>({sha:x.sha.slice(0,8),time:x.commit?.committer?.date||'',title:String(x.commit?.message||'').split('\n')[0].slice(0,120)}));out.pipeline.githubStatus='ok'}else out.pipeline.githubStatus='暂不可用'}catch{out.pipeline.githubStatus='暂不可用'}
 return res.status(200).json(out)
};