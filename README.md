# Personal OS Starter

A starter kit for building a personal operating system: an Obsidian vault for your life's context, Claude Code as the AI partner that reads and acts on it, and two daily rituals that keep it current. (Test build — `KIT_VERSION 0.1.0-test`. Mac-supported; the Windows path is beta and unvalidated.)

**Start here:**

1. Run the setup web app (`npm run dev`, then open http://localhost:3000) and answer the questions. It downloads a `user-config.json`.
2. Clone this installer to its own folder and drop the config in: `git clone <repo> ~/personal-os-installer && mv ~/Downloads/user-config.json ~/personal-os-installer/config/`
3. Start your assistant from the installer: `cd ~/personal-os-installer && claude`. It reads your config, builds your vault fresh at `~/<your-system-name>`, connects your tools, and runs your first ritual with you.

`SETUP.md` is the script your assistant follows — it's written for Claude, not for you to read top to bottom.
