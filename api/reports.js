const categories = new Set(['物品遗失','疑似扒窃','已报警确认失窃','其他物品安全事件']);
function cfg(){const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;return u&&k?{u:u.replace(/\/$/,''),k}:null;}
function escapeSensitive(t){return String(t||'').trim().replace(/[\x00-\x1f\x7f]/g,' ')}
async function db(c,path,options={}){const r=await fetch(c.u+'/rest/v1/'+path,{...options,headers:{apikey:c.k,Authorization:'Bearer '+c.k,Accept:'application/json',...(options.headers||{})}});if(!r.ok)throw new Error('Database request failed: '+r.status);return {data:await r.json().catch(()=>[]),headers:r.headers}}
const recent=new Map();
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const c=cfg();
  if(req.method==='GET'){
    if(!c)return res.status(200).json({enabled:false,items:[],message:'在线事件库尚未配置'});
    try{const v=await db(c,'loss_reports?status=eq.approved&select=id,country,city,category,occurred_on,created_at,public_summary,display_lat,display_lon&order=created_at.desc&limit=150');return res.status(200).json({enabled:true,items:v.data})}
    catch{return res.status(503).json({error:'当前无法读取已审核报告'})}
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!c||process.env.ENABLE_PUBLIC_REPORTING!=='true')return res.status(503).json({error:'线上上报尚未开放，可暂存到本机。'});
  const len=Number(req.headers['content-length']||0);if(len>9000)return res.status(413).json({error:'提交内容过大'});
  const d=req.body&&typeof req.body==='object'?req.body:{};
  if(d.website)return res.status(201).json({status:'accepted'}); // honeypot for simple spambots
  const country=escapeSensitive(d.country),city=escapeSensitive(d.city),address=escapeSensitive(d.address),description=escapeSensitive(d.description);
  if(country.length<1||country.length>60||city.length<1||city.length>100||address.length<6||address.length>160||description.length<12||description.length>800||!categories.has(d.type))return res.status(400).json({error:'请填写具体地址、类别和完整经过，避免输入个人信息'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||d.date>new Date().toISOString().slice(0,10))return res.status(400).json({error:'日期不正确'});
  const lat=d.lat==null?null:Number(d.lat),lon=d.lon==null?null:Number(d.lon);
  if((lat!==null||lon!==null)&&(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))return res.status(400).json({error:'地图坐标不正确'});
  // In-memory throttle is best effort; configure WAF / rate limits and bot protection prior to marketing launch.
  const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'anonymous').split(',')[0].slice(0,96);
  const now=Date.now(),arr=(recent.get(ip)||[]).filter(t=>now-t<3600000);if(arr.length>=5)return res.status(429).json({error:'提交太频繁，请稍后再试'});arr.push(now);recent.set(ip,arr);if(recent.size>10000)recent.clear();
  try{
    const report={country,city,address_private:address,description_private:description,occurred_on:d.date,category:d.type,lat_private:lat,lon_private:lon,status:'pending'};
    await db(c,'loss_reports',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(report)});
    return res.status(201).json({status:'pending',message:'已收到，等待人工审核'})
  }catch{return res.status(503).json({error:'提交服务暂不可用，建议先保存本机记录。'})}
};