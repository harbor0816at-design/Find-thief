// 小偷地图 · 一键发布：① 从 GitHub 同步最新代码 ② 部署云函数 api ③ 上传小程序代码（开发版）
// 用法：双击「发布小偷地图.bat」。本机文件 private.key / env.txt / admin-code.json 永远不会被覆盖。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const readline = require('readline');
const { execFileSync } = require('child_process');

const dir = __dirname;
const REPO_ZIP = 'https://codeload.github.com/harbor0816at-design/Find-thief/zip/refs/heads/main';
const KEEP = new Set(['private.key', 'env.txt', 'project.private.config.json', path.join('cloudfunctions', 'api', 'admin-code.json')]);
const ask = q => new Promise(r => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); r(a.trim()); }); });

function download(url, file, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'xiaotou-map-deploy' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) { res.resume(); return resolve(download(res.headers.location, file, hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('下载失败 HTTP ' + res.statusCode)); }
      const w = fs.createWriteStream(file); res.pipe(w); w.on('finish', () => w.close(resolve)); w.on('error', reject);
    }).on('error', reject).setTimeout(60000, function () { this.destroy(new Error('下载超时')); });
  });
}
function copyTree(src, dst, rel = '') {
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.name === 'node_modules' || KEEP.has(r)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); n += copyTree(s, d, r); }
    else { fs.copyFileSync(s, d); n++; }
  }
  return n;
}
async function syncFromGitHub() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaotou-'));
  try {
    const zip = path.join(tmp, 'src.zip');
    await download(REPO_ZIP, zip);
    execFileSync('tar', ['-xf', zip, '-C', tmp]);
    const top = fs.readdirSync(tmp).find(n => n.startsWith('Find-thief'));
    const weapp = top && path.join(tmp, top, 'weapp');
    if (!weapp || !fs.existsSync(path.join(weapp, 'project.config.json'))) throw new Error('压缩包里没有 weapp 目录');
    return copyTree(weapp, dir);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

(async () => {
  console.log('[1/3] 从 GitHub 同步最新代码 …');
  if (process.argv.includes('--no-sync')) console.log('      已跳过（--no-sync）');
  else {
    try { console.log('      已同步 ' + (await syncFromGitHub()) + ' 个文件'); }
    catch (e) { console.log('      同步失败（' + e.message + '），使用本机现有代码继续'); }
  }

  const ci = require('miniprogram-ci');
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'project.config.json'), 'utf8'));
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
    ignores: ['node_modules/**/*', 'scripts/**/*', 'brand/**/*', 'deploy.js', 'private.key', 'env.txt', '*.bat', '*.zip']
  });

  console.log('[2/3] 部署云函数 api 到环境 ' + env + ' …');
  await ci.cloud.uploadFunction({ project, env, name: 'api', path: path.join(dir, 'cloudfunctions', 'api'), remoteNpmInstall: true });
  console.log('      云函数已部署');

  const now = new Date();
  const version = '1.0.' + (now.getMonth() + 1) + String(now.getDate()).padStart(2, '0') + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  console.log('[3/3] 上传小程序代码，版本 ' + version + ' …');
  await ci.upload({
    project, version, desc: '小偷地图 ' + version, robot: 1,
    setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true, minifyWXML: true, minifyWXSS: true }
  });
  console.log('      代码已上传为开发版');

  console.log('\n========== 完成 ==========');
  console.log('管理员邀请码：' + adminCode + '   （请保存好，不要告诉别人）');
  console.log('下一步：小程序后台 → 版本管理 → 把开发版「选为体验版」，扫码检查后「提交审核」。');
})().catch(e => {
  const msg = String(e && (e.message || e));
  console.error('\n出错了：' + msg);
  if (/invalid ip/i.test(msg)) console.error('→ 小程序后台 → 开发管理 → 开发设置 → 小程序代码上传 → IP 白名单：关闭，或把报错里的 IP 加进去。');
  if (/ResourceNotFound\.Function/i.test(msg)) console.error('→ 云开发控制台 → 云函数 → 新建云函数，名称填 api，然后再运行一次。');
  if (/env|环境/i.test(msg)) console.error('→ 检查云开发环境 ID；删除本文件夹里的 env.txt 后重新运行可重新输入。');
  process.exitCode = 1;
});
