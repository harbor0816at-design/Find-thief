// 调用云函数 api。所有错误统一成可直接展示给用户的中文。
function call(action, data) {
  return wx.cloud.callFunction({ name: 'api', data: Object.assign({ action }, data || {}) })
    .then(r => {
      const res = r.result || {};
      if (res.error) throw new Error(res.error);
      return res;
    })
    .catch(e => {
      const msg = e && e.message && !/errCode|cloud\.callFunction|timeout|fail/i.test(e.message) ? e.message : '网络不太好，请稍后再试';
      throw new Error(msg);
    });
}
function toast(msg) { wx.showToast({ title: String(msg).slice(0, 30), icon: 'none', duration: 2400 }); }

// 上传图片到云存储（存储权限请设为「仅创建者可读写」，管理员通过云函数查看）
function upload(paths) {
  return Promise.all(paths.map((p, i) => {
    const ext = (p.match(/\.(\w+)$/) || [, 'jpg'])[1].toLowerCase();
    return wx.cloud.uploadFile({ cloudPath: 'evidence/' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext, filePath: p })
      .then(r => r.fileID);
  }));
}
module.exports = { call, toast, upload };
