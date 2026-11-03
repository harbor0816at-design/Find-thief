/* 防扒雷达 · 地图首页
 * 逻辑对齐床虱地图：选城市 → 搜地点 → 地图看标记 → 类别开关 → 视野内已标记地点列表 → 详情 → 申诉。
 * 只展示已审核、有出处的数据：/api/events-v2、/api/hotspots、/api/reports(approved)，
 * 接口不可用时降级到 /data 内已核验快照。不生成任何示例点。 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const TYPES=['扒窃','抢夺','诈骗套路'];
const COLOR={admin:'#7b1d27',traveler:'#b8433b',doubt:'#e59a3a',appeal:'#7b1d27'};
const STATUS_TEXT={admin:'管理员判定',traveler:'未经警方确认',doubt:'存疑',appeal:'申诉处理中'};
const SLUG={rome:'罗马',paris:'巴黎',barcelona:'巴塞罗那',milan:'米兰',london:'伦敦',florence:'佛罗伦萨',venice:'威尼斯',madrid:'马德里',naples:'那不勒斯',prague:'布拉格',amsterdam:'阿姆斯特丹',lisbon:'里斯本'};
const enabled=new Set(TYPES);
let cities=[],city='罗马',map=null,layer=null,places=[],appeals=new Map(),loadState='loading';

/* ---------- font size ---------- */
function applyFont(v){document.documentElement.classList.remove('fs-l','fs-xl');if(v==='l'||v==='xl')document.documentElement.classList.add('fs-'+v);store.set('fbmap.fs',v)}
applyFont(store.get('fbmap.fs')||'m');

/* ---------- metrics (anonymous aggregate, existing endpoint) ---------- */
function metric(name,cityName){try{const body=JSON.stringify({event:name,city:String(cityName||city)});if(navigator.sendBeacon)navigator.sendBeacon('/api/metrics',new Blob([body],{type:'application/json'}));else fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{})}catch{}}

