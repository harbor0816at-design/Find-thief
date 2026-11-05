// 小偷地图 · 一键部署：上传云函数 api，再上传小程序代码（开发版）。
// 用法：双击「发布小偷地图.bat」。需要同目录下的 private.key（小程序代码上传密钥）。
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const ci = require('miniprogram-ci');

const dir = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'project.config.json'), 'utf8'));
const ask = q => new Promise(r => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); r(a.trim()); }); });

(async () => {
  if (!fs.existsSync(path.join(dir, 'private.key'))) throw new Error('缺少 private.key（代码上传密钥），请放在本文件夹里');
  const envFile = path.join(dir, 'env.txt');
  let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').trim() : '';
  if (!env) {
    env = await ask('请输入云开发环境 ID（开发者工具 → 云开发 → 设置 里可以复制）：');
    if (!/^[\w-]{4,}$/.test(env)) throw new Error('环境 ID 格式不对');
    fs.writeFileSync(envFile, env);
  }
  const codeFile = path.join(dir, 'cloudfunctions', 'api', 'admin-code.json');
  if (!fs.existsSync(codeFile)) fs.writeFileSync(codeFile, JSON.stringify({ code: crypto.randomBytes(6).toString('hex') }));
  const adminCode = JSON.parse(fs.readFileSync(codeFile, 'utf8')).code;

  const project = new ci.Project({
    appid: cfg.appid, type: 'miniProgram', projectPath: dir,
    privateKeyPath: path.join(dir, 'private.key'),
    ignores: ['node_modules/**/*', 'scripts/**/*', 'deploy.js', 'private.key', 'env.txt', '*.bat']
  });

  console.log('\n[1/2] 上传云函数 api 到环境 ' + env + ' …');
  await ci.cloud.uploadFunction({ project, env, name: 'api', path: path.join(dir, 'cloudfunctions', 'api'), remoteNpmInstall: true });
  console.log('      云函数已部署');

  const now = new Date();
  const version = '1.0.' + (now.getMonth() + 1) + String(now.getDate()).padStart(2, '0') + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  console.log('[2/2] 上传小程序代码，版本 ' + version + ' …');
  await ci.upload({
    project, version, desc: '小偷地图 ' + version, robot: 1,
    setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true, minifyWXML: true, minifyWXSS: true }
  });
  console.log('      代码已上传为开发版');

  console.log('\n========== 完成 ==========');
  console.log('管理员邀请码：' + adminCode + '   （请保存好，不要告诉别人）');
  console.log('下一步：小程序后台 → 版本管理 → 把这个开发版「选为体验版」，用微信扫体验版二维码打开；');
  console.log('        在「我的」页长按底部文字，输入邀请码，进管理后台点「初始化数据库」「同步官方数据」。');
})().catch(e => {
  const msg = String(e && (e.message || e));
  console.error('\n出错了：' + msg);
  if (/invalid ip|ip.*白名单|whitelist/i.test(msg)) console.error('→ 小程序后台 → 开发管理 → 开发设置 → 小程序代码上传 → IP 白名单：关闭，或把报错里的 IP 加进去。');
  if (/env|环境/i.test(msg)) console.error('→ 检查云开发环境 ID 是否正确；删除本文件夹里的 env.txt 后重新运行可重新输入。');
  process.exitCode = 1;
});
