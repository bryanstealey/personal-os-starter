# Install-Day Override — September 2, 2026 (read BEFORE SETUP.md)

**To the agent running this install:** this file overrides SETUP.md wherever they conflict.
Both of today's clients are on **corporate Microsoft 365 (Outlook/Teams), not Google.** The
tenant administrator is not yet identified. Week one is deliberately simplified: **one
right-hand agent per client, no project agents, and TWO commands — `/letsgo` and
`/handoff`. No daily rituals this week.** (Feedback from earlier installs: three rituals
on day one overwhelmed people. The rituals get added by Bryan in a later session, once the
letsgo/handoff loop is a habit.)

## Hard skips (do not run, do not mention as failures)

| Section | Why |
|---|---|
| **12 — Google Workspace CLI** | No Google identity exists. Never open console.cloud.google.com. Never attempt the Anthropic M365 connector, a Graph app registration, or IMAP — all require tenant-admin consent, and a failed attempt can trip conditional-access alerts on the client's corporate account. |
| **13 — Calendar wrapper** | Depends on gws. |
| **11 — two of the hooks** | Install obsidian-lint, npm-install-guard, terminal-context-guard (global) and read-before-claiming (vault). **Skip calendar-day-verify** (Google-only, inert) and **skip lookup-before-asking** (it blocks any response containing "can you paste" and coaches the agent toward Google Sheets — the exact sentence the paste loop needs). Two Stop hooks in the JSON become one. |
| **15 — Rituals** | **Not installed this week.** Do not copy morning.md, shutdown.md, or weekly.md. The vault CLAUDE.md template already describes the two-command loop. |
| **23 — nightly backup / GitHub** | Run ONLY the `git init` + first commit. No GitHub, no nightly-backup script, no scheduler. Obsidian Git is the version history. |
| **24 — System health** | Nothing to watch yet. Skip. `/letsgo` knows to stay silent when it's absent. |
| **20 — Business/personal separation** | Skip regardless of config. One agent. |
| **3 — `new-project` skill** | Do not install it this week (week-two item). Install letsgo, handoff, obsidian-markdown, link-backfill only. SETUP.md has no copy line for link-backfill; use `cp -R setup-files/skills/core/link-backfill ~/.claude/skills/link-backfill`. |
| **26 — the shipped summary + FAQ** | Replace the ENTIRE shipped summary and FAQ with the wording under "Words to use" below. The shipped text lists rituals, Google tools, and hooks that were not installed. |
| **17.1 / 17.2 — email- and calendar-driven population** | Same dependency. Population happens by interview instead (see below). |
| **21 — First project** | Week-one rule is ONE agent. Project agents start in week two, on the client's request. |
| **22 — Multi-pane + first ritual** | Whole section. One pane, one agent, no rituals this week. The day ends on `/handoff` (see Success definition). |

The wizard's account step has a **Microsoft 365 (Outlook)** type — pick it for both clients.
The runbook then skips Sections 12–13 on its own. If a config somehow carries a Google type
with an Outlook address, treat it as Microsoft anyway; never drive it into a Google flow.

## Section 9 (status line) — DO run it

Section 9 was rewritten Sept 1 to install claude-hud correctly (plugin marketplace, three slash
commands typed by the client, then the kit preset). Run it as written. It gives the client the
project name, the context bar, and their usage limits — Bryan wants this on from hour one.

## Words to use (client-facing)

- Section 0: the bootstrap script already did all of it. **Verify only** (`command -v claude jq node git`);
  do not re-run Homebrew or the Claude installer.
- Section 1's scripted speech promises "morning and shutdown rituals" and "a nightly backup." **Do not
  say those.** Promise: your vault, two commands (`/letsgo`, `/handoff`), a few safety hooks, and
  Obsidian's local version history. Teach only the session bookend.
- Sections 2-3: use `/letsgo` as the example command, not `/morning`. Where Section 3 says "we'll run it
  for real in Section 22," say "at the end of today."
- Section 10: **merge** into `~/.claude/settings.json`, never overwrite — Section 9 already wrote the
  `statusLine` entry. Confirm afterwards: `jq .statusLine ~/.claude/settings.json` is still set.
