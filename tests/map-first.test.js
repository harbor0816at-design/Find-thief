const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('homepage is the map-first layout with search, three toggles, list and three tabs',()=>{
 const h=read('index.html');
 for(const id of ['citySelect','searchInput','map','placeList','listCount','guideFloat','appealForm'])assert.match(h,new RegExp('id="'+id+'"'),id);
 for(const t of ['扒窃','抢夺','诈骗套路'])assert.match(h,new RegExp('data-type="'+t+'"'));
 for(const v of ['map','appeal','me'])assert.match(h,new RegExp('data-view="'+v+'"'));
 assert.match(h,/href="tel:112"/);
 assert.match(h,/\/vendor\/leaflet-1\.9\.4\/leaflet\.js/);
 assert.ok(fs.existsSync(path.join(__dirname,'..','vendor/leaflet-1.9.4/leaflet.js')));
});
test('map page uses only reviewed sources and never seeds demo points',()=>{
 const js=read('map.js');
 for(const s of ['/api/events-v2','/api/hotspots','/api/reports','/api/appeals','verified-events-v21.json','verified-uk-police-areas.json'])assert.ok(js.includes(s),s);
 assert.doesNotMatch(js,/Math\.random/);
 assert.match(js,/status==='removed'/);
});
test('appeals API rejects bad input and hides private fields',async()=>{
 const handler=require('../api/appeals.js');
 const mk=()=>({h:{},setHeader(k,v){this.h[k]=v},status(n){this.code=n;return this},json(v){this.value=v;return this}});
 const keep={...process.env};
 try{
  process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_x';process.env.REPORT_RATE_SECRET='r';process.env.DATA_CONTROLLER_EMAIL='a@b.co';
  let res=mk();await handler({method:'POST',headers:{'content-type':'application/json'},body:{consent:true,place_key:'罗马|41.900|12.500',city:'罗马',place_name:'Termini',reason:'不存在',detail:'这条记录地点有误需要更正',email:'x@y.co'}},res);
  assert.equal(res.code,400);
  res=mk();await handler({method:'POST',headers:{'content-type':'application/json'},body:{consent:false}},res);
  assert.equal(res.code,400);
  res=mk();await handler({method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:{}},res);
  assert.equal(res.code,403);
 }finally{process.env=keep}
 assert.doesNotMatch(read('api/appeals.js').match(/place_appeals\?select=[^&']*/)[0],/contact|detail/);
});
