/* Find Thief — Chinese travelers: map, loss report, loss response and prevention */
(()=>{'use strict';
const $=id=>document.getElementById(id),h=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
let cities=[],map=null,selected=null,hotspots=[],publicReports=[],layers=[],markers=[],selectedPin=null,reportEnabled=false,pickMode=false,dragEnabled=true,searchTimeout,officialLatestMonth='',advisories=[],lostItems=[],verifiedEvents=[],v2Areas=[],showAllZones=false;
const MAX_ZONES=180,DISPLAY_RADIUS_M=2000; // 2km map visualization, NOT measured crime radius
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:'#'}catch{return '#'}};
function track(event,city=''){if(!['page_view','search','area_open','report_open','report_attempt','report_saved','source_open'].includes(event))return;fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,city:city.slice(0,80)}) ,keepalive:true}).catch(()=>{});}
function button(which){
 const views={explore:'exploreView',report:'reportView',recovery:'recoveryView',prevention:'preventionView',blackout:'blackoutView'};
 for(const [key,id] of Object.entries(views)){if($(id))$(id).hidden=key!==which}
 for(const [key,id] of Object.entries({explore:'btnExplore',report:'btnReport',recovery:'btnRecovery',prevention:'btnPrevention',blackout:'btnBlackout'})){if($(id))$(id).classList.toggle('active',which===key)}
 const intro=document.querySelector('.intro');if(intro)intro.hidden=which==='recovery'||which==='prevention'||which==='blackout';
 if(which==='report'){track('report_open');loadConfig()}else if(which==='explore')setTimeout(()=>map?.invalidateSize(),90);
 $('resultScroll')?.scrollTo({top:0,behavior:'instant'});
}

const englishAliases={'巴黎':'Paris','巴塞罗那':'Barcelona','罗马':'Rome','伦敦':'London','米兰':'Milan','威尼斯':'Venice','佛罗伦萨':'Florence','马德里':'Madrid','维也纳':'Vienna','阿姆斯特丹':'Amsterdam','布拉格':'Prague','布达佩斯':'Budapest','苏黎世':'Zurich','慕尼黑':'Munich','柏林':'Berlin','爱丁堡':'Edinburgh','里斯本':'Lisbon','雅典':'Athens','日内瓦':'Geneva','哥本哈根':'Copenhagen','赫尔辛基':'Helsinki','尼斯':'Nice','萨尔茨堡':'Salzburg','布鲁塞尔':'Brussels'};
function cityText(c){return `${c.country} ${c.name} ${englishAliases[c.name]||''} ${(c.sights||[]).join(' ')}`.toLowerCase()}
function findCity(){const selectedId=$('citySelect').value;if(selectedId)return cities.find(c=>String(c.id)===selectedId);const q=$('citySearch').value.trim().toLowerCase();return q?cities.find(c=>c.name.toLowerCase()===q||c.country.toLowerCase()===q):null}
function countReports(){return publicReports.length}
function citySummary(city){if(!city)return '请选择目的地或移动地图查看';const reports=publicReports.filter(x=>x.city===city.name).length;const z=hotspots.filter(x=>x.city===city.name).length;return `${city.name} · ${reports}条已审核游客报告 · ${z}片经核验区域`}
function focus(city){selected=city; if(!city)return; $('mapPlace').textContent=citySummary(city);if(map){map.flyTo([city.lat,city.lon],12,{duration:.5})}renderCards();track('area_open',city.name)}
function fillCountries(){const names=[...new Set(cities.map(c=>c.country))].sort((a,b)=>a.localeCompare(b,'zh'));for(let id of ['countrySelect','reportCountry']){$(id).insertAdjacentHTML('beforeend',names.map(n=>`<option value="${h(n)}">${h(n)}</option>`).join(''))}}
function fillCities(selectId,filterCountry='',term=''){const v=$(selectId),prior=v.value;v.innerHTML='<option value="">'+(selectId==='reportCity'?'选择城市':'全部城市')+'</option>';const list=cities.filter(c=>(!filterCountry||c.country===filterCountry)&&(!term||(cityText(c)).toLowerCase().includes(term.toLowerCase()))); v.insertAdjacentHTML('beforeend',list.map(c=>`<option value="${h(c.id)}">${h(c.name)}</option>`).join(''));if(list.some(c=>String(c.id)===prior))v.value=prior;return list}

