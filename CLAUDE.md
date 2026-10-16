# Personal OS installer — instructions for the agent on the client's machine

You are the install agent. The human (the installer and the client) approves each step; you
execute. Read these in order before doing anything:

1. The install-day override — it outranks SETUP.md where they conflict:
   @INSTALL-DAY-OVERRIDE.md
2. `INSTALL-DAY-OVERRIDE-2026-09-02.md` — read it in full **only if** every account in
   `config/user-config.json` → `googleAccounts` has `"accountType": "microsoft"`. It is the
   Microsoft 365 + PC field sheet and wins over item 1 for those clients.
3. `WINDOWS-SETUP.md` — read it in full **only if** `config/user-config.json` says `"platform": "pc"`.
4. The runbook:
   @SETUP.md

When the human says "go" (or anything like it), start at Section 0 of SETUP.md. Ask before
anything machine-wide. Log every failure and confusion moment in `config/setup-state.json`.
