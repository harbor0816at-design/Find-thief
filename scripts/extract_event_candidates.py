#!/usr/bin/env python3
"""Lightweight metadata rule extraction -> review-only incident candidates.
Uses no scraped full article body, no user identifiers and no paid model.
Do not confuse article publication date with incident occurrence date.
"""
import datetime as dt, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ALIASES={
  "巴黎":{"卢浮宫":["卢浮宫","louvre"],"埃菲尔铁塔":["埃菲尔铁塔","eiffel tower"],"巴黎北站":["巴黎北站","gare du nord"],"巴黎圣母院":["巴黎圣母院","notre dame"]},
  "巴塞罗那":{"兰布拉大道":["兰布拉大道","la rambla","las ramblas"],"圣家堂":["圣家堂","sagrada família","sagrada familia"],"哥特区":["哥特区","barri gòtic","gothic quarter"],"巴塞罗那火车站":["estació de sants","barcelona sants"]},
  "罗马":{"罗马斗兽场":["罗马斗兽场","colosseum"],"特雷维喷泉":["特雷维喷泉","trevi fountain"],"罗马 Termini":["termini","特米尼"],"西班牙广场":["西班牙广场","piazza di spagna"]},
  "米兰":{"米兰大教堂":["米兰大教堂","duomo di milano"],"埃马努埃莱二世拱廊":["埃马努埃莱二世拱廊","galleria vittorio emanuele"],"米兰中央车站":["milano centrale","米兰中央车站"],"斯福尔扎城堡":["斯福尔扎城堡","sforza castle"]},
  "伦敦":{"Leicester Square":["leicester square","莱斯特广场"],"Oxford Circus":["oxford circus","牛津圆环"],"Covent Garden":["covent garden","科文特花园"],"Westminster":["westminster","威斯敏斯特"]}
}
STOLEN=re.compile(r'被偷|被盗|遭窃|扒窃|失窃|失物|pickpocket(?:ed|ing)?|was stolen|has been stolen|theft report|furto|hurto|vol de',re.I)
ITEMS={
 '手机':r'手机|iphone|smartphone|mobile phone|telefono|teléfono',
 '钱包':r'钱包|wallet|portefeuille|portafoglio|cartera',
 '护照证件':r'护照|passport|pasaporte|passaporto',
 '背包行李':r'背包|行李|backpack|luggage|zaino|maleta',
 '银行卡现金':r'现金|银行卡|cash|bank card|credit card|dinero',
 '相机电子设备':r'相机|camera|laptop|相机|电脑',
 '首饰':r'首饰|手表|珠宝|jewelry|watch|orologio'
}
def classify(meta, catalog):
 title=(meta.get('title') or '');desc=(meta.get('meta_description') or '')
 text=title+' '+desc
 if meta.get('status')!='metadata_ok' or not STOLEN.search(text):
  return None
 # Reporting a mention in the source title/description is NOT proof of an incident.
 spot_matches=[]
 for spot,labels in ALIASES.get(catalog.get('city'),{}).items():
  if any(re.search(r'(?<![A-Za-z])'+re.escape(alias)+r'(?![A-Za-z])',text,re.I) for alias in labels):
   spot_matches.append(spot)
 matches=[k for k,pat in ITEMS.items() if re.search(pat,text,re.I)]
 published=meta.get('published_meta') or ''
 if not re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:T[^\s]{1,20})?',published):published=None
 return {'source_key':meta['source_key'],'source_url':meta['url'],
 'country':catalog.get('country'),'city_target':catalog.get('city'),
 'spot_mentions':spot_matches,'item_mentions':matches,
 'source_title':title[:200],'source_published_on':published[:10] if published else None,
 'incident_occurred_on':None,'event_status':'staging_needs_human_review',
 'evidence_grade':'metadata_only',
 'summary':'公开页面元信息包含可能相关的失窃词语，须打开原始链接核实是否真实个案、时间与地点；不可直接发布为事件。'}
def run():
 source=json.loads((ROOT/'data'/'source-candidates-v2.json').read_text(encoding='utf-8'))
 catalog={x['source_key']:x for x in json.loads((ROOT/'data'/'source-targets-v2.json').read_text(encoding='utf-8'))['sources']}
 out=[]
 for row in source['sources']:
  rule=catalog.get(row['source_key'])
  if rule:
   v=classify(row,rule)
   if v:out.append(v)
 result={'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
 'status':'REVIEW_ONLY_NOT_PUBLISHED','candidate_count':len(out),
 'candidates':out}
 (ROOT/'data'/'event-candidates-v2.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('metadata incident leads:',len(out))
if __name__=='__main__':run()