/* ---------- fetch ---------- */
async function getJSON(url,ms,opt){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms||6000);try{const r=await fetch(url,{...(opt||{}),signal:ctl.signal,headers:{Accept:'application/json',...((opt||{}).headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.error||('HTTP '+r.status));e.status=r.status;throw e}return d}finally{clearTimeout(t)}}
async function firstNonEmpty(list){for(const [url,pick] of list){try{const v=pick(await getJSON(url));if(v&&v.length)return v}catch{}}return[]}

/* ---------- normalise records ---------- */
function theftType(text){
  if(/诈骗|骗|套路|假警察|手环|请愿|签名|scam|truffa|estafa/i.test(text))return'诈骗套路';
  if(/抢|飞车|夺|snatch|scippo|tirón|robo con/i.test(text))return'抢夺';
  return'扒窃';
}
const num=v=>v==null||v===''?NaN:Number(v);
function fromEvent(e){
  const admin=e.source_type==='official_case'||e.confidence==='official_record';
  return{city:e.city,country:e.country,spot:e.spot_name||'未命名地点',lat:num(e.lat),lon:num(e.lon),
    type:theftType([e.short_summary,e.source_title,e.spot_name].join(' ')),status:admin?'admin':'traveler',
    evidence:e.source_type==='official_case'?'官方通报':'媒体报道',date:e.occurred_on||e.source_published_on||'',count:1,
    item:e.item_category||'',summary:e.short_summary||'',sourceTitle:e.source_title||'',sourceUrl:e.source_url||'',
    caveat:e.location_precision==='approx_area'?'位置为约2公里范围的大致区域，不是精确案发点。':''};
}
function fromRiskArea(a){
  return{city:a.city,country:a.country,spot:a.spot_name||'警方调查区域',lat:num(a.lat),lon:num(a.lon),
    type:theftType([a.sample_summary,a.spot_name].join(' ')),status:'admin',evidence:'警方调查',
    date:a.last_incident_on||a.last_source_on||'',count:Math.max(1,(a.verified_event_count|0)+(a.approved_visitor_reports|0)),
    item:(a.common_item_categories||[]).join('、'),summary:a.sample_summary||'',sourceTitle:'来源报道',sourceUrl:(a.source_urls||[])[0]||'',
    caveat:'这是一组案件的汇总，不等于逐条独立个案。'};
}
function fromGrid(a){
  return{city:a.city,country:a.country,spot:'警方公开数据网格（约1公里）',lat:num(a.lat),lon:num(a.lon),
    type:'扒窃',status:'admin',evidence:'警方数据',date:(a.period_start||'')+(a.period_end?' 至 '+a.period_end:''),
    count:Math.max(1,a.evidence_count|0),item:'',summary:'统计期内该网格有 '+(a.evidence_count|0)+' 条「Theft from the person」警方公开记录。',
    sourceTitle:'data.police.uk',sourceUrl:a.source_url||'https://data.police.uk/data/',
    caveat:'英国警方类别 Theft from the person 同时包含扒窃与抢夺；记录次数不代表遇窃概率。'+(a.license_note?' '+a.license_note:'')};
}
function fromReport(r){
  const police=r.category==='已报警确认失窃';
  return{city:r.city,country:r.country,spot:r.spot_name_public||'游客报告地点',lat:num(r.display_lat),lon:num(r.display_lon),
    type:theftType([r.public_summary,r.category].join(' ')),status:'traveler',
    evidence:police?'已报警':'游客自述',date:r.occurred_on||'',count:1,item:r.item_category||'',
    summary:r.public_summary||'',sourceTitle:'',sourceUrl:'',caveat:'游客自述，经审核脱敏，非警方认定。'};
}

async function loadData(){
  const [ev,grids,reports,ap]=await Promise.all([
    (async()=>{try{const d=await getJSON('/api/events-v2');if(d&&d.available)return d}catch{}
      try{const s=await getJSON('/data/verified-events-v21.json',4000);if(s&&s.verified_public_snapshot===true)return s}catch{}return{items:[],areas:[]}})(),
    firstNonEmpty([['/api/hotspots',d=>d.areas],['/data/verified-uk-police-areas.json',d=>d.areas]]),
    firstNonEmpty([['/api/reports',d=>d.items]]),
    getJSON('/api/appeals',5000).then(d=>d.items||[]).catch(()=>[])
  ]);
  appeals=new Map(ap.map(a=>[a.place_key,a]));
  const recs=[...(ev.items||[]).map(fromEvent),...(ev.areas||[]).map(fromRiskArea),...grids.map(fromGrid),...reports.map(fromReport)]
    .filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon));
  const byKey=new Map();
  for(const r of recs){const k=r.city+'|'+r.lat.toFixed(3)+'|'+r.lon.toFixed(3);if(!byKey.has(k))byKey.set(k,{id:k,city:r.city,country:r.country,lat:r.lat,lon:r.lon,records:[]});byKey.get(k).records.push(r)}
  places=[...byKey.values()].map(p=>{
    const names={};p.records.forEach(r=>names[r.spot]=(names[r.spot]||0)+1);
    p.name=Object.entries(names).sort((a,b)=>b[1]-a[1])[0][0];
    p.allNames=Object.keys(names);
    p.records.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    p.appeal=appeals.get(p.id)||null;
    return p}).filter(p=>!(p.appeal&&p.appeal.status==='removed'));
  loadState=recs.length?'ready':'empty';
}

/* ---------- a place under current toggles ---------- */
function view(p){
  const rs=p.records.filter(r=>enabled.has(r.type));if(!rs.length)return null;
  let status=rs.some(r=>r.status==='admin')?'admin':'traveler';
  if(p.appeal&&p.appeal.status==='pending')status='appeal';
  if(p.appeal&&p.appeal.status==='downgraded')status='doubt';
  const tc={};rs.forEach(r=>tc[r.type]=(tc[r.type]||0)+r.count);
  const type=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];
  const order=['警方数据','警方调查','官方通报','已报警','媒体报道','游客自述'];
  const evidence=order.find(o=>rs.some(r=>r.evidence===o))||rs[0].evidence;
  return{rs,status,type,evidence,count:rs.reduce((s,r)=>s+r.count,0),types:Object.keys(tc)};
}

