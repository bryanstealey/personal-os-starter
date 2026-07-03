# /midday — ADD LATER (stub, not an active ritual)

> **This ritual ships disabled in the starter kit.** The v1 kit ships only two
> active rituals — `/morning` and `/shutdown`. Midday is a stub you can flesh
> out once the two-ritual loop is a habit.

## Why it's not shipped yet

The starter kit's premise is a fast morning launchpad and a clean evening
shutdown. A dedicated midday triage is powerful but heavier, and it's easy to
let it become the thing you skip — which then erodes trust in the whole system.
Start with the two bookends. Add midday only when you feel the morning getting
crowded with triage that doesn't belong there.

## What midday is for (when you add it)

A middle-of-day ritual that clears input and resets afternoon priorities — the
triage the morning launchpad deliberately skips:

- Email triage across all configured inboxes (CLI-primary: use the `gws` CLI,
  not the Google MCP connector, which is a strict fallback for admin-locked
  Workspace domains only).
- Task inbox triage toward inbox zero.
- Brain-dump processing and routing per `05-system/routing-table.md`.
- Afternoon priority adjustment based on what triage surfaced.

## How to turn it on

1. Replace this stub with a real ritual prompt (model it on `morning.md`'s
   structure — silent pre-checks, the core work, a close).
2. Have it write a heartbeat at completion:
   `date +%s > "$HOME/.{{systemName}}-health/midday"`.
3. Add a `midday` entry to the `system-health` component list so staleness
   surfaces.

Until you do that, leave this file as-is. It is intentionally inert.
