#!/usr/bin/env python3
"""Zero-cost, robots-aware public SOURCE METADATA monitor. No social login/bypass.
Does NOT claim or publish incidents. Titles are metadata, not validated events.
"""
import datetime as dt, email.utils, hashlib, html, json, re, sys, time
import urllib.error, urllib.parse, urllib.request, urllib.robotparser
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/"data"/"source-targets-v2.json"
OUT=ROOT/"data"/"source-candidates-v2.json"
AGENT="FindThiefPublicSourceMetadata/2.0 (+https://github.com/harbor0816at-design/Find-thief)"
MAX_BYTES=140000
THIEF=re.compile(r'盗窃|被偷|扒窃|扒手|失窃|stolen|pickpocket|theft|furto|hurto|vol|borteggio',re.I)
EMAIL=re.compile(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}')
PHONE=re.compile(r'(?<!\d)\+?\d[\d ()-]{9,}\d(?!\d)')
class Meta(HTMLParser):
 def __init__(self):
  super().__init__();self.in_title=False;self.title="";self.description="";self.heading="";self.published=""
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=="title":self.in_title=True
  if tag=="meta" and attrs.get("name","").lower()=="description":self.description=attrs.get("content","")
  if tag=="meta" and (attrs.get("property","").lower() in ("article:published_time","og:published_time") or attrs.get("name","").lower() in ("date","pubdate","article:published_time")):
   self.published=attrs.get("content","")[:28]
  if tag=="h1":self.heading="";self.in_heading=True
 def handle_endtag(self,tag):
  if tag=="title":self.in_title=False
  if tag=="h1":self.in_heading=False
 def handle_data(self,d):
  if self.in_title:self.title+=d
  if getattr(self,"in_heading",False):self.heading+=d
def clean(s):
 s=html.unescape(re.sub(r'\s+',' ',s or "")).strip()[:200]
 return PHONE.sub('[removed]',EMAIL.sub('[removed]',s))
def read_metadata(url):
 u=urllib.parse.urlsplit(url)
 if u.scheme!="https" or not u.netloc:raise ValueError("HTTPS required")
 path=u.scheme+"://"+u.netloc
 robots=urllib.robotparser.RobotFileParser();robots.set_url(path+"/robots.txt")
 try: robots.read()
 except Exception: raise RuntimeError("robots_unavailable_fail_closed")
 if not robots.can_fetch(AGENT,url):raise RuntimeError("robots_disallow")
 req=urllib.request.Request(url,headers={"User-Agent":AGENT,"Accept":"text/html,application/xhtml+xml"})
 with urllib.request.urlopen(req,timeout=12) as resp:
  actual=urllib.parse.urlsplit(resp.url)
  if actual.scheme!="https":raise RuntimeError("redirect_not_https")
  if actual.netloc!=u.netloc:raise RuntimeError("redirect_cross_domain_requires_recheck")
  ct=resp.headers.get("Content-Type","").lower()
  if "text/html" not in ct:raise RuntimeError("not_public_html")
  data=resp.read(MAX_BYTES+1)
  if len(data)>MAX_BYTES:raise RuntimeError("response_over_limit")
  doc=Meta();doc.feed(data.decode("utf-8",errors="replace"))
  return {"title":clean(doc.title or doc.heading),
          "meta_description":clean(doc.description),
          "last_modified":clean(resp.headers.get("Last-Modified","")),"published_meta":clean(doc.published)}
def run():
 src=json.loads(CONFIG.read_text(encoding="utf-8"))
 entries=[]; cache={}
 for x in src["sources"]:
  s={"source_key":x["source_key"],"country":x["country"],"city":x["city"],"scope":x["scope"],
     "url":x["url"],"source_kind":x["kind"],"collection_method":x["method"]}
  if not x["enabled"] or x["method"]!="metadata_only":
   s["status"]="link_only_not_fetched";entries.append(s);continue
  url=x["url"]
  if url not in cache:
   try:cache[url]=("metadata_ok",read_metadata(url))
   except Exception as e:cache[url]=(str(e)[:80],{})
   time.sleep(0.7)
  s["status"],details=cache[url];s.update(details)
  hay=(s.get("title","")+" "+s.get("meta_description",""))
  s["theft_keyword_in_metadata"]=bool(THIEF.search(hay))
  # Query location never means a fact is localized to that place.
  s["ready_for_event_publication"]=False
  entries.append(s)
 result={"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
         "status":"STAGING_ONLY_NOT_EVIDENCE","source_total":len(entries),
         "metadata_ok":sum(e["status"]=="metadata_ok" for e in entries),
         "sources":entries,"rule":"No original article text, no personal identifiers, no incident counts without manual evidence QA"}
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("public_source_metadata:",json.dumps({"total":len(entries),"ok":result["metadata_ok"]}))
if __name__=="__main__":run()
