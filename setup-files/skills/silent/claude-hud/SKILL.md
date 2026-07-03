---
name: claude-hud
description: Real-time statusline HUD for Claude Code — context health, tool activity, agent tracking, and todo progress, always visible below the input. Use when the user asks to set up a statusline, configure their HUD, show context usage, or wants the "{{systemName}} · your assistant" lead badge in the vault.
---

# claude-hud

claude-hud is a **real-time statusline** for Claude Code: context usage, active
tools, running agents, todo progress, git status, and session info, rendered below
the input box. It is a genuine **marketplace plugin** (not a bundled skill), so it is
installed via the plugin marketplace rather than file-copied.

> Author: Jarrod Watts · License: MIT · Repo: `jarrodwatts/claude-hud`
> See `THIRD-PARTY-LICENSES` in the kit root for the bundled MIT license text.

## Install (run inside an interactive Claude Code prompt, not a bash block)

Slash commands only run in the Claude Code prompt. Add the marketplace first, THEN
install the plugin — never the `org/name` slash form:

```
/plugin marketplace add jarrodwatts/claude-hud
/plugin install claude-hud@claude-hud
```

After install, reload plugins or restart so the commands appear:

```
/reload-plugins
```

## Configure

Once installed, two commands are available in the Claude Code prompt:

- `/claude-hud:setup` — configure claude-hud as your statusline (writes the
  `statusLine` entry into `~/.claude/settings.json`).
- `/claude-hud:configure` — adjust display options (layout, presets, which segments
  show) while preserving any manual overrides.

Zero config is required to start — sensible defaults render immediately after setup.

## Lead-agent badge (optional, vault-only)

The kit can render a red `{{systemName}} · your assistant` badge in the statusline
**only when the current working directory is the vault** (`$HOME/{{systemName}}`), so
you always know when you're operating inside your personal OS versus a normal project.

This relies on a cwd-conditional statusline wrapper script. If claude-hud's segment
config supports a cwd condition, configure it through `/claude-hud:configure`;
otherwise the kit ships a small wrapper that checks cwd against the vault path before
delegating to claude-hud. The badge is a polish item — skip it if you just want the
default HUD.

## Notes

- This is a statusline display layer; it does not change Claude Code behavior, only
  what you see.
- If `/claude-hud:setup` reports "command not found," the plugin hasn't reloaded yet —
  run `/reload-plugins` or restart Claude Code.
