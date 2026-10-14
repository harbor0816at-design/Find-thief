# 小偷在哪里 V1.4：公开数据来源证据网格

英国警方 data.police.uk，OGL v3.0；伦敦9个样本查询中心（非全市），2026年6月至8月。

检索原始记录去重6484条；达到门槛且聚合到74片格网的记录6472条。分类Theft from the person不等于全部为扒窃。官方坐标为匿名近似位置；我们又按约1公里网格汇总。记录数不代表犯罪率或个人受害概率。

已将74片官方网格写入独立Supabase数据库。独立公开快照 data/verified-uk-police-areas.json 可在未配置数据库服务端密钥时使用。每月GitHub Actions只刷新 staging 文件，不自动发布未经审核的候选记录。

官方来源：https://data.police.uk/data/
官方说明：https://data.police.uk/about/
