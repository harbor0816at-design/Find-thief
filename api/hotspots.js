// Published evidence-only areas. Never shows unreviewed text or private coordinates.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=120');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!u||!k)return res.status(200).json({areas:[],ready:false,message:'尚未接入经核验的公开区域'});
 try{const path='/rest/v1/evidence_areas?status=eq.published&select=id,country,city,label,lat,lon,radius_m,source_type,source_url,license_note,period_start,period_end,evidence_count,method_note,evidence_verified_at&order=period_end.desc&limit=180';
 const r=await fetch(u.replace(/\/$/,'')+path,{headers:{apikey:k,...(k.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+k})},signal:AbortSignal.timeout(6500)});
 if(!r.ok)throw Error('Data source inaccessible');const rows=await r.json();return res.status(200).json({areas:Array.isArray(rows)?rows:[],ready:true,updatedAt:new Date().toISOString()});}
 catch{return res.status(503).json({areas:[],ready:false,error:'区域数据暂不可读取'});}
};
