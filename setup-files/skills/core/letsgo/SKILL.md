---
name: letsgo
description: Bootstrap a new Claude Code session with full project context. Run at the start of every session. Loads the latest handoff for the current project, checks git state, and delivers a concise status report so you arrive informed about recent history. Use when the user says "/letsgo", "let's go", "catch me up on this project", or opens a new session on a project they've worked on before.
---

# Let's Go — Session Bootstrap

This is a mechanical loader, not a ritual. Load context and report ready.

## Step 0 — System Health (Vault only)

If the current working directory is the user's vault (check for `.obsidian/` directory or match against the system name from config), run `system-health` and capture the output. Parse it for any stale components.

- **All green:** say nothing about it. Silence means healthy.
- **One or more stale:** add a single line to the status output: `System health: [N] stale — [names]`. Don't elaborate unless asked.

Skip this step for non-vault directories (system-health is vault-scoped).

## Step 1 — Detect Project Context

Run `pwd` to determine where you are. Then classify:

- **Vault** (the user's system vault): Full load with vault-specific context.
- **Known project** (`~/projects/*`): Load project-local context.
- **Unknown directory**: Handoff + git state only. No assumptions.

Store the project name (directory basename) for the status output.

## Step 2 — Git State

Run these in parallel:
```bash
git status --short 2>/dev/null
git log --oneline -5 2>/dev/null
git branch --show-current 2>/dev/null
```

Note: uncommitted changes, current branch, and what the last 5 commits were. This is the sense of "what just happened here." If not a git repo, skip silently.

## Step 3 — Load Latest Handoff

Collect ALL handoff candidates from every location, then pick the single highest-versioned file. Do NOT stop at the first location that has a match.

**Search locations (scan all):**
1. Project root directory + local `handoffs/` subdirectory — match `HANDOFF*.md` or `WORKLOG*.md`
2. Vault `00-inbox/processed/` — match files prefixed with the project name (e.g., `my-project_HANDOFF_v03.md`)
3. Vault `00-inbox/processed/` — also check for cross-project handoffs if the project name has a parent prefix

**Version extraction:** Parse the `_v<number>` suffix from each filename, accepting **any digit width** — current files are four-digit zero-padded (`HANDOFF_v0088.md`) but legacy files may still be two-digit (`HANDOFF_v87.md`), and both can coexist in one project during the transition. Local files use `HANDOFF_v####.md`; vault processed inbox uses `{project-name}_HANDOFF_v####.md`. Extract the numeric value (strip leading zeros) from either pattern and any width, and compare **numerically** — never lexically — across all matches so `v0088` correctly outranks `v87`.

**Pick the single highest version number regardless of which location it came from.** Read that file. Do NOT load multiple handoffs — the newest should contain everything relevant.

**Staleness check:** Compare the handoff's date against the most recent git commit. If there are commits after the handoff was written, note how many: "3 commits since handoff — context may be partially stale."

**No handoff found:** Say "No handoff found — starting fresh." and move on. Do not block.

## Step 4 — Project-Specific Context

**For the vault:**
- Read the vault's `CLAUDE.md` if it exists
- Scan `00-inbox/` root for unprocessed files (not `processed/`, not `signals/`). If found, flag: "Unprocessed inbox item: [filename]"

**For known projects (`~/projects/*`):**
- The project's `CLAUDE.md` auto-loads via Claude Code — no need to read it again
- Check for a `WORKLOG*.md` or `TODO.md` in the project root

**For unknown directories:**
- Skip this step entirely.

## Step 5 — Upstream Context (Bucket Manifest)

If the project's CLAUDE.md references a vault bucket manifest (look for a path like `~/[vault]/01-buckets/[bucket]/[bucket].md`), **read that manifest now.** It holds current state, active threads, and recent decisions that may not be in the project's local handoffs.

If no bucket manifest is referenced, skip this step.

## Step 6 — Lazy References (Progressive Disclosure)

Do NOT read these files at boot. Hold them as known locations the agent can access when the conversation needs them:

- **Today's daily note:** `~/[vault]/05-system/daily/YYYY-MM-DD.md` (use actual today's date)
- **Google Calendar:** Run the calendar wrapper command when schedule context is needed
- **Task list:** Query the user's task system when task context is needed

These cost zero tokens at boot. The agent reads them on demand.

## Step 7 — Status Output

Present a status block with a short paragraph summarizing the last session. No headers, no bullets, no wall of text. Format:

```
Loaded: [handoff name] ([age]) · [N] commits since · branch: [branch] · [uncommitted changes status]
Project: [project name]
[System health: N stale — names]   <- only if vault AND stale components exist
[Next ritual: /morning | /shutdown]   <- only if vault; pick based on time

[One paragraph summarizing what happened in the last session — the key threads,
what was accomplished, what decisions were made, and where things left off. Write it so
someone picking up cold understands the state of play. 3-5 sentences, not a bullet
point. Pull from the handoff's session summary and decisions log.]

Ready. What are we working on?
```

**Ritual pointer logic (vault only):**
- Before 5:00 PM local time -> `Next ritual: /morning` (unless today's daily note already shows morning priorities filled in, in which case omit the pointer — nothing else is due yet)
- After 5:00 PM -> `Next ritual: /shutdown`

This is informational — do not suggest running the ritual, just surface which one is contextually next.

## Rules

- **Speed over thoroughness.** This should feel instant. No API calls at boot unless absolutely necessary. Git commands and file reads only.
- **Never suggest priorities.** That is `/morning`'s job. `/letsgo` loads context; the user decides what to work on.
- **Never block on failure.** Missing handoff, missing git, missing files — degrade and continue. Always reach "Ready."
- **Don't repeat what CLAUDE.md already provides.** Working style, behavioral rules, and tool configurations auto-load. Don't duplicate them.
- **Handoff is the most critical artifact.** If only one thing loads successfully, it should be the handoff.
- **The agent should arrive informed about recent history, not opinionated about what to do next.**
