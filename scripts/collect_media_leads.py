#!/usr/bin/env python3
"""GDELT DOC 2.0 (public news search API) -> review-only multi-language news URL/title leads.
No article body scraping, user data or social platform bypass. Published article date != incident date.
"""
import datetime as dt, email.utils, hashlib, json, re, time
import xml.etree.ElementTree as ET
import urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"media-leads-v21.json"
API="https://api.gdeltproject.org/api/v2/doc/doc"
AGENT="FindThiefPublicNewsLeadCollector/2.1 (+https://github.com/harbor0816at-design/Find-thief)"
QUERIES=[
 ("法国","巴黎",'pickpocket Paris'),("法国","巴黎",'"vol à la tire" Paris'),("法国","巴黎",'"巴黎" "被偷"'),
 ("西班牙","巴塞罗那",'pickpocket Barcelona'),("西班牙","巴塞罗那",'"hurto" "Barcelona"'),("西班牙","巴塞罗那",'"巴塞罗那" "被盗"'),
 ("意大利","罗马",'pickpocket Rome'),("意大利","罗马",'"borseggio" Roma'),
 ("意大利","米兰",'pickpocket Milan'),("意大利","米兰",'"borseggio" Milano'),
 ("英国","伦敦",'pickpocket London'),("英国","伦敦",'"phone stolen" London')
]
ALIASES={"巴黎":("paris","巴黎"),"巴塞罗那":("barcelona","巴塞罗那"),"罗马":("rome","roma","罗马"),"米兰":("milan","milano","米兰"),"伦敦":("london","伦敦")}
KEYWORDS=re.compile(r'pickpocket|theft|stolen|steal|robbed|hurto|robo|bors[ea]ggi|furto|vol à la tire|vol de|盗|偷|扒窃|抢|丢失',re.I)
ITEMS={
 "手机":r'phone|iphone|smartphone|m[oó]vil|cellular|手机|telefono',
 "钱包":r'wallet|purse|cartera|portefeuille|portafoglio|钱包',
 "护照证件":r'passport|pasaporte|passaporto|护照',
 "背包行李":r'bag|backpack|luggage|borsa|mochila|包|行李',
 "银行卡现金":r'cash|bank card|credit card|dinero|efectivo|现金|银行卡',
 "相机电子设备":r'camera|相机|电脑',
 "智能手表":r'smartwatch|apple watch|智能手表',
 "耳机":r'earbuds|airpods|headphones|耳机',
 "笔记本电脑":r'laptop|macbook|笔记本电脑',
 "行李箱":r'suitcase|行李箱',
 "钥匙":r'keys|钥匙',
 "首饰":r'watch|jewelry|jewellery|gioiell|手表|首饰'
}
EMAIL=re.compile(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}',re.I)
PHONE=re.compile(r'\+?\d[\d\s()-]{10,}\d')
def scrub(value):
 value=re.sub(r'\s+',' ',str(value or "")).strip()[:180]
 return PHONE.sub('[phone removed]',EMAIL.sub('[email removed]',value))
