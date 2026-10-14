/* Public GDELT media title/link leads. This is a REVIEW QUEUE, NOT verified theft incidents. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);let dataset=null;
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:'#'}catch{return '#'}};
 function render(city){
  const box=$('mediaLeadsPanel');if(!box)return;
  const rows=Array.isArray(dataset?.items)?dataset.items:[];
  const relevant=city?rows.filter(x=>x.city_target===city):rows;
  if(!relevant.length){box.innerHTML='';return}
  const top=relevant.slice(0,6);
  box.innerHTML='<div class="guidance-title">📰 公开媒体线索 · 尚未核实</div><p class="muted">只用于寻找原报道：发布日期≠案发日期，标题提到的城市也不能证明在该景点发生过盗窃。这些线索不计入地图犯罪统计。</p>'+
  top.map(x=>'<article class="advice-card"><span class="advice-tag">媒体检索线索 · 待核验</span><h3>'+h(x.title)+'</h3><div class="v2-essential"><span>媒体发布：'+h(x.source_published_on||'未知')+'</span><span>发生时间：待核实</span>'+(Array.isArray(x.item_mentions)&&x.item_mentions.length?'<span>标题可能提及：'+x.item_mentions.map(h).join(' / ')+'</span>':'')+'</div><a href="'+h(safe(x.url))+'" target="_blank" rel="noopener noreferrer">阅读原始报道 ↗</a></article>').join('')+
  (relevant.length>top.length?'<div class="v2-cards-count">该城市另有 '+(relevant.length-top.length)+' 条待核线索，需逐条审核后才能作为事件展示。</div>':'');
 }
 async function load(){
  try{const r=await fetch('/data/media-leads-v21.json',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(d?.review_status!=='PUBLIC_NEWS_LEADS_ONLY_NOT_CONFIRMED_THEFT'||!Array.isArray(d.items))return;dataset=d;render(window.FindThiefUI?.getCity?.()||'')}
  catch(_){}
 }
 window.FindThiefMedia={render};load();
})();
