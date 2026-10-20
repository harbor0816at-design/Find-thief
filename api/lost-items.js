// Anonymous, approved, city+attraction lost-item category counts only.
// No users, contact details, private addresses or identifiers are exposed.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=120');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!u||!k)return res.status(200).json({available:false,items:[],message:'在线已审核丢失物品统计待启用'});
 try{
  const path='/rest/v1/loss_reports?status=eq.approved&spot_name_public=not.is.null&select=city,spot_name_public,item_category&limit=5000';
  const r=await fetch(u.replace(/\/$/,'')+path,{headers:{apikey:k,...(k.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+k})},signal:AbortSignal.timeout(6000)});
  if(!r.ok)throw Error('DB_'+r.status);
  const rows=await r.json();
  if(!Array.isArray(rows))throw Error('Bad response');
  const m=new Map();
  for(const x of rows){if(typeof x.city!=='string'||typeof x.spot_name_public!=='string'||typeof x.item_category!=='string')continue;
   const key=JSON.stringify([x.city,x.spot_name_public,x.item_category]);m.set(key,(m.get(key)||0)+1)}
  const items=[...m.entries()].filter(([,n])=>n>=3).map(([key,n])=>{const [city,spot_name,item_category]=JSON.parse(key);return {city,spot_name,item_category,count:n}});
  return res.status(200).json({available:true,items,minimumDisplayCount:3,note:'仅基于人工审核通过的游客匿名上报，不代表实际盗窃概率；3条以下不公开细分统计。'});
 }catch{return res.status(503).json({available:false,items:[],error:'失物统计暂不可用'})}
};
