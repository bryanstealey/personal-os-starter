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

`/midday` (clear all inputs, reset the afternoon) and `/weekly` (strategic review)
are planned additions — add them when you want a heavier triage and review cadence.

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

## Tools — CLI-primary, MCP-fallback

[List of configured tools during setup — gws accounts, calendar wrapper, task system,
installed plugins.]

**Google Workspace:** the `gws` CLI is **PRIMARY** for all Gmail and Calendar work.
The Google MCP connector is a **strict fallback**, used only when a corporate
Workspace domain is admin-locked and the `gws` OAuth flow is blocked by policy. Do
not route ritual email/calendar steps through MCP when `gws` is available, and ignore
the unrelated `gws-mcp` npm package. This rule applies in every ritual's triage step.

## Canonical People Index

`05-system/name-registry.jsonl` is the canonical index of known people. Consult it
before treating a mentioned person as new. See `05-system/routing-table.md` for the
full input-lifecycle map.
