// 小偷在哪微信小程序：工程完整性 + 云函数全流程（内存数据库模拟 wx-server-sdk）
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const W = path.join(__dirname, '..', 'weapp'), MP = path.join(W, 'miniprogram'), CF = path.join(W, 'cloudfunctions', 'api');
const read = p => fs.readFileSync(p, 'utf8');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

test('every page and component has its four files, and JSON parses', () => {
  const app = JSON.parse(read(path.join(MP, 'app.json')));
  for (const p of app.pages) for (const ext of ['js', 'wxml', 'wxss', 'json']) assert.ok(fs.existsSync(path.join(MP, p + '.' + ext)), p + '.' + ext);
  for (const ext of ['js', 'wxml', 'wxss', 'json']) assert.ok(fs.existsSync(path.join(MP, 'components/guide/guide.' + ext)));
  for (const f of walk(W).filter(f => f.endsWith('.json'))) JSON.parse(read(f));
  for (const t of app.tabBar.list) for (const k of ['iconPath', 'selectedIconPath']) assert.ok(fs.existsSync(path.join(MP, t[k])), t[k]);
  assert.deepEqual(app.tabBar.list.map(t => t.text), ['地点', '申诉', '我的']);
});

test('all mini program JS parses and WXML tags are balanced', () => {
  for (const f of walk(W).filter(f => f.endsWith('.js') && !f.includes('node_modules'))) new Function('require', 'module', 'exports', 'Page', 'App', 'Component', 'getApp', 'wx', read(f));
  const VOID = new Set(['image', 'input', 'page-meta', 'import', 'include']);
  for (const f of walk(MP).filter(f => f.endsWith('.wxml'))) {
    const src = read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, 'X');
    const stack = [];
    for (const m of src.matchAll(/<(\/?)([a-z-]+)([^>]*?)(\/?)>/g)) {
      const [, close, tag, , self] = m;
      if (self || (VOID.has(tag) && !close)) continue;
      if (close) { if (VOID.has(tag)) continue; assert.equal(stack.pop(), tag, f + ' closes ' + tag); } else stack.push(tag);
    }
    assert.deepEqual(stack, [], f + ' unclosed: ' + stack.join(','));
  }
});

