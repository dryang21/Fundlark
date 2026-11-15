"""Build Fundlark's conservative global discovery catalog from maintained registries.

This tool does NOT scrape the Internet or certify an opportunity is open.
Registry program families are searchable, but are never marked as current calls.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sqlite3
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'data/global'
DEMO = ROOT / 'docs/demo'


def load_registry(path, key):
    obj = json.loads(path.read_text(encoding='utf-8'))
    if obj.get('schema_version') != 1 or not isinstance(obj.get(key), list):
        raise ValueError(f'{path}: expected schema_version=1, {key} array')
    return obj[key]


def validate_url(value):
    parsed = urlparse(str(value or ''))
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f'Invalid official HTTPS URL: {value!r}')
    if parsed.hostname in ('localhost', '127.0.0.1'):
        raise ValueError(f'Local URL is not an official funding source: {value!r}')
    return value


def normalize(value):
    return re.sub(r'[^a-z0-9]+', ' ', str(value or '').lower()).strip()


def program_key(item):
    return (normalize(item.get('funder')),normalize(item.get('title')))


def serialize(obj):
    return json.dumps(obj,ensure_ascii=False,indent=2,sort_keys=False)+'\n'


def build():
    src = load_registry(REGISTRY/'source-registry.json','sources')
    programs = load_registry(REGISTRY/'program-registry.json','opportunities')
    for item in src:
        validate_url(item['url'])
    for item in programs:
        validate_url(item['url'])
    if len({item['id'] for item in src}) != len(src):
        raise ValueError('Source registry has duplicate IDs')
    if len({item['id'] for item in programs}) != len(programs):
        raise ValueError('Program registry has duplicate IDs')
    if len({program_key(item) for item in programs}) != len(programs):
        raise ValueError('Program registry has duplicate funder+title combinations')

    source_hubs = json.loads((DEMO/'source-hubs.json').read_text(encoding='utf-8'))['sources']
    existing_src_urls = {str(item['url']).rstrip('/').lower() for item in source_hubs}
    added_hubs = []
    for item in src:
        if item['url'].rstrip('/').lower() in existing_src_urls:
            continue
        added_hubs.append({
            'id':item['id'],'name':item['name'],'region':item['region'],
            'kind':item['kind'],'fields':item.get('fields') or ['all'],
            'url':item['url'],
            'description':item.get('notes') or f'Official research funding entry point; review individual calls.',
            'listing_type':item.get('listing_type','official_source_directory'),
            'access':item.get('access','public'),
            'evidence_type':item.get('evidence_type','source-domain'),
            'last_source_review':item.get('last_source_review'),
            'monitor_policy':item.get('monitor_policy','check_public_changes_only'),
        })
    if len({x['id'] for x in added_hubs}) != len(added_hubs):
        raise ValueError('Duplicate source hub IDs after merge')

    existing = []
    for fn in ['data.json','supplemental.json','coverage.json','crossdisciplinary.json']:
        data = json.loads((DEMO/fn).read_text(encoding='utf-8'))
        existing.extend(data.get('opportunities',[]))
    existing_keys={program_key(item) for item in existing}
    existing_url_titles={(item.get('url','').strip().rstrip('/').lower(),normalize(item.get('title'))) for item in existing}
    # Consolidate existing sponsor/title duplicates, but never discard regional programs solely
    # because they share a generic title such as 'Research Fellowship'.
    imported=[]
    for item in programs:
        if program_key(item) in existing_keys or (item['url'].strip().rstrip('/').lower(),normalize(item.get('title'))) in existing_url_titles:
            continue
        record=dict(item)
        if record.get('program_status_scope')!='specific_call':
            record['status']='verify'
            record['deadline']=None
            record['last_verified_at']=None
            record['review_needed']=True
        if record.get('status') in {'open','forecast','rolling'} and not record.get('last_verified_at'):
            record['status']='verify'
            record['deadline']=None
            record['review_needed']=True
        if record.get('deadline'):
            date.fromisoformat(record['deadline'])
        record['field_ids']=[]
        imported.append(record)

    obj={'schema_version':1,'generated_at':date.today().isoformat(),
         'description':'Global discovery records, not verified live availability. Program families always need current call checks.',
         'opportunities':imported}
    hubs={'schema_version':1,'generated_at':date.today().isoformat(),
          'description':'Additional official source entry points. A source listing is not a current grant.',
          'sources':added_hubs}

    counter=Counter(x['category'] for x in imported)
    by_region=Counter(x['country_or_region'] for x in imported)
    source_kind=Counter(x['kind'] for x in added_hubs)
    source_region=Counter(x['region'] for x in added_hubs)
    audited={
        'catalog_input_records':len(existing),'catalog_distinct_id_count':len({x['id'] for x in existing}),
        'additional_program_registry_rows':len(programs),'additional_program_rows_published':len(imported),
        'global_program_families':sum(x.get('program_status_scope')=='program_family' for x in imported),
        'specific_calls':sum(x.get('program_status_scope')=='specific_call' for x in imported),
        'new_source_registry_rows':len(src),'additional_source_hubs_published':len(added_hubs),
        'existing_hubs':len(source_hubs),'combined_hubs_approx':len(source_hubs)+len(added_hubs),
        'new_by_category':dict(counter),'new_by_region':dict(by_region),
        'new_source_by_kind':dict(source_kind),'new_source_by_region':dict(source_region),
        'no_automatic_eligibility_confirmation':True,'no_guarantee_current_call':True,
    }

    buf=io.StringIO();writer=csv.writer(buf)
    writer.writerow(['ID','Title','Funder','Category','Country/region','Status','Deadline','Official URL','Scope','Source review','Description'])
    for item in sorted(imported,key=lambda x:(x['category'],x['country_or_region'],x['title'])):
        writer.writerow([item['id'],item['title'],item['funder'],item['category'],item['country_or_region'],item['status'],item['deadline'] or '',item['url'],item.get('program_status_scope',''),item.get('last_verified_at') or '',item.get('description') or ''])

    report=[
        '# Fundlark global discovery: coverage and evidence audit','',
        'This release expands **discovery**, not verified live grant availability. A source is a portal; a program family is an established scheme; an open call has a published application window. They must never be counted as equivalent.','',
        f'- Existing input catalog records (before merge): **{len(existing)}**; distinct input IDs: **{audited["catalog_distinct_id_count"]}**.',
        f'- New maintained named program records: **{len(imported)}** (from {len(programs)} program seeds).',
        f'- New funding-source hubs published: **{len(added_hubs)}** (from {len(src)} seeds), plus {len(source_hubs)} prior hubs.',
        f'- Added family-level entries with **unknown next open round**: **{audited["global_program_families"]}**.',
        f'- Added identified specific calls: **{audited["specific_calls"]}** (verify the linked official notice).','',
        '## New programs by sponsor type','',
        *[f'- {k}: {v}' for k,v in sorted(counter.items())],
        '','## New program coverage by location','',
        *[f'- {k}: {v}' for k,v in sorted(by_region.items())],
        '','## New source directory coverage by location','',
        *[f'- {k}: {v}' for k,v in sorted(source_region.items())],
        '','## Operational limitations and gaps','',
        '1. These records were seeded from named funders and scheme families; many official pages were **not independently reviewed during this build**. Null `last_source_review` denotes an unreviewed listing.',
        '2. National calls are not automatically restricted to applicants in that nation. Eligibility differs by sponsor and must be checked against the official scheme.',
        '3. Institution-only/internal grants may require an authenticated campus intranet and can only be partially indexed without institutional access.',
        '4. Industry programs may offer compute credits, datasets, equipment, sponsorship or research fellowships rather than unrestricted cash.',
        '5. Portal/source changes are staging signals, not grant approvals. Automated checks must respect usage policies, robots rules and private data.',
        '6. The included grants.gov update tool collects a bounded set of topics. It is **not an exhaustive federal harvest** and should be treated as a candidate ingestion feed.',
        '7. A globally comprehensive list of every society, foundation and university cannot be guaranteed. Maintainers should publish field × country × funder-type coverage and unresolved gaps.',
        '','## Refresh policy','',
        '- Daily (when a remote GitHub Actions workflow is enabled): query public Grants.gov discovery API; stage a proposed catalog for human review.',
        '- Weekly: monitor public official source listing pages for material changes and stage review alerts. No restricted-content scraping.',
        '- Monthly: manually review frequent-changing institutional, industry and foundation sources; confirm that old deadlines have not been carried into new rounds.',
        '- Each record should preserve official URL, evidence grade, last review, window status, original sponsor, and the applicant-rule caveats.',
        '- Never infer that a program is open from an award history, program name or university/society directory link.',
    ]
    return obj,hubs,audited,buf.getvalue(),'\n'.join(report)+'\n'


def write_sqlite(path,programs,sources):
    if path.exists():path.unlink()
    con=sqlite3.connect(path)
    try:
        con.executescript('''
        CREATE TABLE sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,region TEXT,kind TEXT,url TEXT NOT NULL,access TEXT,evidence_type TEXT,last_source_review TEXT,payload_json TEXT NOT NULL);
        CREATE TABLE opportunities(id TEXT PRIMARY KEY,title TEXT NOT NULL,funder TEXT NOT NULL,category TEXT,country_or_region TEXT,status TEXT,deadline TEXT,url TEXT NOT NULL,scope TEXT,source_confidence TEXT,review_needed INTEGER NOT NULL,payload_json TEXT NOT NULL);
        CREATE INDEX idx_opportunity_category ON opportunities(category);
        CREATE INDEX idx_opportunity_region ON opportunities(country_or_region);
        CREATE INDEX idx_opportunity_deadline ON opportunities(deadline);
        CREATE INDEX idx_source_kind_region ON sources(kind,region);
        ''')
        con.executemany('INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?)',[(x['id'],x['name'],x.get('region'),x.get('kind'),x['url'],x.get('access'),x.get('evidence_type'),x.get('last_source_review'),json.dumps(x,ensure_ascii=False)) for x in sources])
        con.executemany('INSERT INTO opportunities VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[(x['id'],x['title'],x['funder'],x.get('category'),x.get('country_or_region'),x.get('status'),x.get('deadline'),x['url'],x.get('program_status_scope'),x.get('source_confidence'),int(bool(x.get('review_needed',True))),json.dumps(x,ensure_ascii=False)) for x in programs])
        con.commit()
    finally:con.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Validate catalog without writing')
    args=parser.parse_args()
    programs,hubs,audit,csvdata,report=build()
    if not args.check:
        (DEMO/'global-programs.json').write_text(serialize(programs),encoding='utf-8')
        (DEMO/'global-source-hubs.json').write_text(serialize(hubs),encoding='utf-8')
        (REGISTRY/'audit.json').write_text(serialize(audit),encoding='utf-8')
        (REGISTRY/'global-programs.csv').write_text(csvdata,encoding='utf-8')
        # The complete frontend-merged SQLite is produced by export_complete_database.py,
        # not this partial global-seed builder.
        reportfile=ROOT/'docs/research/global-coverage-report.md'
        reportfile.parent.mkdir(parents=True,exist_ok=True)
        reportfile.write_text(report,encoding='utf-8')
    print(json.dumps(audit,indent=2))

if __name__=='__main__':main()
