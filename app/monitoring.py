"""Bounded, robots-aware monitoring of registered official funding pages."""
import asyncio
import hashlib
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from . import storage

UA = "FundlarkBot/0.1 (research funding discovery prototype)"
MAX_RESPONSE_BYTES = 3 * 1024 * 1024
TRANSIENT_STATUSES = {429, 500, 502, 503, 504}


async def request_with_retry(client, method, url, **kwargs):
    """Retry temporary failures at most twice; cap decompressed response size."""
    for attempt in range(3):
        try:
            async with client.stream(method, url, follow_redirects=False, **kwargs) as response:
                chunks = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_RESPONSE_BYTES:
                        raise ValueError("Source response exceeded the 3 MB collection limit")
                    chunks.append(chunk)
                # aiter_bytes has already decoded Content-Encoding.
                headers = {k: v for k, v in response.headers.items()
                           if k.lower() not in {"content-encoding", "content-length"}}
                result = httpx.Response(response.status_code, headers=headers,
                                        content=b"".join(chunks), request=response.request)
        except (httpx.TimeoutException, httpx.NetworkError):
            if attempt == 2:
                raise
        else:
            if result.status_code not in TRANSIENT_STATUSES or attempt == 2:
                return result
            retry_after = result.headers.get("retry-after")
            if retry_after:
                try:
                    delay = float(retry_after)
                except ValueError:
                    # Leave date-based/long backoffs to the next scheduled run.
                    return result
                if not 0 <= delay <= 5:
                    return result
                await asyncio.sleep(delay)
                continue
        await asyncio.sleep(0.5 * (2 ** attempt))


async def robots_allowed(client, url):
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        response = await request_with_retry(client, "GET", robots_url, timeout=8)
        if response.status_code == 404:
            return True
        if response.status_code != 200:
            return False
        parser = RobotFileParser()
        parser.parse(response.text.splitlines())
        return parser.can_fetch(UA, url)
    except (httpx.HTTPError, ValueError):
        return False


def extract_candidate_links(soup, base_url, *, path_prefix=None):
    """Collect possible calls from the same official HTTPS host; never publish them."""
    base_host = urlparse(base_url).netloc.lower()
    clues = ("grant", "funding", "research award", "call for", "proposal", "fellowship",
             "research scholar", "research credit", "application", "agentic ai", "open science")
    seen = set()
    found = []
    for anchor in soup.select("a[href]"):
        title = " ".join(anchor.stripped_strings).strip()
        if len(title) < 5 or (not path_prefix and not any(clue in title.lower() for clue in clues)):
            continue
        parsed = urlparse(urljoin(base_url, anchor.get("href", "")))
        if (parsed.scheme != "https" or parsed.netloc.lower() != base_host
                or parsed.username or parsed.password):
            continue
        if path_prefix and not (parsed.path.startswith(path_prefix) and parsed.path.removeprefix(path_prefix).strip("/")):
            continue
        url = parsed._replace(fragment="").geturl()
        if url in seen or url.rstrip("/") == base_url.rstrip("/"):
            continue
        seen.add(url)
        found.append({"title": title[:160], "url": url})
        if len(found) >= 20:
            break
    return found


async def check_source(client, source):
    source_id = source["id"]
    if source["mode"] != "watch":
        return {"id": source_id, "status": "api", "message": "Use federal synchronization."}
    previous = storage.get_source_checks().get(source_id, {})
    url = source["url"]
    allowed_hosts = {urlparse(url).netloc.lower(), *source.get("redirect_hosts", [])}
    try:
        for _ in range(5):
            parsed = urlparse(url)
            if (parsed.scheme != "https" or parsed.netloc.lower() not in allowed_hosts
                    or parsed.username or parsed.password):
                raise ValueError("Redirect left the registered official HTTPS hosts")
            # Recheck every redirect target before requesting its page.
            if not await robots_allowed(client, url):
                message = "robots.txt disallows this URL or could not be checked"
                storage.record_source_check(source_id, "skipped", message)
                return {"id": source_id, "status": "skipped", "message": message}
            headers = {}
            if previous.get("content_hash") and previous.get("final_url") == url:
                if previous.get("etag"):
                    headers["If-None-Match"] = previous["etag"]
                if previous.get("last_modified"):
                    headers["If-Modified-Since"] = previous["last_modified"]
            response = await request_with_retry(client, "GET", url, headers=headers, timeout=16)
            if response.status_code == 304:
                if not previous.get("content_hash"):
                    raise ValueError("Source returned 304 without a previous snapshot")
                message = "Source reports unchanged; prior review flags are preserved"
                storage.record_source_check(source_id, "ok", message)
                return {"id": source_id, "status": "ok", "message": message}
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location:
                    raise ValueError("Source redirect omitted its destination")
                url = urljoin(url, location)
                continue
            response.raise_for_status()
            break
        else:
            raise ValueError("Too many source redirects")
        if "html" not in response.headers.get("content-type", "").lower():
            raise ValueError("Source did not return an HTML page")
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        root = (soup.select_one(source["content_selector"]) if source.get("content_selector")
                else soup.find("main") or soup.find("article") or soup.body or soup)
        if root is None:
            raise ValueError("Configured funding content was not found")
        candidates = extract_candidate_links(root, url, path_prefix=source.get("candidate_path_prefix"))
        visible = "\n".join(" ".join(s.split()) for s in root.stripped_strings if s.strip())
        if len(visible) < 70:
            raise ValueError("Page has too little readable funding content")
        if len(visible) > 200_000:
            raise ValueError("Readable page exceeded the 200,000 character snapshot limit")
        # Identical labels can point at a new funding round: include link destinations.
        content = visible + "\n\nFunding links:\n" + "\n".join(
            f"{c['title']} -> {c['url']}" for c in sorted(candidates, key=lambda c: c["url"]))
        digest = hashlib.sha256(content.encode()).hexdigest()
        changed = storage.record_source_check(
            source_id, "ok", f"HTTP {response.status_code}; {len(candidates)} candidate links",
            digest, content=content, url=url, etag=response.headers.get("etag"),
            last_modified=response.headers.get("last-modified"))
        storage.upsert_candidate_links(source_id, candidates)
        return {"id": source_id, "status": "changed" if changed else "ok",
                "message": "Page changed; review its snapshot" if changed else "Page checked; no claims auto-verified",
                "link_candidates": len(candidates)}
    except (httpx.HTTPError, ValueError) as exc:
        message = f"{type(exc).__name__}: {str(exc)[:160]}"
        storage.record_source_check(source_id, "error", message)
        return {"id": source_id, "status": "error", "message": message}
