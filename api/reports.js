const crypto = require('node:crypto');
const categories = new Set(['物品遗失','疑似扒窃','已报警确认失窃','其他物品安全事件']);
const jsonHeader={'Content-Type':'application/json'};
function cfg() {
  const u=process.env.SUPABASE_URL, k=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY);
  return u && k && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u) ? {u:u.replace(/\/$/,''),k} : null;
}
const live=()=>Boolean(cfg() && process.env.ENABLE_PUBLIC_REPORTING==='true' && process.env.REPORT_RATE_SECRET && process.env.DATA_CONTROLLER_EMAIL && process.env.DATA_CONTROLLER_NAME && process.env.CRON_SECRET);
function clean(v,max){return typeof v==='string'?v.trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max+1):''}
function validCoordinate(x,limit){return x===null||typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=limit}
async function query(c,path,opt={}){
  const r=await fetch(c.u+'/rest/v1/'+path,{...opt,headers:{apikey:c.k,...(c.k.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+c.k}),Accept:'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(7000)});
  if(!r.ok){let errorCode='';try{errorCode=(await r.json()).code||''}catch{};const error=new Error('DB_'+r.status);error.status=r.status;error.code=errorCode;throw error;}
  return await r.json().catch(()=>[]);
}
function fingerprint(report){
  // Repeat-content dedupe without reading or storing IP, user-agent, cookies or accounts.
  return crypto.createHmac('sha256',process.env.REPORT_RATE_SECRET)
   .update(JSON.stringify([report.country,report.city,report.address,report.date,report.type,report.description]))
   .digest('hex');
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const c=cfg();
  if(req.method==='GET'){
    if(!c)return res.status(200).json({enabled:false,items:[],message:'尚无独立的在线事件库'});
    try{
      const items=await query(c,'loss_reports?status=eq.approved&select=id,country,city,category,occurred_on,created_at,public_summary,display_lat,display_lon&order=occurred_on.desc&limit=150');
      return res.status(200).json({enabled:true,items});
    }catch{return res.status(503).json({error:'暂时无法读取审核记录'});}
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  if(!live())return res.status(503).json({error:'线上上报尚未开放，当前可保存本机记录'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'仅支持JSON格式'});
  const origin=String(req.headers.origin||'');
  if(origin && origin!=='https://find-thief.vercel.app' && !(process.env.ALLOWED_REPORT_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin))return res.status(403).json({error:'提交来源不允许'});
  if(Number(req.headers['content-length']||0)>8192)return res.status(413).json({error:'内容过大'});
  const d=req.body && typeof req.body==='object' && !Array.isArray(req.body)?req.body:{};
  if(d.website)return res.status(202).json({status:'accepted'}); // honeypot
  if(d.consent!==true)return res.status(400).json({error:'提交前请阅读并同意隐私说明'});
  const country=clean(d.country,60),city=clean(d.city,100),address=clean(d.address,160),description=clean(d.description,800),type=d.type;
  const date=clean(d.date,10);let lat=d.lat==null||d.lat===''?null:Number(d.lat),lon=d.lon==null||d.lon===''?null:Number(d.lon);
  if(!country||!city||address.length<6||description.length<12||address.length>160||description.length>800||!categories.has(type))return res.status(400).json({error:'请提供完整且不含个人身份信息的地点及经过'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date || date>new Date().toISOString().slice(0,10))return res.status(400).json({error:'日期无效'});
  // Avoid unbounded personally identifiable text in report descriptions.
  if(/[\w.+-]+@[\w-]+\.[\w.-]+/.test(description)||/(?:\+?\d[\d\s-]{9,}\d)/.test(description))return res.status(400).json({error:'请删除邮箱、电话号码和其他个人信息后重新提交'});
  if(!validCoordinate(lat,90)||!validCoordinate(lon,180)||((lat===null)!==(lon===null)))return res.status(400).json({error:'地图坐标无效'});
  try{
    const report={country,city,address_private:address,description_private:description,occurred_on:date,category:type,lat_private:lat,lon_private:lon,status:'pending',consent_at:new Date().toISOString(),submission_fingerprint:fingerprint({country,city,address,date,type,description}),submission_bucket:Math.floor(Date.now()/600000)};
    const rows=await query(c,'loss_reports?select=id',{method:'POST',headers:{...jsonHeader,Prefer:'return=representation'},body:JSON.stringify(report)});
    try{await fetch(c.u+'/rest/v1/rpc/count_site_metric',{method:'POST',headers:{apikey:c.k,...(c.k.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+c.k}),'Content-Type':'application/json'},body:JSON.stringify({event_name:'report_received',event_city:city}),signal:AbortSignal.timeout(2200)})}catch{/* reporting succeeds even if metrics fail */}
    return res.status(201).json({status:'pending',receipt:rows[0]?.id||null,message:'已收到，待人工审核；不会立即公开'});
  }catch(e){
    if(e.code==='23505')return res.status(429).json({error:'相同内容近期已提交，请十分钟后再试'});
    return res.status(503).json({error:'上报服务暂不可用，可先保存本机草稿'});
  }
};
