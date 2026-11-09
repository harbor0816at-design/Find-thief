const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');
const app = getApp();

Page({
  data: { rootFs: '16px', loading: true, err: '', place: null, records: [], myVote: '', appeal: null, icon: '', statusText: '', ringColor: '#D5D7E3', namesText: '' },

  onLoad(q) { this.id = q.id; this.load(); },
  onShow() { this.setData({ rootFs: font.size() }); },
  onShareAppMessage() {
    const p = this.data.place;
    return { title: p ? '小偷在哪｜' + p.city + ' ' + p.name + ' 的失窃记录' : '小偷在哪', path: '/pages/place/place?id=' + this.id };
  },

  load() {
    api.call('getPlace', { id: this.id }).then(res => this.apply(res)).catch(e => this.setData({ loading: false, err: e.message }));
  },
  apply(res) {
    const p = res.place;
    wx.setNavigationBarTitle({ title: p.name.slice(0, 16) });
    this.setData({
      loading: false, place: p, myVote: res.myVote || '', appeal: res.appeal,
      icon: R.pin(p.types[0], p.status, p.ring), statusText: R.STATUS_TEXT[p.status],
      ringColor: R.RING[p.ring].color, namesText: p.names.join('、'),
      records: res.records.map(r => Object.assign({}, r, { evText: (r.evidence || []).join(' · ') }))
    });
  },

  vote(e) {
    const value = e.currentTarget.dataset.v;
    if (this.voting) return;
    this.voting = true;
    api.call('vote', { id: this.id, value }).then(r => {
      const p = Object.assign({}, this.data.place, { agree: r.agree, disagree: r.disagree, reviews: r.agree + r.disagree, ring: r.ring });
      this.setData({ place: p, myVote: r.myVote, ringColor: R.RING[r.ring].color, icon: R.pin(p.types[0], p.status, r.ring) });
      api.toast('已记录，谢谢你的判断');
    }).catch(err => api.toast(err.message)).then(() => { this.voting = false; });
  },

  copy(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.u, success: () => api.toast('链接已复制，可在浏览器打开核对') });
  },
  navigate() {
    const p = this.data.place;
    wx.openLocation({ latitude: p.lat, longitude: p.lon, name: p.name, address: p.country + ' ' + p.city, scale: 16 });
  },
  report() {
    const p = this.data.place;
    app.globalData.pendingPlace = { name: p.name, lat: p.lat, lon: p.lon, city: p.city, placeId: p.id };
    wx.navigateTo({ url: '/pages/report/report' });
  },
  appealIt() {
    const p = this.data.place;
    wx.navigateTo({ url: '/pages/appeal-form/appeal-form?id=' + p.id + '&name=' + encodeURIComponent(p.name) + '&city=' + encodeURIComponent(p.city) });
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }); }
});
