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
        result=await connectors.check_industry_sources()
        print(json.dumps(result,indent=2))
        failed = failed or any(x["status"] in {"error", "skipped"} for x in result)
    return 1 if failed else 0


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description='Fundlark scheduled collection jobs')
    parser.add_argument('--federal',action='store_true',help='Query the U.S. federal grant API')
    parser.add_argument('--monitor',action='store_true',help='Monitor curated industry/foundation pages')
    parser.add_argument('--queries',default='artificial intelligence,medical research,early career',help='Comma-separated federal search terms (maximum 5)')
    options=parser.parse_args()
    if not options.federal and not options.monitor:
        parser.error('Select --federal and/or --monitor')
    raise SystemExit(asyncio.run(run(options)))
