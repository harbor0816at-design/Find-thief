/* Find-thief V1.1 enhancement: transparent advisory AREAS, address-level reminders, emergency steps */
(()=>{
  'use strict';
  let guidance=[],areaLayers=[],areasOn=true,pickActive=false,pendingReport={},publishedReports=[];
  const h=escapeHTML;
  function safeUrl(u){try{const p=new URL(u);return ['https:','http:'].includes(p.protocol)?p.href:'#'}catch{return '#'}}
  const pos=n=>typeof n==='number'&&Number.isFinite(n);
  const notices=document.createElement('div'); notices.id='advisoryList';notices.className='area-banner';notices.textContent='绿色阴影表示出行安全提醒覆盖范围（示意），并非犯罪热点、犯罪率或已核实事件。选中城市查看详细说明。';
  const pp=$('placesPanel');pp.insertBefore(notices,pp.querySelector('.section-top'));
  const referenceInfo=document.createElement('div');referenceInfo.id='areaReferences';pp.insertBefore(referenceInfo,pp.querySelector('.city-list'));
  function titleFor(z){return z.level==='guide'?'外部指南·地标周边':'基础防盗提醒'}
  function areaHTML(z){return `<div class="region-item"><div class="region-title"><span class="region-mark">${titleFor(z)}</span>${h(z.label)}</div><div class="region-note">${h(z.description)}</div>${z.level==='guide'?`<a href="${h(safeUrl(z.source))}" target="_blank" rel="noopener noreferrer">查看对应外部旅行指南 ↗</a>`:''}</div>`}
  function removeAreas(){areaLayers.forEach(x=>{try{leaflet?.removeLayer(x)}catch{}});areaLayers=[];}
  function drawAreas(){removeAreas();if(!areasOn||provider!=='osm'||!leaflet||typeof L==='undefined')return;
    const c=selectedSafe();const shown=c?guidance.filter(z=>z.city===c.name):guidance.filter(z=>z.level==='general');
    shown.forEach(z=>{if(!pos(z.lat)||!pos(z.lon))return;let guide=z.level==='guide';
      let circle=L.circle([z.lat,z.lon],{radius:z.radius_m,color:guide?'#e4a143':'#389f8b',fillColor:guide?'#f5c47a':'#67bba5',fillOpacity:guide?.14:.075,weight:guide?2:1,opacity:.65,interactive:true});
      circle.bindPopup(`<strong>${h(z.label)}</strong><br>${h(z.description)}<br>${guide?`<a href="${h(safeUrl(z.source))}" target="_blank" rel="noopener noreferrer">原始来源 ↗</a>`:'普通旅行提醒（非犯罪报告）'}`);circle.addTo(leaflet);areaLayers.push(circle);
    });
    for(const v of publishedReports){if(!Number.isFinite(v.display_lat)||!Number.isFinite(v.display_lon))continue;if(c&&v.city!==c.name)continue;
      const r=L.circle([v.display_lat,v.display_lon],{radius:800,color:'#8252ae',fillColor:'#bd97df',fillOpacity:.17,weight:2}).addTo(leaflet);
      r.bindPopup(`<b>审核通过的游客报告（非警方认定）</b><br>${h(v.city)} · ${h(v.category)} · ${h(v.occurred_on)}<br>${h(v.public_summary||'无摘要')}<br><small>地点已作模糊处理，圆形不是精确事发范围</small>`);areaLayers.push(r);
    }
    updateAreaInfo();
  }
  function updateAreaInfo(){const c=selectedSafe(),arr=c?guidance.filter(z=>z.city===c.name):[];
    $('areaReferences').innerHTML=c?`<div class="area-banner"><b>${h(c.name)}：${arr.length}片旅行安全提示区</b><div>范围用圆形参考缓冲区表示，不能当作实际犯罪集中区域。</div>${arr.filter(x=>x.level==='guide').slice(0,3).map(x=>areaHTML(x)).join('')}</div>`:'';
    if(innerWidth>780&&c){$('regionPanel').style.display='block';$('regionPanel').innerHTML=`<div class="region-head"><b>▧ ${h(c.name)} · 区域提醒</b><span class="pill-warning">非真实警情</span></div><p class="region-note">圆形覆盖区为地标周边示意，不表示犯罪率或案发边界。</p>${arr.filter(x=>x.level==='guide').slice(0,3).map(areaHTML).join('')||'<p class="region-note">当前仅有通用安全提示，没有独立核实的该市失窃地点。</p>'}`}
    else $('regionPanel').style.display='none';
  }
  const oldSelectCity=selectCity;selectCity=function(id){oldSelectCity(id);drawAreas()};
  const oldResetMap=resetMap;resetMap=function(){oldResetMap();drawAreas()};
  const oldInitLeaflet=initLeaflet;initLeaflet=function(){oldInitLeaflet();if(innerWidth<=780&&leaflet){leaflet.dragging.disable();leaflet.scrollWheelZoom.disable();}setTimeout(drawAreas,20)};
  const oldSwitchMap=switchMap;switchMap=async function(p){removeAreas();await oldSwitchMap(p);if(p==='osm')drawAreas();if(p==='google')updateAreaInfo()};
  $('areaSwitch').onclick=()=>{areasOn=!areasOn;$('areaSwitch').setAttribute('aria-pressed',String(areasOn));$('areaSwitch').textContent=areasOn?'▧ 区域提示：开启':'▤ 区域提示：关闭';drawAreas();};
  // On mobile, tap button toggles map dragging without breaking normal page vertical scrolling.
  const dragBtn=document.createElement('button');dragBtn.type='button';dragBtn.textContent='✥ 拖动地图';dragBtn.className='map-areas-switch';dragBtn.style.cssText='top:204px;display:none';document.querySelector('.world').appendChild(dragBtn);
  if(innerWidth<=780){dragBtn.style.display='block';let enabled=false;dragBtn.onclick=()=>{if(provider!=='osm'||!leaflet)return toast('当前地图不支持此操作');enabled=!enabled;enabled?leaflet.dragging.enable():leaflet.dragging.disable();dragBtn.textContent=enabled?'✓ 地图拖动中（点此恢复滚动）':'✥ 拖动地图';toast(enabled?'现在可在地图上拖动，点此按钮恢复整页滚动':'已恢复页面向下滚动')};}
  fetch('/data/zone-guidance.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('加载失败');return r.json()}).then(d=>{guidance=Array.isArray(d.zones)?d.zones:[];drawAreas()}).catch(()=>{$('areaReferences').textContent='区域参考资料尚未加载，地图仍可正常使用。'});
  fetch('/api/reports',{cache:'no-store'}).then(r=>r.ok?r.json():{items:[]}).then(v=>{publishedReports=Array.isArray(v.items)?v.items:[];drawAreas()}).catch(()=>{});
  // Explicit address report; backend if configured, local draft fallback otherwise.
  async function getReportEnabled(){try{const r=await fetch('/api/config',{signal:AbortSignal.timeout(5000)});if(!r.ok)return false;const d=await r.json();return d.reportSubmissionsEnabled===true}catch{return false}}
  function remember(d){let arr=[];try{arr=JSON.parse(localStorage.getItem('xiaotou-drafts-v02')||'[]');if(!Array.isArray(arr))arr=[]}catch{};arr.push(d);try{localStorage.setItem('xiaotou-drafts-v02',JSON.stringify(arr.slice(-50)));return true}catch{return false}}
  function popupSubmitStatus(t){toast(t)}
  function latValid(v){return v!==''&&Number.isFinite(Number(v))&&Number(v)>=-90&&Number(v)<=90}
  function lonValid(v){return v!==''&&Number.isFinite(Number(v))&&Number(v)>=-180&&Number(v)<=180}
  const oldOpenReport=openReport;
  openReport=function(pre='',prefill={}){
    const current={...pendingReport,...prefill};
    const opts=cities.map(c=>`<option value="${h(c.country+'·'+c.name)}" ${c.name===(current.city||pre)?'selected':''}>${h(c.country+'·'+c.name)}</option>`).join('');
    modal(`<h2>📍 丢失提醒 · 记录具体位置</h2><p>请填写街道、地铁站出口、路口或商场名称。仅提供城市名无法定位事件。</p><form id="newReportForm">
      <label for="reportCity2">所在城市</label><select id="reportCity2">${opts}</select>
      <label for="reportAddress">具体地址 / 地标位置（必填）</label><input id="reportAddress" minlength="6" maxlength="160" required placeholder="例：巴塞罗那兰布拉大道 86号附近 / Liceu地铁站2号出口" value="${h(current.address||'')}">
      <div class="report-toolbox"><button type="button" id="setReportGPS">◎ 用当前位置</button><button type="button" id="mapReportPick">📍 从地图选位置</button><span id="coordinatesNote" style="font-size:11px;color:#637974">${pos(current.lat)&&pos(current.lon)?'已选地图坐标（仅后台留存待审核）':'尚未选地图坐标，可仅提交详细地址'}</span></div>
      <div class="report-grid"><div><label for="reportDate2">发现日期</label><input id="reportDate2" type="date" required value="${h(current.date||new Date().toISOString().slice(0,10))}" max="${new Date().toISOString().slice(0,10)}"></div><div><label for="reportType2">事件类别</label><select id="reportType2">${['物品遗失','疑似扒窃','已报警确认失窃','其他物品安全事件'].map(n=>`<option ${current.type===n?'selected':''}>${n}</option>`).join('')}</select></div></div>
      <label for="reportText2">具体经过（不要输入可识别个人信息）</label><textarea id="reportText2" minlength="12" maxlength="800" required placeholder="描述时间、如何发现遗失、附近街道或地铁线路；请勿描述个人可识别特征、上传照片或联系方式。">${h(current.description||'')}</textarea>
      <label class="report-help"><input id="agreeReport" type="checkbox" required style="width:auto;margin-right:6px">我确认不包含他人姓名、联系方式、可识别的体貌特征，并理解未审核信息不会直接出现在公开地图。</label>
      <div class="modal-footer"><button type="button" data-close class="plainbtn">取消</button><button type="submit" class="primarybtn" id="submitReport">提交丢失提醒</button></div></form>`);
    $('reportCity2').value=current.country&&current.city?current.country+'·'+current.city:$('reportCity2').value;
    const savePending=()=>{const cityFull=$('reportCity2').value;return {country:cityFull.split('·')[0],city:cityFull.split('·').slice(1).join('·'),address:$('reportAddress').value.trim(),date:$('reportDate2').value,type:$('reportType2').value,description:$('reportText2').value.trim(),lat:current.lat,lon:current.lon,reportedAt:new Date().toISOString()}};
    $('setReportGPS').onclick=()=>{if(!navigator.geolocation)return toast('浏览器不支持定位');navigator.geolocation.getCurrentPosition(x=>{current.lat=+x.coords.latitude.toFixed(5);current.lon=+x.coords.longitude.toFixed(5);$('coordinatesNote').textContent=`已选坐标 ${current.lat}, ${current.lon}；请核对是否是事发地`},()=>toast('定位权限未授予，仍可填写具体地址'),{enableHighAccuracy:false,timeout:10000})};
    $('mapReportPick').onclick=()=>{pendingReport=savePending();pickActive=true;closeModal();toast('请点击地图上的实际遗失位置；位置仅作为待审核线索。')};
    $('newReportForm').onsubmit=async e=>{e.preventDefault();const d=savePending();if(d.address.length<6||d.description.length<12)return toast('请完善详细地址及经过');$('submitReport').disabled=true;$('submitReport').textContent='正在检查接收服务…';
      const active=await getReportEnabled();if(active){try{const r=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,website:''})});if(r.status===201){pendingReport={};closeModal();popupSubmitStatus('提交成功：进入待审核队列，不会立即展示');return}const x=await r.json().catch(()=>({}));popupSubmitStatus(x.error||'在线提交未成功，已保存本机');}catch{popupSubmitStatus('网络未连接，已保存本机')}}
      const saved=remember(d);pendingReport={};closeModal();toast(saved?'当前未开通线上接收，已保存本机记录；不进入审核后台':'记录保存失败，请复制文字保存');};
  };
  // original handlers call openReport by name at interaction time; update older "myDrafts" modal displays to include address.
  showDrafts=function(){let a=[];try{a=JSON.parse(localStorage.getItem('xiaotou-drafts-v02')||'[]');if(!Array.isArray(a))a=[]}catch{}
    modal(`<h2>丢失提醒 · 我的本机记录 (${a.length})</h2><p>没有接入后台时只保存在此设备，不会公开。可导出或清除。</p><div style="max-height:46vh;overflow:auto">${a.slice().reverse().map(d=>`<article class="helpbox"><b>${h(d.city||'未知城市')} · ${h(d.type||'事件')}</b><p>${h(d.address||'此前未填具体位置')} · ${h(d.date||'')}</p><p style="overflow-wrap:anywhere;white-space:pre-wrap">${h(d.description||'')}</p></article>`).join('')||'<div class="helpbox">还没有本机记录。</div>'}</div><div class="modal-footer"><button class="plainbtn" data-close>关闭</button><button id="deleteReminders" class="outlinebtn" ${a.length?'':'disabled'}>清除全部</button><button id="exportReminders" class="primarybtn" ${a.length?'':'disabled'}>导出记录</button></div>`);
    $('deleteReminders').onclick=()=>{if(confirm('彻底删除本机全部丢失提醒？')){localStorage.removeItem('xiaotou-drafts-v02');closeModal();toast('已删除本机记录')}};
    $('exportReminders').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(a,null,2)],{type:'application/json'}));const l=document.createElement('a');l.href=u;l.download='丢失提醒-本机记录.json';l.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
  };
  // Existing map can select location before report form reopening.
  function gotPosition(lat,lon){if(!pickActive)return;pickActive=false;pendingReport.lat=+lat.toFixed(5);pendingReport.lon=+lon.toFixed(5);openReport(pendingReport.city||'',pendingReport);toast('已记录所选坐标，请继续填写具体地址')}
  function hookPick(){if(leaflet&&!leaflet._reportPickerHook){leaflet.on('click',e=>gotPosition(e.latlng.lat,e.latlng.lng));leaflet._reportPickerHook=true}if(googleMap&&!googleMap._reportPickerHook){googleMap.addListener('click',e=>gotPosition(e.latLng.lat(),e.latLng.lng()));googleMap._reportPickerHook=true}}
  const originalInit=initLeaflet;initLeaflet=function(){originalInit();hookPick()};
  const previousMapSwitch=switchMap;switchMap=async function(p){await previousMapSwitch(p);hookPick()};
  hookPick();
  // Full emergency workflow; always offers relevant country-specific number and official source.
  const emergencyInstructions=document.createElement('div'); emergencyInstructions.className='help-extra'; emergencyInstructions.innerHTML=`<h3 style="margin:0 0 12px">丢失财物后怎么办？</h3>
    <details open><summary>① 先确认安全 · 生命危险直接打当地紧急电话</summary><p>优先离开危险区域。不要追赶或对抗嫌疑人。一般遗失不属于紧急电话使用范围，应咨询非紧急警局。</p></details>
    <details><summary>② 银行卡/手机丢失</summary><p>尽快通过银行官方渠道冻结卡片、停用移动支付，联系运营商挂失 SIM/eSIM，并启用设备远程锁定/抹除。不要向陌生人提供银行验证码。</p></details>
    <details><summary>③ 护照遗失</summary><p>向当地警局报案并留存报案编号，再联系中国驻当地使领馆办理旅行证等证件。补办手续和预约以使领馆官方公布为准。</p><a href="https://www.fmprc.gov.cn/" target="_blank" rel="noopener noreferrer">中国外交部官网 ↗</a></details>
    <details><summary>④ 领事保护热线</summary><p>中国外交部全球领事保护与服务应急热线：<a href="tel:+861012308">+86 10 12308</a>；也可拨 <a href="tel:+861065612308">+86 10 65612308</a>。领事热线不能替代当地报警或急救。</p></details>
    <details><summary>⑤ 给当地警方看的英文短句</summary><p id="englishReport">I believe my belongings were stolen or lost. The location was: [specific street or station]. The time was: [date and time]. I need to file a police report and get a case number. Please help me contact the police.</p><button type="button" class="outlinebtn" id="copyPoliceEnglish">复制英文报案话术</button></details>
    <p style="color:#70837e;font-size:11px">号码表包含51个国家/地区；部分国家仅核实综合接警电话，未核实的专线不编造。各电话须以当地官方最新公布为准。</p>`;
  $('emergencyExtras').appendChild(emergencyInstructions);
  $('copyPoliceEnglish').onclick=()=>navigator.clipboard?.writeText($('englishReport').textContent).then(()=>toast('已复制英文报案话术')).catch(()=>toast('无法自动复制，请手动选择文字'));
  // Extra source registrations do not imply any incidents have been copied.
  const sx=document.createElement('div');sx.className='helpbox';sx.innerHTML=`<b>新增外部公开信息核验入口</b><p>以下仅作为核验入口。网页可访问不代表允许批量转载事件数据库。</p><a target="_blank" rel="noopener noreferrer" href="https://pickpockets.live/">pickpockets.live ↗</a><p><a target="_blank" rel="noopener noreferrer" href="https://pickpocketmaps.com/">PickpocketMaps ↗</a></p><p><a target="_blank" rel="noopener noreferrer" href="https://www.minecrime.it/">MineCrime（商业数据需授权）↗</a></p><p><a target="_blank" rel="noopener noreferrer" href="https://www.icgc.cat/en/Tools-and-viewers/Viewers/Crime-map">ICGC 加泰罗尼亚警区统计地图 ↗</a></p><p>小红书、微博、Instagram、Facebook 只处理无需登录且允许采集的公开页面。未获得权限或遇到访问限制时自动跳过。</p>`;
  $('sourcesPanel').appendChild(sx);

  // Optional cost-controlled Stadia Maps tiles: commercial key needed; OSM stays a low-traffic demo fallback.
  let stadiaKey='';try{stadiaKey=localStorage.getItem('find-thief-stadia-key')||''}catch{}
  function useStadia(){if(!leaflet||provider!=='osm'||!stadiaKey||!window.L)return false;
    leaflet.eachLayer(l=>{if(l instanceof L.TileLayer)leaflet.removeLayer(l)});
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key='+encodeURIComponent(stadiaKey),{attribution:'&copy; Stadia Maps &copy; OpenStreetMap contributors',maxZoom:20}).addTo(leaflet);return true;}
  const previousInit=initLeaflet;initLeaflet=function(){previousInit();if(stadiaKey)useStadia()};
  const originalMapOptions=mapOptions;
  mapOptions=function(){originalMapOptions();const el=document.querySelector('.modal');if(!el)return;const wrap=document.createElement('div');wrap.className='helpbox';wrap.innerHTML=`<b>更低成本的商用地图：Stadia Maps</b><p>Starter 官方标价约 $20/月，按实际方案计费，生产使用需商用许可与域名限制。无需替换地理信息。</p><label for="stadiaKey">Stadia Maps 前端地图密钥</label><input id="stadiaKey" type="password" placeholder="仅在本浏览器保存，请先限制域名" autocomplete="off" value="${h(stadiaKey)}"><div class="report-toolbox"><button type="button" id="chooseStadia">启用 Stadia 商用底图</button><button type="button" id="clearStadia">恢复 OSM 预览底图</button></div><p>高流量长期方案：Protomaps + MapLibre 自托管瓦片，按带宽及存储成本付费。</p>`;el.insertBefore(wrap,el.querySelector('.modal-footer')||el.lastChild);
     $('chooseStadia').onclick=()=>{stadiaKey=$('stadiaKey').value.trim();if(!stadiaKey)return toast('请输入有效的Stadia地图密钥');localStorage.setItem('find-thief-stadia-key',stadiaKey);if(provider!=='osm'){switchMap('osm').then(useStadia)}else useStadia();closeModal();toast('已启用 Stadia Maps 底图（需有效密钥）')};
     $('clearStadia').onclick=()=>{stadiaKey='';localStorage.removeItem('find-thief-stadia-key');if(provider==='osm')initLeaflet();closeModal();toast('已恢复普通地图')};
  };
  if(stadiaKey)useStadia();
  document.addEventListener('keydown',e=>{if(e.key==='Escape')pickActive=false});
})();