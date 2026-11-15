#!/usr/bin/env python3
"""Opt-in, maintainer-run import of the public OpenAlex research hierarchy.

Run from the project root:
    python3 scripts/update_openalex_taxonomy.py

Outputs docs/demo/openalex-topics.json (static file served locally to browsers).
The default app works without this file. Only taxonomy labels are downloaded:
NO researcher profile/description is sent to OpenAlex.

Source: https://help.openalex.org/data/topics/
OpenAlex data is CC0: https://help.openalex.org/api/
Uses regular page pagination (up to 100 records), not cursor pagination.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import pathlib
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

BASE='https://api.openalex.org'
DEST=pathlib.Path(__file__).resolve().parents[1]/'docs/demo/openalex-topics.json'

def fetch(endpoint: str, *, api_key: str='', email: str='', opener=urllib.request.urlopen, pause=0.14) -> list[dict]:
    output=[]; page=1
    while page<=80:
        params={'per_page':'100','page':str(page)}
        if api_key:params['api_key']=api_key
        if email:params['mailto']=email
        url=f'{BASE}/{endpoint}?{urllib.parse.urlencode(params)}'
        request=urllib.request.Request(url,headers={'User-Agent':'FundlarkResearchTaxonomyUpdater/1.0 (https://openalex.org; public classifications only)','Accept':'application/json'})
        for attempt in range(5):
            try:
                with opener(request,timeout=30) as response:
                    result=json.load(response)
                break
            except urllib.error.HTTPError as exc:
                if exc.code not in {429,500,502,503,504} or attempt==4:raise
                delay=float(exc.headers.get('Retry-After',0) or 0) or min(2**attempt,20)
                time.sleep(delay)
            except (TimeoutError,urllib.error.URLError):
                if attempt==4:raise
                time.sleep(min(2**attempt,20))
        items=result.get('results')
        if not isinstance(items,list):raise ValueError('Unexpected OpenAlex response format')
        output.extend(items)
        print(f'{endpoint}: page {page} · {len(output)} records',flush=True)
        if len(items)<100:break
        page+=1
        time.sleep(pause)
    return output

def clean(item: dict, kind: str) -> dict|None:
    label=item.get('display_name')
    if not isinstance(label,str) or len(label)<3:return None
    item_id=str(item.get('id','')).split('/')[-1]
    if not item_id:return None
    field=item.get('field') or {}
    subfield=item.get('subfield') or {}
    if kind=='fields':
        fields=[label];subs=[]
    elif kind=='subfields':
        fields=[field.get('display_name')] if isinstance(field.get('display_name'),str) else []
        subs=[label]
    else:
        fields=[field.get('display_name')] if isinstance(field.get('display_name'),str) else []
        subs=[subfield.get('display_name')] if isinstance(subfield.get('display_name'),str) else []
    aliases=item.get('display_name_alternatives') or []
    if not isinstance(aliases,list):aliases=[]
    # legacy_keywords are descriptive, NOT direct synonyms; do not attach them.
    return {'id':f'openalex:{kind}:{item_id}', 'label':label,'fields':fields,'subfields':subs,
        'aliases':[s[:120] for s in aliases if isinstance(s,str) and len(s)<=120][:8]}

def build_snapshot(fetch_fn=fetch, *,api_key='',email=''):
    all_records=[]
    counts={}
    for endpoint in ['fields','subfields','topics']:
        fetched=fetch_fn(endpoint,api_key=api_key,email=email)
        counts[endpoint]=len(fetched)
        for item in fetched:
            converted=clean(item,endpoint)
            if converted:all_records.append(converted)
    if counts['fields']<20 or counts['subfields']<200 or counts['topics']<3500:
        raise ValueError(f'OpenAlex import looks incomplete: {counts}; existing file was not overwritten')
    return {'schema_version':1,'source':'OpenAlex public fields, subfields and topics',
            'source_url':'https://help.openalex.org/data/topics/',
            'fetched_at':dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
            'license':'CC0','counts':counts,'concepts':all_records}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--api-key',default=os.getenv('OPENALEX_API_KEY',''),help='OpenAlex API key (or OPENALEX_API_KEY environment variable)')
    p.add_argument('--email',default=os.getenv('OPENALEX_EMAIL',''),help='Optional contact email for polite API usage')
    p.add_argument('--output',type=pathlib.Path,default=DEST,help='Destination JSON (default: docs/demo/openalex-topics.json)')
    args=p.parse_args()
    data=build_snapshot(api_key=args.api_key,email=args.email)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    content=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
    with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=args.output.parent,prefix='.taxonomy-',delete=False) as tmp:
        tmp.write(content)
        temp=pathlib.Path(tmp.name)
    temp.replace(args.output)
    print(f'Saved {len(data["concepts"])} classifications to {args.output} ({len(content)/1024:.0f} KB).')
    print('Restart or refresh the local Fundlark site to load the expanded vocabulary.')

if __name__=='__main__':main()
