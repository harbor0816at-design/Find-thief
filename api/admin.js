const crypto=require('node:crypto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function conf(){
 const u=process.env.SUPABASE_URL,secret=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY),pub=process.env.SUPABASE_PUBLISHABLE_KEY;
 return u&&secret&&pub&&process.env.ADMIN_EMAILS?{u:u.replace(/\/$/,''),secret,pub}:null;
}
async function db(c,p,opt={}){
 const r=await fetch(c.u+'/rest/v1/'+p,{...opt,headers:{apikey:c.secret,...(c.secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+c.secret}),'Content-Type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Database unavailable: '+r.status);
 return r.json().catch(()=>[]);
}
async function verify(c,auth){
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return {ok:false,status:401};
 const r=await fetch(c.u+'/auth/v1/user',{headers:{Authorization:auth,apikey:c.pub},signal:AbortSignal.timeout(7000)});
 if(!r.ok)return {ok:false,status:401};
 const u=await r.json();
 const allowed=(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!u.id||!u.email||!u.email_confirmed_at||!allowed.includes(u.email.toLowerCase()))return {ok:false,status:403};
 // Optional strict MFA policy after all reviewers enroll a second factor.
 if(process.env.REQUIRE_ADMIN_MFA==='true'){
   try{const jwt=auth.split(' ')[1].split('.')[1];const claims=JSON.parse(Buffer.from(jwt,'base64url').toString('utf8'));if(claims.aal!=='aal2')return {ok:false,status:403,mfa:true};}
   catch{return {ok:false,status:401};}
 }
 return {ok:true,user:u};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const c=conf();if(!c)return res.status(503).json({error:'管理员服务尚未配置'});
 if(!['GET','PATCH','POST'].includes(req.method)){res.setHeader('Allow','GET, PATCH, POST');return res.status(405).json({error:'Method not allowed'});}
 let identity;
 try{identity=await verify(c,String(req.headers.authorization||''));}
 catch{return res.status(503).json({error:'管理员身份验证暂不可用'});}
 if(!identity.ok)return res.status(identity.status).json({error:identity.mfa?'需要管理员双重验证':identity.status===403?'无审核权限':'请登录管理员账户'});
 try{
   if(req.method==='GET'){
     const rows=await db(c,'loss_reports?select=id,country,city,address_private,lat_private,lon_private,occurred_on,category,item_category,spot_name_private,spot_name_public,description_private,status,created_at,public_summary,reviewed_at,reviewed_by&order=created_at.desc&limit=100');
     const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
     let metrics=[],areas=[],leads=[],advice=[],stagedEvents=[];try{metrics=await db(c,'site_metrics_daily?select=day,metric,city,total&day=gte.'+since+'&limit=5000');areas=await db(c,'evidence_areas?status=eq.published&select=id&limit=500');leads=await db(c,'source_leads?status=eq.needs_review&select=id&limit=500');advice=await db(c,'travel_advisories?status=eq.published&select=id&limit=300');stagedEvents=await db(c,'evidence_events_v2?review_status=eq.staging&select=id,country,city,spot_name,event_kind,source_type,source_title,source_url,source_published_on,occurred_on,occurred_precision,item_category,short_summary,confidence,location_precision&order=created_at.desc&limit=60');}catch{/* fails closed for metrics; still permit reviewing reports */}
     const totals={};const cities={};
     for(const x of metrics){totals[x.metric]=(totals[x.metric]||0)+Number(x.total||0);if(x.metric==='area_open'&&x.city)cities[x.city]=(cities[x.city]||0)+Number(x.total||0)}
     const top=Object.entries(cities).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([city,count])=>({city,count}));
     return res.status(200).json({rows,stagedEvents,counts:{pending:rows.filter(x=>x.status==='pending').length,approved:rows.filter(x=>x.status==='approved').length,rejected:rows.filter(x=>x.status==='rejected').length},analytics:{totals,cities:top,publishedAreas:areas.length,waitingLeads:leads.length,publishedAdvisories:advice.length,pendingEvidence:stagedEvents.length},note:'报告最近100条，网站指标近30天为匿名聚合次数、可受机器人影响'});
   }
   const p=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
   if(req.method==='POST'){
     if(p.action!=='stage_event')return res.status(400).json({error:'未识别的线索录入请求'});
     const take=(v,n)=>typeof v==='string'?v.trim().slice(0,n+1):'';
     const country=take(p.country,60),city=take(p.city,100),spot_name=take(p.spot_name,100)||null;
     const title=take(p.source_title,220),summary=take(p.short_summary,200),note=take(p.evidence_note,350);
     const source_type=take(p.source_type,35),event_kind=take(p.event_kind,35);
     const allowedSources=['official_case','consular_case','journalism_case','moderated_report'];
     const allowedEvents=['confirmed_theft','alleged_theft','loss','safety_mention'];
     const items=['手机','钱包','护照证件','背包行李','银行卡现金','相机电子设备','首饰','其他物品','智能手表','耳机','笔记本电脑','行李箱','钥匙'];
     const item=take(p.item_category,30)||null;
     let url;try{url=new URL(String(p.source_url||''));if(url.protocol!=='https:'||url.username||url.password)throw Error('bad');}catch{return res.status(400).json({error:'请填写可公开核实的 HTTPS 来源链接'});}
     const occurrence=take(p.occurred_on,10)||null,publication=take(p.source_published_on,10)||null;
     const validDate=v=>v===null||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10));
     const privatePattern=/[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\d\s-]{9,}\d)/;
     if(country.length<2||city.length<1||title.length<2||summary.length<5||note.length<5||!allowedSources.includes(source_type)||!allowedEvents.includes(event_kind)||item&&!items.includes(item)||!validDate(occurrence)||!validDate(publication)||(!occurrence&&!publication)||(event_kind==='confirmed_theft'&&source_type!=='official_case')||privatePattern.test([spot_name,title,summary,note].join(' ')))return res.status(400).json({error:'请检查来源、时间、事件描述，且不要包含任何个人联系方式'});
     // No automatic publication; coordinates are optional and rounded to approximate grid precision.
     const lat=p.lat==null||p.lat===''?null:Number(p.lat),lon=p.lon==null||p.lon===''?null:Number(p.lon);
     if((lat===null)!==(lon===null)||lat!==null&&(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))return res.status(400).json({error:'坐标无效'});
     const record={
       external_ref:crypto.createHash('sha256').update([url.href,city,spot_name||'',occurrence||'',item||'',event_kind].join('|')).digest('hex'),
       country,city,spot_name,event_kind,source_type,source_title:title,source_url:url.href,source_published_on:publication,occurred_on:occurrence,
       occurred_precision:occurrence?'day':'unknown',
       lat:lat===null?null:+lat.toFixed(2),lon:lon===null?null:+lon.toFixed(2),
       location_precision:lat===null?'unknown':'approx_area',radius_m:lat===null?null:750,
       item_category:item,short_summary:summary,evidence_note:note,
       confidence:source_type==='official_case'?'official_record':'reported_claim',review_status:'staging'
     };
     const data=await db(c,'evidence_events_v2?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(record)});
     return res.status(201).json({id:data[0]?.id,status:'staging',message:'仅进入待审核事件库，未对公众发布'});
   }
   if(p.kind==='event_v2'){
     if(!UUID.test(String(p.id||''))||!['approved','rejected'].includes(p.status))return res.status(400).json({error:'事件审核参数无效'});
     if(p.status==='approved'&&p.confirm_source!==true)return res.status(400).json({error:'请先人工核对来源原文及案发地点和日期'});
     if(p.status==='approved'){
       const staged=await db(c,'evidence_events_v2?id=eq.'+p.id+'&review_status=eq.staging&select=id,event_kind,source_published_on,occurred_on&limit=1');
       if(!staged.length)return res.status(409).json({error:'事件不存在或已经处理'});
       if(staged[0].event_kind==='safety_mention'||(!staged[0].source_published_on&&!staged[0].occurred_on))return res.status(400).json({error:'一般安全提醒不得当作具体盗窃案件发布；必须有真实事件及可核查日期'});
     }
     const edits={review_status:p.status,reviewed_at:new Date().toISOString(),reviewed_by:identity.user.email};
     const updated=await db(c,'evidence_events_v2?id=eq.'+p.id+'&review_status=eq.staging&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(edits)});
     if(!updated.length)return res.status(409).json({error:'事件已处理，请刷新'});
     return res.status(200).json({ok:true,id:p.id,review_status:p.status});
   }

   if(!UUID.test(String(p.id||''))||!['approved','rejected'].includes(p.status))return res.status(400).json({error:'审核参数无效'});
   const changes={status:p.status,reviewed_at:new Date().toISOString(),reviewed_by:identity.user.email,review_notes:String(p.review_notes||'').trim().slice(0,240)};
   if(p.status==='approved'){
     const summary=String(p.public_summary||'').trim();
     const lat=Number(p.display_lat),lon=Number(p.display_lon);
     if(summary.length<12||summary.length>240||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).json({error:'匿名摘要12–240字，且须填写近似区域坐标'});
     if(/[\w.+-]+@[\w-]+\.[\w.-]+/.test(summary)||/(?:\+?\d[\d\s-]{9,}\d)/.test(summary))return res.status(400).json({error:'摘要含疑似个人联系信息，请移除'});
     changes.public_summary=summary;changes.display_lat=+lat.toFixed(2);changes.display_lon=+lon.toFixed(2);changes.spot_name_public=String(p.spot_name_public||'').trim().slice(0,100)||null;
   }else{changes.public_summary=null;changes.display_lat=null;changes.display_lon=null;changes.spot_name_public=null;}
   // Only pending reports can be approved/rejected. DB trigger writes audit atomically.
   const changed=await db(c,'loss_reports?id=eq.'+p.id+'&status=eq.pending&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)});
   if(!changed.length)return res.status(409).json({error:'该报告已处理，刷新后查看'});
   return res.status(200).json({ok:true,id:p.id,status:p.status});
 }catch{return res.status(503).json({error:'管理服务不可用，请重试'});}
};