/* ---------- pin artwork ---------- */
const GLYPH={
  '扒窃':'<path d="M19.5 18.5h13l1.8 11.5H17.7z" fill="#fff"/><path d="M22.5 18.5a3.5 3.5 0 0 1 7 0" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M33 13l4.5-3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  '抢夺':'<path d="M16.5 25.5l8-8m0 0h-5.5m5.5 0V23M35.5 21.5l-8 8m0 0h5.5m-5.5 0V24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  '诈骗套路':'<text x="26" y="30.5" text-anchor="middle" font-size="17" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">?</text>'
};
function pinSVG(status,type){
  const c=COLOR[status],half=status==='appeal';
  return'<svg viewBox="0 0 52 60" aria-hidden="true">'+
    (half?'<defs><clipPath id="hr"><rect x="26" y="0" width="26" height="60"/></clipPath></defs>':'')+
    '<path d="M26 58.5C26 58.5 4 36 4 23a22 22 0 0 1 44 0c0 13-22 35.5-22 35.5z" fill="'+c+'" stroke="#fff" stroke-width="2.5"/>'+
    (half?'<path d="M26 58.5C26 58.5 4 36 4 23a22 22 0 0 1 44 0c0 13-22 35.5-22 35.5z" fill="#7fb3d5" clip-path="url(#hr)"/>':'')+
    '<circle cx="26" cy="23" r="14.5" fill="none" stroke="#fff" stroke-width="2.4"/>'+GLYPH[type]+'</svg>';
}
function icon(v){return L.divIcon({className:'',html:'<div class="pin">'+pinSVG(v.status,v.type)+(v.count>1?'<b>'+(v.count>999?'999+':v.count)+'</b>':'')+'</div>',iconSize:[52,60],iconAnchor:[26,58],popupAnchor:[0,-52]})}
document.querySelectorAll('.tg-pin').forEach(s=>s.innerHTML=pinSVG('admin',s.dataset.glyph));

/* ---------- draw ---------- */
function drawPins(){
  if(map&&layer){layer.clearLayers();
    places.forEach(p=>{const v=view(p);if(!v)return;
      L.marker([p.lat,p.lon],{icon:icon(v),title:p.name,keyboard:true,riseOnHover:true}).on('click',()=>openPlace(p)).addTo(layer)});}
  renderList();
}
function renderList(){
  const title=$('listTitle'),cnt=$('listCount'),st=$('listStatus'),ul=$('placeList');
  title.textContent=city+'当前区域已标记地点';
  if(loadState==='loading'){cnt.textContent='—';st.textContent='正在读取有出处的记录…';st.hidden=false;ul.innerHTML='';return}
  const b=map?map.getBounds():null;
  const vis=places.map(p=>({p,v:view(p)})).filter(x=>x.v&&(b?b.contains([x.p.lat,x.p.lon]):x.p.city===city))
    .sort((a,c)=>(c.v.status==='admin')-(a.v.status==='admin')||c.v.count-a.v.count);
  cnt.textContent=vis.length+' 处';
  if(!vis.length){st.hidden=false;ul.innerHTML='';
    st.textContent=loadState==='empty'?'暂时读取不到已审核记录，请稍后刷新。':!enabled.size?'三个类别都已关闭，打开任意一个即可查看。':'当前区域暂无已标记地点。可缩小地图查看周边、切换城市，或点击地图举报你遇到的失窃。';return}
  st.hidden=true;
  ul.innerHTML=vis.map(({p,v})=>'<li><button type="button" class="prow" data-id="'+esc(p.id)+'"><span class="mini">'+pinSVG(v.status,v.type)+'</span>'+
    '<span class="txt"><span class="nm">'+esc(p.name)+'</span><span class="ad">'+esc(p.country+p.city+(p.allNames.length>1?' · 含附近 '+p.allNames.length+' 处地名':''))+'</span><span class="ev">'+esc(v.evidence)+(v.count>1?' · '+v.count+'条':'')+'</span></span>'+
    '<span class="st '+v.status+'">'+esc(v.type)+' · '+STATUS_TEXT[v.status]+'</span></button></li>').join('');
}
$('placeList').addEventListener('click',e=>{const b=e.target.closest('.prow');if(!b)return;const p=places.find(x=>x.id===b.dataset.id);if(!p)return;if(map)map.setView([p.lat,p.lon],Math.max(map.getZoom(),15));openPlace(p)});

