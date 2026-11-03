/* 防扒地图 P0 — map-first page modeled on the bedbug-map flow.
 * Shows only reviewed, sourced records: /api/events-v2, /api/hotspots, /api/reports (approved),
 * falling back to the verified public snapshots in /data. Never invents points. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const TYPES=['扒窃','抢夺','诈骗套路'];
const COLORS={admin:'#7a1f2b',traveler:'#c2453f'};
const enabled=new Set(TYPES);
let cities=[],city='罗马',map=null,layer=null,places=[],loadState='loading';

/* ---------- font size ---------- */
function applyFont(v){document.documentElement.classList.remove('fs-l','fs-xl');if(v==='l'||v==='xl')document.documentElement.classList.add('fs-'+v);store.set('fbmap.fs',v)}
applyFont(store.get('fbmap.fs')||'m');

/* ---------- fetch helpers ---------- */
async function getJSON(url,ms){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms||6000);try{const r=await fetch(url,{signal:ctl.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error(r.status);return await r.json()}finally{clearTimeout(t)}}
async function tryAll(list){for(const [url,pick] of list){try{const v=pick(await getJSON(url));if(v&&v.length)return v}catch{}}return[]}

/* ---------- classification ---------- */
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
    type:theftType([a.sample_summary,a.spot_name].join(' ')),status:'admin',evidence:'警方调查汇总',
    date:a.last_incident_on||a.last_source_on||'',count:Math.max(1,(a.verified_event_count|0)+(a.approved_visitor_reports|0)),
    item:(a.common_item_categories||[]).join('、'),summary:a.sample_summary||'',sourceTitle:'来源',sourceUrl:(a.source_urls||[])[0]||'',
    caveat:'这是一组案件的汇总，不等于逐条独立个案。'};
}
function fromGrid(a){
  return{city:a.city,country:a.country,spot:'警方开放数据网格（约1公里）',lat:num(a.lat),lon:num(a.lon),
    type:'扒窃',status:'admin',evidence:'警方开放数据',date:(a.period_start||'')+(a.period_end?' 至 '+a.period_end:''),
    count:Math.max(1,a.evidence_count|0),item:'',summary:'该网格在统计期内有 '+(a.evidence_count|0)+' 条「Theft from the person」公开警方记录。',
    sourceTitle:'data.police.uk',sourceUrl:a.source_url||'https://data.police.uk/data/',
    caveat:'英国警方类别 Theft from the person 同时包含扒窃与抢夺；记录次数不代表遇窃概率。'+(a.license_note?' '+a.license_note:'')};
}
function fromReport(r){
  return{city:r.city,country:r.country,spot:r.spot_name_public||'游客报告地点',lat:num(r.display_lat),lon:num(r.display_lon),
    type:theftType([r.public_summary,r.category].join(' ')),status:r.category==='已报警确认失窃'?'admin':'traveler',
    evidence:r.category==='已报警确认失窃'?'自述已报警':'游客自述',date:r.occurred_on||'',count:1,item:r.item_category||'',
    summary:r.public_summary||'',sourceTitle:'',sourceUrl:'',caveat:'游客自述，经审核脱敏，非警方认定。'};
}

async function loadData(){
  const [ev,grids,reports]=await Promise.all([
    (async()=>{try{const d=await getJSON('/api/events-v2');if(d&&d.available)return d}catch{}
      try{const s=await getJSON('/data/verified-events-v21.json',4000);if(s&&s.verified_public_snapshot===true)return s}catch{}return{items:[],areas:[]}})(),
    tryAll([['/api/hotspots',d=>d.areas],['/data/verified-uk-police-areas.json',d=>d.areas]]),
    tryAll([['/api/reports',d=>d.items]])
  ]);
  const recs=[...(ev.items||[]).map(fromEvent),...(ev.areas||[]).map(fromRiskArea),...grids.map(fromGrid),...reports.map(fromReport)]
    .filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon));
  const byKey=new Map();
  for(const r of recs){const k=r.city+'|'+r.lat.toFixed(3)+'|'+r.lon.toFixed(3);if(!byKey.has(k))byKey.set(k,{id:'p'+byKey.size,city:r.city,country:r.country,lat:r.lat,lon:r.lon,records:[]});byKey.get(k).records.push(r)}
  places=[...byKey.values()].map(p=>{
    const names={};p.records.forEach(r=>names[r.spot]=(names[r.spot]||0)+1);
    p.name=Object.entries(names).sort((a,b)=>b[1]-a[1])[0][0];
    p.allNames=Object.keys(names);
    p.records.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return p});
  loadState=recs.length?'ready':'empty';
}

