---
name: handoff
description: Create a handoff document at the end of a meaningful working session so the next Claude Code session on this project picks up with full context. Writes a dated, project-prefixed markdown file in the project root. Adapts structure based on what actually happened in the session. Use when the user says "/handoff", "let's wrap up", "save state", "write a handoff", or at any natural stopping point in a working session.
---

# Handoff — Session-End Continuity

Write a handoff document capturing the important context from this session so
the next session on this project can pick up warm. The job is continuity —
everything in the handoff exists to let the future session resume without
re-explaining what happened.

## Step 1 — Detect Project and Version

Determine the project name (directory basename from `pwd`) and the next
handoff version number.

Search the project root for existing handoffs matching `*HANDOFF*.md`. Find
the highest version number (`v01`, `v02`, `v03`, ...) and increment by one.
If no prior handoffs exist, start at `v01`.

Filename convention: `[project]_HANDOFF_v##.md` in the project root.
Examples: `my-project_HANDOFF_v04.md`, `client-site_HANDOFF_v01.md`.

The project prefix is part of the filename from creation — not added later
during routing. This keeps naming unambiguous everywhere the file lives.

## Step 2 — Gather Session Context

Pull in parallel:

**From the conversation:**
- What work actually happened (writing, building, deciding, discussing)
- Any decisions that were explicitly named and agreed
- Questions that came up and didn't get resolved
- New patterns or conventions established that future sessions should honor
- Whatever the user said they'd do next (if stated)

**From git:**
```bash
git log --since="[last handoff timestamp, or project creation]" --oneline
git diff --stat HEAD [last-handoff-commit]
```

Changed files tell you what was actually built this session, independent of
what the conversation focused on.

**From the last handoff (if one exists):**
- Read the most recent `*HANDOFF*.md` in the project
- Note what open threads it flagged — some may be resolved now, some still open
- Note what "next move" it predicted — was it done? Deferred? Overtaken?

## Step 3 — Decide Which Sections to Include

The handoff uses adaptive sectioning. Include a section only if it has real
content — no hollow placeholders.

**Always include:**
- Title line (project name + version)
- Date
- Session summary (2-5 sentences, concrete)
- Next move (even if it's just "pick up where we left off")

**Include if content exists:**
- **Decisions made** — genuine agreed decisions from this session
- **Open threads / pending** — things that were raised but not resolved
- **Established conventions** — new ways of working that future sessions should honor
- **Notable file changes** — if significant code/docs were produced, list them
- **Context carried forward** — state from prior handoffs that's still relevant

**Skip the section entirely** if you'd otherwise write "none" or leave it blank.

## Step 4 — Write the Handoff

Markdown structure. Short paragraphs, specific items, scannable.

```markdown
# [Project Name] Handoff v##

**Date:** [YYYY-MM-DD, time of day]

## Session Summary

[2-5 sentences. What actually happened this session. Concrete. Not "made progress
on X" — say what, how far, and what shifted.]

## Decisions

[Only if real decisions were made. Bullet list. Format: short title, one-line
reason.]

- **[Decision]** — [why]

## Open Threads

[Only if things are unresolved. Bullet list. What's waiting, on whom/what.]

- [Item] — [status, next action]

## Next Move

[One or two sentences. The concrete first thing to pick up next time.]

## Notable Files

[Only if this session produced substantial file changes worth pointing at.
Short list. One line each.]

- `path/to/file.md` — [what's in it or what changed]
```

## Step 5 — Vault Integration (if vault exists)

After writing the handoff to the project root, copy it to the vault's
processed inbox for cross-project visibility:

1. Copy to `~/[vault]/00-inbox/processed/` with the project name prepended:
   `{project-name}_HANDOFF_v##.md`
2. Extract durable content (decisions, status changes, new context) and route
   to the appropriate vault locations (bucket manifests, knowledge files, etc.)
3. Add `[[wiki-links]]` in both directions for any people or projects mentioned

If the vault doesn't exist or the user hasn't set one up yet, skip this step.

## Step 6 — Save and Report

Write the file to the project root and report:

> Handoff saved: `my-project_HANDOFF_v04.md`
>
> [One-sentence summary so the user can confirm it captured the right things.]

Suggest a git commit if the project is a git repo and the handoff + session
changes warrant it.

## Rules

- **Continuity is the job.** Every decision about what to include should be
  answered by "will the next session need this?" If yes, include. If no, skip.
- **Facts over flavor.** What happened, what was decided, what's next. No
  editorializing, no "great progress today!" language.
- **Specific over general.** Name the actual files, actual decisions, actual
  next steps. "Worked on the project" is useless — "drafted the landing page
  hero section, settled on blue gradient" is useful.
- **Match the project's scale.** A first-session handoff might be 20 lines. A
  mid-project handoff might be 100. That's normal and correct. Don't pad.
- **Never invent context.** If you can't verify something from the conversation,
  git, or prior handoffs, don't include it.
- **One handoff per session.** Don't create multiple handoffs in a single
  working session unless explicitly requested.
