---
name: handoff
description: Create a handoff document at the end of a meaningful working session so the next Claude Code session on this project picks up with full context. Writes a dated, project-prefixed markdown file in the project root, then routes durable content into the vault. Adapts structure based on what actually happened in the session. Use when the user says "/handoff", "let's wrap up", "save state", "write a handoff", or at any natural stopping point in a working session.
---

# Handoff — Session-End Continuity

Write a handoff document capturing the important context from this session so
the next session on this project can pick up warm. The job is continuity —
everything in the handoff exists to let the future session resume without
re-explaining what happened.

The handoff is also what makes your system's memory compound: every handoff
routes durable content into the vault and links it, so the graph gets richer
each time you close a session. Because that value only accrues if you actually
run handoffs, this skill is built to be **fast and cheap** — the writing that
needs judgment stays on your main model, and the mechanical vault routing is
delegated to an affordable model (see Step 6). Don't skip handoffs to save
time; they're built not to cost much.

## Step 1 — Detect Project and Version

Determine the project name (directory basename from `pwd`) and the next
handoff version number.

Search the project root for existing handoffs matching `*HANDOFF*.md`. Find
the highest version number (`v0001`, `v0002`, `v0003`, ...) and increment by
one. If no prior handoffs exist, start at `v0001`. Always render the number
zero-padded to **four digits** so filenames sort correctly in any listing. If a
project's existing handoffs use the legacy two-digit format (e.g. `v87`), keep
incrementing the number and render it four digits wide (the next is `v0088`) —
don't restart the count and don't renumber the old files.

Filename convention: `[project]_HANDOFF_v####.md` in the project root.
Examples: `my-project_HANDOFF_v0004.md`, `client-site_HANDOFF_v0001.md`.

**If the current directory IS the vault** (it contains `.obsidian/`, or matches the
system name in the vault `CLAUDE.md`), the handoff's home is
`00-inbox/processed/` — write it there directly as `[systemName]_HANDOFF_v####.md`,
search that folder for the version count, and skip the copy in Step 6.1 (the file
is already where it belongs). Do not leave handoffs loose in the vault root.

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

## Step 3 — Verify Only This Session's Claims

Before writing, sanity-check the facts you're about to record — but **scope the
verification to what changed this session.** Verify a claim against a live
source (the code, a config file, a tool's actual output) when this session
created or changed it. For anything carried forward unchanged from the prior
handoff, **trust the prior handoff** — do not re-verify the whole world every
run. Re-verifying untouched state is the main reason handoffs feel slow, and it
buys almost nothing. Verify the delta, not the history.

Carried-forward items are **attributed prior state**, not freshly confirmed
fact — record them as "carried forward from the last handoff," not as verified
current status. If something you saw *this* session contradicts the prior
handoff, live evidence wins: use what you observed and note the discrepancy.

## Step 4 — Decide Which Sections to Include

The handoff uses adaptive sectioning. Include a section only if it has real
content — no hollow placeholders.

**Always include:**
- Title line (project name + version)
- Date
- Session summary (2-5 sentences, concrete)
- Next move — a concrete first action. If none was agreed, don't pad with
  "pick up where we left off"; state plainly that no next action was decided and
  name the specific question or decision needed to determine one.

**Include if content exists:**
- **Decisions made** — genuine agreed decisions from this session
- **Open threads / pending** — things that were raised but not resolved
- **Established conventions** — new ways of working that future sessions should honor
- **Notable file changes** — if significant code/docs were produced, list them
- **Context carried forward** — state from prior handoffs that's still relevant

**Skip the section entirely** if you'd otherwise write "none" or leave it blank.

## Step 5 — Write the Handoff

Markdown structure. Short paragraphs, specific items, scannable.

```markdown
# [Project Name] Handoff v####

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

[One or two sentences. The concrete first thing to pick up next time. If no next
action was agreed, say so and name the decision needed to set one — don't write
a filler line.]

## Established Conventions

[Only if new conventions were set this session — naming, structure, workflow,
tone. Bullet list, one line each.]

- **[Convention]** — [what it is]

## Context Carried Forward

[Only if prior-handoff state is still relevant. Mark it as carried forward, not
re-verified.]

- [Item] — carried forward from v#### [status]

## Notable Files

[Only if this session produced substantial file changes worth pointing at.
Short list. One line each.]

- `path/to/file.md` — [what's in it or what changed]
```

Write the file to the project root before moving on. **This authoring step —
Steps 1-5 — stays on your main session model**; capturing decisions and their
rationale accurately is the part that needs judgment.

## Step 6 — Vault Integration (delegate to an affordable model)

If a vault exists, its routing is mechanical work — copy the file, extract
durable content, place it, link it. Delegate this to a **sub-agent on an
affordable model with quick (low-effort) thinking**, not your main model. The
cleanest way to pin both model and effort is a one-agent workflow step with
`{ model: 'sonnet', effort: 'low' }`; a plain sub-agent on an affordable model
also works but inherits the session's thinking level. Use Sonnet-class, not the
cheapest tier — routing needs enough judgment to place content correctly and
avoid duplicates.

**Fallback:** if this environment can't pin a model/effort or spawn a sub-agent
at all, don't stall — run the routing steps below inline on your main model.
Delegation is an optimization, not a requirement; correct routing matters more
than which model does it.

Hand the sub-agent this task (give it explicit boundaries: it may write only to
the `processed/` copy, clearly-matched entity notes, and `pending-links.md` — it
must not edit anything else, delete content, or overwrite unrelated files):

1. Copy the handoff to `~/[vault]/00-inbox/processed/`. The filename already
   carries the `{project-name}_HANDOFF_v####.md` prefix from Step 1 — keep the
   basename **unchanged**; do not prepend the project name a second time. If
   `00-inbox/processed/` doesn't exist yet but the vault does, create it
   (`mkdir -p`) — a missing subfolder is a normal first-run state, not a reason
   to skip. If a file with that exact name already exists, don't overwrite it —
   the version was already allocated; re-check Step 1's version count.
2. Extract durable content (decisions, status changes, new context) and route
   it to the appropriate vault locations (bucket manifests, knowledge files,
   etc.). Extract the durable insight; discard operational detail.
3. Wikilink by confidence — see the tiered rule below.

Only skip vault integration when there is **no vault at all**. A vault that
exists but is missing the `processed/` subfolder is NOT a reason to skip —
create the folder and proceed. When you do skip, report it as a deliberate
choice ("no vault configured, so I skipped vault integration"), never as an
inability.

**Verify before you report.** When the sub-agent returns, have it hand back a
short summary — files it touched, link counts, anything it queued, any errors —
and glance at it before reporting success. Don't claim routing happened that you
haven't confirmed. Routing can partially fail (copy succeeded, linking didn't);
report what actually landed, not what was attempted. The root handoff written in
Step 5 is the source of truth and must survive regardless — a vault-routing
failure never deletes or corrupts it; if routing fails, say so and the routing
can be retried without rewriting the handoff.

