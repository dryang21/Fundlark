"""Transparent, cost-free lexical/profile ranking and conservative eligibility hints."""
import math
import re
from collections import Counter
from datetime import date

STOPWORDS = set('''a an the and or for to in at of on by with from as is are was were be been its their this that these those which where when into using use used based among beyond through over under can may will have has had do does did your you we our it more than also each other i me my cv resume publication university research researcher paper papers conference journal study methods results work working proposed algorithm algorithms applications new development projects project approach system systems model modeling analysis science scientists scientific grant grants award funding supported support institution school department phd doctor doctor of philosophy bachelor masters master degree 2020 2021 2022 2023 2024 2025 2026 2027 2028 education experience selected publications academic contact email phone address https www com org edu doi author co authors volume pages abstract introduction medical center clinical manuscript'''.split())

PHRASES = [
    "agentic ai", "ai agents", "large language models", "natural language processing",
    "reinforcement learning", "machine learning", "deep learning", "computer vision",
    "radiation therapy", "radiotherapy", "medical physics", "treatment planning",
    "healthcare ai", "biomedical imaging", "medical imaging", "public health",
    "automated reasoning", "quantum computing", "human-ai interaction",
    "ai safety", "responsible ai", "multimodal ai", "drug discovery",
    "generative ai", "foundation models", "robotics", "climate science",
    "computational biology", "data science", "bioinformatics", "oncology",
    "dose optimization", "computer aided diagnosis", "biomedical research",
    "artificial intelligence", "cloud computing", "gpu computing", "neuroscience",
    "natural language", "software engineering", "social science", "cybersecurity"
]

SYNONYMS = {
 "ai agents": ["agentic ai", "autonomous agents", "agent systems"],
 "agentic ai": ["ai agents", "autonomous agents", "agent systems"],
 "radiotherapy": ["radiation therapy", "treatment planning", "oncology"],
 "radiation therapy": ["radiotherapy", "oncology"],
 "healthcare ai": ["medical imaging", "biomedical research", "medical research"],
 "medical physics": ["radiation therapy", "radiotherapy", "medical imaging"],
 "large language models": ["llm", "generative ai", "foundation models"],
 "machine learning": ["deep learning", "artificial intelligence"],
 "computer vision": ["image analysis", "medical imaging"],
 "ai safety": ["responsible ai", "ai evaluation", "alignment"],
}


def clean(text):
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def tokenize(text):
    return [w for w in re.findall(r"[a-z][a-z0-9-]{2,}", clean(text)) if w not in STOPWORDS and not w.isdigit()]


def extract_keywords(text, limit=12):
    """Keyword heuristics only; extracts concepts, not identity/contact information."""
    body = clean(text)[:200_000]
    found = [p for p in PHRASES if re.search(r"\b" + re.escape(p) + r"\b", body)]
    counts = Counter(tokenize(body))
    weighted = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    result = sorted(found, key=lambda p: (-len(p.split()), body.find(p)))[:limit]
    for word, _count in weighted:
        if len(result) >= limit:
            break
        if len(word) < 4 or any(word in phrase.split() for phrase in result):
            continue
        result.append(word)
    return result


def match_one(opp, keywords, stage=None, query=""):
    terms = [t.strip().lower() for t in keywords if t.strip()][:30]
    if query.strip():
        terms += [query.strip().lower()]
        terms += extract_keywords(query, 6)
    terms = list(dict.fromkeys(terms))
    content = clean(" ".join([opp["title"],opp["description"]," ".join(opp["topics"])]))
    topics = clean(" ".join(opp["topics"]))
    hits = []
    score = 0
    for term in terms:
        if not term or len(term)<3:
            continue
        if term in topics:
            hits.append(term)
            score += 16
        elif term in content:
            hits.append(term)
            score += 10
        elif any(syn in content for syn in SYNONYMS.get(term, [])):
            hits.append(term)
            score += 7
        elif len(term.split()) == 1 and re.search(r"\b" + re.escape(term) + r"\b", content):
            hits.append(term)
            score += 4
    # Pure browsing (no profile) doesn't imply an exceptional match.
    relevance = min(98, round(12 + 77 * (1-math.exp(-score/30)))) if terms else None
    matched = list(dict.fromkeys(hits))[:5]
    allowed = opp.get("eligible_stages") or []
    if not stage or stage == "unspecified" or not allowed:
        eligibility = "check"
        reason = "Review the official eligibility requirements."
    elif stage in allowed:
        eligibility = "possible"
        reason = "Your selected career stage is included in this program's preliminary criteria; other requirements may apply."
    elif opp.get("faculty_sponsor_possible"):
        eligibility = "sponsor"
        reason = "This program generally requires a faculty PI. You may need an eligible faculty collaborator; verify whether you can participate."
    else:
        eligibility = "unlikely"
        reason = "Your selected career stage is not listed in the preliminary criteria. Verify with the funder."
    if opp["status"] == "closed":
        reason += " The published application window is closed."
    return {**opp, "match_score":relevance, "matched_keywords":matched,
            "eligibility_assessment":eligibility, "eligibility_reason":reason}


def match_all(opportunities, keywords=None, stage=None, query="", societies=None, institutions=None):
    results = [match_one(o, keywords or [], stage, query) for o in opportunities]
    for result in results:
        tags = result.get("affiliation_tags") or {}
        selected_societies = {s.strip().casefold() for s in societies or []}
        selected_institutions = {s.strip().casefold() for s in institutions or []}
        matches = [name for name in tags.get("societies", []) if name.casefold() in selected_societies]
        institution = tags.get("institution")
        if institution and institution.casefold() in selected_institutions:
            matches.append(institution)
        result["affiliation_matches"] = matches
        result["ranking_score"] = (result["match_score"] or 0) + 12 * len(matches)
        result["affiliation_reason"] = ("Related to your saved affiliation; membership and appointment eligibility still require checking."
                                        if matches else "")
    return sorted(results, key=lambda x: x["ranking_score"], reverse=True)
