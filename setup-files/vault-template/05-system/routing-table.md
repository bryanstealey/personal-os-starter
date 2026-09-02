---
description: Universal routing specification for all input types and automated components. The capture-verify-alert pattern mapped per input type.
topics: routing, universal pattern, capture, verification, alerting, components, health monitoring
---

# Routing Table

Every input to your system follows one pattern: **capture at the point of occurrence, verify at regular intervals, alert through existing channels.** This table maps each input type to its complete lifecycle.

## Input Type Routing

| Input Type | Capture Point | Canonical Location | Verify Step | Alert Channel |
|---|---|---|---|---|
| Brain dump capture | `00-inbox/brain-dump.md` | Routed to buckets / tasks on request or at `/handoff` | Handoff (or `/shutdown` once installed) | `/letsgo` surfacing |
| Calendar event | Connected calendar tool if one is listed under Tools in `CLAUDE.md`; otherwise the user tells the agent | Calendar (external) | Agent asks before creating or changing events | Conversation |
| Email (inbound) | Connected mail tool if one is listed under Tools; otherwise the user pastes or forwards it in | Mail client (external) | Agent drafts; the user sends | Conversation |
| Task (from task system) | Task system CLI (e.g. `todoist-query`) | Task system (external) | Reconciled at `/handoff` (and in rituals once installed) | `/letsgo` surfacing |
| Vault file edit | Edit/Write tool | Vault `.md` files | `obsidian-lint` hook (frontmatter + links) | Hook additionalContext |
| Correction event | User states correction | Authoritative vault file + `corrections.jsonl` | Weekly review | Ritual surfacing |
| Signal file | External process writes to `00-inbox/signals/` | Routed to bucket manifest | Shutdown processing | Shutdown ritual |
| Decision (consequential) | Session conversation | Bucket manifest + `06-self/decisions.md` | Weekly review | Weekly review |

## Component Health Registry

Each automated component and its monitoring binding. All components must have a heartbeat location.

| Component | Cadence | Heartbeat Location | Sanity Check | Last Known Failure |
|---|---|---|---|---|
| Obsidian Git (local version history) | Every 10 min while Obsidian is open | Obsidian Git plugin status | `git log -1` in the vault shows a recent commit | — |

*Add components here as automations are set up (nightly backup, system-health, rituals).*

## Canonical People Index

`05-system/name-registry.jsonl` is the canonical index of known people. When the
assistant populates the vault or routes an input that mentions a person, it consults
this file first to recognize who someone is before treating them as new. The file
ships empty and grows as you add people to the system. Each line is a JSON object
(one person per line).

## How to Use This Table

**When adding a new component:** Fill in every column. If a column is blank, the component is not fully wired into the universal pattern. Ask: what is the capture point? How do I find out if it breaks?

**When debugging a failure:** Find the input type in the routing table. Check each column left to right: did capture happen? Did verification run? Did the alert fire? The first blank or failing column is where the system broke.
