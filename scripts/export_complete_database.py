"""Export the *entire* frontend merged catalog, not just global new seeds, to CSV/SQLite."""
from __future__ import annotations
import argparse
import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl,urlsplit,urlunsplit,urlencode

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_global_catalog import write_sqlite

DEMO=ROOT/'docs/demo'
OUTPUT=ROOT/'data/global'
FILES=['data.json','coverage.json','supplemental.json','crossdisciplinary.json','global-programs.json','ukri-calls.json','bulk-calls.json']


def archive_rows(manifest):
    store = json.loads((DEMO/'bulk-archive.json').read_text(encoding='utf-8'))
    if store['archive_revision'] != manifest['archive_revision'] or len(store['rows']) != manifest['archive_count']:
        raise ValueError('Bulk archive does not match the search manifest')
    for key,title,funder,deadline,cooperative,number,floor,ceiling in store['rows']:
        amount = (f'${floor:,}–${ceiling:,}' if floor and ceiling and floor != ceiling else
                  f'Up to ${ceiling:,}' if ceiling else f'From ${floor:,}' if floor else None)
        yield dict(id='grantsgov-bulk-'+key, title=title, funder=funder, deadline=deadline, status='closed',
                   opportunity_number=number, url='https://www.grants.gov/search-results-detail/'+key,
                   category='Government', country_or_region='United States', origin='grantsgov_bulk',
                   program_status_scope='specific_call', review_needed=True, source_checked_at=store['checked_at'],
                   funding_type='Cooperative agreement' if cooperative else 'Federal grant',
                   amount_min=floor, amount_max=ceiling, amount=amount, currency='USD' if amount else None)


def opportunity_key(item):
    p=urlsplit(item.get('url') or '')
    params=sorted((k,v) for k,v in parse_qsl(p.query,keep_blank_values=True)
                  if not re.match(r'^(utm_|fbclid$|gclid$)',k,re.I))
    url=urlunsplit((p.scheme.lower(),p.netloc.lower(),p.path,urlencode(params),'')).rstrip('/')
    return(url,item.get('round') or str(item.get('deadline') or '')[:4] or 'recurring',
           str(item.get('title') or '').strip().lower())


def official_route(item):
    p=urlsplit(item.get('url') or '')
    host=re.sub(r'^www\.','',p.hostname or '')
    is_ukri_call = host == 'ukri.org' and re.fullmatch(r'/opportunity/[a-z0-9-]+/?', p.path, re.I)
    return host+p.path.rstrip('/') if host in ('grants.gov','seedfunding.stanford.edu') or is_ukri_call else None


def merge_all():
    records={};routes={}
    for file in FILES:
        for item in json.loads((DEMO/file).read_text(encoding='utf-8'))['opportunities']:
            route=official_route(item)
            oldkey=routes.get(route) if route else None
            old=records.get(oldkey) if oldkey else None
            imported=lambda record:record.get('origin') in ('grantsgov_api','institution_listing','ukri_listing')
            if old is not None and not imported(old) and imported(item):continue
            key=opportunity_key(item)
            if old is not None and imported(old) and oldkey!=key:records.pop(oldkey,None)
            records[key]=item
            if route:routes[route]=key
    hubs=[];seen=set()
    for file in ['source-hubs.json','global-source-hubs.json']:
        for item in json.loads((DEMO/file).read_text(encoding='utf-8'))['sources']:
            uri=item['url'].rstrip('/').lower()
            if uri not in seen:seen.add(uri);hubs.append(item)
    result=list(records.values())
    if 'bulk-calls.json' in FILES:
        manifest=json.loads((DEMO/'bulk-calls.json').read_text(encoding='utf-8'))
        result.extend(row for row in archive_rows(manifest) if official_route(row) not in routes)
    return result,hubs


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,default=OUTPUT)
    out=parser.parse_args().output_dir
    out.mkdir(parents=True,exist_ok=True)
    all_programs,hubs=merge_all()
    if len({x['id'] for x in all_programs})!=len(all_programs):
        raise ValueError('Duplicate published opportunity IDs must be resolved before SQLite export')
    if len({x['id'] for x in hubs})!=len(hubs):
        raise ValueError('Duplicate published source hub IDs must be resolved before SQLite export')
    write_sqlite(out/'funding.sqlite',all_programs,hubs)
    with (out/'all-funding-opportunities.csv').open('w',newline='',encoding='utf-8') as file:
        writer=csv.writer(file)
        writer.writerow(['ID','Title','Sponsor','Sponsor category','Region','Funding type','Amount','Deadline','Opportunity status','Review needed','Research topics','Official URL','Description'])
        for item in sorted(all_programs,key=lambda x:(x.get('category',''),x.get('country_or_region',''),x.get('title',''))):
            writer.writerow([item.get('id'),item.get('title'),item.get('funder'),item.get('category'),item.get('country_or_region'),item.get('funding_type'),item.get('amount'),item.get('deadline'),item.get('status'),item.get('review_needed',True),'; '.join(str(x) for x in item.get('topics') or []),item.get('url'),item.get('description')])
    audit=json.loads((OUTPUT/'audit.json').read_text());audit['entire_frontend_merged_opportunity_records']=len(all_programs);audit['entire_frontend_merged_source_hubs']=len(hubs)
    (out/'audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
    print(f'Full exported dataset: {len(all_programs)} opportunity leads, {len(hubs)} funder source hubs; 13-column CSV and SQLite.')

if __name__=='__main__':main()
