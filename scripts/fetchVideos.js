import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ytpl from 'ytpl';
import ytdl from 'ytdl-core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYLISTS_FILE = path.join(__dirname, '../src/data/playlists.json');
const VIDEOS_FILE = path.join(__dirname, '../src/data/videos.json');

const DELAY_MS = 500;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getResolutionLabel(formats) {
  if (!formats || !Array.isArray(formats)) return '';
  const heights = formats
    .filter(f => f.qualityLabel)
    .map(f => { const m = f.qualityLabel.match(/(\d+)p/); return m ? parseInt(m[1]) : 0; })
    .filter(h => h > 0);
  if (heights.length === 0) return '';
  const max = Math.max(...heights);
  if (max >= 4320) return '8K';
  if (max >= 2160) return '4K';
  if (max >= 1440) return '2K';
  if (max >= 1080) return '1080p';
  if (max >= 720) return '720p';
  if (max >= 480) return '480p';
  return `${max}p`;
}

/** Build a Set of all existing YouTube IDs from videos.json */
function buildVideoCache(existingGroups) {
  const cache = new Map();
  for (const [groupName, group] of Object.entries(existingGroups)) {
    for (const [catName, cat] of Object.entries(group.categories || {})) {
      for (const [plName, videos] of Object.entries(cat || {})) {
        for (const v of videos) {
          cache.set(v.youtubeLinkID, v);
        }
      }
    }
  }
  return cache;
}

/**
 * Fetch a playlist, using cache when possible.
 * @param {string} url - Playlist URL
 * @param {string} groupName
 * @param {string} categoryName
 * @param {string} playlistName
 * @param {Map} videoCache - Existing video data by ID
 * @param {function} log - Logging function (console.log or custom)
 */
