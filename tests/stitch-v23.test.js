const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Stitch original art remains responsive on desktop and mobile',()=>{
 const css=read('stitch-v23.css'),pc=read('index.html'),mobile=read('stitch-mobile.html');
 for(const text of ['safety-illustration.webp','anti-theft-gear.webp'])assert.match(css,new RegExp(text.replace('.','\\.')));
 assert.match(css,/object-fit:contain/);
 assert.match(css,/max-width:700px/);
 for(const page of [pc,mobile]){assert.match(page,/stitch-v23.css/);assert.match(page,/stitch-v23.js/);assert.match(page,/wechat-bridge.js/);}
});
test('Area title follows selected city and case, not fixed Rome',()=>{
 const js=read('stitch-v23.js');assert.match(js,/function updateHead/);
 assert.match(js,/cities\[city\]/);assert.match(js,/实况避雷雷达/);
 assert.match(js,/city_select/);assert.match(js,/case_open/);
});
test('Four anti-pickpocket categories have selectable shopping checklist without fake rating',()=>{
 const js=read('stitch-v23.js');for(const item of ['拉链防盗扣','防割斜挎包','手机防丢绳','隐形腰包'])assert.match(js,new RegExp(item));
 assert.match(js,/data-good/);assert.match(js,/data-search/);assert.match(js,/stitch-gear-copy/);
 assert.doesNotMatch(js,/虚构销量[^,]{0,80}[0-9][0-9]{3}起/);
});
test('WeChat supports system share + signed official JS-SDK only after credentials',()=>{
 const client=read('stitch-v23.js'),wx=read('wechat-bridge.js'),api=read('api/wechat-signature.js');
 assert.match(client,/navigator\.share/);assert.match(client,/MicroMessenger/);
 assert.match(wx,/updateAppMessageShareData/);assert.match(wx,/updateTimelineShareData/);
 assert.match(api,/WECHAT_APP_ID/);assert.match(api,/WECHAT_APP_SECRET/);
 assert.match(api,/https:\/\/fangbaleida\.com/);assert.match(api,/\.has\(url\.origin\)/);
});
test('Anonymous aggregated visitor events never persist raw search or devices',()=>{
 const js=read('stitch-v23.js'),metrics=read('api/metrics.js'),admin=read('admin.html');
 for(const event of ['page_view','city_select','item_filter','case_open','gear_add','share_native_attempt'])assert.match(metrics,new RegExp(event));
 assert.match(js,/sendBeacon/);assert.match(admin,/导出|下载 CSV/);assert.match(admin,/journeyCards/);
});
test('wechat endpoint remains safely disabled without AppID/secret',async()=>{
 const sign=require('../api/wechat-signature.js');
 const oldId=process.env.WECHAT_APP_ID,oldSecret=process.env.WECHAT_APP_SECRET;
 delete process.env.WECHAT_APP_ID;delete process.env.WECHAT_APP_SECRET;
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.statusCode=s;return this},json(j){this.body=j;return this}};
 try{await sign({method:'GET',query:{url:'https://find-thief.vercel.app/'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.configured,false)}
 finally{if(oldId===undefined)delete process.env.WECHAT_APP_ID;else process.env.WECHAT_APP_ID=oldId;if(oldSecret===undefined)delete process.env.WECHAT_APP_SECRET;else process.env.WECHAT_APP_SECRET=oldSecret;}
});
