---
name: imessage
description: Read and send iMessages from Claude Code — search conversations, read recent messages from a chat, list participants, and send texts. Use when the user wants to capture notes via self-text, review a conversation, search their message history, or send an iMessage. macOS only; requires Full Disk Access.
---

# iMessage

iMessage access lets the assistant read your local Messages history (`chat.db`) and
send texts through the Messages app. The most common use in a personal OS is
**self-text capture** — texting yourself notes from your phone and having the
assistant pull them in during a ritual.

> macOS only. This is an **opt-in** integration delivered as an MCP server, not a
> bundled skill. It is gated behind Full Disk Access because reading `chat.db`
> touches protected user data.

## Install

iMessage ships as a marketplace plugin. From an interactive Claude Code prompt, add
the marketplace first, then install:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install imessage@claude-plugins-official
```

Reload so the MCP tools register:

```
/reload-plugins
```

## Grant Full Disk Access (required)

Reading the Messages database is blocked by macOS until your terminal has Full Disk
Access. Without it, every iMessage tool returns a permission error, not empty results.

1. Open **System Settings → Privacy & Security → Full Disk Access**.
2. Click **+** and add your terminal app (Terminal, Ghostty, iTerm — whichever you
   launch `claude` from).
3. Toggle it **on**, then fully quit and reopen the terminal so the grant takes effect.

If a tool reports "operation not permitted" or "unable to open chat.db," Full Disk
Access has not been granted to the terminal you are actually running in.

## Capabilities

Once installed, these MCP tools are available:

| Tool | What it does |
|------|--------------|
| `im_status` | Confirm the integration can reach `chat.db` (run this first to verify access) |
| `im_chats` | List conversations (chat IDs, names, last-activity) |
| `im_messages` | Read recent messages from a specific chat ID |
| `im_search` | Full-text search across message history |
| `im_participants` | List participants in a chat |
| `im_send` | Send an iMessage to a contact or chat |

## Self-text capture pattern

To use texting-yourself as a capture channel:

1. Find the chat ID for your own "note to self" thread with `im_chats`.
2. During a ritual (e.g. `/shutdown`, or whatever custom triage ritual you add
   later), read new messages from that chat with `im_messages`.
3. Route captured items into the vault inbox per the routing table.

Pin the self-thread chat ID in your vault CLAUDE.md so the ritual doesn't have to
re-discover it each time.

## Notes

- Sends go through the Messages app under your own Apple ID — treat `im_send` like
  sending from your phone. Confirm recipient and content before sending.
- Verify access with `im_status` before reporting "no messages" — an empty result and
  a permissions failure look different and mean different things.
- This integration is local-only; nothing leaves your machine.
