const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const f=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('new primary domain in desktop/mobile canonical, sitemap and robots',()=>{
 assert.match(f('index.html'),/rel="canonical" href="https:\/\/fangbaleida\.com\/"/);
 assert.match(f('stitch-mobile.html'),/href="https:\/\/fangbaleida\.com\/" rel="canonical"/);
 assert.match(f('sitemap.xml'),/https:\/\/fangbaleida\.com\/privacy\.html/);
 assert.match(f('robots.txt'),/https:\/\/fangbaleida\.com\/sitemap\.xml/);
 assert.doesNotMatch(f('stitch-mobile.html'),/find-thief\.vercel\.app/);
});
test('all share links and poster labels are new domain',()=>{
 assert.match(f('stitch-integrate.js'),/return 'https:\/\/fangbaleida\.com\/#city='/);
 assert.match(f('stitch-integrate.js'),/c\.fillText\('fangbaleida\.com'/);
 assert.match(f('stitch-v23.js'),/https:\/\/fangbaleida\.com\/#city=/);
 assert.match(f('wechat-bridge.js'),/https:\/\/fangbaleida\.com\/stitch-assets\/safety-illustration\.webp/);
});
test('new official domain is allowed, and third-party origin not allowed, by sensitive endpoints',()=>{
 for(const file of ['api/reports.js','api/metrics.js','api/wechat-signature.js']){
  const text=f(file);assert.match(text,/https:\/\/fangbaleida\.com/);
  assert.match(text,/https:\/\/find-thief\.vercel\.app/);
  assert.match(text,/\.has\(/);
 }
 assert.match(f('api/reports.js'),/ENABLE_PUBLIC_REPORTING/);
});
test('WeChat sign endpoint does not produce a signature when not configured',async()=>{
 const handler=require('../api/wechat-signature.js');
 const keys=['WECHAT_APP_ID','WECHAT_APP_SECRET'];const before=keys.map(k=>process.env[k]);for(const k of keys)delete process.env[k];
 const res={setHeader(){},status(n){this.code=n;return this},json(v){this.value=v;return this}};
 try{await handler({method:'GET',query:{url:'https://fangbaleida.com/'}},res);assert.equal(res.code,200);assert.equal(res.value.configured,false)}
 finally{for(let i=0;i<keys.length;i++)before[i]===undefined?delete process.env[keys[i]]:process.env[keys[i]]=before[i]}
});