test('every pin image the app can request exists', () => {
  for (const t of ['pick', 'snatch', 'scam']) for (const s of ['admin', 'traveler', 'doubt', 'appeal']) for (let r = 0; r < 5; r++)
    assert.ok(fs.existsSync(path.join(MP, 'images/pins', `${t}-${s}-${r}.png`)));
  for (const f of walk(MP).filter(f => /\.(wxml|js)$/.test(f))) for (const m of read(f).matchAll(/["'](\/images\/[\w/.-]+\.png)["']/g)) assert.ok(fs.existsSync(path.join(MP, m[1])), m[1] + ' in ' + f);
});

test('front-end and cloud constants agree', () => {
  const F = require(path.join(MP, 'utils/rules.js')), C = require(path.join(CF, 'lib/rules.js'));
  assert.deepEqual(F.TYPES.map(t => t.key), C.TYPES);
  assert.deepEqual(F.ITEMS, C.ITEMS); assert.deepEqual(F.EVIDENCE, C.EVIDENCE); assert.deepEqual(F.SLOTS, C.SLOTS); assert.deepEqual(F.APPEAL_REASONS, C.APPEAL_REASONS);
  assert.equal(F.RING.length, 5);
  assert.equal(require(path.join(MP, 'utils/cities.js')).length, JSON.parse(read(path.join(__dirname, '..', 'cities.json'))).length);
});

test('official data becomes places without inventing points', () => {
  const O = require(path.join(CF, 'lib/official.js'));
  const ev = JSON.parse(read(path.join(CF, 'data/verified-events-v21.json'))), g = JSON.parse(read(path.join(CF, 'data/verified-uk-police-areas.json')));
  const places = O.buildOfficialPlaces(ev, g);
  const has = x => x.lat != null && x.lat !== '' && isFinite(x.lat);
  const inputs = [...(ev.items || []), ...(ev.areas || []), ...(g.areas || [])].filter(has).length;
  assert.ok(places.length > 0 && places.length <= inputs);
  assert.equal(places.reduce((n, p) => n + p.records.length, 0), inputs);
  assert.equal(new Set(places.map(p => p._id)).size, places.length);
  for (const p of places) { assert.match(p._id, /^p[0-9a-f]{20}$/); assert.ok(p.name && p.city && isFinite(p.lat)); }
  assert.deepEqual(O.buildOfficialPlaces({}, null), []);
});

test('validation rejects bad input and contact info in public text', () => {
  const C = require(path.join(CF, 'lib/rules.js'));
  const ok = { consent: true, placeName: 'Termini 站', city: '罗马', lat: 41.9, lon: 12.5, type: '扒窃', item: '手机', date: '2026-10-01', evidence: ['仅自述'], detail: '上地铁时被几个人挤到门边，手机没了' };
  assert.equal(C.validateReport(ok, '2026-11-05').type, '扒窃');
  for (const bad of [{ consent: false }, { lat: 10 }, { date: '2026-12-01' }, { date: '2026-02-30' }, { type: '偷' }, { detail: '短' }, { evidence: ['乱写'] }, { images: ['http://x/a.jpg'] }])
    assert.throws(() => C.validateReport(Object.assign({}, ok, bad), '2026-11-05'), C.UserError, JSON.stringify(bad));
  assert.throws(() => C.validatePublicText('联系我 abc@example.com 可以退款', 4, 160, 'x'), C.UserError);
  assert.throws(() => C.validatePublicText('电话 +39 333 123 4567 找他', 4, 160, 'x'), C.UserError);
  assert.equal(C.ringLevel(0), 0); assert.equal(C.ringLevel(2), 1); assert.equal(C.ringLevel(5), 2); assert.equal(C.ringLevel(10), 3); assert.equal(C.ringLevel(11), 4);
});

/* ---------- 内存版 wx-server-sdk ---------- */
function fakeSdk() {
  const store = {}, ctx = { OPENID: 'u1' };
  const CMD = (op, v) => ({ __op: op, v });
  const _ = { neq: v => CMD('neq', v), gt: v => CMD('gt', v), lt: v => CMD('lt', v), push: v => CMD('push', v) };
  const match = (doc, where) => Object.entries(where).every(([k, c]) => {
    const v = doc[k];
    if (c instanceof RegExp) return (Array.isArray(v) ? v : [v]).some(x => c.test(String(x)));
    if (c && c.__op === 'neq') return v !== c.v;
    if (c && c.__op === 'gt') return v > c.v;
    if (c && c.__op === 'lt') return v < c.v;
    return v === c;
  });
  const col = name => {
    if (!store[name]) { const e = new Error('collection not exists'); e.errCode = -502005; throw e; }
    return store[name];
  };
  const query = (name, where, opts) => ({
    where: w => query(name, w, opts), skip: n => query(name, where, Object.assign({}, opts, { skip: n })), limit: n => query(name, where, Object.assign({}, opts, { limit: n })),
    orderBy: (f, d) => query(name, where, Object.assign({}, opts, { order: [f, d] })), field: () => query(name, where, opts),
    async get() {
      let rows = Object.values(col(name)).filter(d => match(d, where || {}));
      if (opts.order) rows.sort((a, b) => (a[opts.order[0]] > b[opts.order[0]] ? 1 : -1) * (opts.order[1] === 'desc' ? -1 : 1));
      rows = rows.slice(opts.skip || 0, (opts.skip || 0) + (opts.limit || 100));
      return { data: JSON.parse(JSON.stringify(rows), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v)) };
    },
    async count() { return { total: Object.values(col(name)).filter(d => match(d, where || {})).length }; }
  });
  let seq = 0;
  const db = {
    command: _, serverDate: () => new Date(), RegExp: ({ regexp, options }) => new RegExp(regexp, options),
    async createCollection(n) { if (store[n]) throw new Error('exists'); store[n] = {}; },
    collection: name => Object.assign(query(name, null, {}), {
      async add({ data }) { const id = 'id' + (++seq); col(name)[id] = Object.assign({ _id: id }, data); return { _id: id }; },
      doc: id => ({
        async get() { const d = col(name)[id]; if (!d) throw new Error('document not exists'); return { data: JSON.parse(JSON.stringify(d)) }; },
        async set({ data }) { col(name)[id] = Object.assign({ _id: id }, data); },
        async update({ data }) {
          const d = col(name)[id]; if (!d) throw new Error('document not exists');
          for (const [k, v] of Object.entries(data)) d[k] = v && v.__op === 'push' ? (d[k] || []).concat(v.v) : v;
        },
        async remove() { delete col(name)[id]; }
      })
    })
  };
  const sdk = {
    DYNAMIC_CURRENT_ENV: 'env', init() {}, database: () => db, getWXContext: () => ({ OPENID: ctx.OPENID }),
    openapi: { security: { msgSecCheck: async ({ content }) => ({ result: { suggest: /违规词/.test(content) ? 'risky' : 'pass' } }) } },
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(f => ({ fileID: f, tempFileURL: 'https://tmp/' + f })) }),
    deleteFile: async () => ({})
  };
  return { sdk, store, ctx };
}