/* ---------- derived view of a place under current toggles ---------- */
function view(p){
  const rs=p.records.filter(r=>enabled.has(r.type));if(!rs.length)return null;
  const status=rs.some(r=>r.status==='admin')?'admin':'traveler';
  const tc={};rs.forEach(r=>tc[r.type]=(tc[r.type]||0)+r.count);
  const type=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];
  const order=['警方开放数据','警方调查汇总','官方通报','自述已报警','媒体报道','游客自述'];
  const evidence=order.find(o=>rs.some(r=>r.evidence===o))||rs[0].evidence;
  return{rs,status,type,evidence,count:rs.reduce((s,r)=>s+r.count,0),types:Object.keys(tc)};
}

/* ---------- pins ---------- */
const GLYPH={
  '扒窃':'<path d="M15 15h14l2 13H13z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M18 15a4 4 0 0 1 8 0" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M27 9l5-3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  '抢夺':'<path d="M12 22l9-9m0 0h-6m6 0v6M32 22l-9 9m0 0h6m-6 0v-6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  '诈骗套路':'<text x="22" y="28" text-anchor="middle" font-size="17" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">?</text>'
};
function pinSVG(color,type){return'<svg viewBox="0 0 44 52"><path d="M22 51C22 51 3 31 3 20a19 19 0 0 1 38 0c0 11-19 31-19 31z" fill="'+color+'" stroke="#fff" stroke-width="2"/><circle cx="22" cy="20" r="13" fill="rgba(255,255,255,.14)"/><g transform="translate(0,-1)">'+GLYPH[type]+'</g></svg>'}
function icon(v){return L.divIcon({className:'',html:'<div class="pin">'+pinSVG(COLORS[v.status],v.type)+(v.count>1?'<b>'+(v.count>999?'999+':v.count)+'</b>':'')+'</div>',iconSize:[44,52],iconAnchor:[22,51],popupAnchor:[0,-46]})}

function drawPins(){
  if(!map)return;layer.clearLayers();
  places.forEach(p=>{const v=view(p);if(!v)return;
    L.marker([p.lat,p.lon],{icon:icon(v),title:p.name,keyboard:true}).on('click',()=>openPlace(p)).addTo(layer)});
  renderList();
}

/* ---------- list ---------- */
function renderList(){
  const title=$('listTitle'),cnt=$('listCount'),st=$('listStatus'),ul=$('placeList');
  title.textContent=city+' 当前区域已标记地点';
  if(loadState==='loading'){cnt.textContent='—';st.textContent='正在读取有出处的记录…';st.hidden=false;ul.innerHTML='';return}
  const b=map?map.getBounds():null;
  const vis=places.map(p=>({p,v:view(p)})).filter(x=>x.v&&(b?b.contains([x.p.lat,x.p.lon]):x.p.city===city))
    .sort((a,b2)=>(b2.v.status==='admin')-(a.v.status==='admin')||b2.v.count-a.v.count);
  cnt.textContent=vis.length+' 处';
  if(!vis.length){st.hidden=false;st.textContent=loadState==='empty'?'暂时读取不到已审核记录，请稍后再试。':
    (enabled.size?'当前区域暂无已标记地点。可缩小地图、换个城市，或点地图举报你遇到的失窃。':'三个类别都已关闭，打开至少一个即可查看。');ul.innerHTML='';return}
  st.hidden=true;
  ul.innerHTML=vis.map(({p,v})=>'<li><button type="button" class="prow" data-id="'+p.id+'"><svg class="mini" viewBox="0 0 44 52">'+pinSVG(COLORS[v.status],v.type).replace(/^<svg[^>]*>|<\/svg>$/g,'')+'</svg>'+
    '<span class="txt"><span class="nm">'+esc(p.name)+'</span><span class="ad">'+esc(p.country+' · '+p.city+(p.allNames.length>1?' · 附近共 '+p.allNames.length+' 个地点名':''))+'</span><span class="ev">'+esc(v.evidence)+(v.count>1?' · '+v.count+' 条':'')+'</span></span>'+
    '<span class="st '+v.status+'">'+esc(v.types.join('/'))+'<br>'+(v.status==='admin'?'管理员判定':'未经警方确认')+'</span></button></li>').join('');
}
$('placeList').addEventListener('click',e=>{const b=e.target.closest('.prow');if(!b)return;const p=places.find(x=>x.id===b.dataset.id);if(p){if(map)map.setView([p.lat,p.lon],Math.max(map.getZoom(),15));openPlace(p)}});

/* ---------- sheet ---------- */
function openSheet(html){$('sheetBody').innerHTML=html;$('sheet').hidden=false;$('sheetBack').hidden=false;$('sheetClose').focus()}
function closeSheet(){$('sheet').hidden=true;$('sheetBack').hidden=true}
$('sheetClose').onclick=closeSheet;$('sheetBack').onclick=closeSheet;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
const navURL=(lat,lon)=>'https://www.google.com/maps/search/?api=1&query='+lat+','+lon;

