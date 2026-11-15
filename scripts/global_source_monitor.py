"""Conservative change monitor for publicly accessible official funding listings.

Does not crawl private intranets, treat changed text as a new call, or update the
public catalog. Results are staged for editorial review only. Respect robots.txt.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from datetime import datetime,timezone
from html import unescape
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

ROOT=Path(__file__).resolve().parents[1]
REGISTRY=ROOT/'data/global/source-registry.json'
STAGING=ROOT/'data/global/staging'
USER_AGENT='FundlarkDiscoveryMonitor/0.1 (public-funding-page-monitor; repository contact required before sustained deployment)'


def normalize_page(body):
    text=body.decode('utf-8','ignore')
    text=re.sub(r'<(script|style|svg|noscript)\b[^>]*>.*?</\1>',' ',text,flags=re.I|re.S)
    text=re.sub(r'<!--.*?-->',' ',text,flags=re.S)
    text=unescape(re.sub(r'<[^>]*>',' ',text))
    text=re.sub(r'\s+',' ',text).strip()
    return text[:250_000]


def select_sources(sources,limit,shard=None):
    candidates=sorted((s for s in sources if s.get('access')=='public'
                       and urlparse(s['url']).scheme=='https'),
                      key=lambda s:(0 if s.get('refresh_priority')=='daily' else 1,s['id']))
    if not candidates:return []
    count=max(1,(len(candidates)+limit-1)//limit)
    if shard is None:shard=int(datetime.now(timezone.utc).strftime('%j'))%count
    return candidates[shard*limit:(shard+1)*limit]


def robots_permission(client,url,cache):
    p=urlparse(url);site=p.scheme+'://'+p.netloc
    if site in cache:return cache[site].can_fetch(USER_AGENT,url)
    rp=RobotFileParser();rp.set_url(site+'/robots.txt')
    try:
        response=client.get(site+'/robots.txt',follow_redirects=True)
        # Unknown robots availability should not be interpreted as explicit permission.
        if response.status_code>=400 and response.status_code!=404:return False
        if response.status_code==404:
            rp.parse([])
        else:rp.parse(response.text.splitlines())
    except httpx.HTTPError:
        return False
    cache[site]=rp
    return rp.can_fetch(USER_AGENT,url)


def monitor(sources,prior,client,limit=30,shard=None,check_robots=True):
    chosen=select_sources(sources,limit,shard)
    now=datetime.now(timezone.utc).isoformat()
    changes=[];results=[];next_state=dict(prior);robots_cache={}
    for source in chosen:
        sid=source['id'];url=source['url']
        item={'id':sid,'name':source['name'],'url':url,'checked_at':now,
              'status':'unavailable','requires_human_review':True}
        try:
            if check_robots and not robots_permission(client,url,robots_cache):
                item['status']='not_allowed_or_robots_unavailable';results.append(item);continue
            headers={}
            old=prior.get(sid,{})
            if old.get('etag'):headers['If-None-Match']=old['etag']
            if old.get('last_modified'):headers['If-Modified-Since']=old['last_modified']
            response=client.get(url,headers=headers,follow_redirects=True)
            if response.status_code==304:
                item['status']='unchanged';results.append(item);continue
            response.raise_for_status()
            if len(response.content)>512_000:
                item['status']='oversized';results.append(item);continue
            media=response.headers.get('content-type','')
            if 'html' not in media.lower() and 'text/plain' not in media.lower():
                item['status']='non_html';results.append(item);continue
            extracted=normalize_page(response.content)
            if len(extracted)<100:
                item['status']='insufficient_content';results.append(item);continue
            digest=hashlib.sha256(extracted.encode()).hexdigest()
            last=prior.get(sid,{})
            item['status']='baseline' if not last.get('sha256') else ('changed' if last['sha256']!=digest else 'unchanged')
            if item['status']=='changed':changes.append({'id':sid,'name':source['name'],'url':url,'last_sha256':last['sha256'],'new_sha256':digest,'message':'Official listing page changed; review new calls, deadlines and applicant rules manually.'})
            next_state[sid]={'sha256':digest,'etag':response.headers.get('etag'),
                             'last_modified':response.headers.get('last-modified'),
                             'last_checked_at':now,'url':str(response.url)}
        except httpx.HTTPError as exc:item['status']='fetch_failed';item['error_type']=type(exc).__name__
        results.append(item)
    return {'generated_at':now,'monitor_type':'official_page_change_only',
            'checked':len(results),'new_review_alerts':len(changes),'results':results,'changes':changes},next_state


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--limit',type=int,default=30)
    ap.add_argument('--shard',type=int)
    ap.add_argument('--state',type=Path,default=STAGING/'source-state.json')
    ap.add_argument('--output',type=Path,default=STAGING/'source-change-review.json')
    args=ap.parse_args()
    if not 1<=args.limit<=250:ap.error('limit should be between 1 and 250')
    sources=json.loads(REGISTRY.read_text())['sources']
    state=json.loads(args.state.read_text()) if args.state.exists() else {}
    with httpx.Client(timeout=12,headers={'User-Agent':USER_AGENT}) as client:
        report,new_state=monitor(sources,state,client,args.limit,args.shard)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    args.state.parent.mkdir(parents=True,exist_ok=True)
    args.state.write_text(json.dumps(new_state,indent=2,ensure_ascii=False)+'\n')
    print(f"Scanned {report['checked']} public sources; {report['new_review_alerts']} require review; changes do NOT update public grants.")

if __name__=='__main__':main()