/* ---------- sheets ---------- */
let lastFocus=null;
function openSheet(html){lastFocus=document.activeElement;$('sheetBody').innerHTML=html;$('sheet').hidden=false;$('sheetBack').hidden=false;$('sheet').scrollTop=0;$('sheetClose').focus()}
function closeSheet(){$('sheet').hidden=true;$('sheetBack').hidden=true;if(lastFocus&&lastFocus.focus)lastFocus.focus()}
$('sheetClose').onclick=closeSheet;$('sheetBack').onclick=closeSheet;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});
const navURL=(lat,lon)=>'https://www.google.com/maps/search/?api=1&query='+lat+','+lon;

function openPlace(p){
  metric('area_open',p.city);
  const v=view(p)||{rs:p.records,status:'traveler',types:[],count:p.records.length};
  const ap=p.appeal;
  openSheet('<h3 id="sheetTitle">'+esc(p.name)+'</h3><div class="badges"><span class="bd '+v.status+'">'+STATUS_TEXT[v.status]+'</span>'+v.types.map(t=>'<span class="bd">'+esc(t)+'</span>').join('')+'<span class="bd">'+v.count+' 条记录</span></div>'+
    (ap&&ap.status==='pending'?'<p class="caveat">该地点已有申诉，管理员正在复核来源。</p>':'')+
    (ap&&ap.status!=='pending'&&ap.decision_public?'<p class="caveat">申诉复核结论：'+esc(ap.decision_public)+'</p>':'')+
    (p.allNames.length>1?'<p class="caveat">此处合并了同一大致位置的多个地名：'+esc(p.allNames.join('、'))+'</p>':'')+
    v.rs.map(r=>'<div class="rec"><div class="meta">'+esc([r.date||'日期未披露',r.type,r.item,r.evidence].filter(Boolean).join(' · '))+'</div>'+
      (r.spot!==p.name?'<div><b>'+esc(r.spot)+'</b></div>':'')+'<div>'+esc(r.summary)+'</div>'+
      (r.sourceUrl?'<div class="meta">来源：<a href="'+esc(r.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(r.sourceTitle||r.sourceUrl)+'</a></div>':'')+
      (r.caveat?'<div class="caveat">'+esc(r.caveat)+'</div>':'')+'</div>').join('')+
    '<div class="sheet-act"><a class="s" href="'+navURL(p.lat,p.lon)+'" target="_blank" rel="noopener noreferrer">导航前往</a><button type="button" class="s" data-appeal-place="'+esc(p.id)+'">申诉</button><a class="p" href="/legacy.html#report">我也被偷过</a></div>');
}
function openGuide(){
  metric('rescue_open');
  openSheet('<div class="guide"><h3 id="sheetTitle">使用说明</h3><h4>操作方法</h4><ol><li>顶部选城市，或在搜索框输入景点、车站、酒店名称</li><li>地图上每个图钉是一处有记录的位置，角标数字是记录条数</li><li>深红：官方通报、警方数据或管理员判定；浅红：媒体报道或游客自述，未经警方确认；橙色：申诉后存疑；半蓝：申诉处理中</li><li>用「扒窃 / 抢夺 / 诈骗套路」开关筛选；下方列表只显示当前地图范围内的地点，拖动地图会自动更新</li><li>点图钉查看来源；点地图空白处可匿名举报</li></ol>'+
  '<h4>被偷后怎么处理</h4><ul><li>人身有危险先拨 112（欧盟通用紧急电话）</li><li>手机：用另一台设备远程锁定和定位，联系运营商停机补卡</li><li>银行卡：立即在银行 App 冻结，或拨打卡背面电话挂失</li><li>护照：到当地警局报案取得报案证明，再联系中国驻当地使领馆补办旅行证件</li><li>报案证明是保险理赔和补证的关键材料，尽量当天办理</li></ul>'+
  '<a class="sos" href="tel:112"><span class="sos-dot"></span>拨打 <b>112</b><span class="sos-hint">点击呼出</span></a>'+
  '<p class="caveat">标记来自公开来源与审核后的游客报告；记录多少不代表遇窃概率。</p></div>');
}
function openFont(){
  const cur=store.get('fbmap.fs')||'m';
  openSheet('<h3 id="sheetTitle">字号设置</h3><div class="fs-opts">'+[['m','标准'],['l','大'],['xl','特大']].map(([k,n])=>'<button type="button" data-fs="'+k+'" aria-pressed="'+(k===cur)+'">'+n+'</button>').join('')+'</div>');
}
$('sheetBody').addEventListener('click',e=>{
  const f=e.target.closest('[data-fs]');
  if(f){applyFont(f.dataset.fs);$('sheetBody').querySelectorAll('[data-fs]').forEach(x=>x.setAttribute('aria-pressed',String(x===f)));setTimeout(()=>map&&map.invalidateSize(),60);return}
  const a=e.target.closest('[data-appeal-place]');
  if(a){const p=places.find(x=>x.id===a.dataset.appealPlace);closeSheet();showView('appeal');if(p){$('apCity').value=p.city;fillAppealPlaces();$('apPlace').value=p.id}}
});
$('fontBtn').onclick=openFont;$('guideOpen').onclick=openGuide;
$('guideClose').onclick=()=>{$('guideFloat').hidden=true;store.set('fbmap.guideClosed','1')};
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>b.dataset.open==='guide'?openGuide():openFont());

