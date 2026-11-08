# Fundlark skill: source review and design decisions

Reviewed November 8, 2026. This is a review of representative source files and
selected sections in six relevant repositories, not an audit of every skill or
proof that stars predict quality. Star totals are a dated popularity snapshot;
they do not measure today's trending growth. Machine-readable counts and inspected
revisions are in [skill-projects-2026-11-08.json](skill-projects-2026-11-08.json).
No upstream installer, package, hook or skill was executed. Fundlark's new code and
instructions were written independently; no third-party source is bundled.

## Projects and transferable patterns

| Repository | Stars at review | Source inspected | Fundlark decision |
| --- | ---: | --- | --- |
| [obra/superpowers](https://github.com/obra/superpowers) | 314,509 | Verification skill and testing documentation | Make evidence requirements observable; distinguish script tests from actual agent behavior tests. |
| [anthropics/skills](https://github.com/anthropics/skills) | 189,453 | Skill-creator workflow and grading guidance | Give the skill a specific trigger, task examples and outcome-based evaluations. |
| [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 56,484 | Research-grants and research-lookup skill sections, package configuration | Separate governing call requirements from general research relevance. Declare optional provider dependencies rather than implying all tools are free or available. |
| [Yuan1z0825/nature-skills](https://github.com/Yuan1z0825/nature-skills) | 52,760 | Academic-search and citation routers, manifest, source routing, citation principles | Keep the entrypoint small, load task-specific references on demand, and use official evidence for each claim. Provide an optional standard-library fallback. |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | 38,601 | Agent directory mappings, skill discovery parser, installation mode handling and troubleshooting | Package a portable folder; document each host's actual install path. An installer is optional, not a runtime requirement. |
| [openai/skills](https://github.com/openai/skills) | 28,597 | Skill-creator conventions and OpenAI metadata reference | Use the shared format with small optional Codex metadata. Avoid requiring host-specific tools in the core workflow. |

The `nature-skills` project in this review is the independently maintained GitHub
project above. Its name alone does not establish an endorsement by Nature Portfolio.
The similarly named Mubuky derivative was found during discovery but is not the
primary repository used for the comparison.

Pinned examples:

- [Nature search router](https://github.com/Yuan1z0825/nature-skills/blob/b6ae2cac022f4aac094d50f2938a3474ba315fbc/skills/nature-academic-search/SKILL.md), [source routing](https://github.com/Yuan1z0825/nature-skills/blob/b6ae2cac022f4aac094d50f2938a3474ba315fbc/skills/nature-academic-search/static/core/routing-and-ops.md), [citation principles](https://github.com/Yuan1z0825/nature-skills/blob/b6ae2cac022f4aac094d50f2938a3474ba315fbc/skills/nature-citation/static/core/principles.md).
- [K-Dense research-grants](https://github.com/K-Dense-AI/scientific-agent-skills/blob/a25cf9ec00e2745d03f8704acf6f6919694ccd9a/skills/research-grants/SKILL.md), [research-lookup](https://github.com/K-Dense-AI/scientific-agent-skills/blob/a25cf9ec00e2745d03f8704acf6f6919694ccd9a/skills/research-lookup/SKILL.md).
- [Anthropic skill creator](https://github.com/anthropics/skills/blob/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/skill-creator/SKILL.md), [grading guidance](https://github.com/anthropics/skills/blob/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/skill-creator/agents/grader.md).
- [Superpowers verification](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/verification-before-completion/SKILL.md), [test/evaluation distinction](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/docs/testing.md).
- [Vercel agent mappings](https://github.com/vercel-labs/skills/blob/d3701c11b1101251af14c9d148f026e1a47ebe17/src/agents.ts), [skill parsing](https://github.com/vercel-labs/skills/blob/d3701c11b1101251af14c9d148f026e1a47ebe17/src/skills.ts).
- [OpenAI skill creator](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md), [host metadata](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/references/openai_yaml.md).

## What to adapt with care

Framework-wide compulsory rituals, blanket tool grants and provider-specific
subagent assumptions do not belong in a portable funding-discovery skill. A
dependency on a paid search service can shift costs to users even if the skill
itself is free. Fundlark instead uses the host's existing web tools and offers a
keyless public API helper.

Repository-level licensing is not sufficient for copying arbitrary files. Nature
Skills declares Apache-2.0; K-Dense, Superpowers and Vercel declare MIT. The OpenAI
and Anthropic catalogs use per-skill licensing; their inspected creator directories
include Apache-2.0 license files. Future copying must check the particular files
and preserve required notices. This release does not depend on copied code.

## Fundlark's distribution model

1. The maintainer collects and reviews public funding records on their own machine.
2. An allowlisted export contains public funding facts, provenance and dates.
3. GitHub stores the code and a modest snapshot. An optional static GitHub Pages
   demo searches that snapshot and distributes the standalone skill ZIP.
4. The installed skill uses context the user's agent actually has, selects suitable
   funding sources, and checks current official announcements.
5. Personal context and CVs are excluded from public exports. AI processing still
   follows the user's host/provider settings; local installation does not make a
   cloud model private or give it access to every old conversation.

This removes the need for a central Fundlark application server in the initial
release. Free GitHub hosting has [usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
The initial demo is an open-source project preview, with no accounts, transactions,
CV uploads or server-side personalization. A large shared service or paid SaaS would
need a separate hosting design.

## Validation and limits

The skill format, public-export boundary, archive contents and optional API helper
are checked deterministically. Live public API retrieval is checked separately.
Suggested host behavior scenarios are in `evals/fundlark.json`; those are not
claimed as completed model evaluations. Claude Code was not installed in the local
environment, so cross-host behavior remains to be tested in actual host sessions.
No general claim of “reverse-engineering everything” or improved model performance
is made from a source review alone.

Current host references: [Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Claude Code skills](https://code.claude.com/docs/en/skills),
[Agent Skills specification](https://agentskills.io/specification).
