const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('five requested function names have matching navigable views',()=>{
 const html=read('index.html'),app=read('app.js'),guides=read('guides.js');
 for(const [id,label] of [['btnExplore','小偷雷达'],['btnReport','实况避雷'],['btnRecovery','急速抢救'],['btnPrevention','防扒指南'],['btnBlackout','防窃黑化']]){
  assert.match(html,new RegExp('id="'+id+'"[^>]*>[\\s\\S]{0,55}'+label));
 }
 for(const id of ['exploreView','reportView','recoveryView','preventionView','blackoutView'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/blackout:'blackoutView'/);
 assert.match(guides,/#guide=\(recovery\|prevention\|blackout\)/);
});
test('Stitch-inspired mobile footer tabs, white panels and palette',()=>{
 const css=read('app.css');
 assert.match(css,/#c8f400/);assert.match(css,/#245fe8/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.panel-scroll\{[^}]*overflow-y:auto/);
 assert.match(css,/html,body\{height:100%;max-height:100%;overflow:hidden!important/);
});
test('blackout skill drill has 5 non-identifying interactive questions',()=>{
 const html=read('index.html'),code=read('blackout.js');
 assert.match(html,/id="blackoutProgress"/);assert.match(html,/id="blackoutChallenges"/);
 assert.match(code,/answered=new Map/);
 assert.equal((code.match(/^\['[^\n]+',\[/gm)||[]).length,0); // question representation is nested arrays
 assert.ok((code.match(/\[\s*'[^']+'/g)||[]).length>=5);
 assert.doesNotMatch(code,/fetch\(|localStorage|navigator\.geolocation/);
});
test('verified sourced case snapshot does not pretend to be all European crimes',()=>{
 const j=JSON.parse(read('data/verified-events-v21.json'));
 assert.equal(j.verified_public_snapshot,true);
 assert.ok(j.items.length>=18);
 const ids=j.items.map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 for(const e of j.items){
  assert.equal(typeof e.short_summary,'string');
  assert.match(e.source_url,/^https:\/\//);
  assert.ok(e.source_published_on||e.occurred_on);
  if(e.occurred_on)assert.ok(e.occurred_on<='2026-10-14');
 }
 assert.ok(j.areas.some(a=>a.city==='巴塞罗那'&&a.verified_event_count===8));
 assert.match(j.caveat,/Not a crime rate/);
});
test('source catalog records are not misrepresented as verified cases',()=>{
 const j=JSON.parse(read('data/source-targets-v2.json'));
 assert.ok(j.sources.length>=23);
 for(const x of j.sources){assert.match(x.url,/^https:\/\//);assert.ok(x.permission_note)}
 const file=read('app.js');assert.match(file,/source_urls\|\|\[\]/);
 assert.match(file,/这是调查报告中的系列案件汇总/);
});
