// 小偷地图 · 云函数 api（单入口路由）
// 小程序端所有读写都经过这里；数据库集合对客户端一律不开放。
'use strict';
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const R = require('./lib/rules');
const O = require('./lib/official');
const { UserError } = R;

const COLLECTIONS = ['places', 'reports', 'votes', 'appeals', 'likes', 'admins'];
const DAY = 24 * 3600 * 1000;
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function getAll(query, max) {
  const out = [];
  for (let skip = 0; skip < (max || 2000); skip += 100) {
    const r = await query.skip(skip).limit(100).get();
    out.push(...r.data);
    if (r.data.length < 100) break;
  }
  return out;
}
async function getDoc(col, id) {
  try { return (await db.collection(col).doc(id).get()).data; } catch (e) { return null; }
}
async function isAdmin(openid) { return !!(openid && await getDoc('admins', openid)); }
async function requireAdmin(openid) { if (!(await isAdmin(openid))) throw new UserError('仅管理员可操作'); }

async function secCheck(openid, text, scene) {
  if (!text) return 'pass';
  try {
    const r = await cloud.openapi.security.msgSecCheck({ openid, scene: scene || 3, version: 2, content: text });
    const s = r && r.result && r.result.suggest;
    if (s === 'risky') throw new UserError('内容含违规信息，请修改后再提交');
    return s || 'review';
  } catch (e) {
    if (e instanceof UserError) throw e;
    console.warn('msgSecCheck unavailable', e && e.errCode);
    return 'review'; // 校验服务不可用时转人工审核，不直接放行到公开区域
  }
}

async function recentCount(col, openid) {
  return (await db.collection(col).where({ _openid: openid, createdAt: _.gt(new Date(Date.now() - DAY)) }).count()).total;
}

async function ensureCollections() {
  const made = [];
  for (const c of COLLECTIONS) { try { await db.createCollection(c); made.push(c); } catch (e) { /* 已存在 */ } }
  return made;
}

function slimFiles(list) { return Array.isArray(list) ? list : []; }
async function tempUrls(fileIDs) {
  if (!fileIDs.length) return {};
  const r = await cloud.getTempFileURL({ fileList: fileIDs });
  const m = {};
  (r.fileList || []).forEach(f => { if (f.tempFileURL) m[f.fileID] = f.tempFileURL; });
  return m;
}

const APPEAL_LABEL = { pending: '审核中', upheld: '已复核 · 维持标记', downgraded: '审核通过 · 已降为存疑', removed: '审核通过 · 已撤下标记', rejected: '未通过' };

