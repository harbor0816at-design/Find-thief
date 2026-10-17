const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('V2.1 has four focused pages and friend-sharing dialog',()=>{
 const html=read('legacy.html');
 for(const id of ['btnExplore','btnReport','btnRecovery','btnPrevention','shareTrigger','recoveryView','preventionView','shareModal','lossGuideContent','preventionContent'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/defer src="\/guides.js"/);assert.match(html,/defer src="\/media.js"/);
});
test('theft map layers render as 2km area visualization but general notices are not mapped as crime',()=>{
 const source=read('app.js');
 assert.match(source,/DISPLAY_RADIUS_M=2000/);
 assert.match(source,/L\.circle\(\[\+z\.lat,\+z\.lon\]/);
 assert.match(source,/L\.circle\(\[\+e\.lat,\+e\.lon\]/);
 assert.match(source,/L\.circle\(\[\+x\.display_lat,\+x\.display_lon\]/);
 assert.match(source,/a\.scope!=='site_context'/);
 assert.match(source,/不是犯罪影响范围|非实际犯罪影响范围|不是实际犯罪影响范围/);
 assert.doesNotMatch(source,/L\.circleMarker/);
});
test('wechat share offers manual platform route instead of pretending to send',()=>{
 const source=read('guides.js');
 assert.match(source,/navigator\.share/);
 assert.match(source,/MicroMessenger/);
 assert.match(source,/发送给朋友/);
 assert.match(source,/navigator\.clipboard/);
 assert.doesNotMatch(source,/WeixinJSBridge.*sendAppMessage/);
});
test('public media headlines remain unverified and do not populate theft event map',()=>{
 const source=read('media.js');
 assert.match(source,/PUBLIC_NEWS_LEADS_ONLY_NOT_CONFIRMED_THEFT/);
 assert.match(source,/尚未核实/);
 assert.match(source,/发生时间：待核实/);
 assert.doesNotMatch(source,/hotspots\.push|verifiedEvents\.push/);
});
test('media crawler only outputs headline link not user identities or inferred incident date',()=>{
 const src=read('scripts/collect_media_leads.py');
 assert.match(src,/MAX|NEWS|NEWS_LEADS_ONLY|PUBLIC_NEWS_LEADS_ONLY_NOT_CONFIRMED_THEFT/);
 assert.match(src,/"incident_occurred_on":None/);
 assert.match(src,/GDELT DOC 2\.0/);
 assert.match(src,/time\.sleep\(6\.0\)/);
});
