// 自定义导航页：标题放在胶囊按钮下方（与床虱地图一致）
function top() {
  try {
    const r = wx.getMenuButtonBoundingClientRect();
    if (r && r.bottom) return r.bottom + 14;
  } catch (e) { /* 取不到时用默认值 */ }
  try { return (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).statusBarHeight + 54; } catch (e) { return 88; }
}
module.exports = { top };
