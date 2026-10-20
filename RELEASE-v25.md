# 防扒雷达 v25 发布说明（2026-10-21）

基于交接包 `04ef1eb` 的发布前检查与修复。

## 修复
| 级别 | 问题 | 处理 |
|---|---|---|
| P0 | 手机页 `<script defer>` 从 bootcdn 同步加载 Leaflet，排在 `stitch-integrate.js` 之前；CDN 慢或不可达时整页功能被阻塞（历史“正在加载”死锁根因之一） | 移除阻塞脚本；Leaflet 改由 `stitch-integrate.js` 异步从 jsDelivr 加载（unpkg 降级，CSS 带 SRI），地图失败不影响其它功能 |
| P1 | 手机底部导航「匿名吐槽」点击无反应：`enterView` 用 `getElementById('#expose-form')` 判断，永远为 null | 重写 `enterView`，按候选选择器依次查找；底栏 `aria-current` 随之更新；`#radar/#report/#rescue/#prevention` 深链可直接定位 |
| P1 | 手机页脚「使用说明 / 隐私免责 / 热点核验」及底栏为 `href="#"` 空链接 | 分别指向 `/terms.html`、`/privacy.html`、`/legacy.html` 与对应锚点 |
| P1 | 桌面「防扒护身符」按钮内联 `onclick` 复制不存在的域名 `thiefradar.eu` 并弹 `alert()`（JS 未加载时生效） | 改为 `data-amulet`，由脚本复制真实当前城市链接 |
| P2 | 品牌残留「小偷在哪里 / Where is the Thief / ThiefRadar」 | 页面标题、OG、页头页脚、分享文案、海报统一为「防扒雷达」（功能栏目名「小偷雷达」保留） |
| P2 | 桌面首屏右侧大片空白、城市按钮被挤到右下角；导航与 SOS 文字折行；雷达卡分类标签竖排 | 首屏改为左文右图网格；导航/按钮/标签不折行 |
| P2 | 手机页 `user-scalable=no` 禁止缩放（无障碍问题） | 移除；表单控件 16px 防止 iOS 聚焦自动放大 |
| P2 | 首页/手机页缺少 meta description、og:title；所有页面无 favicon（每次 404） | 补齐元信息；新增 `favicon.svg` 并重写 `/favicon.ico` |
| P3 | 匿名报失提交遇到非 JSON 错误页时显示解析异常；无超时 | 容错解析 + 15 秒超时提示，可先存本机草稿 |
| P3 | Supabase URL 带尾部斜杠时部分 API 拼出 `//rest/v1` | 统一去除尾部斜杠 |

`vercel.json` 新增 HSTS 与插画缓存。

## 验证
- `node --test tests/*.test.js`：52 通过（新增 `tests/release-v25.test.js`）
- Python 管道测试 7 通过；全部 JS `node --check` 通过
- `tests/stitch-browser-smoke.cjs`（Chromium）通过
- 额外：320/390/430/800/1100/1280/1440 宽度无横向溢出；两种布局全部按钮逐一点击无运行时错误；内联处理函数全部存在

## 仍需人工现场验收（未变）
见 `RELEASE-ACCEPTANCE-CHECKLIST.md`：112 真机唤起、真实投稿→审核→公开全链路、微信 JS-SDK 授权、真机海报保存。