test('cloud function: report → review → map → vote → appeal → decision', async () => {
  const { sdk, store, ctx } = fakeSdk();
  const orig = Module._load;
  Module._load = function (req, ...rest) { return req === 'wx-server-sdk' ? sdk : orig.call(this, req, ...rest); };
  const file = path.join(CF, 'index.js');
  delete require.cache[file];
  const api = require(file);
  Module._load = orig;
  const call = (action, args, who) => { ctx.OPENID = who || 'u1'; return api.main(Object.assign({ action }, args)); };

  assert.deepEqual(await call('listPlaces', { city: '罗马' }), { items: [], ready: false });
  process.env.ADMIN_INVITE_CODE = 'invite-code-123';
  assert.ok((await call('adminLogin', { code: 'wrong' }, 'admin')).error);
  assert.equal((await call('adminLogin', { code: 'invite-code-123' }, 'admin')).isAdmin, true);
  assert.ok((await call('adminSync', {}, 'u1')).error, 'non-admin cannot sync');
  const sync = await call('adminSync', {}, 'admin');
  assert.ok(sync.total > 0 && sync.created === sync.total);
  assert.equal((await call('adminSync', {}, 'admin')).updated, sync.total, 'second sync is idempotent');

  const cities = [...new Set(Object.values(store.places).map(p => p.city))];
  const city = cities[0];
  const before = (await call('listPlaces', { city })).items.length;
  assert.ok(before > 0);

  const data = { consent: true, placeName: '测试广场 Test Square', city, lat: 45.1234, lon: 9.4321, type: '抢夺', item: '手机', date: '2026-10-02', evidence: ['当场发现'], detail: '骑摩托的人从身后抢走手里的手机', images: ['cloud://env.abc/evidence/1.jpg'] };
  assert.ok((await call('submitReport', { data: Object.assign({}, data, { detail: '这里有违规词需要拦截掉' }) })).error);
  const sub = await call('submitReport', { data });
  assert.ok(sub.id && !sub.error);
  assert.equal((await call('listPlaces', { city })).items.length, before, 'pending report is not on the map');
  assert.equal((await call('myReports', {})).items[0].status, 'pending');
  assert.equal((await call('myReports', {}, 'u2')).items.length, 0, 'other users cannot see it');

  const q = await call('adminQueue', {}, 'admin');
  assert.equal(q.reports.length, 1); assert.equal(q.reports[0].imageUrls.length, 1);
  assert.ok((await call('adminReviewReport', { id: sub.id, approve: true, summary: '联系 a@b.com' }, 'admin')).error, 'contact info blocked');
  const rv = await call('adminReviewReport', { id: sub.id, approve: true, summary: '游客在广场被飞车抢走手机。', type: '抢夺', adminVerdict: false }, 'admin');
  assert.equal(rv.status, 'approved'); assert.equal(rv.created, true);
  const after = (await call('listPlaces', { city })).items;
  assert.equal(after.length, before + 1);
  const mine = after.find(p => p.id === rv.placeId);
  assert.equal(mine.status, 'traveler'); assert.deepEqual(mine.types, ['抢夺']); assert.equal(mine.ring, 0);
  assert.equal(store.places[rv.placeId].lat, 45.123, 'public coordinates rounded');

  const detail = await call('getPlace', { id: rv.placeId }, 'u2');
  assert.equal(detail.records[0].summary, '游客在广场被飞车抢走手机。');
  assert.equal(detail.records[0].date, '2026-10', 'public date is month only');
  assert.ok(!JSON.stringify(detail).includes('骑摩托的人'), 'raw detail never public');

  await call('vote', { id: rv.placeId, value: 'agree' }, 'u2');
  await call('vote', { id: rv.placeId, value: 'agree' }, 'u3');
  const v = await call('vote', { id: rv.placeId, value: 'disagree' }, 'u2');
  assert.deepEqual([v.agree, v.disagree, v.ring], [1, 1, 1], 'one vote per user, changeable');

  const ap = await call('submitAppeal', { data: { consent: true, placeId: rv.placeId, reason: '信息错误', detail: '我们店门口有监控，当天没有发生抢夺', contact: 'shop@example.com' } }, 'shop');
  assert.ok(ap.message);
  assert.equal((await call('listPlaces', { city })).items.find(p => p.id === rv.placeId).status, 'appeal');
  const pub = await call('listAppeals', {}, 'u2');
  assert.equal(pub.items.length, 1);
  assert.ok(!JSON.stringify(pub).includes('shop@example.com') && !JSON.stringify(pub).includes('监控'), 'appeal detail and contact stay private');

  const apId = (await call('adminQueue', {}, 'admin')).appeals[0].id;
  assert.equal((await call('adminDecideAppeal', { id: apId, result: 'downgraded', decision: '来源不足，降为存疑。', tags: ['来源已更正', '乱填'] }, 'admin')).status, 'downgraded');
  assert.equal((await call('listPlaces', { city })).items.find(p => p.id === rv.placeId).status, 'doubt');
  assert.deepEqual((await call('listAppeals', {})).items[0].tags, ['来源已更正']);
  assert.equal((await call('getPlace', { id: rv.placeId })).appeal.decision, '来源不足，降为存疑。');

  await call('submitAppeal', { data: { consent: true, placeId: rv.placeId, reason: '恶意标记', detail: '再次申诉，请撤下这个标记谢谢' } }, 'shop');
  const ap2 = (await call('adminQueue', {}, 'admin')).appeals[0].id;
  await call('adminDecideAppeal', { id: ap2, result: 'removed', decision: '核实后撤下。' }, 'admin');
  assert.ok(!(await call('listPlaces', { city })).items.some(p => p.id === rv.placeId), 'removed place hidden');
  assert.ok((await call('getPlace', { id: rv.placeId })).error);

  const syncAgain = await call('adminSync', {}, 'admin');
  assert.equal(syncAgain.total, sync.total);

  const me = await call('like', {}, 'u2'); assert.equal(me.likeCount, 1);
  await call('like', {}, 'u2'); assert.equal((await call('me', {}, 'u1')).likeCount, 1, 'like counted once');
  assert.equal((await call('me', {}, 'u1')).placeCount, 1);

  for (let i = 0; i < 4; i++) await call('submitReport', { data }, 'u1');
  assert.match((await call('submitReport', { data }, 'u1')).error, /5 条/, 'daily limit');
  assert.equal((await call('nope', {})).error, '未知操作');
});
