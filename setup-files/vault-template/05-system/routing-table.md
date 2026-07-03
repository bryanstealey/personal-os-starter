---
description: Universal routing specification for all input types and automated components. The capture-verify-alert pattern mapped per input type.
topics: routing, universal pattern, capture, verification, alerting, components, health monitoring
---

# Routing Table

Every input to your system follows one pattern: **capture at the point of occurrence, verify at regular intervals, alert through existing channels.** This table maps each input type to its complete lifecycle.

## Input Type Routing

| Input Type | Capture Point | Canonical Location | Verify Step | Alert Channel |
|---|---|---|---|---|
| Brain dump capture | `00-inbox/brain-dump.md` | Routed per shutdown routing rules | Shutdown ritual | Ritual surfacing |
| Calendar event | Google Calendar API | Calendar (external) | `calendar-day-verify` hook (writes) + morning (reads) | Hook deny (writes) / morning ritual (reads) |
| Email (inbound) | Gmail API via `gws` | Surfaced narrowly in morning's priority scan | Morning ritual (narrow scan, not full triage) | Morning ritual |
| Task (from task system) | Task system API | Task system (external) | Morning / shutdown reconciliation | Morning ritual |
| Vault file edit | Edit/Write tool | Vault `.md` files | `obsidian-lint` hook (frontmatter + links) | Hook additionalContext |
| Correction event | User states correction | Authoritative vault file + `corrections.jsonl` | Weekly review | Ritual surfacing |
| Signal file | External process writes to `00-inbox/signals/` | Routed to bucket manifest | Shutdown processing | Shutdown ritual |
| Decision (consequential) | Session conversation | Bucket manifest + `06-self/decisions.md` | Weekly review | Weekly review |

## Component Health Registry

Each automated component and its monitoring binding. All components must have a heartbeat location.

| Component | Cadence | Heartbeat Location | Sanity Check | Last Known Failure |
|---|---|---|---|---|
| Nightly backup | Nightly | `$HOME/.{{systemName}}-health/nightly-backup` | No "FAILED" in recent log entries | — |

*Add components here as automations are set up.*

## Canonical People Index

`05-system/name-registry.jsonl` is the canonical index of known people. When the
assistant populates the vault or routes an input that mentions a person, it consults
this file first to recognize who someone is before treating them as new. The file
ships empty and grows as you add people to the system. Each line is a JSON object
(one person per line).

## How to Use This Table

**When adding a new component:** Fill in every column. If a column is blank, the component is not fully wired into the universal pattern. Ask: what is the capture point? How do I find out if it breaks?

**When debugging a failure:** Find the input type in the routing table. Check each column left to right: did capture happen? Did verification run? Did the alert fire? The first blank or failing column is where the system broke.