- Section 11: install `load-core-artifacts` too (harmless). Final count to say: "4 global, 1 vault."
  PC only, after copying the hooks:
  `sed -i.bak 's/Claude Code in Ghostty/Claude Code in Windows Terminal/; s/open <path>/explorer.exe <path>/' ~/.claude/hooks/terminal-context-guard.sh && rm ~/.claude/hooks/terminal-context-guard.sh.bak`
- Section 14 (Todoist): SETUP.md never installs the query tool. After writing the export lines:
  `cp setup-files/scripts/todoist-query ~/.local/bin/ && chmod +x ~/.local/bin/todoist-query`
  then verify in ONE shell call: `export TODOIST_API_TOKEN=<token>; todoist-query 'filter=today' | jq length`.
  Skip Section 14 step 5 (the Inbox project ID hunt — it feeds rituals that aren't installed).
- Section 18: on the PC, Graph View is **Ctrl+G**, not Cmd+G.
- Section 27: write the report file and tell the installer its path. No closing speech about emailing
  or AirDropping it to Bryan; the installer copies it by hand.

- Section 1 greeting: say **"email account (Microsoft 365)"**, never "Google account" — the
  wizard's field was labeled Google, the address in it is Outlook.
- Section 16: offer **tasks** as a context source. Do not offer calendar or email scans.
- The agent must never call `gws` or `calendar-agenda` on these machines; neither is
  installed. Say "not connected by API yet," never "doesn't exist," "not found," "no such file,"
  or "no obvious" (a vault Stop hook blocks those phrasings and the agent has to redo its answer
  in front of the client — if that happens once, it is expected, not broken).
- Section 26 closing summary — say this instead of the shipped text:
  *"Two commands run your system. `/letsgo` starts a session and catches you up. `/handoff`
  ends one and files what happened into your vault. Everything in between is just talking.
  Email and calendar: Outlook stays your mail client this week; connecting them is the
  week-two IT conversation."* Tomorrow's first move: open the terminal → `cd ~/<systemName>`
  → `claude` → `/letsgo`.
- Section 27: save the install report locally. **Do not offer to email it.** Report line
  "Google accounts" → "Email: Microsoft 365, not connected."
- On the PC, in Section 19 swap "Ghostty" → "Windows Terminal" and `open <path>` →
  `explorer.exe <path>` wherever the template mentions them.

## The day-one email loop (say it to the client in these terms)

Programmatic email and calendar access on a corporate Microsoft tenant needs a one-time
approval from the company's IT administrator — that's a week-two conversation, already on
the list. **Today: Outlook stays your mail client. You paste or export a thread into your
agent; the agent thinks with you and drafts; you send from Outlook.** Nothing is broken;
this is the designed interim path.

## Week-one operating block (add to each client's vault CLAUDE.md, Section 19)

The template's **"The session loop"** section is already the week-one contract (letsgo in,
handoff out, offer the handoff unprompted). Add this block directly under it:

```
## Week-one operating mode
One agent. Vault sessions only.
Do not run new-project. Do not split into project panes.
Email/calendar: not connected by API yet (Microsoft 365, IT approval pending).
The user pastes or forwards content in; drafts are sent by the user from Outlook.
Week two begins when the user says "let's start a new project."
```

Under **Tools**, list only what is really there: Todoist (if set up), `ob`, the installed
skills. Do not list gws, a calendar wrapper, or system-health.

## Config rules (both machines)

- **All client context goes in the VAULT CLAUDE.md, never `~/.claude/CLAUDE.md`.** Nothing
  personal gets written globally — it would have to be migrated when project agents arrive.
- **Section 19 is fill-placeholders, never rewrite** — the shipped System Conventions block
  is what lets week-two project agents interoperate with the vault.
- **Section 14 (Todoist), BOTH machines:** the runbook's hidden `read -rs` token prompt cannot
  run inside the agent's shell (no terminal): on Linux it hangs, on the Mac it returns an EMPTY
  token and writes `export TODOIST_API_TOKEN=""`. Have the client paste the token into the chat;
  the agent writes the export line itself (`.zshrc` on Mac; `.bashrc` + `.profile` on PC) and
  verifies with the todoist-query call under "Words to use."
