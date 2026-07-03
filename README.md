# Personal OS Starter

**This is an alpha.** If you're seeing it, you're testing it. Feedback — what
worked, what confused you, what broke — is exactly what's wanted.

A starter kit for building a personal operating system: an Obsidian vault for
your life's context, Claude Code as the AI partner that reads and acts on it,
and daily rituals (`/morning`, `/shutdown`) that keep it current.

## What it is

Two phases:

1. **A setup app** (this repo, run locally) — asks about your stack (Google
   accounts, task manager, terminal, dictation, GitHub) and produces a
   `user-config.json`.
2. **A terminal install** — Claude Code reads that config and builds your
   vault, connects your tools, and runs your first ritual with you, following
   `SETUP.md` as its runbook.

Early setup is runbook-driven. As the install proceeds, your agent
accumulates real context about you — by the end, when you're not sure about
anything, you just ask it. You work it out together.

## Requirements

- **Mac.** Windows has a path (`WINDOWS-SETUP.md`, via WSL2) but it's beta
  and unvalidated — Mac is the supported install.
- **A paid Claude plan.** The $20/month Pro plan works to start, but heavy
  moments — like the initial population of your knowledge base, where your
  agent reads through your email and files — burn through limits fast. Daily
  drivers should expect to need the $100/month Max plan.
- **[Obsidian](https://obsidian.md)** (free) and a
  [GitHub](https://github.com) account. GitHub backs your vault up off your
  machine every night and hosts anything you build with it later.

## Install at your own risk

This system gives AI agents real access to your computer and your accounts.
Guardrails are built in everywhere possible — you'll see them during setup —
but installing means you're comfortable with that trade-off.
**[UNINSTALL.md](./UNINSTALL.md)** reverses every machine-wide change this
kit makes, if you decide it's not for you.

## Start here

1. Run the setup web app (`npm run dev`, then open http://localhost:3000)
   and answer the questions. It downloads a `user-config.json`.
2. Clone this installer to its own folder and drop the config in:
   ```
   git clone <repo> ~/personal-os-installer && mv ~/Downloads/user-config.json ~/personal-os-installer/config/
   ```
3. Start your assistant from the installer: `cd ~/personal-os-installer && claude`.
   It reads your config, builds your vault fresh at `~/<your-system-name>`,
   connects your tools, and runs your first ritual with you.

`SETUP.md` is the script your assistant follows — it's written for Claude,
not for you to read top to bottom. If you ever want to back out,
[UNINSTALL.md](./UNINSTALL.md) has the reverse.
