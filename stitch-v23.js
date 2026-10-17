/* Stitch actions V2.3: responsive art, contextual names, product selection and sharing. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const cities={rome:'罗马',paris:'巴黎',barcelona:'巴塞罗那',milan:'米兰',london:'伦敦',florence:'佛罗伦萨'};
let chosen='rome',spot='',gear=new Set(),ready=false;
const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isWx=()=>/MicroMessenger/i.test(navigator.userAgent||'');
function metric(name,dimension=''){const payload=JSON.stringify({event:name,city:String(dimension).slice(0,80)});try{if(navigator.sendBeacon?.('/api/metrics',new Blob([payload],{type:'application/json'})))return}catch{}fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true}).catch(()=>{})}
function copy(s){if(navigator.clipboard&&isSecureContext)return navigator.clipboard.writeText(s).then(()=>true).catch(()=>legacyCopy(s));return Promise.resolve(legacyCopy(s))}
function legacyCopy(s){const el=document.createElement('textarea');el.value=s;el.style.position='fixed';el.style.left='-9999px';document.body.append(el);el.select();let ok=false;try{ok=document.execCommand('copy')}catch{}el.remove();return ok}
function updateHead(city,area=''){
 if(!cities[city])return;chosen=city;spot=area;
 for(const h of document.querySelectorAll('h2'))if(/实况避雷雷达/.test(h.textContent)){h.textContent=cities[city]+(area?' · '+area:'')+'实况避雷雷达';h.title='按所选城市、区域与物品类别显示公开来源'}
 const box=$('stitch-selected-area');if(box)box.textContent=area?'当前区域：'+cities[city]+' · '+area+'。2公里圈只是地图展示缓冲区，并非案发影响范围。':'当前查询：'+cities[city]+'；切换城市或点击案例来源即可查看该地区信息。';
 document.title=cities[city]+'实况避雷雷达 · 小偷在哪里';
}
function makePictures(){
 if(!location.pathname.includes('stitch-mobile'))return;
 for(const [heading,path,label] of [['丢了别慌！生活急救盒','safety-illustration.webp','失窃后应对插画'],['战术防窃黑话与秘籍','anti-theft-gear.webp','防扒装备示意插画']]){
  const title=[...document.querySelectorAll('h2')].find(x=>x.textContent.includes(heading));if(!title)continue;
  const card=title.closest('.rounded-3xl');if(!card||card.querySelector('.stitch-mobile-art'))continue;
  const figure=document.createElement('figure');figure.className='stitch-mobile-art';
  figure.innerHTML='<img src="/stitch-assets/'+path+'" alt="'+label+'" width="1200" height="675" loading="lazy" decoding="async"><figcaption>'+label+' · 保留设计原图比例</figcaption>';
  const headingRow=title.parentElement?.parentElement?.parentElement;
  if(headingRow?.parentElement===card)headingRow.insertAdjacentElement('afterend',figure);else card.insertBefore(figure,card.children[1]||null);
 }
}
const products=[
 ['zip','拉链防盗扣 / S扣','地铁换乘 · 排队','让背包拉链更难被随手打开。优先选择易自用、不会卡住紧急取物的扣具。','防盗拉链扣 S扣'],
 ['bag','贴身防割斜挎包','景区拍照 · 街区步行','关注隐藏拉链、稳定背带和贴身背法；不是标注“防盗”就能保证安全。','防割 防盗 斜挎包 锁扣'],
 ['phone','手机防丢绳','手机导航 · 拍照','降低手机意外滑落及顺手被拿走的风险，但不能抵御暴力抢夺。','可拆卸 手机防丢绳'],
 ['wallet','隐形腰包 / 证件袋','火车出行 · 转场','分开放备用卡、护照与零钱，不建议把所有现金集中在一个随身包。','旅行贴身证件袋 隐形腰包']
];
function recommendations(){
 if($('stitch-gear'))return;
 const title=[...document.querySelectorAll('h2,h3')].find(h=>/战术防窃黑话与秘籍|战术防窃黑话宝典/.test(h.textContent));
 const card=title?.closest('.rounded-3xl')||title?.parentElement?.parentElement;if(!card)return;
 const section=document.createElement('section');section.id='stitch-gear';section.className='stitch-gear';section.setAttribute('aria-label','防扒好物推荐');
 section.innerHTML='<h3>🎒 防扒好物推荐</h3><p>不是越贵越安全。按具体出行情景推荐四类低门槛防护用品，不设虚构销量、价格、评分或广告排名。</p><div class="stitch-gear-grid">'+
 products.map(([id,name,scenario,why])=>'<article class="stitch-good"><small>'+H(scenario)+'</small><h4>'+H(name)+'</h4><p>'+H(why)+'</p><button type="button" data-good="'+id+'">＋ 加入出行清单</button> <button type="button" data-search="'+id+'">复制选购关键词</button></article>').join('')+
 '</div><button class="stitch-gear-copy" type="button" id="stitch-gear-copy">📋 复制防扒购物清单</button><p class="stitch-gear-note">免费选购方向，无付费商家排名。购买前可在常用平台比较材质、功能、退换货条件。</p>';
 card.append(section);
 section.querySelectorAll('[data-good]').forEach(b=>b.onclick=()=>{let k=b.dataset.good;if(gear.has(k)){gear.delete(k);b.textContent='＋ 加入出行清单';b.classList.remove('selected')}else{gear.add(k);b.textContent='✓ 已加入清单';b.classList.add('selected');metric('gear_add','装备:'+k)}});
 section.querySelectorAll('[data-search]').forEach(b=>b.onclick=async()=>{const p=products.find(x=>x[0]===b.dataset.search);const ok=await copy(p[4]);metric('gear_copy','装备:'+p[0]);b.textContent=ok?'关键词已复制':'请手动复制关键词';setTimeout(()=>b.textContent='复制选购关键词',2000)});
 $('stitch-gear-copy').onclick=async()=>{const all=products.filter(x=>gear.size===0||gear.has(x[0]));const text='【欧洲防扒购物清单】\\n'+all.map((x,i)=>(i+1)+'. '+x[1]+'：'+x[4]).join('\\n')+'\\n任何用品均不能保证百分百防盗。';const ok=await copy(text);metric('gear_copy','清单');$('stitch-gear-copy').textContent=ok?'✓ 已复制，可粘贴微信':'复制失败，请手动选择';};
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){metric('gear_view',cities[chosen]);observer.disconnect()}},{threshold:.2});observer.observe(section)}
}
function link(){return location.origin+'/#city='+encodeURIComponent(cities[chosen]||'罗马')}
async function share(){
 metric('share_native_attempt',cities[chosen]);
 if(typeof navigator.share==='function'){try{await navigator.share({title:'小偷在哪里 · '+cities[chosen]+'避雷雷达',text:'公开信息可追溯，2公里仅为查询圈；出行前查一查。',url:link()});metric('share_native_success',cities[chosen]);notice('系统分享已唤起；是否发给微信好友以微信界面为准。');return}catch(e){if(e?.name==='AbortError')return}}
 const success=await copy('【'+cities[chosen]+'防扒雷达】'+link());metric('share_copy_link',cities[chosen]);notice(success?'链接已复制，请在微信发送给朋友。':'请通过手机浏览器分享菜单选择微信。');
}
function notice(text){const el=$('stitch-share-message');if(el)el.textContent=text;else if(typeof window.showToast==='function')window.showToast(text)}
function shareSetup(){
 const sheet=$('stitch-share-sheet'),native=$('stitch-native-share');if(!sheet||!native)return;
 const wx=document.createElement('button');wx.id='stitch-wechat-one-tap';wx.type='button';wx.textContent='🟢 一键唤起微信分享';
 sheet.querySelector('.share-actions')?.prepend(wx);
 wx.onclick=()=>{if(isWx()){metric('share_wechat_guide',cities[chosen]);try{window.WeixinJSBridge?.call?.('showOptionMenu')}catch{}notice('微信内点右上角「···」→「发送给朋友」。必须由你在微信里确认，网页无法直接替你发送。');}else share()};
 native.addEventListener('click',e=>{e.stopImmediatePropagation();share()},{capture:true});
 const observer=new MutationObserver(()=>{if(!sheet.hidden&&sheet.dataset.observed!=='yes'){sheet.dataset.observed='yes';metric('share_open',cities[chosen])}if(sheet.hidden)sheet.dataset.observed='no'});observer.observe(sheet,{attributes:true,attributeFilter:['hidden']});
 for(const [id,event] of [['stitch-copy-link','share_copy_link'],['stitch-copy-text','share_copy_text']])$(id)?.addEventListener('click',()=>metric(event,cities[chosen]));
}
function init(){
 if(ready)return;ready=true;
 const heading=[...document.querySelectorAll('h2')].find(x=>/实况避雷雷达/.test(x.textContent));
 if(heading){const el=document.createElement('div');el.id='stitch-selected-area';el.className='stitch-selected-area';heading.parentElement.parentElement.insertAdjacentElement('afterend',el)}
 makePictures();recommendations();shareSetup();updateHead(chosen);
 document.addEventListener('click',e=>{
  const b=e.target.closest('.city-btn');if(b){const key=b.dataset.city||Object.keys(cities).find(k=>b.textContent.includes(cities[k]));if(cities[key]){setTimeout(()=>updateHead(key),0);metric('city_select',cities[key])}}
  const f=e.target.closest('.tier-filter,.filter-chip');if(f){metric('item_filter',f.textContent.replace(/\\([^)]*\\)/g,'').slice(0,35));setTimeout(()=>updateHead(chosen),0)}
  const a=e.target.closest('.stitch-real-incident a');if(a){const title=a.closest('.stitch-real-incident')?.querySelector('h3,b')?.textContent?.replace(/^[0-9]+\\.\\s*/,'')||'事件';updateHead(chosen,title);metric('case_open',cities[chosen])}
  if(e.target.closest('#stitch-live-map .leaflet-interactive'))metric('map_area_open',cities[chosen]);
  if(e.target.closest('#stitch-real-report,#stitch-open-real-report'))metric('report_open',cities[chosen]);
  if(e.target.closest('#survival-codex summary'))metric('prevention_open',cities[chosen]);
  if(e.target.closest('[onclick*="showRescueModal"]'))metric('rescue_open',cities[chosen]);
 });
 const admin=document.createElement('a');admin.textContent='管理后台';admin.href='/admin.html';admin.style.cssText='font-size:11px;margin:8px;color:#4567b4;text-decoration:underline';document.querySelector('footer')?.append(admin);
 metric('page_view','');
}
window.StitchEnhanceV23={metric,share,updateHead};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
