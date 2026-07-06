# {{systemName}} — [User's Name]'s Life Operating System

> KIT_VERSION: {{kitVersion}}
>
> This file was scaffolded by the Personal OS Starter kit. The sections under
> "Personal Context" below are filled in during setup (SETUP.md Section 16) from a
> short conversation about how you work. The "System Conventions" sections are the
> operating rules of the system and should be kept as-is unless you know why you're
> changing them. This is a living document — it evolves as you and your assistant
> work together.

---

## Voice

[Derived from the user's communication-style answers during setup — 3-4 sentences
defining the assistant's personality and tone.]

---

# Personal Context

*Filled in during setup. Edit anytime.*

## Who You Are

[Synthesized from setup answers — brief biographical context relevant to the system.]

## The Big Picture

[The user's priorities and the main tension they are navigating right now.]

## How You Work

[Work patterns, what unblocks them, what blocks them.]

## What NOT to Do

[Derived from communication preferences and pet peeves.]

---

# System Conventions

*These are the operating rules of the system. Keep them unless you have a specific
reason to change them — your assistant relies on them on every vault touch.*

## Operating Philosophy

- **Sessions, not an eternal chat.** Don't run one giant conversation forever.
  A session is a bounded unit of work, bookended by `/letsgo` (load context)
  and `/handoff` (capture what happened). Start fresh sessions per unit of
  work; let context carry forward through handoffs, not through an
  ever-growing thread.
- **Run 3-6 active projects, not thirty.** Each project is its own directory
  with its own `CLAUDE.md`, git history, and shell alias. More than a
  handful and you stop actually finishing things.
- **Everything you route through the system is a deposit in a compounding
  record.** Handoffs, rituals, vault edits — each one is context that
  doesn't have to be re-explained next time. The more you route through it,
  the more it knows, and the better it gets. There's no penalty for using it
  on something small.
- **Skills and hooks are how you multiply your own leverage.** Write a
  pattern down once as a skill instead of re-explaining it every session.
  The time it takes to write it pays for itself the second time you would
  have re-explained it by hand.
- **The juice has to be worth the squeeze.** Not everything needs
  automation. Before you build a hook, a skill, or a scheduled job for
  something, ask whether it's actually worth the setup cost. A once-a-year
  task doesn't need a script. A daily one probably does.
- **Hooks and scheduled agents are seeds you plant once.** A well-placed
  guardrail or a nightly job keeps paying off in the background without you
  thinking about it again. That's the whole point of building them.
- **This kit doesn't wire in third-party agent-orchestration frameworks.**
  Claude Code plus hooks plus skills is enough. Simplicity beats stacking
  frameworks on top of frameworks — that's a deliberate choice, not a gap.
- **Your task manager holds dated commitments only** — things you said
  you'd do by a date. Everything else, the backlog, lives in your knowledge
  base instead. The date, not the project, is the organizing principle for
  what belongs in a task system at all.
- **Report "I couldn't" and "I chose not to" as the different things they
  are.** A discretionary skip is not a failure. When a step has an escape
  hatch and you take it, say you took it and why ("no vault configured, so I
  skipped that") — don't phrase a deliberate choice as an inability ("that
  folder doesn't exist"), which reads as a hard block when nothing was blocked.
  Same rule in reverse: don't dress up a real failure as a choice.
- **This system worked daily for three months before it became what you're
  looking at now.** Yours will evolve the same way. Don't expect it to be
  finished on install day — expect it to grow the more you actually use it.

## Vault Structure

```
00-inbox/      ← Frictionless capture landing zone
01-buckets/    ← Life areas (work and personal), each with a manifest file
02-knowledge/  ← Cross-bucket topic notes (the connective tissue of the graph)
03-resources/  ← Templates, frameworks, reference material
04-archive/    ← Completed or decayed items
05-system/     ← System operations (routing table, daily notes, registries)
06-self/       ← Self-knowledge (working patterns, decisions, energy)
```

Filesystem-to-command mapping: a file at `~/.claude/commands/morning.md` becomes the
`/morning` slash command. Skills live under `.claude/skills/`.

## Rituals

- `/morning` — 5-10 minutes. Orient and go. NOT where triage happens.
- `/shutdown` — 3-5 minutes. Close the day, set tomorrow's first task.
- `/weekly` — the anchor review. Bucket audit, commitment integrity, system
  health, the focusing question, calendar design for the week ahead. Ships
  with no fixed schedule — pick your own cadence (a recurring Friday
  afternoon or Sunday evening slot works well for most people) and put it on
  your own calendar. Nothing in the kit triggers it automatically.

`/midday` is not shipped. It's a pattern some people add later — a
middle-of-day ritual that clears input and resets afternoon priorities, once
morning starts feeling crowded with triage that doesn't belong there. Model
it on `/morning`'s structure if you build it.

## Wiki-Link Conventions

Obsidian's graph draws edges only from `[[wikilinks]]`, not from prose or tags. The
graph is what makes the vault more than a folder of notes — so linking discipline is
the single highest-leverage habit.

- Use **shortest-path** format: `[[filename|Display Name]]`. Do NOT use full paths.
  - Bucket manifest: `[[finances|Finances]]`
  - Person file: `[[jane-doe|Jane Doe]]`
  - Knowledge file: `[[budgeting-strategy|Budgeting Strategy]]`
- All vault filenames are unique, so shortest-path always resolves correctly, and it
  survives folder restructuring (full paths break).
- **Links must be bidirectional** — if file A links to B, B should link back to A
  somewhere (in the manifest or a connected file).
- When you mention a person, project, company, or topic that already has a file in
  the vault, **wrap it in a `[[wikilink]]`** rather than leaving it as plain prose.

The `.obsidian/app.json` shipped with this vault pins `newLinkFormat: shortest` and
`useMarkdownLinks: false` so new links you create follow this convention by default.

## Person-File Wikilink Convention

**Every `type: person` file must contain at least one outgoing `[[wikilink]]` to a
bucket, project, or another person.** No person is context-less — if they are in the
vault, they connect to something.

**Why:** A person-file that describes someone's connection in prose but never wraps
the referenced entity in `[[ ]]` shows as an isolated node in Graph View, and graph
traversal (backlinks, outgoing links) returns nothing — the person becomes findable
by keyword search but invisible to anything walking the graph.

**Where to place the link:** usually in a `## Connection to X` section, wrapping the
referenced entity: `[[acme-corp|the Acme partnership]]`. The reverse link should also
exist somewhere in the connected entity's file.

## Frontmatter Convention

All active content files (01-buckets, 02-knowledge, 03-resources) should carry:

- `description:` — a one-line label of what the file IS (not a summary).
- `topics:` — 3-8 semantic search terms that bridge vocabulary gaps so the file is
  findable even when you search with different words than the prose uses.

## Timezone

[Filled during setup from `config/user-config.json`'s `timezone` field — the
timezone your system detected on this machine.] All dates and times you surface
(calendar events, deadlines, "today," "tomorrow") should read in this timezone.
Don't assume any specific region's clock — `date` and the calendar wrapper already
return machine-local time, so this is usually automatic, but call it out explicitly
if you're ever converting a time mentioned in an email or a message from someone in
a different timezone.

## Tools — CLI-primary, MCP-fallback

[List of configured tools during setup — gws accounts, calendar wrapper, task system,
installed plugins.]

**Google Workspace:** the `gws` CLI is **PRIMARY** for all Gmail and Calendar work.
The Google MCP connector is a **strict fallback**, used only when a corporate
Workspace domain is admin-locked and the `gws` OAuth flow is blocked by policy. Do
not route ritual email/calendar steps through MCP when `gws` is available, and ignore
the unrelated `gws-mcp` npm package. This rule applies in every ritual's triage step.

**Web search:** the built-in `WebSearch` tool is the **default** for everything —
looking things up, checking a fact, researching a topic. No MCP web-search or
web-scraping tool gets to make itself primary just because it's installed; if one
is present, it's a specialist for jobs the default can't do (bulk scraping, full-site
crawls, structured extraction), not a replacement for a plain search. For reading a
single page, try a direct fetch first; if a page is JS-heavy or blocks fetching,
fall back to Jina Reader (`curl -s https://r.jina.ai/<URL>` — free, no key needed at
normal rates).

## Canonical People Index

`05-system/name-registry.jsonl` is the canonical index of known people. Consult it
before treating a mentioned person as new. See `05-system/routing-table.md` for the
full input-lifecycle map.
