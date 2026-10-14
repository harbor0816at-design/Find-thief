const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const handler=require('../api/events-v2.js');
function mockRes(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(o){this.body=o;return this}}}
const save={...process.env};
test.afterEach(()=>{process.env={...save};delete global.fetch});
test('V2 public event feed refuses private and unreviewed rows',async()=>{
 process.env.SUPABASE_URL='https://foo.supabase.co';
 process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 const paths=[],headers=[];
 global.fetch=async (u,opt)=>{paths.push(String(u));headers.push(opt.headers);return {ok:true,json:async()=>[]}};
 const res=mockRes();await handler({method:'GET'},res);
 assert.equal(res.code,200);
 assert.equal(res.body.items.length,0);
 assert.equal(paths.length,2);
 assert.match(paths[0],/review_status=eq.approved/);
 assert.match(paths[1],/review_status=eq.published/);
 assert.doesNotMatch(paths.join(' '),/address_private|description_private|lat_private|submission_fingerprint/);
 assert.equal(headers[0].Authorization,undefined);
 assert.equal(headers[0].apikey,'sb_secret_test');
});
test('V2 events API does not accept edits',async()=>{
 const res=mockRes();await handler({method:'POST'},res);
 assert.equal(res.code,405);
});
test('Fixed map layout has scroll only in information panel',()=>{
 const css=fs.readFileSync(require.resolve('../app.css'),'utf-8');
 const html=fs.readFileSync(require.resolve('../index.html'),'utf-8');
 const app=fs.readFileSync(require.resolve('../app.js'),'utf-8');
 assert.match(css,/html,body\{height:100%;max-height:100%;overflow:hidden!important/);
 assert.match(css,/\.panel-scroll\{[^}]*overflow-y:auto/);
 assert.match(css,/#map\{[^}]*height:auto!important/);
 assert.match(html,/class="panel-scroll" id="resultScroll"/);
 assert.match(html,/class="map-panel"/);
 assert.match(app,/evidence_events_v2|\/api\/events-v2/);
 assert.match(app,/统计期/);
 assert.match(app,/发生时间未公开/);
});
test('V2 sources are explicitly not published theft events',()=>{
 const obj=JSON.parse(fs.readFileSync(require.resolve('../data/source-targets-v2.json'),'utf-8'));
 assert.equal(obj.focus_attractions['巴黎'].length,4);
 assert.equal(Object.keys(obj.focus_attractions).length,5);
 assert.ok(obj.sources.length>=12);
 assert.ok(obj.sources.every(s=>s.permission_note&&s.url.startsWith('https://')));
});
