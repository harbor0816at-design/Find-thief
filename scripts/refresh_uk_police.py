#!/usr/bin/env python3
"""Official UK Police crime data -> REVIEW-ONLY London evidence candidates.
Free public Home Office data (OGL v3). No login, proxies, personal records, or API key.
Uses public documented police.uk endpoints, not commercial/scraped social sites.
Never outputs point-level incidents: aggregates to approx 0.01-degree cells.
"""
import datetime as dt, hashlib, json, sys, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
API = "https://data.police.uk/api/"
USER_AGENT = "FindThiefOfficialDataCollector/1.0 (+https://github.com/harbor0816at-design/Find-thief)"
POINTS = {
    "Leicester Square": (51.5104,-0.1302),
    "Oxford Circus": (51.5152,-0.1419),
    "Covent Garden": (51.5129,-0.1247),
    "Westminster": (51.4995,-0.1248),
    "London Bridge": (51.5054,-0.0865),
    "Tower of London": (51.5081,-0.0759),
    "Kings Cross": (51.5308,-0.1238),
    "South Kensington": (51.4948,-0.1738),
    "Notting Hill": (51.5150,-0.2030),
}
def get_json(path, params=None):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept":"application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                if response.status != 200:
                    raise RuntimeError("Unexpected status "+str(response.status))
                return json.loads(response.read(2_500_000))
        except (urllib.error.HTTPError, TimeoutError, urllib.error.URLError) as exc:
            if attempt == 2:
                raise RuntimeError("Official data fetch failed: "+url+"; "+str(exc)) from exc
            time.sleep(2 * (attempt+1))
    raise RuntimeError("unreachable")
def previous_months(latest, n=3):
    year, month = map(int, latest.split("-"))
    out = []
    for _ in range(n):
        out.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month,year = 12,year-1
    return out
def main():
    stamp = dt.datetime.now(dt.timezone.utc).isoformat()
    metadata = get_json("crime-last-updated")
    latest = str(metadata.get("date", ""))[:7]
    if len(latest)!=7 or not latest[:4].isdigit() or not latest[5:].isdigit():
        raise RuntimeError("Official endpoint returned invalid latest date")
    months=previous_months(latest)
    unique, request_count = {},0
    for month in months:
        for name,(lat,lon) in POINTS.items():
            rows = get_json("crimes-street/theft-from-the-person",
                           {"date":month,"lat":lat,"lng":lon})
            if not isinstance(rows,list):
                raise RuntimeError("Unexpected official response for "+name)
            request_count += 1
            for item in rows:
                if item.get("category")!="theft-from-the-person" or item.get("month")!=month:
                    continue
                loc=item.get("location") or {}
                try: a,b=float(loc.get("latitude")),float(loc.get("longitude"))
                except (ValueError,TypeError): continue
                if not (51.44 < a < 51.59 and -0.30 < b < 0.05): continue
                persistent=item.get("persistent_id") or ""
                identity = (month,persistent) if persistent else (month,str(item.get("id")),str(loc.get("street",{}).get("id")))
                unique[identity]={"lat":a,"lon":b,"month":month}
            time.sleep(0.2)
    groups = defaultdict(lambda: {"count":0, "months":set()})
    for record in unique.values():
        # 0.01 degrees longitude spans ~690m at London; latitude ~1.1km.
        la,lo=round(record["lat"],2),round(record["lon"],2)
        grp=groups[(la,lo)]
        grp["count"]+=1
        grp["months"].add(record["month"])
    final=[]
    for (la,lo),g in groups.items():
        if g["count"] < 3: continue
        seen=sorted(g["months"])
        final.append({
            "id":"policeuk-london-"+str(la).replace(".","_")+"-"+str(lo).replace("-","m").replace(".","_"),
            "country":"英国","city":"伦敦",
            "label":"伦敦警方记录聚合网格",
            "lat":la,"lon":lo,"radius_m":750,
            "source_type":"official_street_data",
            "source_url":"https://data.police.uk/data/",
            "license_note":"UK Open Government Licence v3.0; Contains public sector information licensed under the Open Government Licence v3.0.",
            "period_start":seen[0]+"-01",
            "period_end":(dt.date(int(seen[-1][:4]),int(seen[-1][5:]),1).replace(day=28)).isoformat(),
            "evidence_count":g["count"],
            "method_note":"伦敦警方Theft from the person月度公开数据；对匿名化原始位置按0.01度约1公里网格汇总，去除重叠查询重复记录。记录次数不等于扒窃事件数、个人遇窃概率或真实风险等级。",
            "status":"staging","evidence_verified_at":None
        })
    final.sort(key=lambda x:(-x["evidence_count"],x["lat"],x["lon"]))
    if not unique or not final:
        raise RuntimeError("No UK official crime clusters returned; no output overwritten")
    payload={
        "source":"UK Home Office Police Data (data.police.uk)",
        "source_url":"https://data.police.uk/data/",
        "license_url":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        "retrieved_at":stamp,
        "months":months,
        "queries":request_count,
        "unique_record_count":len(unique),
        "candidate_count":len(final),
        "status":"STAGING_REQUIRES_QA_NO_AUTO_PUBLISH",
        "method":"Theft from the person, radius-1-mile query tiles, event deduplication, 0.01-degree cells",
        "areas":final[:100]
    }
    dest=ROOT/"data"/"uk-police-staging.json"
    dest.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("POLICE_DATA_RUN="+json.dumps({"queries":request_count,"months":months,"unique_records":len(unique),"candidate_areas":len(final),"written":str(dest)}))
if __name__=="__main__":
    main()