function openPlace(p){
  const v=view(p)||{rs:p.records,status:'traveler',types:[],count:p.records.length};
  openSheet('<h3 id="sheetTitle">'+esc(p.name)+'</h3><div class="badges"><span class="bd '+v.status+'">'+(v.status==='admin'?'管理员判定':'未经警方确认')+'</span>'+v.types.map(t=>'<span class="bd">'+esc(t)+'</span>').join('')+'<span class="bd">'+v.count+' 条记录</span></div>'+
    (p.allNames.length>1?'<p class="caveat">此处合并了同一大致位置的多个地点名：'+esc(p.allNames.join('、'))+'</p>':'')+
    v.rs.map(r=>'<div class="rec"><div class="meta">'+esc([r.date||'日期未披露',r.type,r.item,r.evidence].filter(Boolean).join(' · '))+'</div>'+
      (r.spot!==p.name?'<div><b>'+esc(r.spot)+'</b></div>':'')+'<div>'+esc(r.summary)+'</div>'+
      (r.sourceUrl?'<div class="meta">来源：<a href="'+esc(r.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(r.sourceTitle||r.sourceUrl)+'</a></div>':'')+
      (r.caveat?'<div class="caveat">'+esc(r.caveat)+'</div>':'')+'</div>').join('')+
    '<div class="sheet-act"><a class="s" href="'+navURL(p.lat,p.lon)+'" target="_blank" rel="noopener noreferrer">导航前往</a><a class="p" href="/legacy.html#report">我也在这被偷过</a></div>');
}

function openGuide(){
  openSheet('<div class="guide"><h3 id="sheetTitle">使用说明</h3><ol><li>顶部选城市，或在搜索框输入景点、车站、街道名称</li><li>地图上每个图钉代表一处有记录的位置，数字是记录条数</li><li>深红＝官方通报、警方数据或管理员判定；浅红＝媒体报道或游客自述，未经警方确认</li><li>用「扒窃 / 抢夺 / 诈骗套路」开关筛选，下方列表只显示当前地图范围内的地点</li><li>点图钉看来源与说明；点地图空白处可举报你遇到的失窃</li></ol>'+
  '<h4>被偷后怎么办</h4><ul><li>人身有危险先拨 <b>112</b>（欧盟通用紧急电话）</li><li>手机：用另一台设备远程锁定/定位，联系运营商停机补卡</li><li>银行卡：立即在银行 App 冻结或拨打卡背面电话挂失</li><li>护照：到当地警局报案取得报案证明，再联系中国驻当地使领馆补办旅行证件</li><li>报案证明是保险理赔和补证的关键材料，尽量当天办理</li></ul>'+
  '<p class="caveat">地图标记来自公开来源与审核后的游客报告，记录多少不代表遇窃概率。</p></div>');
}
function openFont(){
  const cur=store.get('fbmap.fs')||'m';
  openSheet('<h3 id="sheetTitle">字号设置</h3><div class="fs-opts">'+[['m','标准'],['l','大'],['xl','特大']].map(([k,n])=>'<button type="button" data-fs="'+k+'" aria-pressed="'+(k===cur)+'">'+n+'</button>').join('')+'</div>');
}
$('sheetBody').addEventListener('click',e=>{const b=e.target.closest('[data-fs]');if(!b)return;applyFont(b.dataset.fs);$('sheetBody').querySelectorAll('[data-fs]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));setTimeout(()=>map&&map.invalidateSize(),60)});
$('fontBtn').onclick=openFont;$('guideOpen').onclick=openGuide;
$('guideClose').onclick=()=>{$('guideFloat').hidden=true;store.set('fbmap.guideClosed','1')};
if(store.get('fbmap.guideClosed'))$('guideFloat').hidden=true;
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>b.dataset.open==='guide'?openGuide():openFont());

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
  ['map','appeal','me'].forEach(n=>$('view-'+n).hidden=n!==t.dataset.view);
  if(store.get('fbmap.guideClosed')||t.dataset.view!=='map')$('guideFloat').hidden=true;else $('guideFloat').hidden=false;
  if(t.dataset.view==='map'&&map)setTimeout(()=>map.invalidateSize(),50);
  window.scrollTo(0,0);
});

/* ---------- toggles ---------- */
document.querySelectorAll('.tg input').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?enabled.add(cb.dataset.type):enabled.delete(cb.dataset.type);drawPins()}));
document.querySelectorAll('.tg-pin').forEach(s=>s.style.background=COLORS.admin);

