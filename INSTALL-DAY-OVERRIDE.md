# Install-Day Override — every install (read BEFORE SETUP.md)

**To the agent running this install:** this file overrides SETUP.md wherever they conflict.
It holds the week-one rules for every client. A client whose accounts are ALL Microsoft 365
also gets `INSTALL-DAY-OVERRIDE-2026-09-02.md` (the Microsoft + PC field sheet); where that
sheet and this file conflict, the Microsoft sheet wins for that client.

**Week one is deliberately small: one right-hand agent, no project agents, and TWO commands —
`/letsgo` and `/handoff`. No daily rituals this week.** (Feedback from earlier installs: three
rituals on day one overwhelmed people. The installer adds rituals in a later session, once the
letsgo/handoff loop is a habit.)

## Pre-work the client may already have done (check, never assume)

Clients get a prep email before install day. Any of it may be done, half done, or not done.
All three are fine. Check what exists and pick up from there without comment:

- `command -v claude jq node git brew` and `ls /Applications | grep -i -E 'ghostty|obsidian'`
  — if the one-line bootstrap ran, Section 0 is verify-only.
- `ls ~/personal-os-installer/config/user-config.json` — if missing, look in `~/Downloads`
  and copy it in; if there is no config at all, the installer brought one or you build it
  with the client from the web wizard.
- `ls ~/Downloads/*.md` — Claude project write-ups the client saved for import. Hold them
  for Section 16/17 population.

## Order of the day

**Google comes first.** Connecting several Google accounts is the longest job of the day.
Right after Section 1, run **Sections 12 and 13**, then return to Section 2 and continue in
order. Section 12's step 3b (publish the Google app to Production) is never skipped — a
Testing-mode app's sign-ins die 7 days later.

## Skips for week one (do not run, do not mention as failures)

| Section | Why |
|---|---|
| **3 — `new-project` skill** | Week-two item. Install letsgo, handoff, obsidian-markdown, link-backfill only. Copy line for link-backfill: `cp -R setup-files/skills/core/link-backfill ~/.claude/skills/link-backfill`. |
| **11 — lookup-before-asking hook** | It blocks any reply containing "can you paste," which the client needs this week. Install the rest. |
| **15 — Rituals** | Not installed this week. Don't copy morning.md, shutdown.md or weekly.md. |
| **20 — Business/personal separation** | One agent. |
| **21 — First project** | Project agents start in week two, on the client's request. |
| **22 — Multi-pane + first ritual** | One pane, one agent. The day ends on `/handoff`. |
| **23 — GitHub backup + nightly script** | Run the `git init` + first commit only. A GitHub remote and the nightly backup happen only if the installer says so in the room. |
| **24 — System health** | Skip unless the installer turned on the nightly backup in Section 23. |

## Words and fixes

- Section 0: if the bootstrap already ran, **verify only** (`command -v claude jq node git`);
  don't re-run Homebrew or the Claude installer.
- Section 1: don't promise "morning and shutdown rituals" or "a nightly backup." Promise:
  your vault, two commands (`/letsgo`, `/handoff`), your email and calendar connected, a few
  safety hooks, and Obsidian's version history.
- Sections 2–3: use `/letsgo` as the example command, not `/morning`. Where Section 3 says
  "we'll run it for real in Section 22," say "at the end of today."
- Section 9 (status line): run it as written. The client sees project, context bar and usage
  limits from hour one.
- Section 10: **merge** into `~/.claude/settings.json`, never overwrite (Section 9 already
  wrote `statusLine`). Confirm with `jq .statusLine ~/.claude/settings.json`.
- Section 14 (Todoist): the hidden `read -rs` token prompt can't run inside the agent's shell
  (on the Mac it saves an EMPTY token). Have the client paste the token into the chat; write
  the export line yourself; install `cp setup-files/scripts/todoist-query ~/.local/bin/ &&
  chmod +x ~/.local/bin/todoist-query`; verify in one call:
  `export TODOIST_API_TOKEN=<token>; todoist-query 'filter=today' | jq length`.
  Skip step 5 (Inbox project ID; it feeds rituals that aren't installed).
- Section 26 closing summary — say this instead of the shipped text:
  *"Two commands run your system. `/letsgo` starts a session and catches you up. `/handoff`
  ends one and files what happened into your vault. Everything in between is just talking."*
  Tomorrow's first move: open Ghostty → `cd ~/<systemName>` → `claude` → `/letsgo`.
- Section 27: save the install report locally. Don't offer to email it.
- The client's Claude plan: Pro is fine to start. If usage limits bite during population,
  say so plainly and name Max as the upgrade; never push it.

## Week-one operating block (add to the vault CLAUDE.md, Section 19)

Directly under the template's **"The session loop"** section:

```
## Week-one operating mode
One agent. Vault sessions only.
Do not run new-project. Do not split into project panes.
Week two begins when the user says "let's start a new project."
```

Under **Tools**, list only what is really installed.

## Config rules

- **All client context goes in the VAULT CLAUDE.md, never `~/.claude/CLAUDE.md`.**
- **Section 19 is fill-placeholders, never rewrite.**
- Before starting: `config/setup-state.json` must be fresh (null `startedAt`) or the resume
  logic misfires. Ignore the `startedAt` inside `config/user-config.json`.

## Success definition for the day (never cut)

1. Claude Code authenticated; the client talking to their own **named** agent.
2. Every Google account in the config connected and verified, and the Google app reads
   **In production**.
3. Vault exists, CLAUDE.md carries the system name and the week-one block, connection
   verified (Section 18).
4. **One real task completed** on the client's real email or notes.
5. **The day ends on `/handoff`, in the vault.** Close the install session (cwd
   `~/personal-os-installer`). The client opens a new one with `cd ~/<systemName> && claude`,
   runs `/handoff`, then opens Obsidian and sees the new note in `00-inbox/processed/`. Then
   `/letsgo` in a fresh session to show it comes back.
6. Install report saved locally (Section 27).
