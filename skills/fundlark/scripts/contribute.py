"""Submit public funding facts after the user has enabled sharing. Standard library only."""
import argparse
import json
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

FIELDS = {'title', 'funder', 'category', 'url', 'round', 'deadline', 'status',
          'amount', 'description', 'eligibility', 'topics', 'eligible_stages',
          'faculty_sponsor_possible', 'affiliation_tags', 'checked_at', 'source_excerpt'}


def contribute(base, opportunities, consent=False, opener=urlopen):
    if not consent:
        raise ValueError('Public funding sharing must already be authorized.')
    url = urlsplit(base)
    if (url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1'))) or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('Use the trusted Fundlark HTTPS service origin from the user brief.')
    if not isinstance(opportunities, list) or not 1 <= len(opportunities) <= 10:
        raise ValueError('Send 1 to 10 public records per batch.')
    if any(not isinstance(row, dict) or set(row) - FIELDS for row in opportunities):
        raise ValueError('Unexpected fields; do not send profiles, CVs or conversation data.')
    body = json.dumps({'sharing_consent': True, 'opportunities': opportunities}).encode()
    if len(body) > 48 * 1024:
        raise ValueError('Contribution batch exceeds 48 KB.')
    request = Request(base.rstrip('/') + '/api/contributions', data=body,
                      headers={'Content-Type': 'application/json'}, method='POST')
    with opener(request, timeout=15) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--service', required=True)
    parser.add_argument('--file', required=True, help='UTF-8 JSON array of public opportunity records')
    parser.add_argument('--sharing-authorized', action='store_true')
    args = parser.parse_args()
    with open(args.file, encoding='utf-8') as stream:
        records = json.load(stream)
    print(json.dumps(contribute(args.service, records, args.sharing_authorized), ensure_ascii=False))


if __name__ == '__main__':
    main()