function labelDate(value){return value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:value||'时间未公开'}
function renderCards(){
 const q=$('citySearch').value.trim().toLowerCase(),country=$('countrySelect').value,wrap=$('zoneCards');
 const matchLocation=o=>(!selected||o.city===selected.name)&&(!country||o.country===country)&&(!q||[o.country,o.city,o.spot_name||o.label||'',o.short_summary||''].join(' ').toLowerCase().includes(q));
 const events=verifiedEvents.filter(matchLocation).sort((a,b)=>String(b.occurred_on||b.source_published_on||'').localeCompare(String(a.occurred_on||a.source_published_on||''))).slice(0,20);
 const reports=publicReports.filter(matchLocation).slice(0,12);
 const matches=hotspots.filter(matchLocation).sort((a,b)=>Number(b.evidence_count||0)-Number(a.evidence_count||0));
 const multiCases=v2Areas.filter(matchLocation);
 const proven=showAllZones?matches.slice(0,MAX_ZONES):matches.slice(0,12);
 let out='';
 if(events.length){
  out+='<div class="guidance-title">最近经核验的单条事件</div>';
  out+=events.map(e=>{
   const date=e.occurred_on?'发生于 '+labelDate(e.occurred_on):'发生时间未公开';
   const publish=e.source_published_on?' · 来源发布 '+labelDate(e.source_published_on):'';
   const range=e.location_precision==='approx_area'?'2公里提醒圈（不是案发半径）':e.location_precision==='district'?'区级位置':e.location_precision==='city'?'城市范围':'无可用位置范围';
   const obj=e.item_category||'物品未说明';
   const kind=e.source_type==='official_case'?'官方记录':e.source_type==='consular_case'?'领馆案例':e.source_type==='journalism_case'?'媒体案例':'人工审核游客自述';
   return '<article class="zone-card"><div class="row"><b>'+h(e.city)+' · '+h(e.spot_name||'地点未细化')+'</b><span class="tag confirmed">'+h(kind)+'</span></div><div class="v2-essential"><span><strong>'+h(date)+'</strong></span><span>范围：'+h(range)+'</span><span>物品：'+h(obj)+'</span></div><div class="v2-headline">'+h(e.short_summary)+'</div><details class="v2-details"><summary>查看出处与说明</summary><p>资料发布日期'+h(publish||'：未确认')+' · '+h(e.event_kind==='confirmed_theft'?'盗窃记录':e.event_kind==='alleged_theft'?'疑似盗窃陈述':'物品遗失或安全描述')+'</p><a href="'+h(safeUrl(e.source_url))+'" target="_blank" rel="noopener noreferrer">原始来源 ↗</a></details></article>';
  }).join('');
 }
 if(multiCases.length){
  out+='<div class="guidance-title">🚨 警方调查多案汇总（不按单案拆分）</div>';
  out+=multiCases.map(a=>'<article class="zone-card regional-series"><div class="row"><b>'+h(a.city)+' · '+h(a.spot_name)+'</b><span class="tag confirmed">多起事件汇总</span></div><div class="v2-essential"><span>资料发布：'+h(a.last_source_on||'未确认')+'</span><span>展示半径：2公里</span><span>来源记载：'+Number(a.verified_event_count||0)+'起</span></div><p class="v2-headline">'+h(a.sample_summary||'警方公开调查记录')+'</p><details class="v2-details"><summary>查看原始报道和口径</summary><p>这是调查报告中的系列案件汇总，不是 '+Number(a.verified_event_count||0)+'条单独上传事件。地图2公里仅是查询区域，不代表每处都发生盗窃。</p>'+((a.source_urls||[]).filter(x=>safeUrl(x)!=='#').map(x=>'<p><a href="'+h(safeUrl(x))+'" rel="noopener noreferrer" target="_blank">阅读来源 ↗</a></p>').join(''))+'</details></article>').join('');
 }
 if(reports.length){
  out+='<div class="guidance-title">游客匿名上传 · 已审核</div>';
  out+=reports.map(x=>'<article class="zone-card"><div class="row"><b>'+h(x.city)+' · '+h(x.spot_name_public||'匿名区域')+'</b><span class="tag">游客自述</span></div><div class="v2-essential"><span>发现于 '+h(x.occurred_on||'未知日期')+'</span><span>位置：2公里提醒圈（并非案发半径）</span><span>物品：'+h(x.item_category||'未分类')+'</span></div><div class="v2-headline">'+h(x.public_summary||'暂无摘要')+'</div><details class="v2-details"><summary>数据说明</summary>游客自述，不等同于警方确认案件。具体地址与个人资料不公开。</details></article>').join('');
 }
 if(matches.length){
  out+='<div class="guidance-title">警方公开数据 · 区域统计</div>';
  out+=proven.map(z=>{
   const period=z.period_start&&z.period_end?z.period_start.slice(0,7)+'—'+z.period_end.slice(0,7):'统计月份未公布';
   const isUk=z.source_type==='official_street_data';
   const range=isUk?'2公里示意圈（底层约1公里警方网格）':'2公里示意提醒范围';
   const n=Number(z.evidence_count)||0;
   const headline=isUk?'警方在伦敦该网格记录 '+n+' 条「从个人身上盗窃」类事件。':'该区域有 '+n+' 条公开核验记录。';
   return '<article class="zone-card" data-zone="'+h(z.id)+'" role="button" tabindex="0"><div class="row"><b>'+h(z.city)+' · '+h(z.label)+'</b><span class="tag confirmed">官方统计</span></div><div class="v2-essential"><span><strong>统计期：'+h(period)+'</strong></span><span>范围：'+h(range)+'</span><span>记录：'+n+'条</span></div><div class="v2-headline">'+h(headline)+'</div><details class="v2-details"><summary>查看统计口径与来源</summary><p>警方原始位置已匿名化，统计不代表最近一宗事件的具体日期，也不代表游客被盗概率。</p><p>'+h(z.method_note||'')+'</p><a href="'+h(safeUrl(z.source_url))+'" target="_blank" rel="noopener noreferrer">官方资料 ↗</a></details></article>';
  }).join('');
  if(matches.length>12)out+='<button class="zone-more" type="button" id="loadZones">'+(showAllZones?'收起区域':'查看其余 '+(matches.length-12)+' 片区域')+'</button>';
 }
 if(!out){out=selected?'<div class="empty"><b>'+h(selected.name)+'：暂无可核验的逐条失窃记录</b><p>下方有公开旅游防盗资料（如有）。你也可以匿名提供亲历事件。</p></div>':'<div class="empty">请选择城市或景点查看来源和记录。没有记录不等于安全。</div>'}
 wrap.innerHTML=out;
 $('zoneCount').textContent=matches.length+'片警方网格 · '+events.length+'条来源个案 · '+multiCases.length+'片系列汇总';
 wrap.querySelectorAll('[data-zone]').forEach(el=>{const show=()=>{const z=hotspots.find(x=>String(x.id)===el.dataset.zone);if(z)showZone(z)};el.onclick=e=>{if(e.target.closest('a,summary,details'))return;show()};el.onkeydown=e=>{if(e.key==='Enter')show()}});
 const more=$('loadZones');if(more)more.onclick=()=>{showAllZones=!showAllZones;renderCards()};
 renderAdvisoriesAndSpots();
 window.FindThiefMedia?.render?.(selected?.name||'');
}