- Before starting: `config/setup-state.json` must be fresh (null `startedAt`) or the resume
  logic misfires. **Ignore the `startedAt` inside `config/user-config.json`** — the wizard stamps
  that one; only setup-state's field means "resume."

## Population by interview (replaces Section 17's email/calendar scans)

The agent asks, conversationally: who do you work with most (5–10 people), what are the
3–4 areas of your work (these become buckets), what does a normal week look like, what's
on fire right now. Write person stubs and bucket manifests from the answers. Budget ~45
minutes; the client will tire.

## Success definition for today (never cut)

1. Claude Code authenticated; the client talking to their own **named** agent.
2. Vault exists, CLAUDE.md carries the system name and the week-one block, connection
   verified (Section 18 equivalent).
3. **One real task completed:** Client on PC — triage 3 real emails via the paste loop.
   Client on Mac — one real site visit's notes + photos turned into a crew turnover doc.
4. **The day ends on `/handoff`, not `/morning`, and it happens IN THE VAULT.** When the install
   is done, the install session (cwd `~/personal-os-installer`) is closed. The client opens a
   new session with `cd ~/<systemName> && claude` — that is their named agent, with the vault
   CLAUDE.md and hooks. The real task and the demo run there, never in the installer directory
   (a handoff written there would file itself as `personal-os-installer_HANDOFF_v0001.md`).
   The client runs `/handoff` in that vault session, then opens Obsidian and sees the new note in `00-inbox/processed/` with links
   to the people and buckets from their interview. That is the closing demo — memory,
   not a calendar. Then `/letsgo` in a fresh session to show it comes back.
5. Install report saved locally (Section 27) — do NOT send it via gws; copy it off the
   machine by hand.

## PC-specific (Julian)

- **Bootstrap is one line, typed inside Ubuntu:** `curl -fsSL https://personal-os-starter.vercel.app/pc.sh | bash`
  (Mac: `.../mac.sh`). It does the whole prerequisites block, `.wslconfig`, the kit clone, and
  the config copy. After the reboot: `cd ~/personal-os-installer && claude`, sign in, type `go`.
  The installer's own CLAUDE.md loads this override and the runbook automatically.

- Hardening pair is mandatory: `.wslconfig` memory cap (5GB on 16GB RAM — check the machine);
  vault on the **Windows** filesystem at `C:\Users\<user>\<systemName>` (profile root — NOT
  Documents, which is OneDrive on this tenant), symlinked to `~/<systemName>` in WSL.
- **Symlink BEFORE SETUP.md Section 6.** Get the Windows home from
  `cmd.exe /c 'echo %USERPROFILE%'`, never by guessing the username. Verify with
  `readlink -f ~/<systemName>` → must start with `/mnt/c/`.
- **Real path, not symlink, wherever a path is written into a file:** `VAULT_PATH` in
  `~/.claude/settings.json` and the `{{vaultPath}}` token in `ob` both take
  `$(readlink -f ~/<systemName>)`. Then prove it: `ob orphans` must list real files, not "(none)".

- **Git for Windows** goes on during the WSL reboot dead time (`winget install --id Git.Git -e`),
  or Section 7's Obsidian Git shows "Git is not installed." If winget is blocked, remove
  `obsidian-git` from the vault's `.obsidian/community-plugins.json` before Obsidian opens.
- Wizard Export step's `mv ~/Downloads/user-config.json ...` does not apply on PC — the file is
  on the Windows side. The **agent** copies it after auth:
  `cp /mnt/c/Users/<u>/OneDrive/Downloads/user-config.json config/ 2>/dev/null || cp /mnt/c/Users/<u>/Downloads/user-config.json config/`
- Do not ask for pasted screenshots on the PC (clipboard image paste is broken in WSL). Ask for
  "done" instead.
- If WSL is blocked (no admin rights, Intune/GPO policy, virtualization off, distro fetch
  fails after `--web-download` and the Store): switch to the **native fallback** — `winget
  install Anthropic.ClaudeCode`, Git for Windows, Obsidian, vault at
  `Documents\<systemName>`, skip bash hooks and scheduling. Goal unchanged: the owner
  talking to his named agent. Migrate to WSL in week two if IT unblocks it.
- Ten minutes stuck → message Bryan. Never debug longer in front of the client.
