# Personal funding library

When the researcher asks to organize or refresh results with Fundlark, write a file such as `fundlark-library.json` in their own workspace. On request, read the existing library, check its official sources plus any relevant watched sources, and update the matching entries. Report new, amended, expired and inaccessible calls separately. An inaccessible source is not proof of closure; keep its last checked facts and tell the user what could not be checked. Do not overwrite a valid library with a partial search. For periodic runs, only use scheduling the user has enabled or explicitly requested.

Write a JSON object with `schema_version: 1`, `kind: "fundlark-library"`, and an `entries` array of up to 2,000 records. Each record requires `title`, `funder`, and an HTTPS `url` for the exact official opportunity. Example (fictional):

```json
{
  "schema_version": 1,
  "kind": "fundlark-library",
  "entries": [
    {
      "title": "Imaging Methods Seed Grant",
      "funder": "Example University",
      "url": "https://example.edu/research/imaging-seed-grant",
      "round": "2027",
      "opportunity_number": "EX-IMG-27",
      "category": "Institution",
      "funding_type": "Seed grant",
      "amount": "Up to $10,000",
      "deadline": "2027-02-01",
      "status": "open",
      "last_verified_at": "2026-11-14",
      "description": "Pilot studies in imaging methods.",
      "eligibility": "An eligible university host must submit."
    }
  ]
}
```

For recurring notices that use the same URL, keep `round` stable across a deadline amendment, even if the date moves into a different year. Do not use the title as identity. If neither a round nor a deadline year is known, omit `round` and verify it before distinguishing future cycles. Preserve previous records for unrelated calls. Use ISO dates and `open`, `rolling`, `forecast`, `verify` or `closed` for status. Use `verify` when the application window cannot be established. `last_verified_at` means the specific call was actually checked on that date.

Keep the file below 8 MB. Include public opportunity facts only, with short original summaries. Keep CVs, unpublished research plans, chat history and private application notes out of the library. To organize the results, open Fundlark → **My funding → My application tracker → Import funding library**. Reimport the updated file after a refresh. The browser retains existing notes and progress. **Download backup** saves a separate private tracker backup; do not upload or share that file as a public catalog.
