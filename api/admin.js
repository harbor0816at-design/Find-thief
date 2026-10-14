function conf(){const u=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY,pub=process.env.SUPABASE_PUBLISHABLE_KEY;return u&&secret&&pub&&process.env.ADMIN_EMAILS?{u:u.replace(/\/$/,''),secret,pub}:null}
async function query(c,p,opt={}){const r=await fetch(c.u+'/rest/v1/'+p,{...opt,headers:{apikey:c.secret,Authorization:'Bearer '+c.secret,'Content-Type':'application/json',...(opt.headers||{})}});if(!r.ok)throw new Error('DB_'+r.status);return r.json().catch(()=>[])}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');const c=conf();if(!c)return res.status(503).json({error:'管理员验证尚未配置'});
 const authorization=String(req.headers.authorization||'');if(!authorization.startsWith('Bearer '))return res.status(401).json({error:'需要管理员登录'});
 try{
   const r=await fetch(c.u+'/auth/v1/user',{headers:{Authorization:authorization,apikey:c.pub}});if(!r.ok)return res.status(401).json({error:'登录凭证已失效'});const u=await r.json();
   const allowed=String(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase());if(!u.email||!u.email_confirmed_at||!allowed.includes(u.email.toLowerCase()))return res.status(403).json({error:'此账户没有管理员权限'});
   if(req.method==='GET'){
     const rows=await query(c,'loss_reports?select=id,country,city,address_private,lat_private,lon_private,occurred_on,category,description_private,status,created_at,public_summary&order=created_at.desc&limit=100');
     return res.status(200).json({rows,counts:{pending:rows.filter(x=>x.status==='pending').length,approved:rows.filter(x=>x.status==='approved').length,rejected:rows.filter(x=>x.status==='rejected').length},note:'counts cover latest 100 reports'})
   }
   if(req.method==='PATCH'){
     const p=req.body||{};if(!/^[a-f0-9-]{36}$/i.test(String(p.id||''))||!['approved','rejected'].includes(p.status))return res.status(400).json({error:'请求格式错误'});
     let changes={status:p.status,reviewed_at:new Date().toISOString(),reviewed_by:u.email,review_notes:String(p.review_notes||'').slice(0,240)};
     if(p.status==='approved'){
       const summary=String(p.public_summary||'').trim();if(summary.length<12||summary.length>240)return res.status(400).json({error:'请提供12–240字匿名公开摘要，不可包含个人信息'});
       const lat=p.display_lat==null?null:Number(p.display_lat),lon=p.display_lon==null?null:Number(p.display_lon);
       if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).json({error:'公开点需设置近似区域中心坐标'});
       changes.public_summary=summary;
       changes.display_lat=+lat.toFixed(2);changes.display_lon=+lon.toFixed(2); // ~1km coordinate privacy generalization
     }else{changes.public_summary=null;changes.display_lat=null;changes.display_lon=null}
     await query(c,'loss_reports?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(changes)});
     await query(c,'moderation_audit',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({report_id:p.id,action:p.status,admin_email:u.email})});
     return res.status(200).json({ok:true});
   }
   return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(503).json({error:'暂时无法访问管理服务'})}
}