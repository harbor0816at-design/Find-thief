const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const pages=['index.html','stitch-mobile.html','legacy.html','admin.html','privacy.html','terms.html'];
test('map library never blocks page scripts and avoids the China-only CDN',()=>{
 assert.match(read('stitch-integrate.js'),/cdn\.jsdelivr\.net\/npm\/leaflet@1\.9\.4/);
 for(const f of [...pages,'stitch-integrate.js'])assert.doesNotMatch(read(f),/bootcdn/,f);
 assert.doesNotMatch(read('stitch-mobile.html'),/<script[^>]+leaflet/);
});
test('public pages use the unified brand and have favicon',()=>{
 for(const f of pages){const h=read(f);assert.doesNotMatch(h,/小偷在哪里|Where is the Thief|ThiefRadar/i,f);assert.match(h,/favicon\.svg/,f);assert.match(h,/防扒雷达/,f)}
 for(const f of ['index.html','stitch-mobile.html'])assert.match(read(f),/name="description"/);
 assert.doesNotMatch(read('stitch-mobile.html'),/user-scalable=no/);
});
test('vercel config keeps security headers and favicon rewrite',()=>{
 const v=JSON.parse(read('vercel.json'));const keys=v.headers[0].headers.map(h=>h.key);
 for(const k of ['X-Content-Type-Options','Referrer-Policy','X-Frame-Options','Strict-Transport-Security'])assert.ok(keys.includes(k),k);
 assert.ok(v.rewrites.some(r=>r.source==='/favicon.ico'));
 assert.ok(v.crons.some(c=>c.path==='/api/retention'));
});