/* ---------- tabs ---------- */
function showView(name){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  ['map','appeal','me'].forEach(n=>$('view-'+n).hidden=n!==name);
  $('guideFloat').hidden=name!=='map'||!!store.get('fbmap.guideClosed');
  if(name==='appeal'){$('apCity').value=city;fillAppealPlaces()}
  if(name==='map'&&map)setTimeout(()=>map.invalidateSize(),50);
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));
$('guideFloat').hidden=!!store.get('fbmap.guideClosed');

/* ---------- toggles ---------- */
document.querySelectorAll('.tg input').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?enabled.add(cb.dataset.type):enabled.delete(cb.dataset.type);metric('item_filter',cb.dataset.type);drawPins()}));

/* ---------- cities ---------- */
const cityObj=n=>cities.find(c=>c.name===n);
function setCity(n){
  const c=cityObj(n);if(!c)return;city=n;$('citySelect').value=n;
  try{history.replaceState(null,'','#city='+encodeURIComponent(n))}catch{}
  if(map)map.setView([c.lat,c.lon],12);renderList();metric('city_select',n);
}
$('citySelect').onchange=e=>setCity(e.target.value);
function cityOptions(){
  const groups={};cities.forEach(c=>(groups[c.country]=groups[c.country]||[]).push(c));
  return Object.entries(groups).map(([g,cs])=>'<optgroup label="'+esc(g)+'">'+cs.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('')+'</optgroup>').join('');
}

/* ---------- search ---------- */
function showResults(items,q){
  const box=$('searchResults');box.hidden=false;
  box.innerHTML=items.length?items.map((it,i)=>'<button type="button" data-i="'+i+'">'+esc(it.name)+'<small>'+esc(it.sub)+'</small></button>').join(''):'<div class="empty">没有找到「'+esc(q)+'」。可换个写法，或直接拖动地图、点击地图中的地点。</div>';
  box.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const it=items[+b.dataset.i];box.hidden=true;
    if(it.city&&it.city!==city&&cityObj(it.city)){city=it.city;$('citySelect').value=it.city}
    if(map)map.setView([it.lat,it.lon],it.zoom||16);else renderList();if(it.place)openPlace(it.place)};
}
$('searchForm').addEventListener('submit',async e=>{
  e.preventDefault();const q=$('searchInput').value.trim();if(!q){$('searchResults').hidden=true;return}
  metric('search');
  const lq=q.toLowerCase(),out=[];
  places.forEach(p=>{if(p.allNames.some(n=>n.toLowerCase().includes(lq)))out.push({name:p.name,sub:'已标记 · '+p.country+p.city,lat:p.lat,lon:p.lon,city:p.city,place:p})});
  cities.forEach(c=>{if(c.name.includes(q))out.push({name:c.name,sub:'城市 · '+c.country,lat:c.lat,lon:c.lon,city:c.name,zoom:12});
    Object.entries(c.located||{}).forEach(([s,ll])=>{if(s.toLowerCase().includes(lq))out.push({name:s,sub:'景点 · '+c.country+c.name,lat:ll[0],lon:ll[1],city:c.name})})});
  if(out.length<3){
    const c=cityObj(city);$('searchResults').hidden=false;$('searchResults').innerHTML='<div class="empty">正在搜索…</div>';
    try{const d=await getJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=zh-CN,en&q='+encodeURIComponent(q+(c?' '+c.name:'')),5000);
      (Array.isArray(d)?d:[]).forEach(r=>out.push({name:(r.name||String(r.display_name).split(',')[0]),sub:r.display_name,lat:+r.lat,lon:+r.lon}))}catch{}
  }
  showResults(out.slice(0,8),q);
});
document.addEventListener('click',e=>{if(!e.target.closest('.search,.search-results'))$('searchResults').hidden=true});