export async function fetchPlaylist(idOrUrl, groupName, categoryName, playlistName, videoCache, log = console.log) {
  // Support both raw IDs and full URLs
  const playlistId = idOrUrl.includes('list=')
    ? idOrUrl.split('list=')[1]?.split('&')[0]
    : idOrUrl.trim();

  if (!playlistId) {
    log(`    ⚠️  Invalid playlist ID: ${idOrUrl}`);
    return [];
  }

  // Fetch playlist items using chunked pagination (yt-dlp caps at ~100 per request)
  let playlistItems = [];
  const seenIds = new Set();

  const addItems = (items) => {
    let added = 0;
    for (const item of items) {
      if (item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        playlistItems.push(item);
        added++;
      }
    }
    return added;
  };

  // Primary: yt-dlp with chunked pagination (100 items per page)
  const CHUNK_SIZE = 100;
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  let page = 0;

  while (true) {
    const start = page * CHUNK_SIZE + 1;
    const end = start + CHUNK_SIZE - 1;
    try {
      const raw = execSync(
        `yt-dlp --flat-playlist --dump-json --no-warnings --playlist-items ${start}:${end} "${url}"`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
      );
      const items = raw.trim().split('\n').filter(Boolean).map(line => {
        const entry = JSON.parse(line);
        return {
          id: entry.id,
          title: entry.title || 'Untitled',
          durationSec: Math.round(entry.duration || 0),
        };
      });

      if (items.length === 0) break;

      const count = addItems(items);
      log(`    📋 Page ${page + 1} (items ${start}-${end}): got ${items.length} videos, ${count} new`);

      // If we got fewer than CHUNK_SIZE, that's the last page
      if (items.length < CHUNK_SIZE) break;
      page++;
    } catch (err) {
      // If first page fails, that's a real error. Otherwise we just ran out of items.
      if (page === 0 && playlistItems.length === 0) {
        log(`    ⚠️  yt-dlp failed: ${err.message?.substring(0, 80)}`);
      }
      break;
    }
  }

  // Supplement: try ytpl to catch anything yt-dlp missed
  try {
    const playlist = await ytpl(playlistId, { limit: Infinity });
    const items = playlist.items.map(item => ({
      id: item.id,
      title: item.title,
      durationSec: item.durationSec || 0,
    }));
    const count = addItems(items);
    if (count > 0) log(`    ➕ ytpl recovered ${count} extra videos`);
  } catch (err) {
    // ytpl is optional, don't worry if it fails
  }

  if (playlistItems.length === 0) {
    throw new Error('Failed to fetch any videos from playlist');
  }

  log(`    📊 Total unique videos: ${playlistItems.length}`);

  const total = playlistItems.length;
  let cached = 0;
  let fetched = 0;

  // Re-calculate since elements might have been added
  log(`    Found ${total} total videos. Processing...\n`);

  const videos = [];

  for (let i = 0; i < total; i++) {
    const item = playlistItems[i];
    const progress = `    [${i + 1}/${total}]`;

    // Check cache first
    const existing = videoCache.get(item.id);
    if (existing && existing.date) {
      // Re-use cached data, just update group/category/type in case it moved
      videos.push({
        ...existing,
        group: groupName,
        category: categoryName,
        type: playlistName,
      });
      cached++;
      log(`${progress} ⚡ CACHED: ${item.title.substring(0, 50)}...`);
      continue;
    }

    // Fetch fresh data
    let publishDate = '';
    let resolution = '';
    let viewCount = 0;
    try {
      const info = await ytdl.getBasicInfo(item.id);
      publishDate = info.videoDetails.publishDate || '';
      resolution = getResolutionLabel(info.formats || []);
      viewCount = parseInt(info.videoDetails.viewCount) || 0;
      
      if (item.title === 'Fetching title...' || !item.title) {
        item.title = info.videoDetails.title || 'Unknown Title';
      }
      if (!item.durationSec && info.videoDetails.lengthSeconds) {
        item.durationSec = parseInt(info.videoDetails.lengthSeconds) || 0;
      }
    } catch (e) {
      // Fall back
    }

    videos.push({
      youtubeLinkID: item.id,
      title: item.title,
      thumbnail: `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
      duration: formatDuration(item.durationSec || 0),
      durationSec: item.durationSec || 0,
      group: groupName,
      category: categoryName,
      type: playlistName,
      date: publishDate,
      resolution,
      viewCount
    });

    fetched++;
    const resLabel = resolution ? ` [${resolution}]` : '';
    log(`${progress} ✓${resLabel} ${item.title.substring(0, 50)}...`);
    await sleep(DELAY_MS);
  }

  log(`\n    📊 ${cached} cached, ${fetched} fetched, ${total} total.`);
  return videos;
}

/**
 * Main fetch function. Can be imported or run as CLI.
 * @param {object} opts - { targetGroup, targetCategory, targetPlaylist, log }
 */
export async function fetchVideos(opts = {}) {
  const { targetGroup = null, targetCategory = null, targetPlaylist = null, log = console.log } = opts;

  log('\n🎬 YouTube Video Library — Fetch Script (3-Level + Cache)\n');

  if (!fs.existsSync(PLAYLISTS_FILE)) {
    throw new Error(`Playlists file not found at ${PLAYLISTS_FILE}`);
  }

  const playlists = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));

  // Load existing data + build cache
  let existingGroups = {};
  if (fs.existsSync(VIDEOS_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf-8'));
      existingGroups = existing.groups || {};
    } catch (e) {
      log('⚠️  Could not parse existing videos.json, starting fresh.');
    }
  }

  const videoCache = buildVideoCache(existingGroups);
  log(`📦 Cache: ${videoCache.size} existing videos loaded.\n`);

  // Validate CLI args
  if (targetGroup && !playlists[targetGroup]) {
    throw new Error(`Group "${targetGroup}" not found. Available: ${Object.keys(playlists).join(', ')}`);
  }
  if (targetGroup && targetCategory) {
    const cats = playlists[targetGroup].categories || {};
    if (!cats[targetCategory]) {
      throw new Error(`Category "${targetCategory}" not found. Available: ${Object.keys(cats).join(', ')}`);
    }
    if (targetPlaylist && !cats[targetCategory][targetPlaylist]) {
      throw new Error(`Playlist "${targetPlaylist}" not found. Available: ${Object.keys(cats[targetCategory]).join(', ')}`);
    }
  }

  const mode = targetPlaylist
    ? `Single playlist — "${targetGroup}" > "${targetCategory}" > "${targetPlaylist}"`
    : targetCategory
    ? `Category — "${targetGroup}" > "${targetCategory}"`
    : targetGroup
    ? `Group — "${targetGroup}"`
    : 'Full update';
  log(`📂 Mode: ${mode}\n`);

  if (!targetGroup) existingGroups = {};

  const groupsToProcess = targetGroup
    ? [[targetGroup, playlists[targetGroup]]]
    : Object.entries(playlists);

  for (const [groupName, groupConfig] of groupsToProcess) {
    const icon = groupConfig.icon || '';
    const allCategories = groupConfig.categories || {};

    if (!existingGroups[groupName]) existingGroups[groupName] = { icon, categories: {} };
    existingGroups[groupName].icon = icon;
    if (!targetCategory) existingGroups[groupName].categories = {};

    const catsToProcess = targetCategory
      ? [[targetCategory, allCategories[targetCategory]]]
      : Object.entries(allCategories);

    if (catsToProcess.length === 0) {
      log(`⏭  Skipping "${groupName}" — no categories defined.\n`);
      continue;
    }

    for (const [catName, catPlaylists] of catsToProcess) {
      if (!existingGroups[groupName].categories[catName]) existingGroups[groupName].categories[catName] = {};
      if (!targetPlaylist) existingGroups[groupName].categories[catName] = {};

      const plToProcess = targetPlaylist
        ? [[targetPlaylist, catPlaylists[targetPlaylist]]]
        : Object.entries(catPlaylists || {});

      for (const [plName, idOrUrl] of plToProcess) {
        log(`\n━━━ ${icon} ${groupName} > ${catName} > ${plName} ━━━`);
        log(`    ID: ${idOrUrl}`);
        if (!idOrUrl) { log(`    ⚠️  No ID, skipping.`); continue; }

        try {
          const videos = await fetchPlaylist(idOrUrl, groupName, catName, plName, videoCache, log);
          existingGroups[groupName].categories[catName][plName] = videos;
          log(`    ✅ ${plName}: ${videos.length} videos saved.`);
        } catch (err) {
          log(`    ❌ Error: ${err.message}`);
        }
      }
    }
  }

  // Write
  const output = { lastUpdated: new Date().toISOString(), groups: existingGroups };
  fs.writeFileSync(VIDEOS_FILE, JSON.stringify(output, null, 2));

  let totalVideos = 0, totalPlaylists = 0;
  for (const group of Object.values(existingGroups)) {
    for (const cat of Object.values(group.categories || {})) {
      for (const vids of Object.values(cat || {})) {
        totalVideos += vids.length;
        totalPlaylists++;
      }
    }
  }

  const summary = `✅ Done! ${totalVideos} videos across ${totalPlaylists} playlists.`;
  log(`\n${'═'.repeat(40)}\n${summary}\n${'═'.repeat(40)}\n`);
  return summary;
}

// CLI entry point
if (process.argv[1]?.includes('fetchVideos')) {
  const args = process.argv.slice(2);
  fetchVideos({
    targetGroup: args[0] || null,
    targetCategory: args[1] || null,
    targetPlaylist: args[2] || null,
  }).catch((err) => {
    console.error('💥 Fatal:', err.message);
    process.exit(1);
  });
}
