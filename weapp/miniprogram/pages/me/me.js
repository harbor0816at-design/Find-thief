const api = require('../../utils/api');
const font = require('../../utils/font');
const nav = require('../../utils/nav');

Page({
  data: {
    rootFs: '16px', navTop: 88,
    me: { placeCount: 0, reportCount: 0, likeCount: 0, liked: false, isAdmin: false },
    fontShow: false, fontLevels: font.LEVELS, fontKey: 'm', fontName: '标准',
    guideShow: false, adminAsk: false, code: ''
  },
  onLoad() { this.setData({ navTop: nav.top() }); },
  onShow() { this.syncFont(); this.load(); },
  onShareAppMessage() { return { title: '小偷地图｜出发前看看哪里扒手多', path: '/pages/index/index' }; },
  syncFont() { const k = font.get(); this.setData({ rootFs: font.size(), fontKey: k, fontName: font.LEVELS.find(l => l.key === k).name }); },
  load() { api.call('me').then(me => this.setData({ me })).catch(() => {}); },

  toMine() { wx.navigateTo({ url: '/pages/my-reports/my-reports' }); },
  toHome() { wx.switchTab({ url: '/pages/index/index' }); },
  toAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },
  openDoc(e) { wx.navigateTo({ url: '/pages/doc/doc?t=' + e.currentTarget.dataset.t }); },
  like() {
    if (this.data.me.liked) return api.toast('已经喜欢过啦，谢谢！');
    api.call('like').then(r => { this.setData({ 'me.liked': true, 'me.likeCount': r.likeCount }); api.toast('收到你的喜欢 ♥'); }).catch(e => api.toast(e.message));
  },
  call112() { wx.makePhoneCall({ phoneNumber: '112', fail() {} }); },
  copy12308() { wx.setClipboardData({ data: '+86-10-12308' }); },
  openGuide() { this.setData({ guideShow: true }); },
  closeGuide() { this.setData({ guideShow: false }); },
  openFont() { this.setData({ fontShow: true }); },
  closeFont() { this.setData({ fontShow: false }); },
  setFont(e) { font.set(e.currentTarget.dataset.k); this.syncFont(); },
  askAdmin() { this.setData({ adminAsk: true }); },
  closeAdmin() { this.setData({ adminAsk: false, code: '' }); },
  onCode(e) { this.setData({ code: e.detail.value }); },
  adminLogin() {
    api.call('adminLogin', { code: this.data.code.trim() }).then(() => {
      this.setData({ adminAsk: false, code: '', 'me.isAdmin': true });
      wx.navigateTo({ url: '/pages/admin/admin' });
    }).catch(e => api.toast(e.message));
  }
});