const actions = {
  // ---------- 公开读取 ----------
  async listPlaces({ city }) {
    city = R.clean(city, 30);
    if (!city) throw new UserError('缺少城市');
    let docs = [];
    try { docs = await getAll(db.collection('places').where({ city, hidden: _.neq(true) })); } catch (e) { return { items: [], ready: false }; }
    return { items: docs.map(R.derive).filter(p => p.count > 0), ready: true };
  },

  async search({ city, q }) {
    q = R.clean(q, 40);
    if (!q) return { items: [] };
    const re = db.RegExp({ regexp: escRe(q), options: 'i' });
    const col = db.collection('places');
    let docs = [];
    try {
      docs = (await col.where({ city: R.clean(city, 30), hidden: _.neq(true), names: re }).limit(10).get()).data;
      if (docs.length < 3) docs = docs.concat((await col.where({ hidden: _.neq(true), names: re }).limit(10).get()).data.filter(d => !docs.some(x => x._id === d._id)));
    } catch (e) { docs = []; }
    return { items: docs.slice(0, 10).map(R.derive) };
  },

  async getPlace({ id }, openid) {
    const p = await getDoc('places', R.clean(id, 40));
    if (!p || p.hidden) throw new UserError('这个地点不存在或已撤下');
    const vote = openid ? await getDoc('votes', openid + '_' + p._id) : null;
    let appeal = null;
    try {
      const a = (await db.collection('appeals').where({ placeId: p._id, status: _.neq('pending') }).orderBy('decidedAt', 'desc').limit(1).get()).data[0];
      if (a) appeal = { status: a.status, label: APPEAL_LABEL[a.status], decision: a.decisionPublic || '', tags: a.tags || [], decidedAt: a.decidedAt };
    } catch (e) { /* 无申诉 */ }
    const records = (p.records || []).map(R.publicRecord).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return { place: R.derive(p), records, myVote: vote ? vote.value : '', appeal };
  },

  async listAppeals({ q }) {
    const where = {};
    q = R.clean(q, 40);
    if (q) where.placeName = db.RegExp({ regexp: escRe(q), options: 'i' });
    let rows = [];
    try { rows = (await db.collection('appeals').where(where).orderBy('createdAt', 'desc').limit(50).get()).data; } catch (e) { rows = []; }
    return {
      items: rows.map(a => ({
        id: a._id, placeId: a.placeId, placeName: a.placeName, city: a.city, status: a.status,
        label: APPEAL_LABEL[a.status] || a.status,
        decision: a.status === 'pending' ? '管理员正在核对来源，处理期间该地点图钉显示为「申诉处理中」。' : (a.decisionPublic || ''),
        tags: a.tags || [], createdAt: a.createdAt
      }))
    };
  },

  async me(_args, openid) {
    const out = { isAdmin: false, liked: false, likeCount: 0, reportCount: 0, placeCount: 0 };
    try { out.likeCount = (await db.collection('likes').count()).total; } catch (e) { /* 未初始化 */ }
    if (!openid) return out;
    out.isAdmin = await isAdmin(openid);
    out.liked = !!(await getDoc('likes', openid));
    try {
      const mine = (await db.collection('reports').where({ _openid: openid }).field({ status: true, placeId: true }).limit(100).get()).data;
      out.reportCount = mine.length;
      out.placeCount = new Set(mine.filter(r => r.status === 'approved' && r.placeId).map(r => r.placeId)).size;
    } catch (e) { /* 未初始化 */ }
    return out;
  },

  async myReports(_args, openid) {
    let rows = [];
    try { rows = (await db.collection('reports').where({ _openid: openid }).orderBy('createdAt', 'desc').limit(50).get()).data; } catch (e) { rows = []; }
    return {
      items: rows.map(r => ({
        id: r._id, placeId: r.placeId || '', placeName: r.placeName, city: r.city, type: r.type, item: r.item, date: r.date,
        evidence: r.evidence, detail: r.detail, images: slimFiles(r.images), status: r.status,
        rejectReason: r.rejectReason || '', createdAt: r.createdAt
      }))
    };
  },

  // ---------- 用户写入 ----------
  async submitReport(args, openid) {
    const d = R.validateReport(args.data, today());
    if (await recentCount('reports', openid) >= 5) throw new UserError('今天已提交 5 条，请明天再来');
    if (d.placeId) {
      const p = await getDoc('places', d.placeId);
      if (!p || p.hidden) d.placeId = '';
    }
    const check = await secCheck(openid, d.placeName + '\n' + d.detail, 3);
    const doc = { ...d, _openid: openid, status: 'pending', secCheck: check, createdAt: db.serverDate() };
    const r = await db.collection('reports').add({ data: doc });
    return { id: r._id, message: '已提交，管理员审核通过后才会出现在地图上' };
  },

  async vote({ id, value }, openid) {
    if (!['agree', 'disagree'].includes(value)) throw new UserError('参数无效');
    const p = await getDoc('places', R.clean(id, 40));
    if (!p || p.hidden) throw new UserError('这个地点不存在或已撤下');
    await db.collection('votes').doc(openid + '_' + p._id).set({ data: { _openid: openid, placeId: p._id, value, updatedAt: db.serverDate() } });
    const votes = db.collection('votes');
    const agree = (await votes.where({ placeId: p._id, value: 'agree' }).count()).total;
    const disagree = (await votes.where({ placeId: p._id, value: 'disagree' }).count()).total;
    await db.collection('places').doc(p._id).update({ data: { agree, disagree } });
    return { agree, disagree, ring: R.ringLevel(agree + disagree), myVote: value };
  },

  async submitAppeal(args, openid) {
    const d = R.validateAppeal(args.data);
    if (await recentCount('appeals', openid) >= 5) throw new UserError('今天已提交 5 次申诉，请明天再来');
    const p = await getDoc('places', d.placeId);
    if (!p || p.hidden) throw new UserError('这个地点不存在或已撤下');
    const check = await secCheck(openid, d.detail, 1);
    await db.collection('appeals').add({ data: { ...d, placeName: p.name, city: p.city, _openid: openid, status: 'pending', secCheck: check, createdAt: db.serverDate() } });
    await db.collection('places').doc(p._id).update({ data: { appealState: 'pending' } });
    return { message: '申诉已提交，处理期间该地点显示「申诉处理中」' };
  },

  async like(_args, openid) {
    await db.collection('likes').doc(openid).set({ data: { _openid: openid, createdAt: db.serverDate() } });
    return { liked: true, likeCount: (await db.collection('likes').count()).total };
  },

  // ---------- 管理员 ----------
  async adminLogin({ code }, openid) {
    await ensureCollections();
    const expected = process.env.ADMIN_INVITE_CODE;
    if (!expected || expected.length < 8 || String(code || '') !== expected) throw new UserError('邀请码不正确');
    await db.collection('admins').doc(openid).set({ data: { _openid: openid, createdAt: db.serverDate() } });
    return { isAdmin: true };
  },

  async adminInit(_args, openid) {
    await requireAdmin(openid);
    return { created: await ensureCollections() };
  },

  async adminSync(_args, openid) {
    await requireAdmin(openid);
    const events = require('./data/verified-events-v21.json');
    const grids = require('./data/verified-uk-police-areas.json');
    const places = O.buildOfficialPlaces(events, grids);
    let created = 0, updated = 0;
    for (const p of places) {
      const old = await getDoc('places', p._id);
      if (old) {
        const userRecs = (old.records || []).filter(r => r.origin === 'user');
        const names = [...new Set([...(p.names || []), ...(old.names || [])])];
        await db.collection('places').doc(p._id).update({ data: { records: [...p.records, ...userRecs], names, name: old.name || p.name, updatedAt: db.serverDate() } });
        updated++;
      } else {
        const { _id, ...rest } = p;
        await db.collection('places').doc(_id).set({ data: { ...rest, agree: 0, disagree: 0, appealState: '', hidden: false, createdAt: db.serverDate(), updatedAt: db.serverDate() } });
        created++;
      }
    }
    return { total: places.length, created, updated };
  },

  // 清理处理完成超过 180 天的原始材料（隐私政策承诺）
  async adminCleanup(_args, openid) {
    await requireAdmin(openid);
    const cutoff = new Date(Date.now() - 180 * DAY);
    const oldReports = await getAll(db.collection('reports').where({ status: 'rejected', reviewedAt: _.lt(cutoff) }), 1000);
    const oldAppeals = await getAll(db.collection('appeals').where({ status: _.neq('pending'), decidedAt: _.lt(cutoff) }), 1000);
    const approved = await getAll(db.collection('reports').where({ status: 'approved', reviewedAt: _.lt(cutoff) }), 1000);
    const files = [...oldReports, ...oldAppeals, ...approved].flatMap(x => slimFiles(x.images));
    for (let i = 0; i < files.length; i += 50) await cloud.deleteFile({ fileList: files.slice(i, i + 50) });
    for (const r of oldReports) await db.collection('reports').doc(r._id).remove();
    for (const r of approved) await db.collection('reports').doc(r._id).update({ data: { detail: '（原始描述已按隐私政策清理）', images: [] } });
    for (const a of oldAppeals) await db.collection('appeals').doc(a._id).update({ data: { detail: '（原始说明已按隐私政策清理）', contact: '', images: [] } });
    return { reports: oldReports.length + approved.length, appeals: oldAppeals.length, files: files.length };
  },

  async adminQueue(_args, openid) {
    await requireAdmin(openid);
    const reports = (await db.collection('reports').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(50).get()).data;
    const appeals = (await db.collection('appeals').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(50).get()).data;
    const files = [...reports, ...appeals].flatMap(x => slimFiles(x.images));
    const urls = await tempUrls(files);
    const withUrls = x => ({ ...x, id: x._id, imageUrls: slimFiles(x.images).map(f => urls[f]).filter(Boolean) });
    return { reports: reports.map(withUrls), appeals: appeals.map(withUrls), tags: R.APPEAL_TAGS };
  },

  async adminReviewReport(args, openid) {
    await requireAdmin(openid);
    const rep = await getDoc('reports', R.clean(args.id, 40));
    if (!rep || rep.status !== 'pending') throw new UserError('这条上报已处理，请刷新');
    if (!args.approve) {
      const reason = R.validatePublicText(args.rejectReason || '信息不足，无法核实', 4, 80, '未通过原因');
      await db.collection('reports').doc(rep._id).update({ data: { status: 'rejected', rejectReason: reason, reviewedAt: db.serverDate(), reviewedBy: openid } });
      return { status: 'rejected' };
    }
    const summary = R.validatePublicText(args.summary, 10, 200, '公开描述');
    const type = R.TYPES.includes(args.type) ? args.type : rep.type;
    const verdict = !!args.adminVerdict;
    const rec = {
      rid: rep._id, origin: 'user', date: String(rep.date).slice(0, 7), type, item: rep.item, evidence: rep.evidence,
      adminVerdict: verdict, summary, count: 1,
      sourceName: verdict ? '管理员核实的游客上报' : '游客上报（未经警方确认）',
      sourceUrl: '', caveat: verdict ? '' : '游客自述，经审核脱敏，非警方认定。'
    };
    let target = rep.placeId ? await getDoc('places', rep.placeId) : null;
    if (target && target.hidden) target = null;
    if (!target) {
      const key = O.placeKey(rep.city, rep.lat, rep.lon);
      const id = O.placeId(key);
      target = await getDoc('places', id);
      if (!target) {
        const name = R.validatePublicText(args.placeName || rep.placeName, 2, 60, '地点名称');
        await db.collection('places').doc(id).set({ data: {
          key, city: rep.city, country: R.clean(args.country, 20), lat: +Number(rep.lat).toFixed(3), lon: +Number(rep.lon).toFixed(3),
          name, names: [name], records: [rec], agree: 0, disagree: 0, appealState: '', hidden: false, createdAt: db.serverDate(), updatedAt: db.serverDate()
        } });
        await db.collection('reports').doc(rep._id).update({ data: { status: 'approved', placeId: id, reviewedAt: db.serverDate(), reviewedBy: openid } });
        return { status: 'approved', placeId: id, created: true };
      }
    }
    await db.collection('places').doc(target._id).update({ data: { records: _.push(rec), hidden: false, updatedAt: db.serverDate() } });
    await db.collection('reports').doc(rep._id).update({ data: { status: 'approved', placeId: target._id, reviewedAt: db.serverDate(), reviewedBy: openid } });
    return { status: 'approved', placeId: target._id, created: false };
  },

  async adminDecideAppeal(args, openid) {
    await requireAdmin(openid);
    const a = await getDoc('appeals', R.clean(args.id, 40));
    if (!a || a.status !== 'pending') throw new UserError('这条申诉已处理，请刷新');
    if (!R.APPEAL_RESULTS.includes(args.result)) throw new UserError('请选择处理结果');
    const decision = R.validatePublicText(args.decision, 4, 160, '公开处理说明');
    const tags = (Array.isArray(args.tags) ? args.tags : []).filter(t => R.APPEAL_TAGS.includes(t)).slice(0, 3);
    await db.collection('appeals').doc(a._id).update({ data: { status: args.result, decisionPublic: decision, tags, decidedAt: db.serverDate(), decidedBy: openid } });
    const still = (await db.collection('appeals').where({ placeId: a.placeId, status: 'pending' }).count()).total;
    const patch = { updatedAt: db.serverDate() };
    if (args.result === 'removed') patch.hidden = true;
    if (args.result === 'downgraded') patch.appealState = 'downgraded';
    else if (still === 0) patch.appealState = '';
    else patch.appealState = 'pending';
    await db.collection('places').doc(a.placeId).update({ data: patch });
    return { status: args.result };
  }
};

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const fn = actions[event && event.action];
  if (!fn) return { error: '未知操作' };
  try {
    return await fn(event || {}, OPENID);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    console.error(event.action, e);
    return { error: '服务暂时不可用，请稍后再试' };
  }
};
exports._actions = actions;
