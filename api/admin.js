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
 if(!['GET','PATCH'].includes(req.method)){res.setHeader('Allow','GET, PATCH');return res.status(405).json({error:'Method not allowed'});}
 let identity;
 try{identity=await verify(c,String(req.headers.authorization||''));}
 catch{return res.status(503).json({error:'管理员身份验证暂不可用'});}
 if(!identity.ok)return res.status(identity.status).json({error:identity.mfa?'需要管理员双重验证':identity.status===403?'无审核权限':'请登录管理员账户'});
 try{
   if(req.method==='GET'){
     const rows=await db(c,'loss_reports?select=id,country,city,address_private,lat_private,lon_private,occurred_on,category,description_private,status,created_at,public_summary,reviewed_at,reviewed_by&order=created_at.desc&limit=100');
     const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
     let metrics=[],areas=[],leads=[];try{metrics=await db(c,'site_metrics_daily?select=day,metric,city,total&day=gte.'+since+'&limit=5000');areas=await db(c,'evidence_areas?status=eq.published&select=id&limit=500');leads=await db(c,'source_leads?status=eq.needs_review&select=id&limit=500');}catch{/* fails closed for metrics; still permit reviewing reports */}
     const totals={};const cities={};
     for(const x of metrics){totals[x.metric]=(totals[x.metric]||0)+Number(x.total||0);if(x.metric==='area_open'&&x.city)cities[x.city]=(cities[x.city]||0)+Number(x.total||0)}
     const top=Object.entries(cities).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([city,count])=>({city,count}));
     return res.status(200).json({rows,counts:{pending:rows.filter(x=>x.status==='pending').length,approved:rows.filter(x=>x.status==='approved').length,rejected:rows.filter(x=>x.status==='rejected').length},analytics:{totals,cities:top,publishedAreas:areas.length,waitingLeads:leads.length},note:'报告最近100条，网站指标近30天为匿名聚合次数、可受机器人影响'});
   }
   const p=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
   if(!UUID.test(String(p.id||''))||!['approved','rejected'].includes(p.status))return res.status(400).json({error:'审核参数无效'});
   const changes={status:p.status,reviewed_at:new Date().toISOString(),reviewed_by:identity.user.email,review_notes:String(p.review_notes||'').trim().slice(0,240)};
   if(p.status==='approved'){
     const summary=String(p.public_summary||'').trim();
     const lat=Number(p.display_lat),lon=Number(p.display_lon);
     if(summary.length<12||summary.length>240||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).json({error:'匿名摘要12–240字，且须填写近似区域坐标'});
     if(/[\w.+-]+@[\w-]+\.[\w.-]+/.test(summary)||/(?:\+?\d[\d\s-]{9,}\d)/.test(summary))return res.status(400).json({error:'摘要含疑似个人联系信息，请移除'});
     changes.public_summary=summary;changes.display_lat=+lat.toFixed(2);changes.display_lon=+lon.toFixed(2);
   }else{changes.public_summary=null;changes.display_lat=null;changes.display_lon=null;}
   // Only pending reports can be approved/rejected. DB trigger writes audit atomically.
   const changed=await db(c,'loss_reports?id=eq.'+p.id+'&status=eq.pending&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)});
   if(!changed.length)return res.status(409).json({error:'该报告已处理，刷新后查看'});
   return res.status(200).json({ok:true,id:p.id,status:p.status});
 }catch{return res.status(503).json({error:'管理服务不可用，请重试'});}
};