function renderAdvisoriesAndSpots(){
 const q=$('citySearch').value.trim().toLowerCase(),country=$('countrySelect').value;
 const matches=advisories.filter(a=>(!selected||a.city===selected.name)&&(!country||a.country===country)&&(!q||[a.country,a.city,a.spot_name].join(' ').toLowerCase().includes(q))).slice(0,22);
 const type={official_statistics:'官方地区统计',government_travel_advice:'政府防盗提醒',historical_government_notice:'历史提醒',chinese_consular_notice:'中国领馆公开案例',journalism_observation:'媒体观察'};
 const scope={citywide:'整座城市',district:'行政区范围',transit:'公共交通范围',site_context:'景区参考提示'};
 const wrap=$('advicePanel');
 wrap.innerHTML=matches.length?'<div class="guidance-title">公开防盗资料（非景区案件）</div>'+matches.map(a=>{
  const stat=a.statistic_value!=null?'<span class="advice-stat">'+Number(a.statistic_value).toLocaleString('zh-CN')+'条</span> '+h(a.statistic_year)+'年 '+h(a.statistic_label||'地区记录'):'';
  const date=a.source_date?'资料发布：'+h(a.source_date):'具体发布时间未确认';
  const summary=stat||h(a.brief_zh).slice(0,90);
  return '<details class="advice-card"><summary><span class="advice-tag">'+h(type[a.evidence_kind]||'公开资料')+'</span><h3>'+h(a.city)+' · '+h(a.spot_name)+'</h3><div class="v2-record-summary">'+summary+'</div><div class="v2-essential"><span>'+date+'</span><span>范围：'+h(scope[a.scope]||'未明确')+'</span></div></summary><p>'+h(a.brief_zh)+'</p>'+(Array.isArray(a.case_items)&&a.case_items.length?'<p>原文公开案例提及：'+a.case_items.map(i=>h(i)).join(' / ')+'。不是本站真实上报排名。</p>':'')+'<p class="qualify">'+h(a.qualification_zh)+'</p><a href="'+h(safeUrl(a.source_url))+'" target="_blank" rel="noopener noreferrer">查看公开来源 ↗</a><button type="button" class="linkbtn" data-advice="'+h(a.id)+'">地图定位</button></details>';
 }).join(''):(selected?'<p class="muted">该城市暂无精确到景区的可核验事件资料。</p>':'');
 wrap.querySelectorAll('[data-advice]').forEach(b=>b.onclick=()=>{const a=advisories.find(x=>x.id===b.dataset.advice);if(a&&map){map.flyTo([a.latitude,a.longitude],14);$('mapPlace').textContent=a.city+' · '+a.spot_name+'（资料参考位置）'}});
 const box=$('lostWhatPanel');if(!selected){box.innerHTML='';return}
 const sourced=verifiedEvents.filter(e=>e.city===selected.name&&e.item_category);
 const counts={};for(const e of sourced)counts[e.item_category]=(counts[e.item_category]||0)+1;
 const sourcedText=Object.keys(counts).length?'<div class="sourced-items"><b>🧳 此城有出处的事件涉及</b><div>'+Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name,n])=>'<span class="sourced-item-chip">'+h(name)+' '+n+'条来源个案</span>').join('')+'</div><small>这是已收录的报道/官方个案分类，不是该城市实际失窃率；不同媒体重复报道已尽量去重。</small></div>':'<p class="muted">本城暂无已核验的单独失窃事件物品记录。</p>';
 box.innerHTML='<div class="guidance-title">🎒 这些景区报道都丢了什么？</div>'+sourcedText+'<p class="muted">游客匿名上传的排行榜另行统计，目前每类不足3条不会显示。</p><div class="spot-item-grid">'+(selected.sights||[]).slice(0,8).map(name=>{
 const a=lostItems.filter(x=>x.city===selected.name&&x.spot_name===name);
 const summary=a.length?a.map(x=>h(x.item_category)+' '+Number(x.count)+'条').join('、'):'暂无已审核物品数据';
 return '<div class="spot-item"><b>'+h(name)+'</b><small>'+summary+'</small><button type="button" data-report-spot="'+h(name)+'">我也要报丢失</button></div>'
 }).join('')+'</div>';
 box.querySelectorAll('[data-report-spot]').forEach(b=>b.onclick=()=>{button('report');$('reportCountry').value=selected.country;setReportCities();$('reportCity').value=String(selected.id);setReportSpots();$('reportSpot').value=b.dataset.reportSpot});
}
function setReportSpots(){
 const c=cities.find(x=>String(x.id)===$('reportCity').value);$('reportSpot').innerHTML='<option value="">不确定或不在景区</option>'+(c?.sights||[]).map(x=>'<option value="'+h(x)+'">'+h(x)+'</option>').join('');
}
function riskLabel(z){const n=Number(z.evidence_count||0),t=String(z.source_type||'');if(n<3)return'数据不足';if(t==='official_street_data'){const a=String(z.period_start||'').slice(0,7),b=String(z.period_end||'').slice(0,7);const count=(+b.slice(0,4)-(+a.slice(0,4)))*12+(+b.slice(5)-(+a.slice(5)))+1;const monthly=n/Math.max(1,count);return monthly>=20?'官方记录较集中':monthly>=6?'官方记录较多':'有警方公开记录'}return n>=6?'多条审核记录':'有审核记录'}
function showZone(z){if(z.lat!=null&&z.lon!=null)map?.flyTo([z.lat,z.lon],12);$('mapPlace').textContent=`${z.city} · ${z.label} · ${riskLabel(z)}`;track('area_open',z.city)}
function clearLayers(){for(const x of [...layers,...markers]){try{map.removeLayer(x)}catch{}}layers=[];markers=[]}
function drawEvidence(){
 if(!map||typeof L==='undefined')return;clearLayers();
 for(const z of hotspots){
  if(!Number.isFinite(+z.lat)||!Number.isFinite(+z.lon))continue;
  const n=Number(z.evidence_count)||0,shade=n>=60?'#bd614b':n>=18?'#d99532':'#e5bb66';
  const area=L.circle([+z.lat,+z.lon],{radius:DISPLAY_RADIUS_M,color:shade,fillColor:shade,fillOpacity:n>=60?.13:.065,weight:1.3});
  area.bindPopup('<b>'+h(z.city)+' · 官方警方记录</b><br>统计期：'+h((z.period_start||'').slice(0,7))+'—'+h((z.period_end||'').slice(0,7))+'<br>记录：'+n+' 条<br><small>2公里是地图示意缓冲圈，不是犯罪影响范围。实际统计来自匿名化网格。</small><br><a href="'+h(safeUrl(z.source_url))+'" target="_blank" rel="noopener noreferrer">官方出处 ↗</a>');
  area.addTo(map);layers.push(area);
 }
 for(const e of verifiedEvents){
  if(!Number.isFinite(+e.lat)||!Number.isFinite(+e.lon))continue;
  const area=L.circle([+e.lat,+e.lon],{radius:DISPLAY_RADIUS_M,color:'#15856f',fillColor:'#6cc7aa',fillOpacity:.13,weight:2});
  area.bindPopup('<b>'+h(e.city)+' · '+h(e.spot_name||'已审核事件')+'</b><br>发生：'+h(e.occurred_on||'时间未公开')+' · 物品：'+h(e.item_category||'未说明')+'<br>'+h(e.short_summary)+'<br><small>2公里为查询提醒范围，非实际案发半径。</small><br><a href="'+h(safeUrl(e.source_url))+'" target="_blank" rel="noopener noreferrer">事件来源 ↗</a>');
  area.addTo(map);layers.push(area);
 }
 for(const a of v2Areas){
  if(!Number.isFinite(+a.lat)||!Number.isFinite(+a.lon))continue;
  const area=L.circle([+a.lat,+a.lon],{radius:DISPLAY_RADIUS_M,color:'#188b74',fillColor:'#70c6af',fillOpacity:.08,weight:2});
  area.bindPopup('<b>'+h(a.city)+' · '+h(a.spot_name)+'</b><br>已审核事件 '+Number(a.verified_event_count||0)+' 条<br><small>2公里查询示意范围，并非实际犯罪半径。</small>');
  area.addTo(map);layers.push(area);
 }
 for(const a of advisories){
  // General national/city notices have no local crime radius: only site-context gets a dotted browsing buffer.
  if(a.scope!=='site_context'||!Number.isFinite(+a.latitude)||!Number.isFinite(+a.longitude))continue;
  const area=L.circle([+a.latitude,+a.longitude],{radius:DISPLAY_RADIUS_M,color:'#548eb1',fillColor:'#a8d3ed',fillOpacity:.035,weight:1,dashArray:'6 7',opacity:.7});
  area.bindPopup('<b>'+h(a.spot_name)+'</b><br><strong>公开旅行安全建议，非经核验案发地</strong><br>'+h(a.brief_zh)+'<br><small>蓝色虚线2公里只用于周边资料浏览。</small><br><a href="'+h(safeUrl(a.source_url))+'" target="_blank" rel="noopener noreferrer">查看出处 ↗</a>');
  area.addTo(map);layers.push(area);
 }
 for(const x of publicReports){
  if(!Number.isFinite(+x.display_lat)||!Number.isFinite(+x.display_lon))continue;
  const area=L.circle([+x.display_lat,+x.display_lon],{radius:DISPLAY_RADIUS_M,color:'#7759b9',fillColor:'#baabdf',fillOpacity:.12,weight:2});
  area.bindPopup('<b>'+h(x.city)+' · 游客已审核自述</b><br>'+h(x.occurred_on)+' · '+h(x.item_category||'失物未说明')+'<br>'+h(x.public_summary)+'<br><small>2公里提醒圈并非警方确认的盗窃范围。</small>');
  area.addTo(map);layers.push(area);
 }
 $('statAreas').textContent=hotspots.length;$('statReports').textContent=countReports();
 $('statUpdated').textContent=hotspots.length?(officialLatestMonth||'已载入'):'待更新';
}

