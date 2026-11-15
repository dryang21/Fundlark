#!/usr/bin/env python3
"""Write docs/demo/fellowships.json: curated early-career fellowships.

Each record was checked against the funder's own page on the date in
``last_verified_at``. Dates are recorded only when that page stated them;
otherwise the record is a program-family lead with an unconfirmed window.
Run: python3 scripts/build_fellowships.py
"""
import json
from pathlib import Path

CHECKED = "2026-11-15"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "demo" / "fellowships.json"


def rec(id, title, funder, url, *, category="Foundation", stages, topics, fields, description,
        eligibility, funding_type="Fellowship", amount=None, status="verify", deadline=None,
        deadline_time=None, deadline_timezone=None, opens_on=None, region=None, route="direct",
        next_step=None, review_needed=False, timing=None):
    record = {
        "id": f"fellowship:{id}", "title": title, "funder": funder, "category": category,
        "url": url, "status": status, "funding_type": funding_type,
        "description": description, "eligibility": eligibility,
        "eligible_stages": stages, "topics": topics, "field_ids": fields,
        "origin": "curated", "source_date": CHECKED, "last_verified_at": CHECKED,
        "review_needed": review_needed,
        "eligibility_rules": {"application_route": route,
                              "next_step": next_step or "Read the funder's current guidelines and confirm every eligibility rule before preparing an application."},
    }
    if status == "verify":
        record["program_status_scope"] = "program_family"
    for key, value in [("amount", amount), ("deadline", deadline), ("deadline_time", deadline_time),
                       ("deadline_timezone", deadline_timezone), ("opens_on", opens_on),
                       ("country_or_region", region)]:
        if value:
            record[key] = value
    if timing:
        record["timing_evidence"] = {"url": url, "checked": CHECKED, "detail": timing}
    return record


