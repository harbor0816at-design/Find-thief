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
 const html=fs.readFileSync(require.resolve('../legacy.html'),'utf-8');
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

test('admin can only stage a sourced event; it never becomes approved automatically',async()=>{
 const admin=require('../api/admin.js');
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_mock',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',ADMIN_EMAILS:'a@example.com'});
 let insert;
 global.fetch=async (url,opt)=>{if(String(url).includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'user-id',email:'a@example.com',email_confirmed_at:'2026-10-12'})};
   if(String(url).includes('/rest/v1/evidence_events_v2')){insert=JSON.parse(opt.body);return {ok:true,json:async()=>[{id:'9a86c7bb-2ae4-4f0a-93c3-cd8ee3c57940'}]}};
   throw Error('unexpected URL')};
 const response=mockRes();
 await admin({method:'POST',headers:{authorization:'Bearer abc.def.ghi'},body:{action:'stage_event',country:'西班牙',city:'巴塞罗那',spot_name:'兰布拉大道',event_kind:'alleged_theft',source_type:'consular_case',source_title:'巴塞罗那领馆公开案例',source_url:'https://example.org/consulate-note',source_published_on:'2026-10-01',occurred_on:'',item_category:'钱包',short_summary:'有公开领事案例称游客随身钱包被盗',evidence_note:'原文提及具体案例和城市，发生日期未明确，不将城市误称成景区',lat:'',lon:''}},response);
 assert.equal(response.code,201);
 assert.equal(insert.review_status,'staging');
 assert.equal(insert.occurred_on,null);
 assert.equal(insert.source_published_on,'2026-10-01');
 assert.equal(insert.lat,null);
 assert.equal(insert.confidence,'reported_claim');
});
test('admin rejects invented published incident with no cited date',async()=>{
 const admin=require('../api/admin.js');
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_mock',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',ADMIN_EMAILS:'a@example.com'});
 let dbCalls=0;global.fetch=async url=>{if(String(url).includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'1',email:'a@example.com',email_confirmed_at:'2026-10-12'})};dbCalls++;throw Error('Should not reach DB')};
 const response=mockRes();
 await admin({method:'POST',headers:{authorization:'Bearer abc.def.ghi'},body:{action:'stage_event',country:'法国',city:'巴黎',source_title:'Paris travel advice',source_url:'https://example.org/advice',source_type:'journalism_case',event_kind:'alleged_theft',short_summary:'有人在巴黎被偷',evidence_note:'未核实任何具体事件发生日或原始发表日'}},response);
 assert.equal(response.code,400);
 assert.equal(dbCalls,0);
});
test('general travel advice cannot be approved as a specific theft incident',async()=>{
 const admin=require('../api/admin.js');
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_mock',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',ADMIN_EMAILS:'a@example.com'});
 let patchCount=0;
 global.fetch=async(url,opt)=>{if(String(url).includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'1',email:'a@example.com',email_confirmed_at:'2026-10-12'})};
   if(opt?.method==='PATCH')patchCount++;
   return {ok:true,json:async()=>[{id:'9a86c7bb-2ae4-4f0a-93c3-cd8ee3c57940',event_kind:'safety_mention',source_published_on:'2026-10-01',occurred_on:null}]}};
 const response=mockRes();await admin({method:'PATCH',headers:{authorization:'Bearer abc.def.ghi'},body:{kind:'event_v2',id:'9a86c7bb-2ae4-4f0a-93c3-cd8ee3c57940',status:'approved',confirm_source:true}},response);
 assert.equal(response.code,400);assert.equal(patchCount,0);
});