/* ---------- cities ---------- */
function cityObj(n){return cities.find(c=>c.name===n)}
function setCity(n,fly){
  const c=cityObj(n);if(!c)return;city=n;$('citySelect').value=n;
  try{history.replaceState(null,'','#city='+encodeURIComponent(n))}catch{}
  if(map)map.setView([c.lat,c.lon],fly?13:12);renderList();
}
$('citySelect').onchange=e=>setCity(e.target.value,false);
function fillCities(){
  const groups={};cities.forEach(c=>(groups[c.country]=groups[c.country]||[]).push(c));
  $('citySelect').innerHTML=Object.entries(groups).map(([g,cs])=>'<optgroup label="'+esc(g)+'">'+cs.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('')+'</optgroup>').join('');
}

/* ---------- search ---------- */
function showResults(items,q){
  const box=$('searchResults');box.hidden=false;
  box.innerHTML=items.length?items.map((it,i)=>'<button type="button" data-i="'+i+'">'+esc(it.name)+'<small>'+esc(it.sub)+'</small></button>').join(''):'<div class="empty">没有找到「'+esc(q)+'」，可换个写法，或直接在地图上拖动查找。</div>';
  box.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const it=items[+b.dataset.i];box.hidden=true;
    if(it.city&&it.city!==city&&cityObj(it.city)){city=it.city;$('citySelect').value=it.city}
    if(map)map.setView([it.lat,it.lon],it.zoom||16);else renderList();if(it.place)openPlace(it.place)};
}
$('searchForm').addEventListener('submit',async e=>{
  e.preventDefault();const q=$('searchInput').value.trim();if(!q){$('searchResults').hidden=true;return}
  const lq=q.toLowerCase(),out=[];
  places.forEach(p=>{if(p.allNames.some(n=>n.toLowerCase().includes(lq)))out.push({name:p.name,sub:'已标记 · '+p.city,lat:p.lat,lon:p.lon,city:p.city,place:p})});
  cities.forEach(c=>{if(c.name.includes(q))out.push({name:c.name,sub:'城市 · '+c.country,lat:c.lat,lon:c.lon,city:c.name,zoom:12});
    Object.entries(c.located||{}).forEach(([s,ll])=>{if(s.toLowerCase().includes(lq))out.push({name:s,sub:'景点 · '+c.name,lat:ll[0],lon:ll[1],city:c.name})})});
  if(out.length<3){
    const c=cityObj(city);$('searchResults').hidden=false;$('searchResults').innerHTML='<div class="empty">正在搜索…</div>';
    try{const d=await getJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=zh-CN,en&q='+encodeURIComponent(q+(c?' '+c.name:'')),5000);
      (d||[]).forEach(r=>out.push({name:(r.name||r.display_name.split(',')[0]),sub:r.display_name,lat:+r.lat,lon:+r.lon}))}catch{}
  }
  showResults(out.slice(0,8),q);
});
document.addEventListener('click',e=>{if(!e.target.closest('.search,.search-results'))$('searchResults').hidden=true});

/* ---------- map ---------- */
function initMap(){
  const c=cityObj(city)||{lat:41.9,lon:12.5};
  if(typeof L==='undefined'){$('map').innerHTML='<p style="padding:2rem 1rem;text-align:center;color:#6b7a73">地图加载失败（网络较慢时常见）。下方列表仍可使用。</p>';return}
  map=L.map('map',{zoomControl:false,tap:true}).setView([c.lat,c.lon],12);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  layer=L.layerGroup().addTo(map);
  map.on('moveend',renderList);
  map.on('click',ev=>{
    L.popup().setLatLng(ev.latlng).setContent('<b>在这里被偷过？</b><div style="color:#6b7a73;font-size:.8rem;margin-top:2px">匿名举报，审核通过后才会出现在地图上</div><div class="pop-act"><a class="p" href="/legacy.html#report">举报此处</a><a class="s" href="'+navURL(ev.latlng.lat.toFixed(5),ev.latlng.lng.toFixed(5))+'" target="_blank" rel="noopener noreferrer">在地图App打开</a></div>').openOn(map);
  });
}

/* ---------- boot ---------- */
(async function boot(){
  try{cities=await getJSON('/cities.json',5000)}catch{cities=[{country:'意大利',name:'罗马',lat:41.9028,lon:12.4964}]}
  fillCities();
  const h=decodeURIComponent((location.hash.match(/city=([^&]+)/)||[])[1]||'');
  city=cityObj(h)?h:(cityObj('罗马')?'罗马':cities[0].name);$('citySelect').value=city;
  initMap();renderList();
  try{await loadData()}catch{loadState='empty'}
  drawPins();
})();
})();
