@AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on `venturinodino-creator/ai-job-finder` (use the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.

## Feature workflow

New features and sizeable changes follow Matt Pocock's flow, in order:

1. `grill-me`: interview the user until the plan has no open branches.
2. `to-spec`: publish the agreed spec as a GitHub issue.
3. `to-tickets`: break the spec into tracer-bullet tickets with their blocking edges.
4. `implement` / `implement-spec`: build ticket by ticket, test-first (`tdd`).

Most of these skills are user-invoked only; when the user asks for a feature without typing them, read each skill's `SKILL.md` in `~/.claude/skills/` and follow it.

Stay direct, without the flow, for bug fixes, small tweaks, copy changes, verification requests and housekeeping. For a hard bug use `diagnosing-bugs`.

Do not run `git-guardrails-claude-code` or `setup-pre-commit` unless the user asks: both change how git behaves for every session working in this repo.
