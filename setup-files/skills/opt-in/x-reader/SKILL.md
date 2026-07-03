---
name: x-reader
description: Fetch full content from X/Twitter posts — resolves t.co links, gets full text, engagement stats, and media. Use when the user shares a tweet URL, asks about a tweet, wants to read an X post, or any task needs tweet content. Also use when resolving t.co shortened URLs.
---

# X/Twitter Content Reader

Fetch full tweet content using the fxtwitter mirror API. No API key needed. Works
reliably where Twitter's official API and web scraping fail.

## API

```
GET https://api.fxtwitter.com/{handle}/status/{tweetId}
```

**Extract handle and tweetId from any X/Twitter URL:**
- `https://x.com/WesRoth/status/2042754510880432218` → handle: `WesRoth`, tweetId: `2042754510880432218`
- `https://twitter.com/aakashgupta/status/2042415274511704434` → handle: `aakashgupta`, tweetId: `2042415274511704434`

## Usage

```bash
curl -s "https://api.fxtwitter.com/{handle}/status/{tweetId}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = d['tweet']
print('Author:', t['author']['name'], f\"(@{t['author']['screen_name']})\")
print('Text:', t['text'])
print('Likes:', t['likes'], '| RTs:', t['retweets'], '| Replies:', t['replies'])
if t.get('media') and t['media'].get('all'):
    for m in t['media']['all']:
        print(f\"Media: {m['type']} — {m.get('url', m.get('thumbnail_url', ''))}\")
# Resolved links from raw_text facets
raw = t.get('raw_text', {})
for facet in raw.get('facets', []):
    if facet.get('type') == 'url':
        print(f\"Link: {facet['replacement']} (was {facet['original']})\")
"
```

## Response Structure

Key fields in `response.tweet`:
- `text` — Full tweet text with t.co URLs already resolved inline
- `raw_text.text` — Original text with t.co URLs preserved
- `raw_text.facets[]` — Array mapping each entity (URLs, mentions, hashtags):
  - `type: "url"` → `original` (t.co) and `replacement` (resolved URL)
  - `type: "media"` → link points to tweet's own media, not external content
- `author` — Full author object (name, handle, avatar, followers, etc.)
- `likes`, `retweets`, `replies`, `bookmarks` — Engagement counts
- `media.all[]` — Media attachments with URLs, dimensions, alt text
- `quote` — Quoted tweet (same structure, recursive)
- `created_at` — Post timestamp

## t.co Link Resolution

Every t.co URL in a tweet is a 301 redirect. The fxtwitter API resolves them
automatically in the `text` field and maps them explicitly in `raw_text.facets[]`.
For bulk resolution:

```bash
# Resolve a single t.co URL without the full tweet API
curl -sI "https://t.co/Uw1o20VSMc" | grep -i "^location:" | cut -d' ' -f2
```

## When to Use

- The user shares a tweet URL and wants to discuss it
- A task needs tweet content (article links, thread text, engagement data)
- Resolving t.co shortened URLs to their destinations
- Enriching bookmark data that has truncated or missing text
- Any time you'd otherwise say "I can't access Twitter content"

## Notes

- No API key, no OAuth, no rate limiting encountered
- Response time ~200ms per call
- Works for public tweets only (protected accounts return errors)
- The API is a mirror/proxy — it reads from Twitter's public data
- For article content behind a resolved URL, follow up with the defuddle skill:
  `defuddle parse <resolved-url> --md`
