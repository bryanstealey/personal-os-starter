---
name: new-project
description: Bootstrap a new project with proper Claude Code configuration. Use this skill whenever the user wants to start a new project, set up a new codebase, initialize a new repo, or scaffold a project directory. Triggers on phrases like "new project", "set up a project", "bootstrap", "init a new repo", "start building X", or any request to create a fresh project workspace. Also use when the user says "set up Claude Code for this project" or "add Claude config to this project" for an existing directory that lacks Claude Code configuration.
---

# New Project Bootstrap

You are setting up a new project with proper Claude Code configuration. This means
the project will have everything Claude needs to work effectively from the very
first session — scope, context, structure — without duplicating what the global
config already provides.

## Before You Create Anything

### 1. Identify the project

Determine the project name and directory. If the user hasn't specified:
- Default to `~/projects/[project-name]/`
- Ask only if the name or location is genuinely ambiguous

### 2. Check the vault for related context

If the user has a vault (check for `~/[system-name]/` with `.obsidian/` inside),
search it for files related to this project. Bucket manifests in `01-buckets/`
contain current state and context for life areas. If the project clearly maps to
one bucket, read that manifest so the CLAUDE.md arrives with real context.

If nothing relevant is in the vault, skip this step.

### 3. Check what already exists

Read the project directory if it exists. Look for:
- `package.json`, `Cargo.toml`, `pyproject.toml`, etc. — to identify tech stack
- Existing `CLAUDE.md` — don't overwrite, offer to enhance
- Existing `.git/` — don't re-init
- Any existing code that reveals the project's nature

## What to Create

### CLAUDE.md (always)

Create `[project]/CLAUDE.md` with these sections. Every section should contain
real, specific information — not placeholders or TODOs.

```markdown
# [Project Name]

## Voice

[2-3 sentences defining the tone for this project's Claude sessions. What role
is Claude playing — developer, strategist, consultant, creative director,
researcher? Match the role to the project.]

## What This Project Is

[One paragraph: what this project is and what it does. Be specific.]

## Tech Stack

[Languages, frameworks, key dependencies. Only what's actually in use — verified
from package.json/config files, not assumed.]

## Development

[How to run locally, build, test. Commands that a fresh Claude session needs.]

## Deployment

[How this deploys. Include branch conventions if relevant.]

## Vault Reference

[If a vault bucket connects to this project:]
This project relates to the [bucket-name] bucket.
Read `~/[vault]/01-buckets/[bucket-name]/[bucket-name].md` for broader context.

## Known Issues & Gotchas

[For new projects: "None yet — add issues here as they're discovered."]
```

**What NOT to put in CLAUDE.md:**
- Anything from global `~/.claude/CLAUDE.md` — working style, communication
  preferences, tool configs. These load automatically. Duplicating them wastes
  context window and creates drift.
- Generic boilerplate. Every line should be specific to this project.

### .claude/commands/ directory (always)

```bash
mkdir -p [project]/.claude/commands/
```

This is where project-specific slash commands live. Leave it empty — commands
get added as the project matures.

### Git repository (if none exists)

If there's no `.git/` directory:

```bash
cd [project] && git init && git add -A && git commit -m "Initial commit"
```

If the user wants a GitHub remote:

```bash
gh repo create [username]/[project-name] --private --source .
git push -u origin main
```

Creating a GitHub remote also registers the project for nightly backup (if
configured). Ask the user if they want local-only or remote.

### Shell alias (recommended)

Every project benefits from a launch alias so it can be opened from any terminal:

```bash
alias [name]="cd ~/projects/[project-name] && claude -n [session-name]"
```

Check existing aliases first to avoid collisions. Add to the user's shell
config file (`~/.zshrc`, `~/.bashrc`, etc.).

### Update vault bucket manifest (if applicable)

If a vault bucket was matched, add a reference to the new project:

```markdown
## Projects
- `~/projects/[project-name]/` — [one-line description]
```

## What NOT to Create

- **No `settings.json` or `settings.local.json`** — Global permissions cover
  standard tools. Only create project-level settings for truly unique tools.
- **No `README.md`** — Unless specifically asked for.
- **No project-specific handoff or letsgo command** — These are global skills.
  Duplicating them per-project creates version drift.
- **No boilerplate files** (.gitignore, LICENSE, etc.) — Only create files that
  are directly needed.

## After Setup

Tell the user what was created and what wasn't (and why). Keep it brief.
Suggest a commit if there are files worth committing.
