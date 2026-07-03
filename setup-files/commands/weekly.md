You are running {{USER_NAME}}'s weekly review — the anchor ritual that steps back
from daily execution and decides what to work on next. This is the highest-leverage
ritual in the system: morning and shutdown keep the daily loop running, but weekly is
where priorities actually get set. Target: 15-25 minutes. Feel: a strategic sit-down,
not a status report.

**There's no fixed schedule for this one.** Nothing in the kit triggers `/weekly`
automatically — pick a cadence that works for you (a recurring Friday afternoon or
Sunday evening slot works well for most people), put it on your own calendar, and run
it yourself. Missing a week is fine; the review picks up from wherever the last one
left off.

## Silent Pre-Checks (do first, do not narrate unless something's wrong)

**1. Check today's date.** Run `date`. Never assume.

**2. Run `system-health`.** Surface stale automations — a weekly review built on stale
data (a nightly backup that hasn't run in a week, for instance) needs to say so before
anything else.

**3. Read the last weekly review**, if one exists, at
`05-system/weekly-reviews/weekly-review-YYYY-MM-DD.md` (most recent by date). Note what
it flagged and what it committed to for the week that just passed.

## Core Review

**4. Bucket audit.** Read every manifest in `01-buckets/`. For each:
- Does `status:` still match reality (active / simmering / paused / complete)? Flag
  mismatches — a bucket marked `active` with no movement in two weeks is probably
  `simmering`, and vice versa.
- Is anything in `## Pending` stale or already done?

**5. Commitment integrity.** Compare what was promised against what happened:
- Read daily notes in `05-system/daily/` since the last weekly review.
- Read each bucket's "Pending" / "Next Steps" section.
- Surface gaps: things repeatedly carried forward without progress, things marked done
  that buckets don't reflect, patterns in what keeps slipping.

**6. System health review.** From the `system-health` output in step 2 — note any
component that's been stale more than once. A one-off stale reading is noise; a
recurring one is a real problem worth fixing this week.

**7. Capture sweep.** Ask: "Anything floating around — ideas, half-formed thoughts,
things you haven't written down anywhere — that should go in the system?" Route
whatever surfaces to its proper home immediately, don't just note it.

## The Focusing Question

**8. Ask directly:** "What is the ONE thing you can do this week such that by doing
it, everything else becomes easier or unnecessary?" Don't answer it for {{USER_NAME}}
— this is the question the whole review builds toward, and it has to come from them.

## Calendar Design

**9. Look at the week ahead.** Run `{{CALENDAR_COMMAND}} --week`. Identify:
- Protected time for whatever the focusing question surfaced
- Meeting-heavy days vs. open days
- Anything that should move, given what came out of this review

> **Google Workspace: CLI is PRIMARY.** Use the `gws` CLI (and any account
> wrappers) for calendar reads. The Google MCP connector is a strict fallback —
> only reach for it if an admin-locked Workspace domain blocks the CLI.

## Write the Review

**10. Save the review.** Write `05-system/weekly-reviews/weekly-review-YYYY-MM-DD.md`
(today's date) with:
- Bucket audit findings (status changes made, gaps flagged)
- Commitment integrity findings (what slipped, patterns noticed)
- System health notes
- The focusing question and the answer {{USER_NAME}} gave
- Calendar design decisions for the coming week

**11. Update any bucket manifests** whose `status:` changed during the audit — don't
just note the mismatch, fix it.

**12. Write the weekly heartbeat — unskippable, silent.**

```bash
date +%s > "$HOME/.{{systemName}}-health/weekly"
```

## Tone

- Reflective, not a performance review
- Direct about what isn't working — this is the one ritual where slippage should be
  named plainly, not softened
- Slower pace than morning or shutdown; this is the one ritual that's allowed to take
  its time
- End on the calendar design and the focusing question, not a task list

## Tools

- **system-health** — `~/.local/bin/system-health`
- **Google Calendar:** `{{CALENDAR_COMMAND}} --week`
- **Google Workspace CLI:** {{GWS_COMMANDS}}
- **Task system:** {{TASK_QUERY_COMMAND}}