function initMap(){if(typeof L==='undefined'){$('map').innerHTML='<div class="empty">地图网络资源加载失败。请刷新页面，或使用搜索列表。</div>';return}map=L.map('map',{center:[47,12],zoom:5,minZoom:3,scrollWheelZoom:false,tap:false,zoomControl:true,attributionControl:true,dragging:dragEnabled});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:18}).addTo(map);if(!dragEnabled)$('map').classList.add('map-scroll');$('useDrag').textContent='地图拖动：'+(dragEnabled?'开':'关');map.on('click',ev=>{if(!pickMode)return;selectedPin={lat:+ev.latlng.lat.toFixed(5),lon:+ev.latlng.lng.toFixed(5)};pickMode=false;button('report');$('pinText').textContent=`已选事发点 ${selectedPin.lat}, ${selectedPin.lon}；仅内部审核使用`;});setTimeout(()=>map?.invalidateSize(),150);drawEvidence();}
function showGuide(risk=false){$('modalTitle').textContent=risk?'危险程度如何判断？':'3步使用小偷在哪里';$('modalBody').innerHTML=risk?`<p>只有可核查的警方公开数据、允许复用的来源或人工审核的游客报告，才进入地图的事件层。</p><div class="guide-step"><b>记录较集中</b><p>同一官方采样网格平均每月至少20条相关记录，显示为「较集中」。这不是警方危险等级，也未按客流归一化。</p></div><div class="guide-step"><b>多条记录 / 有核验记录</b><p>公开记录月均6—19条显示「较多」，3条以上显示「有警方公开记录」；未确认社交帖子不进入评级。</p></div><div class="guide-step"><b>数据不足</b><p>缺乏足够且可核查的记录时不评级；0条记录绝不意味着“安全”。不同城市的原始计数不可直接比较危险程度。</p></div>`:`<div class="guide-step"><b>01 搜索地点</b><p>输入中国游客常用的中文城市、国家或景点名称，地图会定位。左侧信息区独立上下滚动，地图始终保持原位，可独立拖动。</p></div><div class="guide-step"><b>02 判断证据</b><p>点开区域，先看事件数、时间、数据类型与原始来源；没有证据就显示数据不足。</p></div><div class="guide-step"><b>03 匿名报失</b><p>不需账户，不填姓名或电话，只填具体地址、时间、类型与经过。审核后仅公开大致范围，不能作为正式报警。</p></div><p class="muted">使用方向：为中国游客服务；中国的小红书、微博、携程、马蜂窝、穷游、中文媒体及海外公开资料均可成为待核验线索；只有许可清楚、具备证据且经过审核的记录才形成地图区域。</p>`;$('guideModal').showModal()}
function showSources(){$('modalTitle').textContent='当前公开证据来源';$('modalBody').innerHTML=`<div class="guide-step"><b>英国警方公开犯罪记录（开放CSV）</b><p><a target="_blank" rel="noopener" href="https://data.police.uk/data/">data.police.uk/data</a> · OGL v3，包含匿名化街道级犯罪事件，可按时间聚合。</p></div><div class="guide-step"><b>法国政府SSMSI统计</b><p><a target="_blank" rel="noopener" href="https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales">市镇/省级统计</a> · 不当成具体街道事件。</p></div><div class="guide-step"><b>加泰罗尼亚ICGC犯罪统计地图</b><p><a href="https://www.icgc.cat/en/Tools-and-viewers/Viewers/Crime-map" target="_blank" rel="noopener">警方分区数据</a> · 仅能映射相应分区，不能伪造精确发生点。</p></div><div class="guide-step"><b>国内中文来源（线索发现）</b><p>小红书、微博、微信公众号、携程、马蜂窝、穷游以及中国公开新闻报道；优先识别中国游客常用地名和中文失窃描述。未获授权的帖文不抓取全文、不直接作为风险等级。</p></div><div class="guide-step"><b>海外来源（事实核验）</b><p>当地警方开放数据、政府统计、当地公开新闻与允许复用的旅游安全公告。提供日期、案件类别、区划或模糊位置及原始链接。</p></div><p class="muted">海外与国内均属于信息来源；地图只展示经核验且有合法复用依据的区域。</p>`;$('guideModal').showModal()}
async function loadEvidence(){
  try{
    const r=await fetch('/api/hotspots',{cache:'no-store'});
    if(r.ok){const j=await r.json();hotspots=Array.isArray(j.areas)?j.areas:[]}
  }catch(e){}
  if(!hotspots.length){
    try{
      const r=await fetch('/data/verified-uk-police-areas.json',{cache:'no-store'});
      if(r.ok){
        const d=await r.json();
        hotspots=Array.isArray(d.areas)?d.areas:[];
        officialLatestMonth=String(d.data_latest_month||'');
        $('evidenceInfo').innerHTML='<b>英国警方公开记录 · 伦敦2026年6—8月</b><p>74片约1公里官方记录网格，仅包含伦敦9个样本查询中心。颜色表示记录数量的相对集中程度，不代表被盗概率或警方危险等级。<a target="_blank" rel="noopener noreferrer" href="https://data.police.uk/data/">查看官方来源 ↗</a></p>';
      }
    }catch(e){}
  }
  try{
    const r=await fetch('/api/reports',{cache:'no-store'});
    if(r.ok){const j=await r.json();publicReports=Array.isArray(j.items)?j.items:[]}
  }catch(e){}
  try{const r=await fetch('/data/multicountry-advisories.json',{cache:'no-store'});if(r.ok){const j=await r.json();advisories=Array.isArray(j.items)?j.items:[]}}catch{}
  try{const r=await fetch('/api/lost-items',{cache:'no-store'});if(r.ok){const j=await r.json();lostItems=Array.isArray(j.items)?j.items:[]}}catch{}
  let approvedEventsApiAvailable=false;
  try{const r=await fetch('/api/events-v2',{cache:'no-store'});if(r.ok){const j=await r.json();if(j.available===true){approvedEventsApiAvailable=true;verifiedEvents=Array.isArray(j.items)?j.items:[];v2Areas=Array.isArray(j.areas)?j.areas:[]}}}catch{}
  if(!approvedEventsApiAvailable){try{const r=await fetch('/data/verified-events-v21.json',{cache:'no-store'});if(r.ok){const j=await r.json();if(j.verified_public_snapshot===true&&Array.isArray(j.items)){verifiedEvents=j.items;v2Areas=Array.isArray(j.areas)?j.areas:[];}}}catch{}}
  drawEvidence();renderCards();
}
async function loadConfig(){try{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)throw Error('接口不可用');const o=await r.json();reportEnabled=o.reportSubmissionsEnabled===true;$('reportState').classList.toggle('warning',!reportEnabled);$('reportState').textContent=reportEnabled?'在线提交已开启：报告只进入待审核队列，不会直接公开；无需注册。':'线上数据库投稿暂未开放：你可以在本机保存草稿，但尚不能上传服务器。请勿误认为保存成功即已送交审核。';$('sendReport').disabled=!reportEnabled;$('sendReport').textContent=reportEnabled?'提交待审核':'线上提交暂不可用'}catch{$('reportState').textContent='无法确认服务状态；只允许本机保存草稿。';$('reportState').classList.add('warning');$('sendReport').disabled=true}}
function setReportCities(){fillCities('reportCity',$('reportCountry').value)}
function payload(){const city=cities.find(c=>String(c.id)===$('reportCity').value);return {country:city?.country||'',city:city?.name||'',address:$('reportAddress').value.trim(),date:$('reportDate').value,type:$('reportCategory').value,item_category:$('reportItem').value,spot_name:$('reportSpot').value,description:$('reportDesc').value.trim(),lat:selectedPin?.lat??null,lon:selectedPin?.lon??null,consent:$('reportConsent').checked}}
function localSave(){if(!$('reportForm').reportValidity())return;const d=payload();try{const a=JSON.parse(localStorage.getItem('find_thief_local_reports')||'[]');a.push({country:d.country,city:d.city,address:d.address,date:d.date,type:d.type,item_category:d.item_category,spot_name:d.spot_name,description:d.description,createdAt:new Date().toISOString()});localStorage.setItem('find_thief_local_reports',JSON.stringify(a.slice(-30)));$('reportFeedback').className='muted success';$('reportFeedback').textContent='仅保存在本设备浏览器中（未上传，不会出现在地图或后台）。清理本网站浏览器存储即可删除。';track('report_saved',d.city)}catch{$('reportFeedback').className='muted error';$('reportFeedback').textContent='浏览器禁止本机存储；请检查隐私模式或浏览器存储权限。'}}

