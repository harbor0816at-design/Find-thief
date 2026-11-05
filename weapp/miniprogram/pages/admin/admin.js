const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');

Page({
  data: {
    rootFs: '16px', tab: 'r', loading: true, reports: [], appeals: [], edit: {}, tags: [],
    types: R.TYPES.map(t => t.key),
    results: [{ k: 'upheld', n: '维持标记' }, { k: 'downgraded', n: '降为存疑' }, { k: 'removed', n: '撤下标记' }, { k: 'rejected', n: '驳回申诉' }],
    syncing: false, syncResult: ''
  },
  onShow() { this.setData({ rootFs: font.size() }); this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },
  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },

  load() {
    return api.call('adminQueue').then(r => {
      const edit = {};
      r.reports.forEach(x => { edit[x.id] = { summary: '', type: x.type, verdict: false, reason: '' }; });
      r.appeals.forEach(x => { edit[x.id] = { result: '', decision: '', tagMap: {} }; });
      this.setData({
        loading: false, tags: r.tags, edit,
        reports: r.reports.map(x => Object.assign({}, x, { evText: (x.evidence || []).join('、') })),
        appeals: r.appeals
      });
    }).catch(e => { this.setData({ loading: false }); api.toast(e.message); });
  },
  onEdit(e) { const d = e.currentTarget.dataset; this.setData({ ['edit.' + d.id + '.' + d.f]: e.detail.value }); },
  setEdit(e) { const d = e.currentTarget.dataset; this.setData({ ['edit.' + d.id + '.' + d.f]: d.v }); },
  toggleVerdict(e) { const id = e.currentTarget.dataset.id; this.setData({ ['edit.' + id + '.verdict']: !this.data.edit[id].verdict }); },
  toggleTag(e) { const d = e.currentTarget.dataset; this.setData({ ['edit.' + d.id + '.tagMap.' + d.v]: !this.data.edit[d.id].tagMap[d.v] }); },
  preview(e) { wx.previewImage({ current: e.currentTarget.dataset.src, urls: e.currentTarget.dataset.all }); },
  openPlace(e) { wx.navigateTo({ url: '/pages/place/place?id=' + e.currentTarget.dataset.id }); },

  done(msg) { api.toast(msg); this.load(); },
  approve(e) {
    const id = e.currentTarget.dataset.id, ed = this.data.edit[id];
    api.call('adminReviewReport', { id, approve: true, summary: ed.summary, type: ed.type, adminVerdict: ed.verdict })
      .then(() => this.done('已通过并上图')).catch(err => api.toast(err.message));
  },
  reject(e) {
    const id = e.currentTarget.dataset.id, ed = this.data.edit[id];
    api.call('adminReviewReport', { id, approve: false, rejectReason: ed.reason }).then(() => this.done('已驳回')).catch(err => api.toast(err.message));
  },
  decide(e) {
    const id = e.currentTarget.dataset.id, ed = this.data.edit[id];
    if (!ed.result) return api.toast('请选择处理结果');
    const tags = Object.keys(ed.tagMap).filter(k => ed.tagMap[k]);
    api.call('adminDecideAppeal', { id, result: ed.result, decision: ed.decision, tags }).then(() => this.done('已处理')).catch(err => api.toast(err.message));
  },
  init() { api.call('adminInit').then(r => api.toast(r.created.length ? '已创建 ' + r.created.length + ' 个集合' : '集合都已存在')).catch(e => api.toast(e.message)); },
  cleanup() { api.call('adminCleanup').then(r => api.toast('已清理上报 ' + r.reports + ' 条、申诉 ' + r.appeals + ' 条')).catch(e => api.toast(e.message)); },
  sync() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    api.call('adminSync').then(r => this.setData({ syncResult: '共 ' + r.total + ' 个地点：新增 ' + r.created + '，更新 ' + r.updated }))
      .catch(e => api.toast(e.message)).then(() => this.setData({ syncing: false }));
  }
});
