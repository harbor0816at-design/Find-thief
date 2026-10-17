const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('desktop and mobile use direct source UI and local compiled styles',()=>{
 const pc=read('index.html'),mobile=read('stitch-mobile.html');
 for(const html of [pc,mobile]){
  assert.match(html,/stitch-integrate\.js/);
  assert.match(html,/小偷雷达|防扒|失物|被偷|避雷/);
  assert.doesNotMatch(html,/cdn\.tailwindcss\.com/);
 }
 assert.match(pc,/stitch-tailwind-desktop\.css/);
 assert.match(mobile,/stitch-tailwind-mobile\.css/);
});
test('designed interface acts on real event and article evidence rather than seeded fake posts',()=>{
 const js=read('stitch-integrate.js');
 assert.match(js,/\/api\/events-v2/);
 assert.match(js,/verified-events-v21\.json/);
 assert.match(js,/\/api\/hotspots/);
 assert.match(js,/暂无|没有.*报告|未核验/);
 assert.match(js,/radius:\s*2000|2000/);
});
test('share flows include WeChat, native share, clipboard and personal card download',()=>{
 const js=read('stitch-integrate.js');
 assert.match(js,/navigator\.share/);
 assert.match(js,/clipboard|execCommand/);
 assert.match(js,/download|toBlob|toDataURL/);
 assert.match(js,/MicroMessenger|微信/);
});
test('old anonymous form and moderator backend stay preserved',()=>{
 assert.match(read('legacy.html'),/reportForm/);
 assert.match(read('app.js'),/location\.hash==='#report'/);
 assert.match(read('api/reports.js'),/ENABLE_PUBLIC_REPORTING/);
});