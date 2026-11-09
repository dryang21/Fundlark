"""Maintainer review client. Credentials come from FUNDLARK_ADMIN_TOKEN, never the webpage."""
import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--service', required=True)
    parser.add_argument('--id', help='Contribution ID to approve or reject')
    parser.add_argument('--decision', choices=['approved', 'rejected'])
    parser.add_argument('--official-source-checked', action='store_true')
    parser.add_argument('--export', type=Path, help='Export public reviewed records for a GitHub snapshot')
    args = parser.parse_args()
    url = urlsplit(args.service)
    if (url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1'))) or url.username or url.password or url.path not in ('', '/') or url.query or url.fragment:
        parser.error('Use the trusted service origin, with HTTPS outside localhost.')
    base = args.service.rstrip('/')
    if args.export:
        if args.id or args.decision:
            parser.error('Export is separate from review.')
        with urlopen(base + '/api/catalog', timeout=15) as response:
            result = json.load(response)
        args.export.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Exported {len(result["opportunities"])} reviewed records to {args.export}.')
        return
    token = os.environ.get('FUNDLARK_ADMIN_TOKEN')
    if not token:
        parser.error('Set FUNDLARK_ADMIN_TOKEN in your environment.')
    body = None
    route = '/api/admin/contributions'
    if args.id or args.decision:
        if not args.id or not args.decision or len(args.id) != 64 or any(c not in '0123456789abcdef' for c in args.id):
            parser.error('Provide a valid ID and decision together.')
        route += '/' + args.id
        body = json.dumps({'decision': args.decision, 'official_source_checked': args.official_source_checked}).encode()
    request = Request(base + route, data=body, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urlopen(request, timeout=15) as response:
        print(json.dumps(json.load(response), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
