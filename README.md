# 小偷在哪里 V0.2 · 面向中国游客的欧洲旅行安全地图（PC + H5）

## V0.2交付

- 欧洲 **18** 个重点旅游国家、**51** 个城市、**224** 个景点目录。地图点击、缩放、定位、分享、Google Maps 外链。
- 地图模式切换：无需密钥的 OpenStreetMap 演示地图 + Google Maps JavaScript API（用户自行提供有效浏览器Key）完整地图。支持两种地图的城市和已核坐标景点标记。
- **51** 个欧洲或跨欧亚国家/地区应急号码速查、一键拨号与来源链接（梵蒂冈112经官方资料核对）。中国领保热线、四步求助清单。
- 竞品/公开来源清单，仅引用跳转，不擅自复制第三方用户事件。`sources.json` 描述许可状态。
- 匿名事件草稿：只存储在当前浏览器，不上传服务器，不公开展示，尚无真实事件数据。

## Google Maps 真正启用

1. 打开 Google Cloud Console，选定独立的Google Cloud项目、建立账单账号。
2. 启用 **Maps JavaScript API**。创建 Browser API Key。
3. 将Key的API访问权限限制为 Maps JavaScript API，并将**HTTP Referer**限制为你实际部署的域名（例如 `https://your-domain.example/*`）。
4. 部署后访问网页，点顶部 **地图模式 → Google地图**，输入受限Key，完成切换。此示例把Key保存在本地浏览器localStorage，不会发送至本站后端；Google地图请求会向谷歌发送Key。
5. `file://` 打开的本地网页经常无法通过受限域名的Referrer限制，正式效果要在HTTPS域名下检验。
6. 没有Key时地图仍用 OpenStreetMap，点击城市详情“Google地图”链接即可在独立Google地图页查看实际位置。

## 紧急号码来源

- 欧盟27国统一112: https://europa.eu/youreurope/citizens/travel/security-and-emergencies/emergency/index_en.htm
- 英国999/112: https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers
- 瑞士117/118/144/112: https://www.geo.admin.ch/en/dataset-21072025
- 挪威110/112/113: https://www.forsvaret.no/en/exercises-and-operations/exercises/information-for-participants
- 冰岛112: https://www.112.is/en
- 中国外交部领保（境外拨打）: https://cs.mfa.gov.cn/zggmcgx/lsbhyxz/12308lbrx/202607/t20260713_11981004.html
- 所有国家记录的明细、独立官方或政府旅游安全来源，请见 **emergency.json**。
- 数据资料人工核对日期：**2026-10-14**。紧急号码只用于真实紧急情况；常规失窃报案应向当地警方咨询。

## 竞品公开数据补充：可行范围

- `Pickpocket Alert`、`PickpocketMaps` 已建立可打开的来源链接，未获得批量商业复用许可，**未执行抓取，也不提供从竞争平台复制的警情数据**。
- 真正同步前须核对对方服务条款、许可、robots.txt及API政策。遵守请求频率和授权范围。不批量复制用户评论、照片、全文或具名个人资料。
- 优先使用官方开放数据、已授权合作事件、游客自主报告；所有条目需来源URL/来源类型/事件日期/更新时间/近似地点/审核状态/删除申诉机制。
- 不通过Google地图抓取商户、坐标或用户评论打造自有数据库；该内容受Google平台条款限制。

## 体验与局限

解压并打开 `index.html`，联网可查看底图。移动端适配PC/H5。一切交通、景点和电话列表可离线查看（地图和外链需要网络）。首次体验可以直接使用默认地图，无需申请密钥。

**当前仅为前端演示版**：没有后台，没有真实犯罪事件，没有API/自动采集，没有广告付款、没有服务端审核系统，也没有完成真实浏览器端到端检验，不可宣称已上线实时安全数据产品。

> 源数据: `cities.json`、`emergency.json`、`sources.json`; 页面为内嵌离线可读数据。维护工具 `upgrade_v02.py` 可重建文件，但请先留存基线源码并留意覆盖逻辑。