/* ---------- appeal form ---------- */
function fillAppealPlaces(){
  const c=$('apCity').value,list=places.filter(p=>p.city===c);
  $('apPlace').innerHTML='<option value="">'+(list.length?'请选择':'该城市暂无已标记地点')+'</option>'+list.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+(p.allNames.length>1?'（含 '+p.allNames.length+' 处地名）':'')+'</option>').join('');
}
$('apCity').onchange=fillAppealPlaces;
$('appealForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('apMsg');msg.className='form-msg';
  const p=places.find(x=>x.id===$('apPlace').value);
  const body={place_key:p?p.id:'',city:$('apCity').value,place_name:p?p.name:'',reason:$('apReason').value,detail:$('apDetail').value.trim(),email:$('apEmail').value.trim(),consent:$('apConsent').checked,website:$('apWebsite').value};
  const fail=t=>{msg.textContent=t;msg.classList.add('err')};
  if(!p)return fail('请选择被标记的地点');
  if(!body.reason)return fail('请选择申诉理由');
  if(body.detail.length<10)return fail('情况说明至少10个字');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))return fail('请填写有效邮箱');
  if(!body.consent)return fail('请先勾选同意隐私政策');
  $('apSubmit').disabled=true;msg.textContent='正在提交…';
  try{
    const d=await getJSON('/api/appeals',9000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    msg.textContent=d.message||'申诉已提交';msg.classList.add('ok');
    appeals.set(p.id,{place_key:p.id,status:'pending'});p.appeal={status:'pending'};drawPins();
    $('apDetail').value='';$('apReason').value='';$('apConsent').checked=false;
  }catch(err){fail(err.message&&!/^HTTP|abort/i.test(err.message)?err.message:'提交失败，请检查网络后重试')}
  finally{$('apSubmit').disabled=false}
});

/* ---------- map ---------- */
function initMap(){
  const c=cityObj(city)||{lat:41.9,lon:12.5};
  if(typeof L==='undefined'){$('map').innerHTML='<p style="padding:3rem 1rem;text-align:center;color:#8a948f">地图加载失败（网络较慢时常见）。下方列表仍可使用。</p>';return}
  map=L.map('map',{zoomControl:false,tap:true}).setView([c.lat,c.lon],12);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  layer=L.layerGroup().addTo(map);
  map.on('moveend',renderList);
  map.on('click',ev=>{
    const lat=ev.latlng.lat.toFixed(5),lon=ev.latlng.lng.toFixed(5);
    L.popup().setLatLng(ev.latlng).setContent('<b>在这里被偷过？</b><div style="color:#8a948f;font-size:.8rem;margin-top:2px">匿名举报，审核通过后才会出现在地图上</div><div class="pop-act"><a class="p" href="/legacy.html#report">举报此处</a><a class="s" href="'+navURL(lat,lon)+'" target="_blank" rel="noopener noreferrer">地图App打开</a></div>').openOn(map);
  });
}

/* ---------- boot ---------- */
(async function boot(){
  try{cities=await getJSON('/cities.json',5000)}catch{cities=[{country:'意大利',name:'罗马',lat:41.9028,lon:12.4964}]}
  const opts=cityOptions();$('citySelect').innerHTML=opts;$('apCity').innerHTML=opts;
  let h=decodeURIComponent((location.hash.match(/city=([^&]+)/)||[])[1]||'');h=SLUG[h.toLowerCase()]||h;
  city=cityObj(h)?h:(cityObj('罗马')?'罗马':cities[0].name);$('citySelect').value=city;
  initMap();renderList();metric('page_view');
  try{await loadData()}catch{loadState='empty'}
  drawPins();
})();
})();