def query_api(query):
 params=urllib.parse.urlencode({"query":query,"mode":"artlist","maxrecords":35,"timespan":"3months","sort":"datedesc","format":"json"})
 req=urllib.request.Request(API+"?"+params,headers={"User-Agent":AGENT,"Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=30) as response:
  raw=response.read(650000)
  if "json" not in response.headers.get("Content-Type","").lower():raise RuntimeError("non_json_response")
  return json.loads(raw)
def parse_day(value):
 match=re.match(r'^(\d{4})(\d{2})(\d{2})',str(value or ""))
 if not match:return None
 value="-".join(match.groups())
 try:dt.date.fromisoformat(value);return value
 except ValueError:return None
def main():
 rows={};failures=[];api_ok=0
 for country,city,search in QUERIES:
  try:
   result=query_api(search)
   if not isinstance(result.get("articles"),list):raise RuntimeError("invalid_articles")
   api_ok+=1
   for doc in result["articles"]:
    raw_url=doc.get("url","")
    parsed=urllib.parse.urlparse(raw_url)
    if parsed.scheme!="https" or not parsed.netloc or len(raw_url)>1000:continue
    title=scrub(doc.get("title",""))
    if len(title)<12 or not KEYWORDS.search(title):continue
    # Searching a city doesn't prove the article refers to an incident in that city.
    if not any(alias in title.casefold() for alias in ALIASES[city]):continue
    key=hashlib.sha256(raw_url.encode("utf-8")).hexdigest()[:24]
    if key in rows:continue
    items=[item for item,pattern in ITEMS.items() if re.search(pattern,title,re.I)]
    rows[key]={"id":key,"country_target":country,"city_target":city,"title":title,"url":raw_url,
      "domain":scrub(doc.get("domain","")),"source_published_on":parse_day(doc.get("seendate")),
      "incident_occurred_on":None,"item_mentions":items,
      "location_precision":"unverified_article_title","source_type":"public_news",
      "source":"GDELT DOC 2.0 open news article search",
      "status":"requires_review_not_published","review_required":"Confirm specific theft, place, incident date, item and original link independently; this title alone is not proof."}
  except Exception as e:failures.append({"country":country,"city":city,"reason":str(e)[:95]})
  time.sleep(6.0)
 try:
  # Euronews explicitly publishes a travel RSS feed for readers. Only title/link/date,
  # no full text, no media copying, no hidden platform access.
  feed="https://www.euronews.com/rss?level=vertical&name=travel"
  req=urllib.request.Request(feed,headers={"User-Agent":AGENT,"Accept":"application/rss+xml"})
  with urllib.request.urlopen(req,timeout=18) as res:
   contents=res.read(240000)
  rss=ET.fromstring(contents)
  for item in rss.findall(".//item")[:60]:
   title=scrub(item.findtext("title"))
   url=(item.findtext("link") or "").strip()
   link=urllib.parse.urlparse(url)
   if not title or not KEYWORDS.search(title) or link.scheme!="https" or not link.netloc:continue
   cities=[city for city,aliases in ALIASES.items() if any(alias in title.casefold() for alias in aliases)]
   if not cities:continue
   day=None
   try:day=email.utils.parsedate_to_datetime(item.findtext("pubDate")).date().isoformat()
   except (ValueError,TypeError):pass
   key=hashlib.sha256(url.encode("utf8")).hexdigest()[:24]
   if key not in rows:rows[key]={"id":key,"country_target":None,"city_target":cities[0],"title":title,"url":url,"domain":link.netloc,"source_published_on":day,"incident_occurred_on":None,"item_mentions":[name for name,pat in ITEMS.items() if re.search(pat,title,re.I)],"location_precision":"unverified_article_title","source_type":"public_news","source":"Euronews Travel RSS","status":"requires_review_not_published","review_required":"RSS headline is not evidence of a confirmed incident"}
 except Exception as e:failures.append({"country":"Europe","city":"Euronews RSS","reason":str(e)[:95]})
 order=sorted(rows.values(),key=lambda x:(x["source_published_on"] or "",x["id"]),reverse=True)
 data={"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"query_count":len(QUERIES),
 "successful_queries":api_ok,"failed_queries":failures,"candidate_count":len(order),
 "review_status":"PUBLIC_NEWS_LEADS_ONLY_NOT_CONFIRMED_THEFT",
 "note":"All candidates are title/link discovery results, not police verified events; event date remains unknown. Content is not licensed for full-text republication.",
 "items":order[:180]}
 OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"searched":len(QUERIES),"successful":api_ok,"leads":len(order),"failed":len(failures),"error_samples":failures[:6]}))
 if api_ok==0 and not order:raise SystemExit("No available public media feeds; output diagnostic JSON but never fake leads")
if __name__=="__main__":main()
