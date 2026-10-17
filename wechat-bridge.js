/* Official WeChat Share: activates only after verified Official Account credentials. */
(()=>{'use strict';let ready=false,initialized=false;const inWx=/MicroMessenger/i.test(navigator.userAgent||'');
const title=()=> '小偷在哪里 · 欧洲防扒实况避雷雷达';
const destination=()=>window.StitchEnhanceV23?.shareLink?.()||'https://fangbaleida.com/';
const description='查看有出处的欧洲失窃案例，分享防扒避雷提醒。2公里仅为地图展示圈，非犯罪影响范围。';
const image=()=> 'https://fangbaleida.com/stitch-assets/safety-illustration.webp';
function update(){
 if(!ready||!window.wx)return;const data={title:title(),desc:description,link:destination(),imgUrl:image(),
  success:()=>{const label=document.getElementById('stitch-share-message');if(label)label.textContent='已在微信内准备分享卡片，请在分享菜单中选择朋友并确认发送。';}};
 try{window.wx.updateAppMessageShareData(data);window.wx.updateTimelineShareData(data)}catch{}
}
function loadSdk(){
 if(initialized)return;initialized=true;
 const el=document.createElement('script');el.src='https://res.wx.qq.com/open/js/jweixin-1.6.0.js';el.async=true;
 el.onload=async()=>{
  try{
   const response=await fetch('/api/wechat-signature?url='+encodeURIComponent(location.href.split('#')[0]),{cache:'no-store'});
   if(!response.ok)return;const conf=await response.json();if(!conf.configured)return;
   window.wx.config({debug:false,appId:conf.appId,timestamp:conf.timestamp,nonceStr:conf.nonceStr,signature:conf.signature,jsApiList:['updateAppMessageShareData','updateTimelineShareData']});
   window.wx.ready(()=>{ready=true;update()});
   window.wx.error(()=>{ready=false});
  }catch{}
 };
 document.head.append(el);
}
async function init(){
 if(!inWx)return;
 // Avoid loading SDK and querying WeChat APIs unless the owner has set up credentials.
 try{const r=await fetch('/api/wechat-signature?url='+encodeURIComponent(location.href.split('#')[0]),{cache:'no-store'});const conf=await r.json();if(!r.ok||!conf.configured)return;
  // SDK requires valid signature for this exact page address.
  if(initialized)return;initialized=true;
  const script=document.createElement('script');script.src='https://res.wx.qq.com/open/js/jweixin-1.6.0.js';script.async=true;
  script.onload=()=>{window.wx?.config({debug:false,appId:conf.appId,timestamp:conf.timestamp,nonceStr:conf.nonceStr,signature:conf.signature,jsApiList:['updateAppMessageShareData','updateTimelineShareData']});window.wx?.ready(()=>{ready=true;update()});window.wx?.error(()=>{ready=false})};
  document.head.append(script);
 }catch{}
}
window.StitchWechatShare={update,get ready(){return ready}};
document.addEventListener('click',e=>{if(e.target.closest('.city-btn'))setTimeout(update,120)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
