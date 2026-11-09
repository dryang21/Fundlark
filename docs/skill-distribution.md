# Use Fundlark with your own AI assistant

Fundlark has two complementary experiences: a browser-based funding matcher and a
downloadable skill that works through the user's own agent. Neither requires a
central Fundlark server for matching. An optional community API adds reviewed
background contributions; see [community launch](community-launch.md). The existing FastAPI app remains available for local
collection, review and the full local dashboard.

## Install the skill

The standalone package needs only `skills/fundlark/`. The web app, database and
Python dependencies are not required. Copy the complete folder, including its
references and optional script, into one supported host location:

| Host | Personal skills | Project skills |
| --- | --- | --- |
| Codex | `~/.agents/skills/fundlark/` | `.agents/skills/fundlark/` |
| Claude Code | `~/.claude/skills/fundlark/` | `.claude/skills/fundlark/` |

For example, from this repository on macOS/Linux:

```bash
mkdir -p ~/.agents/skills
cp -R skills/fundlark ~/.agents/skills/
```

For Claude Code, use `~/.claude/skills` instead. Do not replace an existing
customized copy without reviewing it. Start a new host session. Ask Codex:

> Use $fundlark to find research funding for the project we've been discussing.
> Separate options I can apply for from those needing a faculty collaborator.

In Claude Code, `/fundlark` invokes the skill. Natural-language selection is also
host-dependent. The skill uses only context, memory and files the host makes
available; it cannot automatically read every previous conversation.

Live verification needs the host's web tools. The optional public federal API
helper runs with Python 3.9+ and standard-library modules only:

```bash
python3 skills/fundlark/scripts/search_federal.py --query "medical physics" --rows 10
```

No separate paid LLM/search API is bundled. The user's AI plan and any optional
tools they enable can still incur costs. A cloud AI provider may process CV or
conversation text supplied to that agent; this is not an offline-model guarantee.

## Update the public snapshot locally

Use the existing collection and review workflow, then export:

```bash
python -m app.jobs --federal --monitor --queries 'medical research,early career'
python -m app.publish
python scripts/package_skill.py
```

Inspect `docs/demo/data.json` before committing it. The export preserves each
record's source and verification dates, including uncertainty, and omits private
review notes and user-profile data. An export is not a fresh verification of the
whole catalog. Publish public metadata and concise summaries rather than full
third-party announcement text. Never commit the SQLite database or personal CVs.

Collection can be refreshed when the maintainer runs it. Nothing in the skill
continuously crawls on every user's behalf; no recurring job is installed by
default. Each user's agent can do an on-demand live check when asked.

## Preview the static demo

```bash
python scripts/package_skill.py
python -m http.server 8010 --bind 127.0.0.1 --directory docs/demo
```

Open `http://127.0.0.1:8010`. This serves static files: the preview searches
`data.json` in the browser, saves a local research profile, ranks matches and offers
a personalized assistant brief plus skill download. Sharing is unavailable unless
you connect the optional community API. It has no CV upload or account service.

## Publish on GitHub Pages

After a public repository exists and the reviewed files have been pushed:

1. In repository Settings → Pages, choose GitHub Actions as the publishing source.
2. Run the **Publish static demo** workflow from the Actions tab.
3. The workflow packages the skill and publishes only `docs/demo/`.

The workflow is manual; it does not collect data, use AI APIs or publish personal
files. It must be run again after a reviewed snapshot update. Public Pages is
available with GitHub Free subject to its limits; large data hosting and commercial
SaaS are outside this initial design. See [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
and [workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The published `data.json` URL can be supplied to Fundlark in a prompt. Until the
repository/demo is published, use a local snapshot or direct official sources.
