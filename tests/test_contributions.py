import importlib.util
import io
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('fundlark_contribute', ROOT / 'skills/fundlark/scripts/contribute.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def test_contribution_requires_existing_sharing_authorization():
    with pytest.raises(ValueError, match='authorized'):
        helper.contribute('https://fundlark.example', [{'title': 'Award'}])


def test_contribution_rejects_private_fields_and_untrusted_origins():
    with pytest.raises(ValueError, match='Unexpected fields'):
        helper.contribute('https://fundlark.example', [{'title': 'Award', 'profile': 'PRIVATE'}], True)
    for origin in ('http://remote.example', 'https://token@remote.example', 'https://remote.example/path', 'https://remote.example?secret=1'):
        with pytest.raises(ValueError, match='trusted'):
            helper.contribute(origin, [{'title': 'Award'}], True)


def test_contribution_sends_only_public_records_without_credentials():
    calls = []
    def opener(request, timeout):
        calls.append(request)
        assert timeout == 15
        return io.BytesIO(b'{"results":[{"state":"queued"}]}')
    result = helper.contribute('https://fundlark.example', [{'title': 'Award'}], True, opener=opener)
    assert result['results'][0]['state'] == 'queued'
    assert json.loads(calls[0].data) == {'sharing_consent': True, 'opportunities': [{'title': 'Award'}]}
    assert calls[0].full_url == 'https://fundlark.example/api/contributions'
    assert 'Authorization' not in dict(calls[0].header_items())