BIO = ["life", "medicine"]
records = [
    # ---- Postdoctoral: biomedical and life sciences --------------------------------
    rec("damon-runyon-fellowship", "Damon Runyon Fellowship Award", "Damon Runyon Cancer Research Foundation",
        "https://www.damonrunyon.org/for-scientists/application-guidelines/fellowship",
        stages=["postdoc"], topics=["cancer research", "cancer biology", "biomedical research", "postdoctoral fellowship"],
        fields=BIO, amount="Four-year stipend ($70,000 rising to $76,000) plus $2,000 yearly expenses",
        description="Four-year fellowship for early postdoctoral scientists doing basic or translational cancer research.",
        eligibility="Basic scientists apply within 18 months of their doctoral degree; physician-scientists after clinical training. Non-U.S. citizens must train at a U.S. institution. The 14 August 2026 round has passed; check the site for the next deadline."),
    rec("damon-runyon-quantitative", "Damon Runyon Quantitative Biology Fellowship Award", "Damon Runyon Cancer Research Foundation",
        "https://www.damonrunyon.org/for-scientists/application-guidelines/quantitative/forms",
        stages=["postdoc"], topics=["computational biology", "cancer research", "data science", "mathematical modeling", "quantitative biology"],
        fields=BIO + ["computing"], status="open", deadline="2026-12-01", deadline_time="16:00", deadline_timezone="America/New_York",
        timing="The application guidelines list a 1 December 2026 deadline and a 26 February 2027 selection meeting.",
        description="Three-year fellowship for computational and quantitative scientists working on biological questions relevant to cancer, with dual mentorship.",
        eligibility="Degree conferred between 1 Dec 2021 and 1 Dec 2026, and joined the mentor's lab on or after 1 Dec 2024. Reference letters are due by the deadline."),
    rec("jane-coffin-childs", "Jane Coffin Childs Postdoctoral Fellowship", "Jane Coffin Childs Memorial Fund for Medical Research",
        "https://www.jccfund.org/fellowship-information/",
        stages=["postdoc"], topics=["biomedical research", "cancer research", "cell biology", "postdoctoral fellowship"], fields=BIO,
        amount="$50,000 a year for three years, plus lab and travel allowances",
        description="Three-year fellowship for early postdocs in the medical and related sciences bearing on cancer.",
        eligibility="Generally no more than one year of postdoctoral experience. Any nationality, but foreign nationals must train in the United States. The page lists a 1 February deadline without a year; confirm the current cycle."),
    rec("helen-hay-whitney", "Helen Hay Whitney Foundation Postdoctoral Fellowship", "Helen Hay Whitney Foundation",
        "https://hhwf.org/research-fellowship/",
        stages=["postdoc"], topics=["biomedical research", "life sciences", "postdoctoral fellowship"], fields=BIO,
        amount="Three years; stipend $73,000 rising to $77,000, plus allowances",
        description="Three-year fellowship for early postdoctoral training in the basic biomedical sciences.",
        eligibility="PhD within two years (MD within four) of the deadline and at most one year in the postdoctoral lab. Foreign citizens must train in U.S. labs. The 15 June 2026 round has passed."),
    rec("lsrf", "Life Sciences Research Foundation Postdoctoral Fellowship", "Life Sciences Research Foundation",
        "https://www.lsrf.org/apply",
        stages=["postdoc"], topics=["life sciences", "biology", "postdoctoral fellowship"], fields=BIO,
        description="Three-year postdoctoral fellowships across the life sciences, funded by sponsoring companies, foundations and institutes.",
        eligibility="PhD within the five-year window set for each cycle, in a different lab from the thesis lab. Non-U.S. citizens must work in a U.S. lab. The 1 October 2026 round has passed."),
    rec("hhmi-hanna-gray", "HHMI Hanna H. Gray Fellows Program", "Howard Hughes Medical Institute",
        "https://www.hhmi.org/programs/hanna-h-gray-fellows",
        stages=["postdoc"], topics=["biomedical research", "biology", "faculty transition", "postdoctoral fellowship"], fields=BIO,
        status="open", deadline="2026-12-15", deadline_time="17:00", deadline_timezone="America/New_York",
        timing="HHMI's program page says applications are open and close 15 December 2026 at 5 PM ET.",
        description="Supports postdocs in basic biological and biomedical research who intend to start an independent faculty career.",
        eligibility="Current mentored postdoc at an HHMI-eligible institution, up to seven years of postdoctoral experience, intending to start a faculty position by May 2030. Must be authorized or eligible to work in the U.S."),
    rec("cri-irvington", "CRI Irvington Postdoctoral Fellowship", "Cancer Research Institute",
        "https://www.cancerresearch.org/cri-irvington-postdoctoral-fellowship",
        stages=["postdoc"], topics=["cancer immunology", "immunology", "immunotherapy", "cancer research", "postdoctoral fellowship"], fields=BIO,
        review_needed=True,
        description="Three-year fellowship for postdocs training in fundamental immunology or cancer immunology at nonprofit institutions worldwide.",
        eligibility="Work must relate directly to immunology or cancer immunology. University notices describe two deadlines a year; the official page could not be reached on the check date, so confirm dates there."),
    rec("aacr-leonard", "AACR John and Elizabeth Leonard Basic Cancer Research Fellowship", "American Association for Cancer Research",
        "https://www.aacr.org/grants/aacr-john-and-elizabeth-leonard-basic-cancer-research-fellowship/",
        category="Society", stages=["postdoc"], topics=["cancer research", "cancer biology", "basic research", "postdoctoral fellowship"], fields=BIO,
        amount="$130,000 over two years", status="open", deadline="2026-11-24",
        timing="AACR's grants page lists a 24 November 2026 letter of intent and a 15 March 2027 application deadline.",
        description="Two-year fellowship for postdoctoral and clinical research fellows doing mentored basic cancer research. The listed deadline is for the letter of intent.",
        eligibility="Read the program guidelines for career-stage and AACR membership rules. Full applications are by invitation after the letter of intent."),
    rec("bcrf-aacr-cda", "Breast Cancer Research Foundation–AACR Career Development Awards", "American Association for Cancer Research",
        "https://www.aacr.org/grants/breast-cancer-research-foundation-aacr-career-development-awards/",
        category="Society", stages=[], topics=["breast cancer", "cancer research", "career development"], fields=BIO,
        funding_type="Career development award", amount="$375,000 over three years", status="open", deadline="2026-12-15",
        timing="AACR's grants page lists a 15 December 2026 letter of intent and a 1 April 2027 application deadline.",
        description="Three-year career development award for breast cancer research. The listed deadline is for the letter of intent.",
        eligibility="Career-stage rules are in the program guidelines; career development awards usually target early independent investigators rather than trainees."),
    rec("bwf-casi", "Burroughs Wellcome Fund Career Awards at the Scientific Interface", "Burroughs Wellcome Fund",
        "https://www.bwfund.org/grants/interfaces-in-science/career-awards-at-the-scientific-interface/",
        stages=["postdoc"], topics=["computational biology", "biophysics", "quantitative biology", "interdisciplinary research", "faculty transition"],
        fields=BIO + ["computing", "physical"], amount="$560,000 over five years",
        description="Bridges advanced postdoctoral training and the first years of a faculty post for researchers from the physical, mathematical, computational or engineering sciences who work on biological questions.",
        eligibility="Postdoctoral experience window applies (12–60 months by the full-application deadline in the 2027 cycle). The 2027 letter-of-intent deadline (14 Aug 2026) has passed; full proposals are by invitation."),
    rec("hfsp-fellowships", "HFSP Long-Term and Cross-Disciplinary Fellowships", "Human Frontier Science Program",
        "https://www.hfsp.org/funding/hfsp-funding/postdoctoral-fellowships", category="Government",
        stages=["postdoc"], topics=["life sciences", "biology", "interdisciplinary research", "international mobility", "postdoctoral fellowship"],
        fields=BIO + ["physical", "computing"], region="International",
        description="Three-year fellowships for postdocs who move to a new country for basic life-science research. Cross-Disciplinary Fellowships are for those trained outside biology.",
        eligibility="Doctorate within three years of the full-proposal deadline, a lead-author paper, and a move to a different country from the PhD. The 2027-cycle letter-of-intent deadline has passed."),
    rec("humboldt-research-fellowship", "Humboldt Research Fellowship", "Alexander von Humboldt Foundation",
        "https://www.humboldt-foundation.de/en/apply/sponsorship-programmes/humboldt-research-fellowship", category="Foundation",
        stages=["postdoc", "faculty"], topics=["international mobility", "research fellowship", "any discipline"],
        fields=[], region="Germany", amount="€3,000 a month for postdocs (€3,600 experienced researchers), 6–24 months",
        status="open", opens_on="2026-11-15",
        timing="Calls open on 15 March, 15 July and 15 November and close early once 800 applications are received.",
        description="Funds researchers of any discipline and any non-German nationality for a research stay at a host in Germany.",
        eligibility="Postdocs within four years of the doctorate; experienced researchers within twelve years. Fewer than 90 days in Germany in the previous 18 months. Calls close early once 800 applications arrive."),
    rec("schmidt-science-fellows", "Schmidt Science Fellows", "Schmidt Sciences / Rhodes Trust",
        "https://schmidtsciencefellows.org/selection/how-to-apply/",
        stages=["phd", "postdoc"], topics=["interdisciplinary research", "natural sciences", "engineering", "computing", "mathematics", "postdoctoral fellowship"],
        fields=["physical", "life", "computing", "engineering", "math"], route="partner",
        next_step="Ask your PhD-granting university's research or fellowships office about its internal nomination round.",
        description="Interdisciplinary postdoctoral placement for people finishing a STEM PhD who want to pivot into a new field.",
        eligibility="Candidates must be nominated by their PhD-awarding institution. The 2027-cohort deadlines (May–July 2026) have passed; universities usually open internal nominations early in the year."),
    # ---- Graduate students -------------------------------------------------------------
    rec("nsf-grfp", "NSF Graduate Research Fellowship Program (GRFP)", "U.S. National Science Foundation",
        "https://www.nsf.gov/funding/initiatives/grfp", category="Government",
        stages=["undergrad", "phd"], topics=["graduate fellowship", "science", "engineering", "social sciences", "psychology", "STEM"],
        fields=["physical", "life", "computing", "engineering", "math", "social"], region="United States",
        amount="$37,000 stipend plus $16,000 cost of education a year, for three years of support",
        description="Five-year award with three years of support for graduate study in NSF-supported science and engineering fields.",
        eligibility="For students at the start of graduate study. Citizenship and career-stage limits are in the current Notice of Funding Opportunity. The October 2026 field deadlines have closed."),
    rec("hertz", "Hertz Foundation Graduate Fellowship", "Fannie and John Hertz Foundation",
        "https://www.hertzfoundation.org/the-fellowship/",
        stages=["phd"], topics=["applied science", "engineering", "mathematics", "graduate fellowship"],
        fields=["physical", "engineering", "math", "computing"], region="United States", amount="Up to five years of support, valued up to $250,000",
        description="Doctoral fellowship in the applied physical, biological and engineering sciences and mathematics.",
        eligibility="Doctoral students and those applying to doctoral programs. Citizenship and timing rules are on the foundation's eligibility page."),
    rec("ndseg", "National Defense Science and Engineering Graduate (NDSEG) Fellowship", "U.S. Department of Defense",
        "https://ndseg.sysplus.com/", category="Government",
        stages=["undergrad", "phd"], topics=["engineering", "physical sciences", "computer science", "graduate fellowship"],
        fields=["engineering", "physical", "computing", "math"], region="United States",
        description="Three-year fellowships for doctoral study in research areas relevant to the U.S. Department of Defense.",
        eligibility="U.S. citizens or nationals pursuing a doctorate at a U.S. institution. The FY2027 window (3 Aug–30 Oct 2026) has closed."),
    rec("doe-csgf", "DOE Computational Science Graduate Fellowship", "U.S. Department of Energy / Krell Institute",
        "https://www.krellinst.org/csgf/", category="Government",
        stages=["undergrad", "phd"], topics=["computational science", "high-performance computing", "applied mathematics", "graduate fellowship"],
        fields=["computing", "math", "physical", "engineering"], region="United States", status="open",
        amount="$45,000 a year plus full tuition and fees, renewable up to four years",
        description="Doctoral fellowship for computational science, combining a field of science or engineering with applied math and computing.",
        eligibility="U.S. citizens and permanent residents; senior undergraduates and first-year graduate students. The site says the 2027 application is open; check it for the closing date."),
    rec("pd-soros", "Paul & Daisy Soros Fellowships for New Americans", "Paul & Daisy Soros Fellowships",
        "https://www.pdsoros.org/apply",
        stages=["undergrad", "masters", "phd"], topics=["graduate fellowship", "any discipline"], fields=[], region="United States",
        description="Graduate-school funding for immigrants and children of immigrants in any field at U.S. institutions.",
        eligibility="Apply before or during the first two years of the funded program; immigration background and age rules apply. The 2027 cycle closed 29 Oct 2026; the 2028 application is expected to open mid-April 2027."),
    rec("naed-spencer", "NAEd/Spencer Dissertation Fellowship", "National Academy of Education / Spencer Foundation",
        "https://naeducation.org/naedspencer-dissertation-fellowship-program/",
        stages=["phd"], topics=["education research", "dissertation fellowship"], fields=["education", "social"], region="United States",
        amount="$30,000 for one academic year",
        description="Dissertation-year support for doctoral candidates whose research concerns education, with mentoring and retreats.",
        eligibility="Doctoral candidates at U.S. graduate schools (U.S. citizenship not required). Applications are closed; the next window is expected to open in August 2027."),
]

payload = {
    "schema_version": 1,
    "generated_at": CHECKED,
    "description": "Curated early-career fellowships for PhD students and postdocs.",
    "limitations": "Checked against each funder's page on the date shown. Not exhaustive. Records without a confirmed date are program leads: read the official page before applying.",
    "opportunities": records,
}
OUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {len(records)} records to {OUT.relative_to(ROOT)}")
