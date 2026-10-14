const {test}=require('node:test'),assert=require('node:assert/strict');
const hotspots=require('../api/hotspots.js'),metrics=require('../api/metrics.js');
function response(){return{code:200,data:null,setHeader(){},status(n){this.code=n;return this},json(x){this.data=x;return this},end(){return this}}}
test('No secret key never fabricates hotspot evidence',async()=>{
 const old={...process.env};delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;const r=response();
 await hotspots({method:'GET',headers:{}},r);assert.equal(r.code,200);assert.deepEqual(r.data.areas,[]);process.env={...old};
});
test('Anonymous event counter is graceful when DB key not configured',async()=>{
 const old={...process.env};delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;const r=response();
 await metrics({method:'POST',headers:{origin:'https://find-thief.vercel.app','content-type':'application/json'},body:{event:'page_view',city:''}},r);
 assert.equal(r.code,204);process.env={...old};
});
test('Rejects unrelated origins for anonymous metrics',async()=>{
 const r=response();await metrics({method:'POST',headers:{origin:'https://example.net'},body:{event:'page_view',city:''}},r);assert.equal(r.code,204);
});
