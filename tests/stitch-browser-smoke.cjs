const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8765';
async function check(condition,why){if(!condition)throw Error(why)}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const pc=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  await pc.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:25000});
  await pc.locator('#stitch-gear').waitFor({timeout:15000});
  assert.match(await pc.locator('h2').filter({hasText:'实况避雷雷达'}).first().innerText(),/罗马/);
  await pc.locator('.city-btn[data-city="paris"]').first().click();
  assert.match(await pc.locator('h2').filter({hasText:'实况避雷雷达'}).first().innerText(),/巴黎/);
  await pc.locator('.city-btn[data-city="milan"]').first().click();
  const headline=await pc.locator('h2').filter({hasText:'实况避雷雷达'}).first().innerText();
  assert.match(headline,/米兰/);
  await pc.locator('[data-good="zip"]').first().click();
  assert.match(await pc.locator('[data-good="zip"]').first().innerText(),/已加入清单/);
  const art=pc.locator('img[src*="anti-theft-gear.webp"]').first();
  await art.scrollIntoViewIfNeeded();
  assert.equal(await art.evaluate(el=>el.complete&&el.naturalWidth>0),true,'desktop artwork loaded');
  await pc.evaluate(()=>window.openShareModal());
  assert.equal(await pc.locator('#stitch-wechat-one-tap').isVisible(),true,'WeChat share control');
  await pc.locator('#stitch-wechat-one-tap').click();
  assert.match(await pc.locator('#stitch-share-message').innerText(),/微信|分享|复制/);
  await pc.goto(BASE+'/admin.html',{waitUntil:'domcontentloaded'});
  await pc.locator('#journeyDashboard').waitFor();
  assert.match(await pc.locator('#journeyDashboard').innerText(),/核心埋点|运营漏斗/);
  await pc.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await mobile.goto(BASE+'/stitch-mobile.html',{waitUntil:'domcontentloaded',timeout:25000});
  await mobile.locator('#stitch-gear').waitFor({timeout:15000});
  assert.equal(await mobile.locator('figure.stitch-mobile-art img').count(),2,'two mobile illustrations added');
  const images=mobile.locator('figure.stitch-mobile-art img');
  for(let i=0;i<2;i++){
   await images.nth(i).scrollIntoViewIfNeeded();
   assert.equal(await images.nth(i).evaluate(el=>el.complete&&el.naturalWidth>0),true,'mobile painting '+i);
  }
  await mobile.locator('.city-btn[data-city="barcelona"]').first().click();
  assert.match(await mobile.locator('h2').filter({hasText:'实况避雷雷达'}).first().innerText(),/巴塞罗那/);
  await mobile.evaluate(()=>window.showRescueModal('phone'));
  assert.equal(await mobile.locator('#rescue-modal').isVisible(),true,'mobile rescue modal should open');
  await mobile.evaluate(()=>window.openShareModal());
  assert.equal(await mobile.locator('#stitch-wechat-one-tap').isVisible(),true,'mobile WeChat sharing');
  await mobile.close();
  console.log('Browser smoke passed: desktop city/gear/share/admin + mobile art/city/rescue/WeChat');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
