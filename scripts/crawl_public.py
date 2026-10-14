#!/usr/bin/env python3
"""Robots-respecting, metadata-only HTML monitor. Does NOT copy incident databases.
All sources are public HTTP GET pages, no APIs, no auth cookies, no anti-bot bypass.
Intentionally stores only URL / page title / HTTP status and no source text.
"""
import json, re, time, datetime, urllib.request, urllib.robotparser, urllib.error
from html.parser import HTMLParser
from urllib.parse import urlsplit
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCES=json.loads((ROOT/'data/source-registry.json').read_text(encoding='utf8'))['sources']
AGENT='FindThiefSourceMonitor/1.1 (+https://github.com/harbor0816at-design/Find-thief)'
class Title(HTMLParser):
 def __init__(self):super().__init__();self.intitle=False;self.title=''
 def handle_starttag(self,tag,attrs):
  if tag=='title':self.intitle=True
 def handle_endtag(self,tag):
  if tag=='title':self.intitle=False
 def handle_data(self,data):
  if self.intitle:self.title+=data

def check(url):
  o=urlsplit(url)
  if o.scheme!='https' or not o.netloc:return {'status':'skip','reason':'non-HTTPS URL'}
  robots=o.scheme+'://'+o.netloc+'/robots.txt'
  # Robots fetch must succeed or site is skipped: fail closed.
  try:
    with urllib.request.urlopen(urllib.request.Request(robots,headers={'User-Agent':AGENT}),timeout=12) as r:
      txt=r.read(300000).decode('utf-8','replace');code=r.status
    rp=urllib.robotparser.RobotFileParser();rp.parse(txt.splitlines())
    if not rp.can_fetch(AGENT,url):return {'status':'robots-denied','reason':'robots.txt prohibits crawler'}
  except urllib.error.HTTPError as e:
    if e.code in (401,403):return {'status':'robots-denied','reason':f'robots.txt HTTP {e.code}'}
    return {'status':'skipped','reason':'robots.txt unavailable; fail closed'}
  except Exception as e:return {'status':'skipped','reason':'cannot verify robots.txt: '+type(e).__name__}
  try:
    req=urllib.request.Request(url,headers={'User-Agent':AGENT,'Accept':'text/html'})
    with urllib.request.urlopen(req,timeout=15) as r:
      ct=r.headers.get('Content-Type','');status=r.status
      if 'text/html' not in ct:return {'status':'skipped','reason':'non-HTML content'}
      data=r.read(150000).decode('utf-8','replace')
    title=Title();title.feed(data)
    # Do not save source text, personal data, article details or event entries.
    return {'status':'ok','http_status':status,'page_title':re.sub(r'\s+',' ',title.title).strip()[:120], 'reason':'HTML metadata only; not a licensed event dataset'}
  except Exception as e:return {'status':'unavailable','reason':'public HTML request failed: '+type(e).__name__}

def run():
  out={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':[],'notes':'No event records imported; metadata only. No CAPTCHA or authentication bypass.'}
  for s in SOURCES:
    r={'name':s['name'],'url':s['url'],'rights':s['reuserights']}
    if not s.get('crawl_metadata'):
      r.update(status='not-authorized',reason='Social content needs specific public post URLs and permission; no platform scraping')
    else:r.update(check(s['url']));time.sleep(2.5)
    out['sources'].append(r)
  (ROOT/'data/crawl-status.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  print('Monitored',len(out['sources']),'sources; incident records imported: 0')
if __name__=='__main__':run()