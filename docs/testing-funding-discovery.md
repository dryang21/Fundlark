# Test society funding discovery

The earlier version registered society source pages but had no society catalog
records, and the Discover request omitted saved affiliations. Both gaps are fixed.
Source recommendations and indexed opportunities remain distinct.

1. Refresh the local app after upgrading/restarting it.
2. In **My research profile**, add AAPM and/or ASTRO using the list and Add button.
   Select your actual career stage and keywords, then click **Save profile**.
3. In **Discover**, choose **Societies**. Clear the search box and turn off
   **Open / rolling** for the initial check.
4. Five indexed society programs should appear: 2027 AAPM Research Seed Funding;
   ASTRO-AAPM Physics Residents/Postdoctoral Fellows Seed Grant; ASTRO
   Residents/Fellows Seed Grant; Sigma Xi Grants in Aid of Research; and IEEE
   Photonics Society Graduate Student Scholarship.
5. AAPM/ASTRO connections should appear on the relevant cards and contribute to
   Best match ordering. This is an affiliation connection, not verified eligibility.
6. The **Official funding sources to explore** panel should include relevant
   society pages and searches for your saved memberships.
7. Turn on **Open / rolling**. An empty result can be correct: as checked November
   8, 2026, ASTRO labels the two indexed calls closed; the other indexed society
   programs require current-window verification. The page should explain this and
   keep the official source routes visible. **Clear search and show all statuses**
   restores the program listings without changing your category.

The AAPM seed record uses March 22, 2027 as the mandatory LOI deadline and records
April 19 as the full-proposal deadline in its description. Do not test success by
expecting every listed program to be open or every member to be eligible.

For an institution check, save Stanford University only if it is a current
affiliation, then choose **Institutions**. The Bio-X seed program should show an
affiliation connection and a requirement to check faculty-team/current-call rules.

`python -m pytest -q` covers the saved-profile API path, affiliation ranking,
preserved closed/verify states, institution metadata, and Sigma Xi student-stage
restrictions. Browser checks cover the membership picker, saving and Discover.
The static public preview supports category browsing, while personalized profile
behavior belongs to the local app and agent skill.
