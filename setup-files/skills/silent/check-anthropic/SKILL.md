---
name: check-anthropic
description: Check Anthropic's official channels for updates relevant to your Claude Code setup. Pull-based review — run on-demand or during a weekly review. Use when the user asks "what's new from Anthropic", "any Claude Code updates", "check for new features", or wants to know if their setup should change based on recent releases or blog posts.
---

# Check Anthropic Updates

A pull-based review of Anthropic's official channels (Claude Code releases, blog,
engineering posts, docs) filtered down to what actually affects how the user has
Claude Code configured. Run on-demand or fold it into a weekly review.

## Step 1 — Load State

Read `~/.claude/anthropic-updates/last-check.json` if it exists. This contains:
- `last_check_date`: ISO date of the last run
- `seen_posts`: array of slugs from anthropic.com/news and /engineering already reviewed
- `seen_releases`: array of claude-code release tags already reviewed
- `installed_version`: claude-code version at last check

If the file doesn't exist, this is the first run. Create the directory and treat
everything as new (but limit to the last 30 days).

## Step 2 — Gather Updates (run all in parallel)

### 2a. Claude Code Releases
Run: `gh api repos/anthropics/claude-code/releases --paginate --jq '.[] | {tag_name, name, published_at, body}' | head -100`

Filter to releases not in `seen_releases`. For daily patch releases, only flag ones
where the body mentions: new features, behavior changes, breaking changes, new
commands, new flags, permission changes, hook changes, or CLAUDE.md-related updates.
Skip pure bug-fix patches. (Requires the `gh` CLI authenticated; if unavailable,
note it and skip this sub-step rather than failing the whole run.)

### 2b. Anthropic Blog & Engineering Posts
Fetch `https://www.anthropic.com/sitemap.xml` using curl. Extract URLs matching
`/news/` and `/engineering/` patterns. Compare slugs against `seen_posts`. Identify
new entries.

### 2c. Platform/Docs Changes
Fetch `https://platform.claude.com/sitemap.xml` using curl. Look for new pages under
`/release-notes/` or significant new docs pages. Note any new URLs.

### 2d. Current Version
Run `claude --version` to get the installed version. Compare against
`installed_version` from state.

## Step 3 — Analyze New Content

For each new blog/engineering post identified:
1. Use `defuddle parse <url> --md` to fetch the full content (falls back to plain
   curl if the defuddle skill isn't installed).
2. Assess relevance to the user's Claude Code setup — specifically:
   - Does it contain guidance on CLAUDE.md structure, system prompts, or instructions?
   - Does it discuss skills, hooks, commands, or permissions?
   - Does it cover prompt engineering best practices that would change how instructions are written?
   - Does it announce model changes that affect behavior?
   - Does it describe patterns to adopt or anti-patterns to stop?
3. Score as: HIGH (should act on this), MEDIUM (worth knowing), LOW (not relevant).

For meaningful Claude Code releases:
1. Read the release notes body.
2. Identify anything that changes how Claude Code should be configured or used.
3. Note any new features the user should know about.

## Step 4 — Read Current Setup for Comparison

Read `~/.claude/CLAUDE.md` (global instructions) to compare against any new guidance.
Don't read the whole thing if nothing relevant was found — only read if a HIGH or
MEDIUM finding needs comparison.

## Step 5 — Present Findings

Format the output as:

```
## Anthropic Updates — [today's date]
Last checked: [last_check_date or "first run"]

### Action Items (HIGH relevance)
[Things that should change in your setup, with specific recommendations]

### Worth Knowing (MEDIUM relevance)
[Interesting but no immediate action needed]

### Claude Code [current version]
[Any version change since last check, with notable changes]

### Skipped
[Count of items reviewed but not relevant — e.g., "Skipped 3 policy posts, 2 research papers, 8 patch releases"]
```

If there are no HIGH or MEDIUM items, say so clearly: "Nothing new that affects your
setup since [last_check_date]."

## Step 6 — Update State

Write updated `~/.claude/anthropic-updates/last-check.json` with:
- Today's date as `last_check_date`
- All reviewed post slugs added to `seen_posts`
- All reviewed release tags added to `seen_releases`
- Current `installed_version`

## Important Rules

- **Source labeling:** Always state where information came from (which blog post,
  which release, which docs page).
- **Don't recommend changes without reading the current setup first.** Compare before suggesting.
- **Be opinionated.** Don't dump raw findings — say what matters and what doesn't.
- **Err on the side of filtering OUT.** Only surface things that genuinely affect how
  Claude Code is used.
- **If the sitemap fetch fails or returns unexpected content**, report the failure
  visibly. Don't silently produce "no updates."
