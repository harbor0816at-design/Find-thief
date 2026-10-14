/* Chinese travelers' theft-prevention + response guide, friend sharing.
 No account, no sensitive data, no WeChat JS-SDK claims without valid platform credentials. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const D={
 '手机':[
 ['立即挂失设备','iPhone 可进入 iCloud.com/find 标记丢失；Android 可使用 Google Find Hub 锁定。不要亲自追踪嫌疑人。','https://support.apple.com/en-ie/120837','苹果失窃处理'],
 ['保护账号与SIM','联系手机运营商停用SIM，检查支付与邮箱登录记录，并使用可信设备更改关键账号密码。','https://support.google.com/android/answer/6160491','Android官方步骤'],
 ['保留证据与报警','记录最后看见手机的位置、时间、型号和序列号；向当地警方报案并保留报案回执。','https://support.apple.com/en-ie/120837','官方说明']
 ],
 '钱包':[
 ['立即冻结银行卡','在银行官方App中冻结银行卡、检查交易记录，必要时联系银行挂失及申请补卡；如发现盗刷立即报告。',null,null],
 ['遗失证件及时挂失','银行卡与身份文件一起丢失时，及时处理相关证件，避免冒用。',null,null],
 ['向当地警方报案','记录地点、时间、丢失清单与票据；联系保险公司了解理赔所需材料。','https://europa.eu/youreurope/citizens/travel/security-and-emergencies/emergency/index_en.htm','欧盟安全资讯']
 ],
 '护照证件':[
 ['先报警并保存报失凭证','记录证件最后出现的地点与时间，向当地警察机构了解报案手续并保存记录。',null,null],
 ['向中国使领馆申请旅行证或补发','短期赴海外中国公民护照遗失，可按适用情形通过“中国领事”APP向当地中国使领馆申请旅行证；办理材料和时间以使领馆公告为准。','https://www.mfa.gov.cn/wjbzwfwpt/byw/hzlxz/','中国外交部办理说明'],
 ['联系航空公司与住宿方','及时确认返程登机所需旅行文件，并准备护照照片、订票凭证或其他身份辅助材料；不要假设警方报失单可代替旅行证件。',null,null],
 ['确需领事协助时','拨打中国12308海外领事保护应急热线：+86-10-12308 或 +86-10-65612308。','https://cs.mfa.gov.cn/zggmcgx/lsbhyxz/12308lbrx/202607/t20260713_11981004.html','中国领事服务网']
 ],
 '背包行李':[
 ['马上联系场所失物招领','先联系车站、机场、酒店、餐馆或承运人，保留行李票、订单、物品特征。',null,null],
 ['疑似被盗及时报案','尽快回忆地点、时间、物品类别与金额；请求警方提供报案编号，供保险或后续补办使用。',null,null],
 ['及时处理随身证件与卡片','如包内有护照、银行卡、手机，分别按对应栏目处理；可联系旅行保险确认索赔手续。',null,null]
 ]
 };
 const P={
 '地铁公交':[
 ['背包放前胸','上下车、拥挤车厢和闸机附近将背包置于身前并拉好拉链；手机不放后裤袋。'],
 ['防止分散注意力','被突然撞击、搭话或围堵时先照看同行人与物品，不要与陌生人发生冲突。'],
 ['交通卡与现金分开放','将少量现金和备用卡与主要钱包分开，护照不要一直拿在手上。']
 ],
 '景区排队':[
 ['拍照前先收好手机和包','拍照、买票、看表演前先将包带收紧，避免把手机放在伸手可拿的外袋。'],
 ['别把物品放在地上','排队和临时休息时背包贴身，不把相机包交给陌生人看管。'],
 ['警惕突然的接触与搭话','遇到推挤、问卷或陌生人靠近，保持距离并留意个人物品。']
 ],
 '餐厅咖啡馆':[
 ['贵重物品不留在桌面','手机和钱包避免放在桌沿或椅背口袋；外套与包保持在视线和控制范围内。'],
 ['别把包挂在椅子背后','尤其是户外座位和人流密集街区，尽量将包放在身体一侧并固定带子。'],
 ['结账时保护卡片','优先使用正规付款终端，核对金额；避免陌生人以协助支付为名拿走卡片。']
 ],
 '入住出行':[
 ['护照与备用卡分开放','准备证件电子备份，并放在安全位置；电子备份不能代替正式旅行证件。'],
 ['下车先确认行李','出租车、火车、酒店大堂等转场位置，离开前清点手机、证件与行李。'],
 ['预设紧急联系人','给同行人留下酒店地址和联系方式；在网络允许时准备离线地图和本地警方联系方式。']
 ]
 };
 function renderTabs(containerId,contentId,data,key){
  const bar=$(containerId),panel=$(contentId);if(!bar||!panel)return;
  function render(chosen){
   bar.querySelectorAll('button').forEach(b=>{const on=b.dataset[key]===chosen;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
   panel.innerHTML=(data[chosen]||[]).map((step,i)=>'<article class="guide-action-card"><b>'+(i+1)+'. '+step[0]+'</b><p>'+step[1]+'</p>'+(step[2]?'<a href="'+step[2]+'" target="_blank" rel="noopener noreferrer">'+step[3]+' ↗</a>':'')+'</article>').join('');
  }
  bar.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>render(b.dataset[key])));
  render(bar.querySelector('button.active')?.dataset[key]||Object.keys(data)[0]);
 }
 function isWx(){return /MicroMessenger/i.test(navigator.userAgent||'')}
 function activeName(){const obj=window.FindThiefUI;return obj?.getCity?.()||''}
 function targetLink(){let suffix='';
  if(!$('blackoutView')?.hidden)suffix='#guide=blackout';
  else if(!$('recoveryView')?.hidden)suffix='#guide=recovery';
  else if(!$('preventionView')?.hidden)suffix='#guide=prevention';
  else if(!$('exploreView')?.hidden&&activeName())suffix='#city='+encodeURIComponent(activeName());
  return location.origin+location.pathname+suffix;
 }
 function description(){return (!$('blackoutView')?.hidden)?'欧洲旅行防窃黑化训练':(!$('preventionView')?.hidden)?'欧洲旅行防窃实用清单':(!$('recoveryView')?.hidden)?'欧洲旅行失窃后紧急处理指南':(activeName()?activeName()+'附近盗窃证据和提醒':'查欧洲盗窃区域与匿名失物提醒')}
 function openShare(){
  const modal=$('shareModal');if(!modal)return;
  const wechat=isWx();$('shareFeedback').textContent='';
  $('shareHint').textContent=wechat?'你正在微信内。点击右上角「···」→「发送给朋友」即可分享当前网页。':'手机支持系统分享时，可在下方直接选择微信；也可以复制链接发到微信群或好友。';
  modal.showModal();
 }
 async function copyLink(){
  const value=targetLink();
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return true}}
  catch(_){}
  const input=document.createElement('textarea');input.value=value;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
  let ok=false;try{ok=document.execCommand('copy')}catch(_){}
  input.remove();return ok;
 }
 async function nativeShare(){
  if(typeof navigator.share==='function'){
   try{await navigator.share({title:'小偷在哪里',text:description(),url:targetLink()});$('shareFeedback').textContent='已调出系统分享';return}
   catch(e){if(e?.name==='AbortError')return}
  }
  const copied=await copyLink();$('shareFeedback').textContent=copied?'已复制链接，请在微信聊天中粘贴并发送。':'当前浏览器无法自动分享，请使用右上角菜单分享本网页。';
 }
 async function wechatShare(){
  if(isWx()){
   $('shareFeedback').textContent='微信内请点右上角「···」→「发送给朋友」；本网页尚未配置微信JS-SDK，不能绕过微信授权直接发送。';
   try{window.WeixinJSBridge?.call?.('showOptionMenu')}catch(_){}
  }else await nativeShare();
 }
 function openGuide(which){
  window.FindThiefUI?.button?.(which);
  history.replaceState(null,'',location.pathname+'#guide='+which);
 }
 function init(){
  renderTabs('lossGuideTabs','lossGuideContent',D,'loss');
  renderTabs('preventionTabs','preventionContent',P,'prevent');
  $('btnRecovery')?.addEventListener('click',()=>openGuide('recovery'));
  $('btnPrevention')?.addEventListener('click',()=>openGuide('prevention'));
  $('btnBlackout')?.addEventListener('click',()=>openGuide('blackout'));
  $('shareBlackout')?.addEventListener('click',openShare);
  $('btnExplore')?.addEventListener('click',()=>{if(location.hash.startsWith('#guide='))history.replaceState(null,'',location.pathname)});
  $('btnReport')?.addEventListener('click',()=>{if(location.hash.startsWith('#guide='))history.replaceState(null,'',location.pathname)});
  $('shareTrigger')?.addEventListener('click',openShare);
  $('shareRecovery')?.addEventListener('click',openShare);
  $('sharePrevention')?.addEventListener('click',openShare);
  $('openExploreFromGuide')?.addEventListener('click',()=>window.FindThiefUI?.button?.('explore'));
  $('closeShare')?.addEventListener('click',()=>$('shareModal').close());
  $('shareModal')?.addEventListener('click',e=>{if(e.target===$('shareModal'))$('shareModal').close()});
  $('wechatShare')?.addEventListener('click',wechatShare);
  $('nativeShare')?.addEventListener('click',nativeShare);
  $('copyShare')?.addEventListener('click',async()=>{$('shareFeedback').textContent=await copyLink()?'链接已复制，可发送给微信朋友。':'复制失败，请使用浏览器分享功能。'});
  // Deep links should open the exact emergency / prevention guide from WeChat.
  const deep=location.hash.match(/^#guide=(recovery|prevention|blackout)$/);
  if(deep)window.FindThiefUI?.button?.(deep[1]);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
