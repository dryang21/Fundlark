"""Command-line jobs for cron / task scheduler.

Examples:
  python -m app.jobs --federal
  python -m app.jobs --monitor
  python -m app.jobs --federal --monitor --queries 'AI,medical research'
"""
import argparse
import asyncio
import json

from . import connectors, storage


async def run(args):
    storage.init_db()
    failed = False
    if args.federal:
        terms=[x.strip() for x in args.queries.split(',') if x.strip()][:5]
        result = await connectors.sync_federal(terms)
        print(json.dumps(result,indent=2))
        failed = bool(result["errors"])
    if args.monitor:
        categories=getattr(args,"category",None)
        result=await (connectors.check_industry_sources(categories=set(categories)) if categories
                      else connectors.check_industry_sources())
        if getattr(args,"summary",False):
            from collections import Counter
            print(json.dumps({
                "sources": len(result),
                "status": Counter(item["status"] for item in result),
                "candidate_links_seen": sum(item.get("link_candidates",0) for item in result),
                "unavailable": [item["id"] for item in result if item["status"] in {"error","skipped"}],
            },indent=2))
        else:
            print(json.dumps(result,indent=2))
        failed = failed or any(x["status"] in {"error", "skipped"} for x in result)
    return 1 if failed else 0


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description='Fundlark scheduled collection jobs')
    parser.add_argument('--federal',action='store_true',help='Query the U.S. federal grant API')
    parser.add_argument('--monitor',action='store_true',help='Monitor registered official funding pages')
    parser.add_argument('--category',action='append',choices=['Society','Industry','Institution','Foundation'],
                        help='Limit monitoring to these categories; repeat to select multiple')
    parser.add_argument('--summary',action='store_true',help='Print compact monitoring totals')
    parser.add_argument('--queries',default='artificial intelligence,medical research,early career',help='Comma-separated federal search terms (maximum 5)')
    options=parser.parse_args()
    if not options.federal and not options.monitor:
        parser.error('Select --federal and/or --monitor')
    if options.category and not options.monitor:
        parser.error('--category requires --monitor')
    raise SystemExit(asyncio.run(run(options)))
