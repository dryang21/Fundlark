# v3.1 — CV-to-matches workflow fix (2026-11-14)

## Problem reproduced

The user could upload a CV and see selected suggestions, but clicking the main **Find funding** form button searched an empty profile. The page scrolled to the **Explore funding** directory and displayed 487 non-closed catalog records. **Match my profile** then did nothing because the suggestions were still pending. Separately, explicitly confirming the CV returned 275 loose topic matches, including known mismatched career stages and unrelated records associated with a broad discipline.

## Fixed behavior

1. After uploading or pasting a CV, the app shows **checked, editable suggestions**. Clicking **Find funding**, **Match my profile**, or **Apply checked CV details & show matches** applies only these checked entries locally. The button is now a meaningful confirmation action. The CV file itself is not uploaded or saved.
2. **Find funding** activates the personalized search, clears residual browse filters, and scrolls to **My funding dashboard**. **Match my profile** activates the same search and scrolls to the filtered opportunity results. **Browse all funding** is a separate explicit mode.
3. The personalized view uses `recommendedOnly` plus `plausibleProfileLead()` to remove known ineligible career stages, known unmet individual PI/research-effort conditions, unrelated universities, and weak same-discipline matches without a relevant career stage or sponsor route. Broad browsing remains available and unchanged.
4. The opportunity filter exposes **Application route**: all potential leads, individual route, faculty/institution partnership, or needs eligibility checks. Labels emphasize **potential leads**, not official eligibility.
5. The dashboard and the full matching results now use the same shortlist gate; a user should not see contradictory counts.

## Validation

- With an eight-page medical physics researcher CV (Stanford resident), the uploaded text was parsed into 13 checked suggestions, including AAPM, ASTRO and Stanford, and the primary button returned **34 potential active leads**, compared with the original 487 unspecialized browse records and 275 broad profile matches. These figures describe the bundled November 2026 snapshot; they do **not** imply 34 confirmed eligibilities.
- The original directly relevant records (ASTRO–AAPM resident seed grant and RSNA Resident Research Grant) remain among the first items.
- Browser-driven exercises passed for (i) TXT file upload + Find funding, (ii) pasted CV + Match my profile, (iii) individual-route filter, (iv) Browse all distinction, (v) four cross-discipline profiles (computing, humanities, education, engineering), and (vi) 375px mobile layout. The local smoke harness runs actual browser JavaScript against mocked static fetches because localhost navigation is blocked in this tool environment; it is not a deployment test.
- 45 core JavaScript tests and 54 Python tests passed. Two optional Cloudflare Worker/D1 integration tests could not start because Wrangler dependencies are not installed.

## Manual verification

```sh
cd Fundlark-v3-fixed
python3 -m http.server 8011 --directory docs/demo
```

Open http://127.0.0.1:8011/ (use a new port to avoid caching/old server). Upload a CV, review checkboxes, and click **Find funding**. Confirm the dashboard names your stage and shows a shortlist. Click **See my matched leads** to examine matching cards. Use **Application route** to narrow to individual or institutional routes. Switch to **Browse all funding** to return to the unfiltered directory. Reload and confirm your chosen profile remains in this browser.

**Eligibility caveat:** This is a conservative heuristic, not a live verification of applicant status, citizenship, institution, application dates or sponsor rules. A sponsor's official call is authoritative. Cross-disciplinary coverage and the published catalog are unchanged in this patch.
