const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');
const nav = require('../../utils/nav');

const SHORT = { pending: ['审核中', 'appeal'], upheld: ['维持标记', 'traveler'], downgraded: ['审核通过', 'ok'], removed: ['审核通过', 'ok'], rejected: ['未通过', ''] };

Page({
  data: { rootFs: '16px', navTop: 88, kw: '', items: [], loading: true },
  onLoad() { this.setData({ navTop: nav.top() }); },
  onShow() { this.setData({ rootFs: font.size() }); this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },
  onKw(e) { this.setData({ kw: e.detail.value }); },
  load() {
    this.setData({ loading: !this.data.items.length });
    return api.call('listAppeals', { q: this.data.kw.trim() }).then(res => {
      this.setData({
        loading: false,
        items: res.items.map(a => Object.assign({}, a, { short: (SHORT[a.status] || [a.label])[0], cls: (SHORT[a.status] || ['', ''])[1], time: R.fmtTime(a.createdAt) }))
      });
    }).catch(e => { this.setData({ loading: false }); api.toast(e.message); });
  },
  newAppeal() { wx.navigateTo({ url: '/pages/appeal-form/appeal-form' }); },
  openPlace(e) {
    const it = this.data.items.find(x => x.placeId === e.currentTarget.dataset.id);
    if (it && it.status !== 'removed') wx.navigateTo({ url: '/pages/place/place?id=' + it.placeId });
  }
});
