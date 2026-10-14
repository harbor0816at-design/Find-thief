/* Educational choices; local to this page, no identity fields or fabricated risk scoring. */
(()=>{'use strict';
const $=id=>document.getElementById(id),h=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const questions=[
['🚇 地铁车门拥挤','有人挤在背包后面，你怎么做？',['把包置于身前，确认拉链','立即追赶身后的陌生人','拿出钱包在人群中检查'],0,'先保护物品和自身安全，不与陌生人直接冲突，也不在拥挤车厢展示证件与现金。'],
['📸 景区拍照','你要在景点排队拍照，包内有护照与手机。',['把包放在一旁石墩上','保持包贴身，和同行人轮流拍照','把现金放到裤子后袋'],1,'拍照时注意力易分散；把贵重物品保持在自己可控范围。'],
['☕ 露天咖啡馆','有人拿地图在你桌旁问路，桌上有手机。',['先把手机和钱包收好','把地图压在手机上讨论','转身离开一会儿，包挂椅背'],0,'无论对方是否善意，先保护桌面物品，包不要挂在背后。'],
['🧳 火车行李','陌生人要帮助你把旅行箱放进高铁行李架。',['把护照和卡片交给他保管','保持行李可视，证件贴身并自行放置','装有钱包的背包留在车门口'],1,'接受帮助也要保持物品控制，尤其证件、现金和电子设备。'],
['📱 手机失踪','你怀疑手机在景区被偷了。先做什么？',['自行定位并追逐嫌疑人','先确保安全，远程锁定设备并联系运营商','公开发布包含手机号和护照照的寻物信息'],1,'优先保护自己和账号，利用官方设备定位功能锁定，挂失SIM卡，必要时报警。']
];
let answered=new Map();
function render(){const root=$('blackoutChallenges');if(!root)return;
root.innerHTML=questions.map((q,i)=>{let pick=answered.get(i);return '<article class="guide-action-card blackout-card"><h3>关卡 '+(i+1)+' · '+h(q[0])+'</h3><p>'+h(q[1])+'</p><div class="blackout-choices">'+q[2].map((c,j)=>'<button type="button" data-q="'+i+'" data-a="'+j+'" '+(pick!==undefined?'disabled':'')+' class="'+(pick!==undefined?(j===q[3]?'correct':j===pick?'incorrect':''):'')+'">'+String.fromCharCode(65+j)+'. '+h(c)+'</button>').join('')+'</div>'+(pick!==undefined?'<p class="blackout-answer"><b>'+(pick===q[3]?'✓ 选择正确':'更推荐选 '+String.fromCharCode(65+q[3]))+'</b> · '+h(q[4])+'</p>':'')+'</article>'}).join('');
const n=answered.size;$('blackoutProgress').textContent=n+' / '+questions.length;$('blackoutProgressBar').style.width=(100*n/questions.length)+'%';
root.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const i=+b.dataset.q;if(!answered.has(i)){answered.set(i,+b.dataset.a);render()}});
}
function init(){if(!$('blackoutChallenges'))return;$('resetBlackout')?.addEventListener('click',()=>{answered=new Map();render()});render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();