async function submit(e){e.preventDefault();if(!reportEnabled){$('reportFeedback').textContent='服务器未启用在线接收；你可以先保存本机草稿。';return}const d=payload();if(!d.city||!d.address||!d.date||!d.description)return;$('sendReport').disabled=true;$('reportFeedback').textContent='正在发送…';track('report_attempt',d.city);try{const r=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const j=await r.json();if(!r.ok)throw Error(j.error||'提交失败');$('reportFeedback').className='muted success';$('reportFeedback').textContent='已进入待审核队列，回执：'+(j.receipt||'待生成')+'。不会立即公开到地图。';$('reportForm').reset();}catch(err){$('reportFeedback').className='muted error';$('reportFeedback').textContent=err.message||'上传失败'}finally{$('sendReport').disabled=!reportEnabled}}
async function boot(){try{const r=await fetch('/cities.json');const data=await r.json();cities=Array.isArray(data)?data:(Array.isArray(data.cities)?data.cities:[]);fillCountries();fillCities('citySelect');setReportCities();setReportSpots();const hash=decodeURIComponent(location.hash.slice(1));if(hash.startsWith('city=')){const name=hash.slice(5);const c=cities.find(x=>x.name===name);if(c){$('countrySelect').value=c.country;fillCities('citySelect',c.country);$('citySelect').value=String(c.id);selected=c}}}catch(err){$('zoneCards').innerHTML='<div class="empty">城市目录暂时加载失败，请稍后重试。</div>'}
initMap();if(selected)focus(selected);else {const london=cities.find(c=>c.name==='伦敦');if(london){$('countrySelect').value=london.country;fillCities('citySelect',london.country);$('citySelect').value=String(london.id);focus(london)}else renderCards()}loadEvidence();loadConfig();track('page_view');
$('btnExplore').onclick=()=>button('explore');$('btnReport').onclick=()=>button('report');$('guideTrigger').onclick=()=>showGuide();$('guideBottom').onclick=()=>showGuide();$('howRisk').onclick=()=>showGuide(true);$('guideOK').onclick=$('closeGuide').onclick=()=>$('guideModal').close();$('guideModal').addEventListener('click',e=>{if(e.target===$('guideModal'))$('guideModal').close()});
$('citySearch').addEventListener('input',()=>{clearTimeout(searchTimeout);searchTimeout=setTimeout(()=>{
 const term=$('citySearch').value.trim().toLowerCase();
 fillCities('citySelect',$('countrySelect').value,term);
 if(term){
  const city=cities.find(x=>x.name.toLowerCase()===term||englishAliases[x.name]?.toLowerCase()===term||
    (x.sights||[]).some(spot=>spot.toLowerCase().includes(term)));
  if(city){
   selected=city;$('countrySelect').value=city.country;fillCities('citySelect',city.country,term);$('citySelect').value=String(city.id);
   const place=(city.sights||[]).find(x=>x.toLowerCase().includes(term));
   const pt=place&&city.located?.[place];
   if(map)map.flyTo(pt||[city.lat,city.lon],pt?14:12);
   $('mapPlace').textContent=place?city.name+' · '+place+'（景点位置，不代表案发点）':city.name;
  }else if(selected&&!cityText(selected).includes(term))selected=null;
 }
 showAllZones=false;renderCards();if(term)track('search');
},420)});
$('countrySelect').onchange=()=>{showAllZones=false;fillCities('citySelect',$('countrySelect').value,$('citySearch').value.trim());selected=null;renderCards()};$('citySelect').onchange=()=>{const c=findCity();if(c){showAllZones=false;focus(c);history.replaceState(null,'','#city='+encodeURIComponent(c.name))}else{selected=null;renderCards()}};
$('resetMap').onclick=()=>{selected=null;$('citySearch').value='';$('countrySelect').value='';fillCities('citySelect');map?.setView([47,12],5);$('mapPlace').textContent='欧洲 · 风险证据地图';renderCards()};$('useDrag').onclick=()=>{dragEnabled=!dragEnabled;if(map){dragEnabled?map.dragging.enable():map.dragging.disable()}$('map').classList.toggle('map-scroll',!dragEnabled);$('useDrag').textContent='地图拖动：'+(dragEnabled?'开':'关')};
$('reportCountry').onchange=()=>{setReportCities();setReportSpots()};$('reportCity').onchange=setReportSpots;$('reportDate').max=new Date().toISOString().slice(0,10);$('reportDate').value=$('reportDate').max;
document.querySelectorAll('[data-pick-city]').forEach(b=>{b.onclick=()=>{const c=cities.find(x=>x.name===b.dataset.pickCity);if(!c)return;$('citySearch').value='';$('countrySelect').value=c.country;fillCities('citySelect',c.country);$('citySelect').value=String(c.id);focus(c);history.replaceState(null,'','#city='+encodeURIComponent(c.name));$('resultScroll')?.scrollTo({top:0,behavior:'instant'});document.querySelectorAll('[data-pick-city]').forEach(q=>q.classList.toggle('active',q===b))}});
$('reportForm').onsubmit=submit;$('saveDraft').onclick=localSave;$('selectPin').onclick=()=>{if(!map){$('pinText').textContent='地图资源暂不可用，请输入具体地址';return}const c=cities.find(x=>String(x.id)===$('reportCity').value);if(c)map.setView([c.lat,c.lon],14);pickMode=true;dragEnabled=true;map.dragging.enable();$('map').classList.remove('map-scroll');$('useDrag').textContent='地图拖动：开';button('explore');$('mapPlace').textContent='📍 请点击地图选择事发点（只保存于你的表单）';$('pinText').textContent='等待地图点击…';$('map').focus({preventScroll:true})};
/* V2: first screen opens directly on the map; user can tap “如何使用” any time. */}
window.FindThiefUI={button,getCity:()=>selected?.name||''};
boot();
})();
