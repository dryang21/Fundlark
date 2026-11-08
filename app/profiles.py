"""Conservative CV affiliation signals and explainable source routing. No persistence."""
import re
from urllib.parse import quote_plus

SOCIETIES = {
    "IEEE": r"\bIEEE\b|Institute of Electrical and Electronics Engineers",
    "ASTRO": r"\bASTRO\b|American Society for Radiation Oncology",
    "AAPM": r"\bAAPM\b|American Association of Physicists in Medicine",
    "ASCO": r"\bASCO\b|American Society of Clinical Oncology",
    "RSNA": r"\bRSNA\b|Radiological Society of North America",
    "ACM": r"\bACM\b|Association for Computing Machinery",
}
INSTITUTIONS = {
    "Stanford University": r"\bStanford(?: University| Medicine)?\b",
    "Harvard University": r"\bHarvard(?: University| Medical School)?\b",
    "University of California, San Francisco": r"\bUCSF\b|University of California[, ]+San Francisco",
    "Massachusetts Institute of Technology": r"\bMIT\b|Massachusetts Institute of Technology",
}


def extract_affiliations(text):
    societies, institutions = {}, {}
    section = ""
    for raw in text[:200_000].splitlines():
        line = " ".join(raw.split())
        if not line:
            continue
        if re.fullmatch(r"(?:professional )?(?:memberships?|affiliations?|education|publications?|experience|appointments?)[: ]*", line, re.I):
            section = line.lower()
            continue
        for name, pattern in SOCIETIES.items():
            if re.search(pattern, line, re.I):
                explicit = bool(re.search(r"\b(member|membership|fellow)\b", line, re.I) or "membership" in section)
                if name not in societies or explicit:
                    former = bool(re.search(r"\b(former|expired|lapsed|past)\b", line, re.I))
                    societies[name] = {"name": name, "relationship": "former_membership" if former and explicit else "membership_evidence" if explicit else "mention_only",
                                       "evidence": line[:240], "needs_confirmation": True}
        names = [name for name, pattern in INSTITUTIONS.items() if re.search(pattern, line, re.I)]
        # Discover additional university names without pretending to resolve their identity.
        names += re.findall(r"\bUniversity of [A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,3}", line)
        for name in dict.fromkeys(names):
            if "education" in section:
                relationship = "education_history"
            elif re.search(r"\b(current|present)\b", line, re.I) and re.search(r"\b(postdoc\w*|fellow|resident|professor|faculty|student|staff|appointment|institution|affiliation)\b", line, re.I):
                relationship = "current_affiliation_evidence"
            else:
                relationship = "affiliation_mentioned"
            item = {"name": name, "relationship": relationship, "evidence": line[:240], "needs_confirmation": True}
            previous = institutions.get(name)
            if not previous or relationship == "current_affiliation_evidence":
                institutions[name] = item
    return {"societies": list(societies.values())[:20], "institutions": list(institutions.values())[:20]}


def recommend_sources(sources, keywords=(), societies=(), institutions=()):
    terms = " ".join(keywords).lower()
    memberships = {s.strip().upper() for s in societies}
    affiliations = {s.strip().lower() for s in institutions}
    results = []
    for source in sources:
        reasons = []
        institution = source.get("institution")
        if institution:
            aliases = {institution.lower(), institution.lower().removesuffix(" university")}
            if not aliases & affiliations:
                continue
            reasons.append("Your confirmed institution matches this internal-funding source; appointment and PI rules still need checking.")
        if source.get("society") in memberships:
            reasons.append("Your confirmed society affiliation suggests checking member-specific awards; membership grade and duration may matter.")
        matched = [topic for topic in source.get("topics", []) if topic.lower() in terms]
        if matched:
            reasons.append("Research topics: " + ", ".join(matched))
        if reasons:
            results.append({**source, "recommendation_reasons": reasons, "eligibility": "not_established"})
    queries = []
    for institution in institutions:
        query = f'"{institution}" internal seed pilot grants postdoctoral funding limited submissions'
        queries.append({"institution": institution, "query": query,
                        "search_url": "https://www.google.com/search?q=" + quote_plus(query),
                        "note": "Verify the institution's official research office, department and appointment rules; portals may require institutional login."})
    society_queries = []
    for society in societies:
        query = f'"{society}" official research grants fellowships seed funding member awards'
        society_queries.append({"society": society, "query": query,
                                "search_url": "https://www.google.com/search?q=" + quote_plus(query)})
    return {"sources": results, "institution_discovery": queries, "society_discovery": society_queries,
            "note": "Source suggestions are not verified open opportunities or an eligibility assessment."}
