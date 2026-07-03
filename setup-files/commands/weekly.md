# /weekly — ADD LATER (stub, not an active ritual)

> **This ritual ships disabled in the starter kit.** The v1 kit ships only two
> active rituals — `/morning` and `/shutdown`. Weekly is a stub you can flesh
> out once the daily loop is steady.

## Why it's not shipped yet

The weekly review is the highest-leverage ritual in a mature system — it's where
you decide WHAT to execute, not just execute. But it only pays off once you have
a few weeks of daily notes to review. Get the morning/shutdown bookends running
first; the weekly review has something to chew on after that.

## What weekly is for (when you add it)

A once-a-week anchor (Friday afternoon or Sunday evening) that sets priorities
for the coming week:

- **Bucket audit** — read every manifest in `01-buckets/`, flag wrong statuses.
- **Commitment integrity** — what was promised this week vs. what happened, from
  daily logs in `05-system/daily/` and bucket "Next Steps".
- **System health review** — run `system-health`, note recurring failures.
- **The focusing question** — "What is the ONE thing you can do next week such
  that by doing it, everything else becomes easier or unnecessary?"
- **Calendar design** — protect deep-work blocks for the week ahead
  (`{{CALENDAR_COMMAND}} --week`).
- **Capture sweep** — anything in your head not yet in the system.

## How to turn it on

1. Replace this stub with a real ritual prompt (sections pre-populated by the
   assistant, focusing question + calendar design completed by you).
2. Have it write a heartbeat at completion:
   `date +%s > "$HOME/.{{systemName}}-health/weekly"`.
3. Add a `weekly` entry to the `system-health` component list so staleness
   surfaces (and let `/morning` nudge when it goes stale).
4. Save each review to `05-system/weekly-reviews/weekly-review-YYYY-MM-DD.md`.

Until you do that, leave this file as-is. It is intentionally inert.
