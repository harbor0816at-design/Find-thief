#!/usr/bin/env python3
"""Offline preparation of evidence candidates from UK Home Office police.uk Open Government Licence CSV.

Usage: python scripts/ingest_police_csv.py --input path/to/2026-08-metropolitan-street.csv --output police-candidates.json

No API calls, account login, user data, or third-party social scraping. The output is
an OFFLINE staging file; an administrator must check each statistical cluster and
licence notice before loading to evidence_areas / publishing. Do not infer a rate
or probability of victimization from raw counts.
"""
import argparse,csv,json,collections,datetime,pathlib
CATEGORIES={'Theft from the person','Robbery','Other theft'}
def run(path):
    groups=collections.defaultdict(lambda:{'count':0,'months':set(),'categories':collections.Counter()})
    with open(path,encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        required={'Longitude','Latitude','Crime type','Month'}
        if not required<=set(reader.fieldnames or []): raise SystemExit('Missing police.uk street-level CSV columns: '+str(required-set(reader.fieldnames or [])))
        for row in reader:
            crime=row['Crime type'].strip(); month=row['Month'].strip()
            if crime not in CATEGORIES:continue
            try:lat,lon=float(row['Latitude']),float(row['Longitude'])
            except (ValueError,TypeError):continue
            # roughly 1 km, NOT precise crime scene / not city center fabricated point
            if not(48<lat<61 and -9<lon<3):continue
            a=round(lat,2);b=round(lon,2)
            bucket=groups[a,b];bucket['count']+=1;bucket['months'].add(month);bucket['categories'][crime]+=1
    out=[]
    for (lat,lon),g in groups.items():
        if g['count']<3:continue
        months=sorted(m for m in g['months'] if len(m)==7 and m[:4].isdigit())
        if not months:continue
        out.append({'label':'UK police.uk 约1km统计网格','lat':lat,'lon':lon,'radius_m':700,
          'evidence_count':g['count'],'period_start':months[0]+'-01','period_end':months[-1]+'-28',
          'source_type':'official_street_data','source_url':'https://data.police.uk/data/',
          'license_note':'UK Open Government Licence v3.0','status':'staging',
          'method_note':'OGL公开街道犯罪CSV；原始地点已匿名化，按经纬度0.01°格网聚合；只反映记录数，不代表风险概率',
          'categories':dict(g['categories']),'source_months':months})
    return sorted(out,key=lambda x:-x['evidence_count'])
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
    data=run(args.input)
    pathlib.Path(args.output).write_text(json.dumps({'title':'待审核官方犯罪统计网格','license':'OGL v3.0','source':'https://data.police.uk/data/','candidate_count':len(data),'staging_areas':data},ensure_ascii=False,indent=2),encoding='utf-8')
    print('staging areas:',len(data),'output:',args.output)
