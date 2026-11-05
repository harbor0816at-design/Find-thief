const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');
const LABEL = { pending: ['审核中', 'appeal'], approved: ['已上图', 'ok'], rejected: ['未通过', 'traveler'] };

Page({
  data: { rootFs: '16px', loading: true, items: [] },
  onShow() { this.setData({ rootFs: font.size() }); this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },
  load() {
    return api.call('myReports').then(r => this.setData({
      loading: false,
      items: r.items.map(x => Object.assign({}, x, { label: (LABEL[x.status] || [x.status])[0], cls: (LABEL[x.status] || ['', ''])[1], time: R.fmtTime(x.createdAt) }))
    })).catch(e => { this.setData({ loading: false }); api.toast(e.message); });
  },
  preview(e) { wx.previewImage({ current: e.currentTarget.dataset.src, urls: e.currentTarget.dataset.all }); },
  open(e) { wx.navigateTo({ url: '/pages/place/place?id=' + e.currentTarget.dataset.id }); },
  toHome() { wx.switchTab({ url: '/pages/index/index' }); }
});