### Wikilinking — by confidence, never blind

Never blind-link. Auto-fabricating a `[[link]]` to the wrong entity is worse
than no link, and it's hard to unwind. This rule covers entities that have (or
should have) their own vault note — people, projects, companies, clients, and
the like; other link types follow your vault's local conventions. Sort each into
one of these outcomes:

1. **Confident existing match → link now.** A single vault note is clearly this
   entity. "Clearly" means more than a filename that looks similar — confirm via
   frontmatter aliases and contextual fit (same person/project, not a homonym or
   a same-named other). When it's that unambiguous, add the `[[wikilink]]` in
   both directions immediately, at handoff time (append the backlink to the
   entity note's references/activity section; don't edit its structured body).
   This is the bulk of links, and it's why fresh content is graph-accessible the
   moment the session closes — that immediacy is the whole point, don't defer it.
2. **Ambiguous existing match → queue.** More than one note could be it, or you
   can't confirm identity. Do NOT guess. Queue it (format below) for confirmation.
3. **Confirmed new entity → queue as a note-creation candidate.** No note exists
   and it clearly merits one. Don't silently invent it mid-routing — queue it so
   you decide deliberately whether to create the note.
4. **Incidental mention → leave as plain text.** No durable value; don't link,
   don't queue.

For tiers 2 and 3, append to `~/[vault]/05-system/pending-links.md` (create the
file/dir if missing; skip if an identical entry is already queued):
```
- [ ] `[entity as written]` in `[source file, with the sentence/context]` — [ambiguous: candidates file-a, file-b | new entity, no match]
```
Your next `/letsgo` surfaces this file (`Pending links: N to confirm`), and so do the
morning/shutdown rituals once they are installed — you confirm the handful of queued
items in seconds, same day, not next week.

**Backstop (not a guarantee).** If your system runs a weekly vault-maintenance
sweep that flags orphaned/unlinked entities, it catches stragglers — but only if
that sweep is actually configured. Treat it as a secondary net, not a promise:
the queue in tier 2/3 is the real safety mechanism, so anything you can't link
confidently must land there, not rely on a sweep that may not exist.

This keeps confident links instant and everything else explicitly queued —
without ever guessing at the wrong entity.

## Step 7 — Save and Report

Report:

> Handoff saved: `my-project_HANDOFF_v0004.md`
>
> [One-sentence summary so the user can confirm it captured the right things.]
> [If vault integration ran: "Routed to the vault; N links added, M queued for
> your confirmation." If any pending links: name where they're queued.]

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
- **Never blind-link.** Confident links only; ambiguous ones get queued, not
  guessed.
- **One handoff per session.** Don't create multiple handoffs in a single
  working session unless explicitly requested.
