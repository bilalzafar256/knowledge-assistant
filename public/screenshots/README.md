# Landing page screenshots

Drop the following PNGs into this folder. The landing page at `/` references them
by name; missing files will simply render as broken-image icons until you add them.

**Recommended:** 1600×1000 PNGs, 16:10 aspect, one consistent theme (light or dark)
across all four product shots.

| Filename | Source page | Notes |
|---|---|---|
| `hero-chat.png` | `/dashboard/chat/[id]` with sources panel visible | Hero visual, biggest impact — make it count |
| `dashboard-overview.png` | `/dashboard` (stats cards) | |
| `chat-with-sources.png` | `/dashboard/chat/[id]` with sources panel visible | Can be a tighter crop of `hero-chat.png` |
| `documents-list.png` | `/dashboard/documents` | Ideally with at least one doc in each ingestion state |
| `settings-activity.png` | `/dashboard/settings` → Activity tab | |
| `telegram-approval.png` *(optional)* | Telegram chat — bot's approval message | Only if you have a clean one; otherwise drop it and keep the flow diagram |

## Quick capture tips

- `pnpm dev` → log in → load each route → screenshot at 1600px viewport.
- macOS: ⌘+⇧+4, then space, then click the browser window for a clean window-shot.
- For privacy, swap any real document titles to generic placeholders before publishing.
