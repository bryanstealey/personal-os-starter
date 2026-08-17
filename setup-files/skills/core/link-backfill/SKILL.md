---
name: link-backfill
description: Repair an Obsidian vault whose graph never formed — backfill missing bidirectional wikilinks across existing notes that were written before forward-linking worked, or while handoff routing was dead-ending. Diagnoses first and stops if the graph is already healthy, so it is safe to run on any vault. Never blind-links; ambiguous matches are queued for human confirmation, never guessed. Use when the user says "/link-backfill", "my Obsidian has no connections", "my graph is just disconnected dots", "backfill my wikilinks", "repair my vault graph", or when an agent notices a content-rich vault with almost no links.
---

# Link Backfill — Repair a Graph That Never Formed

Some vaults end up full of notes but nearly empty of links: the Obsidian graph
shows a cloud of disconnected dots instead of a web. This almost always means
notes were written during a period when **forward-linking wasn't running** — an
install that predates the linking fix, or a handoff routing step that was
silently dead-ending. New content never got linked, and nothing ever went back
to fix the old content.

This skill does the one thing the handoff skill can't: it walks the notes that
**already exist** and backfills the bidirectional wikilinks they should have had
all along. The handoff skill links content going *forward*, at write time. This
links everything that was written *before* that started working.

## When this skill does NOT apply

Run the diagnosis in Step 1 before doing anything. If the graph is already
healthy, **stop and tell the user they don't need this skill.** A vault that
links as it goes doesn't need a backfill, and running one anyway just adds noise
and churn. This skill is self-limiting on purpose — an agent handed this file
should be able to determine "this won't help you" and move on.

## The one rule that matters most: never blind-link

Auto-fabricating a `[[link]]` to the wrong entity is worse than no link at all,
and it is hard to unwind at scale. This skill links **only** when the target is
unambiguous. Everything uncertain gets **queued for human confirmation**, never
guessed. When in doubt, queue it — do not link it. This is non-negotiable; a
backfill that guesses wrong across hundreds of files does real damage.

---

## Step 1 — Diagnose (always first)

Quantify the problem before touching anything.

1. Enumerate the vault's content notes — the areas that should be richly linked
   (buckets/life-areas, knowledge notes, resources, people files). Skip
   `.obsidian/`, archive, system logs, and templates.
2. For each, count outgoing `[[wikilinks]]`. If the vault ships an `ob` CLI,
   `ob lns` surfaces person-files with zero outgoing links — a fast signal.
3. Compute rough link density: what fraction of content notes have **zero**
   outgoing links, and the median links-per-note.

**Decision:**
- If most content notes already carry links (healthy web) → **stop.** Report:
  "Your graph looks healthy — [N] of [M] notes are linked. You don't need a
  backfill." Done.
- If a large fraction have zero links (disconnected dots) → continue. Report the
  numbers so the user sees the scale of what's about to change.

## Step 2 — Checkpoint before mutating

This skill edits many files at once. Make the whole pass reversible:

1. Confirm the vault git tree is clean. If it's dirty, commit or stash first —
   you want the backfill to be its **own** isolated commit.
2. Do a **dry run first** (Steps 3–4 in report-only mode): produce the full list
   of links it *would* add and *would* queue, and show the user, before writing
   anything. Only apply once they've seen the scale.
3. When applying, commit the result as one commit (e.g. `link-backfill: N links
   added across M files`) so it can be reverted wholesale if anything looks off.

## Step 3 — Build the entity index

The set of linkable targets is every existing note in the vault (vault filenames
are unique by convention, so a filename resolves unambiguously).

1. List every note filename (without `.md`) → its display name.
2. Add known aliases from frontmatter (`aliases:`, `title:`) as alternate surface
   forms pointing at the same target.
3. Note which targets are "distinctive" (full proper names, multi-word project
   names) vs. "risky" (common words, first-names-only, short tokens). Risky
   surface forms are the ones that most often produce ambiguous matches in
   Step 4.

## Step 4 — Walk each content file and classify by confidence

For each content note, scan its prose for surface forms from the index. For each
candidate mention, sort it into exactly one tier — the same tiers the handoff
skill uses:

1. **Confident, unambiguous match → link now.** A single distinctive target
   clearly matches (e.g. the full name of a person who has exactly one note, an
   exact project name). Add the `[[filename|Display Name]]` inline at the mention
   **and** append a backlink in the target note (bidirectional — usually in a
   "Connections" or "Related" section). This is the bulk of the work.
2. **Ambiguous → queue, do not link.** Multiple possible targets, a first-name
   that could be several people, a common word that happens to match a filename,
   a partial match. Append to `~/[vault]/05-system/pending-links.md` (create it
   if missing) with the file, the mention, and the candidate targets, for the
   user to confirm at their next shutdown/morning. **Never link a tier-2 item.**
3. **Entity has no note → suggest, don't fabricate.** The mention names a real
   person/project/topic with no note yet. Note it as a "consider creating"
   suggestion in the queue. Do not create `[[links]]` to non-existent notes as a
   way to stub them unless the vault's own convention explicitly does this.
4. **Incidental mention → leave as plain text.** No durable linking value; don't
   link and don't queue.

**Idempotency:** never wrap text that is already inside a `[[ ]]`. Skip any
mention already linked. The skill must be safe to run more than once — a second
run on an already-backfilled vault should add nothing.

## Step 5 — Scale it cheaply

The per-file scan is mechanical, high-volume work — a good fit for delegation.
Orchestrate with your planning model and fan the per-file scanning out to
cheaper models (Sonnet/Haiku), each returning a structured list of
{file, mention, target, tier} for one batch of files. The orchestrator dedupes,
applies the confident links, writes the queue, and commits. This keeps a
large-vault backfill fast and inexpensive without lowering the judgment bar on
the confident/ambiguous split — the tiering rule travels in each sub-agent's
instructions.

## Step 6 — Report

Tell the user, plainly:
- Links added and files touched (the applied, bidirectional, confident links).
- How many items were **queued** to `pending-links.md` and where to confirm them.
- Any "consider creating" entity suggestions.
- The commit to revert to if they want to undo the whole pass.

Then remind them that going forward, the **handoff skill** keeps the graph
current at write time — this backfill is a one-time catch-up, not a recurring
chore. If they run it again later and Step 1 reports a healthy graph, that's the
system working.
