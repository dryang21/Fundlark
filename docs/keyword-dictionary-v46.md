# Fundlark v4.6 — controlled keywords and monochrome UI

## Behavior

- One research-description field remains; text is never rewritten.
- The local vocabulary contains 959 curated concepts, optional imported OpenAlex topics, labels, and aliases. The term picker searches those items only, ranking exact/alias, prefix, substring, then bounded-edit-distance typo suggestions.
- Researchers must select a suggested term (click or Arrow keys and Enter); arbitrary keywords are not accepted. Existing unknown manual keywords from older local profiles are dropped from matching during profile normalization on the next edit, to prevent unrecognized tags from participating silently.
- Automatically extracted terms use recognized dictionary concepts; the remaining fallback extractor is restricted to canonical dictionary labels. Keyword removals remain persistent.
- The user can still expand Browse research keywords by discipline to discover indexed terms. Unknown or emerging terminology can be expressed in the research description, but will not become an official dictionary keyword until the taxonomy is extended.
- Funding relevance and eligibility statuses remain separate.

## UI theme

- Global surfaces: white/near-white, charcoal, and neutral-gray borders and text.
- Interactive controls: black active/primary, light-gray secondary, accessible monochrome focus states.
- Eligibility and warning messages: muted green, amber, and red accents are retained for meaning.

## Validation

- `npm test`: 96 tests pass locally; 2 community Worker/D1 tests cannot start without the optional `wrangler` package.
- `pytest -q`: 57 pass.
- Static desktop/mobile renders have no horizontal overflow.
- Full live-browser navigation was blocked by the test environment; please verify interactions in a locally running copy.

## Limitation

This is dictionary-based approximate search, **not** semantic or generative AI search. It cannot cover every specialized or newly coined research term. The funding catalog itself is unchanged.
