const assert=require('node:assert/strict');
const {test,afterEach}=require('node:test');
const report=require('../api/reports.js');const admin=require('../api/admin.js');
function res(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(x){this.body=x;return this}}}
const envSave={...process.env};afterEach(()=>{process.env={...envSave};delete global.fetch});
test('anon submission closed without dedicated DB config',async()=>{delete process.env.SUPABASE_URL;const r=res();await report({method:'POST',headers:{'content-type':'application/json'},body:{}},r);assert.equal(r.code,503);});
test('public only returns approved redacted fields',async()=>{process.env.SUPABASE_URL='https://foo.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';let path='';global.fetch=async(u)=>{path=String(u);return {ok:true,json:async()=>[{id:'1',city:'Paris',public_summary:'reviewed'}]}};const r=res();await report({method:'GET',headers:{}},r);assert.equal(r.code,200);assert.match(path,/status=eq.approved/);assert.doesNotMatch(path,/address_private/);});
test('report rejects missing address, no DB call',async()=>{Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',ENABLE_PUBLIC_REPORTING:'true',REPORT_RATE_SECRET:'a',DATA_CONTROLLER_EMAIL:'reporter@example.org',DATA_CONTROLLER_NAME:'Operator Name',CRON_SECRET:'local-test'});global.fetch=()=>{throw Error('should not connect')};const r=res();await report({method:'POST',headers:{'content-type':'application/json'},body:{consent:true,country:'法国',city:'巴黎',address:'巴黎',type:'物品遗失',date:'2026-10-12',description:'我的包在地铁站附近找不到了。'}},r);assert.equal(r.code,400)});
test('anon cannot inspect admin queue',async()=>{Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',SUPABASE_PUBLISHABLE_KEY:'pub',ADMIN_EMAILS:'a@example.com'});const r=res();await admin({method:'GET',headers:{}},r);assert.equal(r.code,401)});
test('valid reviewer can approve, audited via database trigger',async()=>{Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',SUPABASE_PUBLISHABLE_KEY:'pub',ADMIN_EMAILS:'a@example.com'});let calls=[];global.fetch=async(u,o)=>{calls.push([String(u),o?.method||'GET']);if(String(u).includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'1',email:'a@example.com',email_confirmed_at:'2026-10-13'})};return {ok:true,json:async()=>[{id:'3f62c6ee-9adf-4aa2-b52f-ade7b9eea491'}]}};const r=res();await admin({method:'PATCH',headers:{authorization:'Bearer abc.def.ghi'},body:{id:'3f62c6ee-9adf-4aa2-b52f-ade7b9eea491',status:'approved',public_summary:'旅客称曾在地铁站附近发现随身包遗失，请自行防范。',display_lat:48.857,display_lon:2.355}},r);assert.equal(r.code,200);assert.equal(calls.filter(c=>c[0].includes('/rest/v1/')).length,1);});
test('non-whitelisted account cannot review private report',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',SUPABASE_PUBLISHABLE_KEY:'pub',ADMIN_EMAILS:'chief@example.org'});
 let privateQueries=0;global.fetch=async u=>{if(String(u).includes('/rest/v1/'))privateQueries++;return {ok:true,json:async()=>({id:'2',email:'attacker@example.org',email_confirmed_at:'2026-10-13'})}};
 const r=res();await admin({method:'GET',headers:{authorization:'Bearer mock.jwt.value'}},r);assert.equal(r.code,403);assert.equal(privateQueries,0);
});
test('successful anonymous report creates only private pending record and returns receipt',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',ENABLE_PUBLIC_REPORTING:'true',REPORT_RATE_SECRET:'abc',DATA_CONTROLLER_EMAIL:'privacy@example.org',DATA_CONTROLLER_NAME:'Registered Operator',CRON_SECRET:'local-test'});
 let body={};global.fetch=async (_url,options)=>{if(String(_url).includes('/rest/v1/loss_reports'))body=JSON.parse(options.body);return {ok:true,json:async()=>[{id:'3f62c6ee-9adf-4aa2-b52f-ade7b9eea491'}]}};
 const r=res();await report({method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'1.2.3.4'},body:{country:'法国',city:'巴黎',address:'巴黎地铁站某号出口附近',type:'物品遗失',date:'2026-10-12',description:'在地铁站准备换乘时发现随身背包不见了，希望提醒其他游客。',consent:true}},r);
 assert.equal(r.code,201);assert.equal(r.body.status,'pending');assert.equal(body.status,'pending');assert.equal(body.address_private,'巴黎地铁站某号出口附近');assert.equal(body.consent_at?.length>0,true);assert.equal(body.submission_fingerprint?.length,64);assert.equal(body.public_summary,undefined);
});
test('public report requires active data-controller and cleanup settings',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',ENABLE_PUBLIC_REPORTING:'true',REPORT_RATE_SECRET:'abc',DATA_CONTROLLER_EMAIL:'privacy@example.org',DATA_CONTROLLER_NAME:'Registered Operator'});delete process.env.CRON_SECRET;
 const r=res();await report({method:'POST',headers:{'content-type':'application/json'},body:{}},r);assert.equal(r.code,503);
});
test('retention cron rejects unauthorized caller and no database queries occur',async()=>{
 const retention=require('../api/retention.js');process.env.CRON_SECRET='server-token';let n=0;global.fetch=()=>{n++;throw Error('no access')};const r=res();await retention({method:'GET',headers:{authorization:'Bearer wrong'}},r);assert.equal(r.code,401);assert.equal(n,0);
});
test('retention cron removes expired statuses with service credential',async()=>{
 const retention=require('../api/retention.js');Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'key',CRON_SECRET:'server-token'});const calls=[];global.fetch=async(u,o)=>{calls.push([u,o.method]);return {ok:true}};const r=res();await retention({method:'GET',headers:{authorization:'Bearer server-token'}},r);assert.equal(r.code,200);assert.equal(calls.length,3);assert.ok(calls.every(c=>c[1]==='DELETE'));assert.ok(calls.every(c=>c[0].includes('loss_reports?status=eq.')));
});

test('modern sb_secret key uses apikey without bearer on public reports',async()=>{
 process.env.SUPABASE_URL='https://foo.supabase.co';delete process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SECRET_KEY='sb_secret_mock_key';let headers;
 global.fetch=async(_url,o)=>{headers=o.headers;return {ok:true,json:async()=>[]}};
 const r=res();await report({method:'GET',headers:{}},r);
 assert.equal(r.code,200);assert.equal(headers.apikey,'sb_secret_mock_key');assert.equal(headers.Authorization,undefined);
});
test('modern sb_secret key not confused with JWT in authorized reviewer database read',async()=>{
 Object.assign(process.env,{SUPABASE_URL:'https://foo.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_mock_key',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',ADMIN_EMAILS:'a@example.com'});
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;let dbHeaders;
 global.fetch=async(u,o)=>{if(String(u).includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'1',email:'a@example.com',email_confirmed_at:'2026-10-14'})};dbHeaders=o.headers;return {ok:true,json:async()=>[]}};
 const r=res();await admin({method:'GET',headers:{authorization:'Bearer signed.user.jwt'}},r);
 assert.equal(r.code,200);assert.equal(dbHeaders.apikey,'sb_secret_mock_key');assert.equal(dbHeaders.Authorization,undefined);
});
