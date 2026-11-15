# Use Fundlark with your own AI assistant

Fundlark has two complementary experiences: a browser-based funding matcher and a
downloadable skill that works through the user's own agent. Neither requires a
central Fundlark server for matching. An optional community API adds reviewed
background contributions; see [community launch](community-launch.md). The existing FastAPI app remains available for local
collection, review and the full local dashboard.

## Install the skill

### Install with the skills.sh CLI

With Node.js 22.20 or later, open a terminal in the workspace you use with your assistant and run:

```sh
npx skills add dryang21/Fundlark --skill fundlark
```

Select your assistant if prompted. For an explicit choice, use `-a codex` or
`-a claude-code`. Add `-g` to make the skill available across your projects.
If npm asks to download the `skills` CLI, confirm to continue. See the
[installer documentation](https://github.com/vercel-labs/skills#install-a-skill),
including its [telemetry options](https://github.com/vercel-labs/skills#telemetry).

For catalog maintainers, install the separate skill with
`npx skills add dryang21/Fundlark --skill fundlark-maintainer`.

### Manual install from ZIP

[Download and unzip Fundlark-skill.zip](https://dryang21.github.io/Fundlark/Fundlark-skill.zip).
Copy the complete `fundlark` folder into one of these locations. The project
paths are relative to the folder you open in your assistant.

| Host | Personal skills | Project skills |
| --- | --- | --- |
| Codex | `~/.agents/skills/fundlark/` | `.agents/skills/fundlark/` |
| Claude Code | `~/.claude/skills/fundlark/` | `.claude/skills/fundlark/` |

If you cloned the repository, use the `skills/fundlark/` folder instead.
The skill does not require the web app, a database, or Python dependencies.

### Start a funding search

Start a new session in your assistant. Ask Codex:

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

To organize results in the browser, ask the skill to write or refresh a
`fundlark-library.json` in your workspace. Open **My funding → My application
tracker → Import funding library**. Reimporting an amended round updates its
source facts without replacing your notes, target date, or application progress.
Use **Download backup** to keep a private, restorable copy of the tracker.

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
