# COPILOT.md — YouTube Personal Video Library

> Full project context for AI-assisted development. Keep this file updated as the codebase evolves.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture — Version 1 State](#4-architecture--version-1-state)
5. [Data Model](#5-data-model)
6. [Component Inventory](#6-component-inventory)
7. [State Management](#7-state-management)
8. [Backend / API Layer](#8-backend--api-layer)
9. [Fetch Pipeline](#9-fetch-pipeline)
10. [Styling System](#10-styling-system)
11. [Routing & Navigation](#11-routing--navigation)
12. [Version 1 Feature Map](#12-version-1-feature-map)
13. [Known Limitations / Tech Debt (v1)](#13-known-limitations--tech-debt-v1)
14. [Version 2 Roadmap](#14-version-2-roadmap)
15. [Development Commands](#15-development-commands)
16. [Environment & Config](#16-environment--config)

---

## 1. Project Overview

A **personal YouTube video library** — a self-hosted, dark-themed single-page application that organises curated YouTube playlists into a browsable, searchable interface with an embedded player.

Videos are fetched from YouTube via a Node.js script (using `ytpl` + `ytdl-core` with `yt-dlp` fallback), cached into a local `videos.json` file, and served statically by the Vite React app. There is no user auth, no database — it's a personal tool deployed via GitHub Pages.

**Live deployment:** `https://<user>.github.io/YouTube/`

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 (Vite 8, JSX) |
| Bundler | Vite 8 + Rolldown |
| Styling | Plain CSS (single `App.css`), CSS custom properties |
| Charts | Recharts 3 |
| YouTube Player | `react-youtube` (wraps `youtube-player`) |
| Backend API | Express 5 (Node.js, ESM) |
| YouTube Data | `ytpl` 2.3 + `ytdl-core` 4.11 + `yt-dlp` CLI fallback |
| Deployment | `gh-pages` → GitHub Pages |
| Linting | ESLint 9 (flat config) with react-hooks + react-refresh plugins |
| Package Manager | npm (lockfile v3) |
| Node Requirement | `^20.19.0 \|\| >=22.12.0` |

---

## 3. Project Structure

```
youtube-library/
├── index.html                     # Entry HTML
├── vite.config.js                 # base: '/YouTube/'
├── package.json
├── eslint.config.js
│
├── public/
│   ├── favicon.svg                # Purple Vite-style bolt icon
│   └── icons.svg                  # SVG sprite (social icons)
│
├── src/
│   ├── main.jsx                   # React root mount
│   ├── App.jsx                    # Root component + all app state
│   │
│   ├── components/
│   │   ├── Player.jsx             # YouTube modal player (normal + mini PiP)
│   │   ├── VideoCard.jsx          # Individual video card with thumbnail fallback
│   │   ├── VideoGrid.jsx          # Grid layout wrapper
│   │   ├── FilterBar.jsx          # Group/Category/Playlist/Resolution/Sort dropdowns
│   │   ├── Dropdown.jsx           # Reusable accessible dropdown component
│   │   ├── AnalyticsDashboard.jsx # Full-screen analytics modal (Recharts)
│   │   └── ScriptsPage.jsx        # Dev tool: trigger fetch jobs via API
│   │
│   ├── styles/
│   │   └── App.css                # All styles (≈1,100 lines), CSS vars, dark theme
│   │
│   └── data/
│       ├── playlists.json         # SOURCE OF TRUTH: playlist IDs config
│       └── videos.json            # GENERATED: fetched video metadata cache
│
└── scripts/
    ├── fetchVideos.js             # Core fetch logic (ytpl → ytdl → yt-dlp)
    └── server.js                  # Express API server (port 3001)
```

---

## 4. Architecture — Version 1 State

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (SPA)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  App.jsx  (single source of truth — all useState)    │   │
│  │                                                        │   │
│  │  State:                                               │   │
│  │   activeGroup / activeCategory / activePlaylist       │   │
│  │   activeResolution / activeSort / searchQuery         │   │
│  │   selectedVideo / gridColumns / playerMode            │   │
│  │   showScripts / showAnalytics / isMonitorSize         │   │
│  │   isMiniPlayer                                        │   │
│  └───────┬──────────────────┬────────────────────────────┘   │
│          │ props            │ props                          │
│  ┌───────▼──────┐  ┌────────▼──────────────────────────┐    │
│  │  sticky-nav  │  │          Main Content              │    │
│  │  ┌─────────┐ │  │  ┌────────────┐  ┌─────────────┐  │    │
│  │  │ Header  │ │  │  │  HomeView  │  │ FilteredView│  │    │
│  │  │ Search  │ │  │  │ (latest 20)│  │  VideoGrid  │  │    │
│  │  └─────────┘ │  │  └────────────┘  └─────────────┘  │    │
│  │  ┌─────────┐ │  └───────────────────────────────────┘    │
│  │  │FilterBar│ │                                            │
│  │  └─────────┘ │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  └──────────────┘  │  Player  │ │Analytics │ │ Scripts  │  │
│                    │  Modal   │ │Dashboard │ │  Modal   │  │
│                    └──────────┘ └──────────┘ └──────────┘  │
│                                                              │
│  Data: import videosData from './data/videos.json'          │
│        (bundled at build time — static JSON, no API call)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              DEV-ONLY: Express API (port 3001)               │
│                                                              │
│  GET  /api/playlists   → reads playlists.json               │
│  GET  /api/stats       → reads videos.json, computes counts  │
│  POST /api/fetch       → spawns fetchVideos job, returns id  │
│  GET  /api/jobs/:id    → polls job status + logs            │
│                                                              │
│  ScriptsPage.jsx ←──── fetch() ────→ Express API            │
│                                       └──→ fetchVideos.js   │
│                                             └──→ ytpl/ytdl  │
│                                                  └──→ YouTube│
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions (v1)

- **Static data bundling**: `videos.json` is imported directly by React at build time. No runtime API calls to YouTube. The SPA works fully offline after build.
- **Zoom-based monitor scaling**: `isMonitorSize` toggle applies `document.documentElement.style.zoom = 1.75` for large monitors. Quick hack, not ideal for accessibility.
- **All state in App.jsx**: No Context, no Redux, no Zustand. Works fine at this scale.
- **CSS variables only**: No Tailwind, no CSS modules. Single `App.css` with 100+ CSS custom properties. Glassmorphism / Apple Music aesthetic.

---

## 5. Data Model

### `playlists.json` — Config (hand-edited)

```json
{
  "GroupName": {
    "icon": "emoji",
    "categories": {
      "CategoryName": {
        "PlaylistName": "YouTube_Playlist_ID_or_URL"
      }
    }
  }
}
```

Current groups: `Music`, `Nature`, `Movies`, `Games`

### `videos.json` — Generated Cache

```json
{
  "lastUpdated": "ISO-8601 timestamp",
  "groups": {
    "GroupName": {
      "icon": "emoji",
      "categories": {
        "CategoryName": {
          "PlaylistName": [ /* Video[] */ ]
        }
      }
    }
  }
}
```

### `Video` object schema

```typescript
interface Video {
  youtubeLinkID: string;       // YouTube video ID (e.g. "PmuQDnWT-WI")
  title: string;               // Video title
  thumbnail: string;           // https://img.youtube.com/vi/{id}/maxresdefault.jpg
  duration: string;            // Human-readable "3:26"
  durationSec: number;         // Raw seconds (for analytics)
  group: string;               // "Music"
  category: string;            // "Telugu"
  type: string;                // "Romance" (= playlist name)
  date: string;                // ISO-8601 publish date from YouTube
  resolution: string;          // "8K" | "4K" | "2K" | "1080p" | "720p" | "480p" | ""
}
```

### Current data stats (as of last fetch)

| Group | Videos |
|---|---|
| Music | ~680+ |
| Nature | ~50+ |
| Movies | ~35+ |
| Games | ~15+ |

Total: **~800+ videos** across 4 groups, 15+ categories, 60+ playlists.

---

## 6. Component Inventory

### `App.jsx`
- **Role**: Root component, single state store
- **Key logic**: `filteredVideos` memo, `latestVideos` memo, `videoCounts` memo, `availableResolutions` memo, `handleReset`, `handleGroupChange`, keyboard shortcut `⌘K` → focus search
- **Renders**: Header, FilterBar, HomeSection or VideoGrid, Player, AnalyticsDashboard, ScriptsPage

### `FilterBar.jsx`
- **Role**: Full filtering control surface
- **Features**: Group dropdown, Category dropdown (conditional), Resolution dropdown, Sort dropdown, Reset button, Quick Access chips (Telugu / Hindi / 8K Ultra), Playlist tabs row
- **Props**: Fully controlled — all state lives in App.jsx

### `Dropdown.jsx`
- **Role**: Reusable accessible custom dropdown
- **Features**: Outside-click close, Escape-key close, active item check, item count badge
- **Renders**: trigger button + animated menu with items

### `VideoCard.jsx`
- **Role**: Single video card
- **Features**: Lazy thumbnail loading with 3-level fallback chain (maxresdefault → hqdefault → mqdefault → SVG placeholder), skeleton shimmer, play overlay, duration badge, resolution badge, relative date with absolute tooltip
- **Staggered animation**: `animationDelay = Math.min(index * 0.03, 0.5)s`

### `VideoGrid.jsx`
- **Role**: Wraps VideoCard array
- **Features**: Empty state, optional `gridColumns` override via inline style

### `Player.jsx`
- **Role**: YouTube embed modal
- **Features**: Normal fullscreen modal, Mini PiP mode (bottom-right), ESC close, outside-click close, body scroll lock (normal mode only), "Open in YouTube" link, toggle mini button
- **Uses**: `react-youtube` component with `autoplay: 1`

### `AnalyticsDashboard.jsx`
- **Role**: Full-screen stats overlay
- **Charts**:
  - Area chart: Additions over time (by year)
  - Bar chart: Top 5 content types
  - Donut pie: Watch time by group (hours)
  - Donut pie: Resolution breakdown
  - Horizontal bar: Category scale (language)
  - Table: 20 most recently added videos
- **KPI cards**: Total watch time, 4K+ %, Top content flavor, Most recent addition
- **Note**: `zoom: 1/1.75` applied when `isMonitorSize` is true (inverse zoom compensation)

### `ScriptsPage.jsx`
- **Role**: Dev tool for triggering YouTube fetches
- **Features**: Server status indicator, total/groups/lastUpdated stats, fetch all / per-group / per-category / per-playlist buttons, real-time job log polling (1s interval)
- **API**: Communicates with Express on `http://localhost:3001`

---

## 7. State Management

All state lives in `App.jsx` via `useState`. No external state library.

```javascript
// Filter state
const [activeGroup, setActiveGroup] = useState('All');
const [activeCategory, setActiveCategory] = useState('All');
const [activePlaylist, setActivePlaylist] = useState('All');
const [activeResolution, setActiveResolution] = useState('All');
const [searchQuery, setSearchQuery] = useState('');
const [activeSort, setActiveSort] = useState('Newest First');

// UI state
const [selectedVideo, setSelectedVideo] = useState(null);
const [gridColumns, setGridColumns] = useState(3);   // NOTE: slider exists in CSS but not wired in FilterBar currently
const [showScripts, setShowScripts] = useState(false);
const [showAnalytics, setShowAnalytics] = useState(false);
const [isMonitorSize, setIsMonitorSize] = useState(false);
const [isMiniPlayer, setIsMiniPlayer] = useState(false);
```

### Derived state (useMemo)

| Memo | Depends on | Purpose |
|---|---|---|
| `allVideos` | `videosData` | Flat array of all videos + group/category meta |
| `latestVideos` | `allVideos`, `activeResolution` | Top 20 newest for home view |
| `availableResolutions` | `allVideos` | Sorted list for resolution dropdown |
| `activeCategories` | `activeGroup`, `groupMeta` | Category list for current group |
| `activePlaylists` | `activeGroup`, `activeCategory`, `groupMeta` | Playlist tabs for current category |
| `videoCounts` | `allVideos`, `groups` | Count lookup `{total, groups{}, categories{}, playlists{}}` |
| `filteredVideos` | All filter state, `allVideos` | The videos currently displayed |

---

## 8. Backend / API Layer

**File**: `scripts/server.js`  
**Port**: `3001`  
**Start**: `npm run api`

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/playlists` | Returns parsed `playlists.json` |
| `GET` | `/api/stats` | Counts videos per group/category/playlist, returns `{total, groups, lastUpdated}` |
| `POST` | `/api/fetch` | Body: `{group?, category?, playlist?}`. Starts async fetch job. Returns `{jobId}` |
| `GET` | `/api/jobs/:id` | Returns `{status, logs[], summary?, error?}` for a job |

Jobs are tracked in-memory (`Map`). Server restart clears all jobs. No persistence.

---

## 9. Fetch Pipeline

**File**: `scripts/fetchVideos.js`

```
playlists.json
    ↓
fetchVideos({ targetGroup, targetCategory, targetPlaylist, log })
    ↓
for each group → for each category → for each playlist:
    ↓
fetchPlaylist(idOrUrl, groupName, catName, plName, videoCache, log)
    ↓
1. Try ytpl(playlistId, { limit: Infinity })
   ↓ on failure
2. Fall back: execSync("yt-dlp --flat-playlist --dump-json ...")
    ↓
for each video item:
    - Check videoCache (Map<youtubeLinkID, Video>)
    - If cached → reuse (update group/category/type)
    - If new → ytdl.getBasicInfo(id) for publishDate + resolution
    - sleep(500ms) between fetches
    ↓
Write merged result to videos.json
```

**Cache key**: `youtubeLinkID`  
**Rate limiting**: 500ms sleep between individual video fetches  
**Resolution detection**: Parses `qualityLabel` from ytdl format list → returns max height label

---

## 10. Styling System

**File**: `src/styles/App.css` (~1,100 lines)

### CSS Custom Properties

```css
/* Surfaces */
--bg-primary: #0a0a0a
--bg-secondary: #111111
--bg-card: #181818
--bg-card-hover: #212121
--bg-elevated: #1e1e1e
--bg-modal: rgba(0,0,0,0.85)

/* Text */
--text-primary: #f1f1f1
--text-secondary: #aaaaaa
--text-muted: #717171

/* Accent */
--accent: #ff0033
--accent-soft: rgba(255,0,51,0.15)
--accent-gradient: linear-gradient(135deg, #ff0033, #ff2d78)

/* Borders */
--border-subtle: rgba(255,255,255,0.06)
--border-hover: rgba(255,255,255,0.12)

/* Grid */
--grid-gap: 16px
--card-min-width: 290px  (310px at ≥1200px)
```

### Design Language

- **Theme**: Ultra-dark (#0a0a0a base), Apple Music aesthetic
- **Glassmorphism**: `backdrop-filter: blur(45px) saturate(200%)` on header/nav
- **Accent colour**: `#ff0033` / `#ff2d78` (YouTube red → pink gradient)
- **Typography**: Inter (Google Fonts) with tabular numerics
- **Card hover**: `translateY(-4px) scale(1.01)` + box-shadow
- **Animations**: `cardSlideIn`, `fadeIn`, `dropdownSlide`, `shimmer`
- **Scrollbars**: Hidden globally (`scrollbar-width: none`)
- **Responsive**: 480px (1-col), 768px (2-col forced), 1200px (wider cards)

---

## 11. Routing & Navigation

**No router** — single page, all navigation is pure state. Sharing a specific filter requires manually bookmarking.

The `isHomeView` flag (`activeGroup === 'All' && !searchQuery`) switches between:
- **Home view**: "Recently Added" section (latest 20 videos)
- **Filtered view**: Full `filteredVideos` grid

URL: Always `https://<user>.github.io/YouTube/` (no hash routing).

---

## 12. Version 1 Feature Map

### ✅ Implemented

| Feature | Location |
|---|---|
| Browse by Group / Category / Playlist | FilterBar → App state |
| Filter by resolution (8K, 4K, etc.) | FilterBar → App state |
| Sort: Newest First / Oldest First | FilterBar → App state |
| Text search (title substring) | Header search + FilterBar state |
| Quick Access chips (Telugu / Hindi / 8K) | FilterBar |
| Home view: latest 20 videos | App.jsx `isHomeView` branch |
| Video card with thumbnail fallback chain | VideoCard.jsx |
| Embedded YouTube player modal | Player.jsx + react-youtube |
| Mini PiP player | Player.jsx `isMiniPlayer` |
| Full-screen analytics dashboard | AnalyticsDashboard.jsx |
| KPI cards: watch time, 4K%, top type, latest | AnalyticsDashboard |
| Charts: timeline, top types, watch time pie, resolution pie, category bar | AnalyticsDashboard |
| Recently added table (top 20) | AnalyticsDashboard |
| Monitor size zoom toggle (100% ↔ 175%) | App.jsx `isMonitorSize` |
| Scripts / fetch trigger UI | ScriptsPage.jsx |
| Express API for fetch jobs | scripts/server.js |
| ytpl + yt-dlp fallback fetch | scripts/fetchVideos.js |
| Incremental fetch with cache | fetchVideos.js `videoCache` |
| GitHub Pages deployment | `gh-pages`, `vite.config.js base` |
| ⌘K keyboard shortcut for search | App.jsx useEffect |
| ESC to close player | Player.jsx useEffect |

### ❌ Not Implemented (v1 gaps)

- URL-based filter state (no deep linking)
- Watch history / resume position
- Favourites / bookmark list
- Playlist-level shuffle
- Continuous/autoplay queue
- Mobile gesture support
- Dark/light theme toggle
- Keyboard navigation in video grid
- Video preview on hover (thumbnail GIF / preview)
- Full-text search across title + metadata
- Sort by duration / alphabetical
- Batch thumbnail preloading strategy
- PWA / offline support
- Video count visible in playlist tabs

---

## 13. Known Limitations / Tech Debt (v1)

1. **`zoom` hack for monitor scaling** — `document.documentElement.style.zoom` is non-standard, breaks accessibility, and causes layout jank. Should be replaced with viewport/container queries or a proper scale transform.

2. **`gridColumns` state exists but slider is unused in FilterBar** — the `onGridColumnsChange` prop is passed but the slider UI is hidden (`display: none`) on mobile and no trigger exists on desktop in current FilterBar code.

3. **`videos.json` bundled at build time** — any new fetch requires a rebuild and redeploy. For a personal tool this is fine, but means data is always stale after the last build.

4. **No error boundaries** — if `videos.json` is malformed or a component throws, the whole app crashes to blank.

5. **`ytdl-core` is largely broken** for modern YouTube (anti-bot) — `yt-dlp` fallback works but `ytdl.getBasicInfo()` for resolution/date often silently fails and returns empty strings.

6. **All CSS in one file** — at 1,100 lines it's manageable but will become unwieldy. No CSS modules or scoping.

7. **Analytics `zoom: 1/1.75` compensation** is fragile — `style={{ zoom: isMonitorSize ? (1 / 1.75) : 1 }}` inside the component is a hack that only works because the parent already applied `1.75x`.

8. **No TypeScript** — prop types are undocumented. Adding new components risks prop mismatches with no compile-time safety.

9. **In-memory job store** — Express API loses all job history on restart. Fine for dev use.

10. **Quick Access chips are hardcoded** — `Telugu`, `Hindi`, `8K Ultra` are hardcoded strings in FilterBar. Should be config-driven.

---

## 14. Version 2 Roadmap

### Priority 1 — Core UX Improvements

#### 1.1 URL-Based Filter State (Deep Linking)
**Why**: Can't share or bookmark a specific filtered view.  
**How**: Replace `useState` filters with URL search params via a lightweight hook (`useSearchParams` pattern, no React Router needed — just `window.history.pushState` + `popstate` listener).  
```
/YouTube/?group=Music&category=Telugu&playlist=Romance&resolution=8K
```
**Files affected**: `App.jsx`, `FilterBar.jsx`

#### 1.2 Watch History & Resume Position
**Why**: Can't remember what was watched or where you left off.  
**How**: Use `localStorage` to store `{ [youtubeLinkID]: { watchedAt, progressSec } }`. Show a "Continue watching" row on the home screen. Display a coloured progress bar on cards that have been partially watched.  
**New component**: `ContinueWatching.jsx`  
**Files affected**: `Player.jsx` (YouTube `onStateChange` event to track progress), `VideoCard.jsx` (progress bar), `App.jsx`

#### 1.3 Favourites / Bookmarks
**Why**: No way to curate personal sublists.  
**How**: `localStorage` Set of `youtubeLinkID`. Heart icon on cards (toggle), dedicated "Favourites" quick-access chip. Optional export to JSON.  
**Files affected**: `VideoCard.jsx`, `FilterBar.jsx`, `App.jsx`

---

### Priority 2 — Playback Enhancements

#### 2.1 Autoplay Queue
**Why**: Currently each video must be manually opened.  
**How**: Maintain a `queue: Video[]` in state. When a video ends (`onEnd` YouTube event), auto-advance to the next video in the current filtered set. Show queue panel in player sidebar.  
**New component**: `QueuePanel.jsx`  
**Files affected**: `Player.jsx`, `App.jsx`

#### 2.2 Shuffle Mode
**Why**: Browse content in a randomised order.  
**How**: `shuffleActive` boolean in state. When active, `filteredVideos` is shuffled using a seeded Fisher-Yates. Toggle button in FilterBar or Player.

#### 2.3 Keyboard Navigation
**Why**: Power users can't navigate without mouse.  
**How**:
- Arrow keys to move focus between cards in grid
- `Enter` / `Space` to open selected card
- `N` / `P` for next/prev video when player is open
- `M` for mini-player toggle
- `F` for fullscreen YouTube embed  
**Files affected**: `VideoGrid.jsx`, `VideoCard.jsx`, `Player.jsx`

---

### Priority 3 — Search & Discovery

#### 3.1 Richer Search (with filters inline)
**Why**: Search only matches title substring. No way to search by resolution, date range, or type.  
**How**: Extend the search query parser:
- `res:8K` → resolution filter
- `after:2024` → date filter  
- `type:romance` → playlist type filter
- Default: title + type combined

#### 3.2 Related Videos Panel
**Why**: No discovery mechanism from the player.  
**How**: When a video is playing, show a sidebar of 8–10 videos from the same playlist/category, sorted by similarity (same type, nearest date). Uses existing local data — no API call.  
**New component**: `RelatedPanel.jsx`

#### 3.3 Sort by Duration / Alphabetical
**Why**: Only Newest/Oldest sort available.  
**How**: Add options to `sortOptions` array in `FilterBar.jsx` and extend `filteredVideos` sort in `App.jsx`:
- Shortest First / Longest First
- A → Z / Z → A

---

### Priority 4 — Data & Fetch Pipeline

#### 4.1 Scheduled Auto-Fetch (Cron)
**Why**: Data only updates when manually triggered from ScriptsPage.  
**How**: Add a `node-cron` job inside `server.js` that runs `fetchVideos({ targetGroup: null })` every Sunday at 3am. Optionally send a desktop notification on completion.  
**Files affected**: `scripts/server.js`

#### 4.2 Replace `ytdl-core` with `yt-dlp` for Metadata
**Why**: `ytdl-core` is largely broken for modern YouTube (fails silently for resolution/date).  
**How**: Replace `ytdl.getBasicInfo()` calls with `yt-dlp --dump-json {videoId}` shell execution. Parse `upload_date` and `height` from yt-dlp JSON output. More reliable, actively maintained.  
**Files affected**: `scripts/fetchVideos.js`

#### 4.3 Incremental Delta Fetch (New Videos Only)
**Why**: Full-playlist fetches are slow when only a few new videos were added.  
**How**: Compare playlist item list from ytpl against existing cache. Only fetch `ytdl.getBasicInfo` for IDs not in cache. Already partially implemented via `videoCache` — needs `--playlist-end N` optimisation to only check the first N items.

---

### Priority 5 — UI & Polish

#### 5.1 Video Hover Preview
**Why**: No way to preview content without opening the player.  
**How**: On card hover (after 800ms delay), load the YouTube thumbnail sequence or a short clip preview. Simplest implementation: cycle through `/0.jpg`, `/1.jpg`, `/2.jpg`, `/3.jpg` thumbnails on a 500ms interval.  
**Files affected**: `VideoCard.jsx`

#### 5.2 Playlist-Level Stats
**Why**: No per-playlist metadata visible in the UI.  
**How**: Show video count in playlist tabs (currently commented out in `FilterBar.jsx` — just uncomment and style the `filter-bar__count` span). Add total duration per playlist.

#### 5.3 Light Theme Support
**Why**: Always dark. Some use cases (presentations, bright environments) need lighter UI.  
**How**: Add `data-theme="light"` attribute toggle on `<html>`. Define light overrides for all CSS custom properties. Add toggle button in header.

#### 5.4 PWA / Offline Support
**Why**: App currently requires internet to load YouTube thumbnails.  
**How**: Add `vite-plugin-pwa` (Workbox). Cache-first strategy for thumbnails and the bundled `videos.json`. Manifest with icons. Installable on desktop/mobile.

#### 5.5 Fix Monitor Zoom (Replace `zoom` hack)
**Why**: `zoom` is non-standard and accessibility-hostile.  
**How**: Use CSS `transform: scale(1.75)` with `transform-origin: top left` + compensate container width, or better: implement proper CSS container queries / `clamp()`-based fluid typography.

---

### Priority 6 — TypeScript Migration

**Why**: Codebase is growing; prop mismatches are silent.  
**Approach**: Gradual migration.
1. Rename `vite.config.js` → `vite.config.ts`, add tsconfig
2. Add `Video`, `Group`, `Category` interfaces in `src/types.ts`
3. Migrate leaf components first (`VideoCard`, `Dropdown`, `VideoGrid`)
4. Migrate stateful components last (`App`, `FilterBar`, `AnalyticsDashboard`)

---

### v2 Feature Summary Table

| Feature | Priority | Effort | Impact |
|---|---|---|---|
| URL-based filter state | P1 | Small | High |
| Watch history + resume | P1 | Medium | High |
| Favourites / bookmarks | P1 | Small | High |
| Autoplay queue | P2 | Medium | High |
| Shuffle mode | P2 | Small | Medium |
| Keyboard navigation | P2 | Medium | Medium |
| Richer search parser | P3 | Medium | Medium |
| Related videos panel | P3 | Small | Medium |
| Sort by duration/alpha | P3 | Small | Low |
| Scheduled auto-fetch | P4 | Small | Medium |
| Replace ytdl with yt-dlp | P4 | Small | High |
| Hover video preview | P5 | Medium | Medium |
| Playlist-level stats | P5 | Small | Low |
| Light theme | P5 | Medium | Low |
| PWA / offline | P5 | Medium | Low |
| Fix zoom hack | P5 | Medium | Medium |
| TypeScript migration | P6 | Large | Medium |

---

## 15. Development Commands

```bash
# Install dependencies
npm install

# Run frontend (Vite dev server, port 5173)
npm run dev

# Run backend API (Express, port 3001)
npm run api

# Run both concurrently
npm start

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to GitHub Pages
npm run deploy

# Fetch all videos (CLI, no server needed)
npm run fetch-videos

# Fetch specific group
node scripts/fetchVideos.js Music

# Fetch specific group + category
node scripts/fetchVideos.js Music Telugu

# Fetch specific playlist
node scripts/fetchVideos.js Music Telugu Romance

# Lint
npm run lint
```

---

## 16. Environment & Config

### `vite.config.js`
```javascript
{
  base: '/YouTube/',           // GitHub Pages subdirectory
  server: { host: '127.0.0.1', port: 5173 }
}
```

### No `.env` required
All configuration is hardcoded or read from JSON files. No API keys needed (YouTube data is fetched via ytpl/yt-dlp, not YouTube Data API).

### Build output
`dist/` — static files, deployed to `gh-pages` branch.

### Data files location
- `src/data/playlists.json` — committed to repo (source of truth)
- `src/data/videos.json` — should be in `.gitignore` if large; currently not in `.gitignore` (see note below)

> **Note**: `videos.json` is not listed in `.gitignore`. For a personal tool deployed via `gh-pages`, this is intentional — the generated data is committed and bundled. The file is currently ~large (800+ videos with full metadata). Consider adding it to `.gitignore` and generating it at CI build time for cleaner version control.

---

*Last updated: April 2026 — reflects v1 state as of last commit.*