"""Global funding seed validation: explicit evidence levels and safe update behavior."""
import importlib.util
import json
import sqlite3
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

ROOT=Path(__file__).resolve().parents[1]


def load(name,filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/filename)
    module=importlib.util.module_from_spec(spec)
    sys.modules[name]=module
    spec.loader.exec_module(module)
    return module

builder=load('global_catalog_builder','build_global_catalog.py')
monitor=load('global_catalog_monitor','global_source_monitor.py')


def test_catalog_sources_and_programs_are_distinct():
    catalog,sources,audit,_,report=builder.build()
    assert catalog['schema_version']==sources['schema_version']==1
    assert len(catalog['opportunities'])>=200
    assert len(sources['sources'])>=100
    assert audit['global_program_families']>=200
    assert 'not verified live grant availability' in report.lower()
    assert all(item['status']=='verify' and item['deadline'] is None for item in catalog['opportunities'] if item.get('program_status_scope')=='program_family')
    assert all(item['review_needed'] for item in catalog['opportunities'] if item.get('program_status_scope')=='program_family')


def test_cross_disciplinary_and_regional_programs():
    data=json.loads((ROOT/'docs/demo/global-programs.json').read_text())['opportunities']
    assert {'Government','Industry','Institution','Society','Foundation'}<=set(x['category'] for x in data)
    assert {'United States','Australia','Hong Kong','Singapore','Canada','Germany','United Kingdom','European Union'}<=set(x['country_or_region'] for x in data)
    assert len({x['id'] for x in data})==len(data)
    assert len({builder.program_key(x) for x in data})==len(data)
    assert all(x['url'].startswith('https://') for x in data)


def test_source_review_status_not_fabricated():
    entries=json.loads((ROOT/'data/global/source-registry.json').read_text())['sources']
    assert all(not x.get('last_source_review') for x in entries)
    assert len({x['id'] for x in entries})==len(entries)


def test_bad_url_fails_validation():
    for bad in ['javascript:alert(1)','http://funder.example','https://localhost/','https://x:y@funder.example/']:
        with pytest.raises(ValueError):builder.validate_url(bad)


def test_sqlite_export_matches_current_published_json(tmp_path):
    exporter=load('global_database_exporter','export_complete_database.py')
    rows,hubs=exporter.merge_all()
    snapshot=tmp_path/'funding.sqlite'
    exporter.write_sqlite(snapshot,rows,hubs)
    with sqlite3.connect(snapshot) as con:
        count=con.execute('SELECT COUNT(*) FROM opportunities').fetchone()[0]
        sources=con.execute('SELECT COUNT(*) FROM sources').fetchone()[0]
        archived=con.execute("SELECT COUNT(*) FROM opportunities WHERE status='closed'").fetchone()[0]
    assert count==len(rows)>10000
    assert archived>=15000
    assert sources==len(hubs)>=200


def test_global_source_monitor_uses_review_only():
    page=b'<html><body>'+b'Official opportunities, fellowship deadlines and university research funding. '*20+b'</body></html>'
    fake=Mock();fake.status_code=200;fake.content=page;fake.headers={'content-type':'text/html','etag':'"abc"'};fake.url='https://test.example/research'
    client=Mock();client.get.return_value=fake
    source=[{'id':'s1','name':'Funder research page','url':'https://test.example/research','access':'public','refresh_priority':'weekly'}]
    first,states=monitor.monitor(source,{},client,limit=10,shard=0,check_robots=False)
    assert first['new_review_alerts']==0 and first['results'][0]['status']=='baseline'
    second,states2=monitor.monitor(source,states,client,limit=10,shard=0,check_robots=False)
    assert second['new_review_alerts']==0 and second['results'][0]['status']=='unchanged'
    new=Mock();new.status_code=200;new.content=page+b'<p>NEW deadline posted</p>';new.headers={'content-type':'text/html'};new.url='https://test.example/research'
    client.get.return_value=new
    third,_=monitor.monitor(source,states2,client,limit=10,shard=0,check_robots=False)
    assert third['new_review_alerts']==1
    assert third['changes'][0]['message'].startswith('Official listing page changed')
    assert 'opportunities' not in third


def test_discovery_queues_do_not_inflate_opportunity_counts():
    institutions=json.loads((ROOT/'data/global/institution-discovery-queue.json').read_text())
    companies=json.loads((ROOT/'data/global/industry-discovery-queue.json').read_text())
    assert len(institutions['entries'])>=100
    assert len(companies['entries'])>=50
    assert all(x['discovery_status']=='not_yet_verified' for x in institutions['entries'])
    assert all(x['discovery_status']=='not_yet_verified' for x in companies['entries'])
    assert all(x['official_funding_page'] is None for x in institutions['entries']+companies['entries'])


def test_promotion_needs_explicit_approved_official_ids_and_preserves_editorial():
    promote=load('global_catalog_promoter','promote_reviewed_candidates.py').promote
    original={'schema_version':1,'opportunities':[{'id':'grantsgov:old','origin':'curated','title':'Reviewed editorial'}]}
    candidate={'schema_version':1,'opportunities':[
        {'id':'grantsgov:new','origin':'grantsgov_api','status':'open','title':'New application',
         'url':'https://www.grants.gov/search-results-detail/1234'},
        {'id':'grantsgov:old','origin':'grantsgov_api','status':'open','title':'Override',
         'url':'https://www.grants.gov/search-results-detail/5678'}]}
    with pytest.raises(ValueError):promote(original,candidate,[])
    with pytest.raises(ValueError):promote(original,candidate,['non-existent'])
    updated,summary=promote(original,candidate,['grantsgov:new','grantsgov:old'])
    assert summary['written']==['grantsgov:new']
    assert summary['editorial_records_protected']==['grantsgov:old']
    assert updated['opportunities'][0]['title']=='Reviewed editorial'
    assert updated['opportunities'][1]['review_needed'] is True
    assert updated['opportunities'][1]['last_verified_at'] is None
