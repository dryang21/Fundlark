"""Explicitly promote editor-approved official Grants.gov candidates to the static catalog.

Requires a human-written JSON allowlist of precise opportunity IDs. Defaults to
preview only; --apply performs an atomic write and preserves editorial overrides.
"""
from __future__ import annotations
import argparse
import json
from datetime import datetime,timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'docs/demo/data.json'
STAGING=ROOT/'data/global/staging'


def promote(original,candidates,approved_ids):
    if original.get('schema_version')!=1 or candidates.get('schema_version')!=1:
        raise ValueError('Expected catalog schema_version 1')
    incoming={x['id']:x for x in candidates['opportunities'] if x.get('origin')=='grantsgov_api'}
    selected=set(approved_ids)
    if not selected:
        raise ValueError('No reviewed opportunity IDs provided. Nothing can be auto-published.')
    unknown=selected-incoming.keys()
    if unknown:raise ValueError(f'Approved IDs not in Grants.gov candidate set: {sorted(unknown)}')
    indexed={x['id']:x for x in original['opportunities']}
    written=[];protected=[]
    for oid in sorted(selected):
        new=incoming[oid];uri=new.get('url') or ''
        if not uri.startswith('https://www.grants.gov/search-results-detail/'):
            raise ValueError(f'Not an expected official Grants.gov opportunity URL: {uri}')
        if new.get('status') not in {'open','forecast','closed','verify'}:
            raise ValueError(f'Invalid candidate status: {oid}')
        previous=indexed.get(oid)
        if previous and previous.get('origin')!='grantsgov_api':
            protected.append(oid);continue
        # API confirms window metadata, not subjective applicant eligibility.
        indexed[oid]={**new,'review_needed':True,'last_verified_at':None,
                      'publication_reviewed_at':datetime.now(timezone.utc).isoformat(),
                      'eligibility':'Sponsor eligibility must be checked in the complete NOFO before applying.'}
        written.append(oid)
    updated=dict(original,opportunities=list(indexed.values()))
    return updated,{'approved':len(selected),'written':written,'editorial_records_protected':protected}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate',type=Path,default=STAGING/'grantsgov-proposed-catalog.json')
    parser.add_argument('--approved',type=Path,required=True,help='JSON array of exact approved Grants.gov opportunity IDs')
    parser.add_argument('--apply',action='store_true',help='Write approved rows to docs/demo/data.json')
    args=parser.parse_args()
    original_bytes=CATALOG.read_bytes();original=json.loads(original_bytes)
    candidates=json.loads(args.candidate.read_text())
    allow=json.loads(args.approved.read_text())
    if not isinstance(allow,list) or any(not isinstance(x,str) for x in allow):
        parser.error('Approval file must contain a JSON array of opportunity IDs')
    result,summary=promote(original,candidates,allow)
    print(json.dumps({'mode':'apply' if args.apply else 'preview',**summary},indent=2))
    if not args.apply or not summary['written']:return
    if CATALOG.read_bytes()!=original_bytes:raise SystemExit('Catalog was modified; retry review.')
    with NamedTemporaryFile(mode='w',encoding='utf-8',dir=CATALOG.parent,delete=False) as file:
        json.dump(result,file,indent=2,ensure_ascii=False);file.write('\n');temp=Path(file.name)
    temp.replace(CATALOG)

if __name__=='__main__':main()
