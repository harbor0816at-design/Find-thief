// Place appeals: anyone responsible for a marked place can request review.
// GET  -> public status per place (no contact, no private detail).
// POST -> creates a pending appeal; never changes the map by itself.
const crypto=require('node:crypto');
const reasons=new Set(['信息错误','已过时','已整改','恶意标记','其他']);
function cfg(){
  const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  return u&&k&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)?{u:u.replace(/\/$/,''),k}:null;
}
const clean=(v,max)=>typeof v==='string'?v.trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max+1):'';
async function query(c,path,opt={}){
  const r=await fetch(c.u+'/rest/v1/'+path,{...opt,headers:{apikey:c.k,...(c.k.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+c.k}),Accept:'application/json','Content-Type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(7000)});
  if(!r.ok){const e=new Error('DB_'+r.status);e.status=r.status;try{e.code=(await r.json()).code}catch{}throw e}
  return r.json().catch(()=>[]);
}
const allowedOrigins=()=>new Set(['https://fangbaleida.com','https://www.fangbaleida.com','https://find-thief.vercel.app',...(process.env.ALLOWED_REPORT_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)]);

module.exports=async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  const c=cfg();
  if(req.method==='GET'){
    res.setHeader('Cache-Control','public, max-age=60');
    if(!c)return res.status(200).json({items:[],available:false});
    try{
      const rows=await query(c,'place_appeals?select=place_key,status,decision_public,decided_at&order=created_at.desc&limit=500');
      const latest=new Map();for(const r of rows)if(!latest.has(r.place_key))latest.set(r.place_key,r);
      return res.status(200).json({available:true,items:[...latest.values()]});
    }catch{return res.status(503).json({items:[],available:false,error:'申诉状态暂时无法读取'})}
  }
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'})}
  if(!c||!process.env.REPORT_RATE_SECRET||!process.env.DATA_CONTROLLER_EMAIL)return res.status(503).json({error:'在线申诉暂未开放'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'仅支持JSON格式'});
  const origin=String(req.headers.origin||'');
  if(origin&&!allowedOrigins().has(origin))return res.status(403).json({error:'提交来源不允许'});
  if(Number(req.headers['content-length']||0)>6144)return res.status(413).json({error:'内容过大'});
  const d=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  if(d.website)return res.status(202).json({status:'accepted'}); // honeypot
  if(d.consent!==true)return res.status(400).json({error:'提交前请阅读并同意隐私说明'});
  const place_key=clean(d.place_key,160),city=clean(d.city,100),place_name=clean(d.place_name,160),reason=clean(d.reason,10),detail=clean(d.detail,1000),email=clean(d.email,200);
  if(place_key.length<3||place_key.length>160||!city||city.length>100||!place_name||place_name.length>160)return res.status(400).json({error:'请先选择要申诉的地点'});
  if(!reasons.has(reason))return res.status(400).json({error:'请选择申诉理由'});
  if(detail.length<10||detail.length>1000)return res.status(400).json({error:'申诉说明需10–1000字'});
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>200)return res.status(400).json({error:'请填写有效邮箱，仅用于告知审核结果'});
  const fp=crypto.createHmac('sha256',process.env.REPORT_RATE_SECRET).update(JSON.stringify([place_key,reason,detail,email.toLowerCase()])).digest('hex');
  try{
    const rows=await query(c,'place_appeals?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({place_key,city,place_name,reason,detail_private:detail,contact_email_private:email,submission_fingerprint:fp})});
    return res.status(201).json({status:'pending',id:rows[0]&&rows[0].id,message:'申诉已提交，管理员复核后会通过邮件告知结果'});
  }catch(e){
    if(e.code==='23505')return res.status(409).json({error:'相同内容的申诉已提交，请等待处理'});
    return res.status(503).json({error:'申诉暂时无法提交，请稍后再试'});
  }
};
