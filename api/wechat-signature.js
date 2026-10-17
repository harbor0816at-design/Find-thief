// Optional official WeChat JS-SDK signature. Requires the owner's verified Official Account,
// WECHAT_APP_ID and WECHAT_APP_SECRET configured as sensitive Vercel environment variables.
// Do not cache visitor URLs, cookies, IPs or other identity; token/ticket kept in memory.
const crypto=require('node:crypto');
let cache={token:null,ticket:null,until:0};
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const appId=process.env.WECHAT_APP_ID,secret=process.env.WECHAT_APP_SECRET;
 if(!appId||!secret)return res.status(200).json({configured:false,reason:'微信公众平台尚未完成授权配置'});
 if(!/^[A-Za-z0-9_-]{6,80}$/.test(appId))return res.status(503).json({configured:false,error:'Invalid WeChat account configuration'});
 const raw=typeof req.query?.url==='string'?req.query.url:'';
 let url;try{url=new URL(raw)}catch{return res.status(400).json({error:'URL invalid'})}
 if(url.protocol!=='https:'||url.origin!=='https://find-thief.vercel.app'||url.username||url.password||raw.length>350)return res.status(400).json({error:'Invalid share URL'});
 url.hash='';
 const get=async target=>{
  const r=await fetch(target,{signal:AbortSignal.timeout(7000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('WeChat unreachable');
  const j=await r.json();if(j.errcode&&j.errcode!==0)throw Error('WeChat API error '+j.errcode);return j;
 };
 try{
  if(!cache.ticket||cache.until<Date.now()){
   const token=await get('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+encodeURIComponent(appId)+'&secret='+encodeURIComponent(secret));
   if(!token.access_token)throw Error('Missing WeChat token');
   const ticket=await get('https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token='+encodeURIComponent(token.access_token));
   if(!ticket.ticket)throw Error('Missing WeChat ticket');
   cache={token:token.access_token,ticket:ticket.ticket,until:Date.now()+Math.min(6500,Number(ticket.expires_in||7200)-400)*1000};
  }
  const timestamp=Math.floor(Date.now()/1000),nonceStr=crypto.randomBytes(10).toString('hex');
  const str='jsapi_ticket='+cache.ticket+'&noncestr='+nonceStr+'&timestamp='+timestamp+'&url='+url.toString();
  const signature=crypto.createHash('sha1').update(str,'utf8').digest('hex');
  return res.status(200).json({configured:true,appId,timestamp,nonceStr,signature});
 }catch{
  return res.status(503).json({configured:false,error:'微信签名暂不可用，仍可使用系统分享或复制链接'});
 }
};
