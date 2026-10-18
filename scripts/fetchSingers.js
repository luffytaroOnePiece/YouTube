import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import ytdl from 'ytdl-core';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ─────────────────────────────────────────────────────
const SINGERS_INPUT = path.join(__dirname, '../src/data/singers.json');
const SINGERS_OUTPUT = path.join(__dirname, '../src/data/singersData.json');

// ── Read TMDB key from .env.local ─────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found — TMDB API key required');
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
  }
  return env;
}

const env = loadEnv();
const TMDB_READ_ACCESS_TOKEN = env.VITE_TMDB_READ_ACCESS_TOKEN;
if (!TMDB_READ_ACCESS_TOKEN) {
  throw new Error('VITE_TMDB_READ_ACCESS_TOKEN not found in .env.local');
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const DELAY_MS = 300;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── TMDB Fetch Helper ──────────────────────────────────────────
async function tmdbFetch(endpoint) {
  const url = `${TMDB_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
    },
  });
  if (!res.ok) {
    console.error(`  ⚠️  TMDB ${res.status} for ${endpoint}`);
    return null;
  }
  return res.json();
}

// ── Duration Formatter ─────────────────────────────────────────
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

// ── Fetch YouTube Playlist via yt-dlp & full metadata via ytdl-core ──
async function fetchPlaylistVideos(playlistId, cachedVideosMap = new Map()) {
  if (!playlistId) return [];
  let playlistItems = [];
  try {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const { stdout: raw } = await execAsync(
      `yt-dlp --flat-playlist --dump-json --no-warnings "${url}"`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    playlistItems = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (err) {
    console.error(`  ⚠️  yt-dlp failed for ${playlistId}: ${err.message?.substring(0, 100)}`);
    return [];
  }

  const videos = [];
  for (const entry of playlistItems) {
    const existing = cachedVideosMap.get(entry.id);
    if (existing && existing.date) {
      videos.push(existing);
      continue;
    }

    let publishDate = '';
    let resolution = '';
    let viewCount = 0;
    let durationSec = Math.round(entry.duration || 0);
    let title = entry.title || 'Untitled';

    try {
      const info = await ytdl.getBasicInfo(entry.id);
      publishDate = info.videoDetails.publishDate || '';
      resolution = getResolutionLabel(info.formats || []);
      viewCount = parseInt(info.videoDetails.viewCount) || 0;
      
      if (title === 'Fetching title...' || title === 'Untitled' || !title) {
        title = info.videoDetails.title || 'Unknown Title';
      }
      if (!durationSec && info.videoDetails.lengthSeconds) {
        durationSec = parseInt(info.videoDetails.lengthSeconds) || 0;
      }
    } catch (e) {
      // Fallback to minimal data if ytdl fails
    }

    videos.push({
      youtubeLinkID: entry.id,
      title,
      thumbnail: `https://img.youtube.com/vi/${entry.id}/maxresdefault.jpg`,
      duration: formatDuration(durationSec),
      durationSec,
      date: publishDate,
      resolution,
      viewCount,
    });
    await new Promise(r => setTimeout(r, 200));
  }
  return videos;
}

// ── Fetch YouTube Playlist Count Only ────────────────────────
async function fetchPlaylistCount(playlistId) {
  if (!playlistId) return 0;
  try {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const { stdout: raw } = await execAsync(
      `yt-dlp --flat-playlist --playlist-end 1 --print "%(playlist_count)s" --no-warnings "${url}"`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    const lines = raw.trim().split('\n').filter(Boolean);
    const countStr = lines[lines.length - 1];
    return parseInt(countStr, 10) || 0;
  } catch (err) {
    return 0;
  }
}

// ── Extract numeric TMDB ID from the id field ─────────────────
function extractTmdbId(id) {
  if (!id) return null;
  const match = String(id).match(/^(\d+)/);
  return match ? match[1] : null;
}

// ── Main ───────────────────────────────────────────────────────
async function fetchSingers() {
  console.log('\n🎤 Singer Albums — Fetch Script\n');

  if (!fs.existsSync(SINGERS_INPUT)) {
    throw new Error(`singers.json not found at ${SINGERS_INPUT}`);
  }

  const singersInput = JSON.parse(fs.readFileSync(SINGERS_INPUT, 'utf-8'));
  const categories = Object.keys(singersInput);
  const totalSingers = categories.reduce((sum, cat) => sum + singersInput[cat].length, 0);
  console.log(`📋 Found ${totalSingers} singers across ${categories.length} categories.\n`);

  // Load existing data for caching
  let existingData = {};
  if (fs.existsSync(SINGERS_OUTPUT)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SINGERS_OUTPUT, 'utf-8'));
      existingData = existing.singers || {};
    } catch (e) {
      console.log('⚠️  Could not parse existing singersData.json, starting fresh.');
    }
  }

  // Build a video cache from existing data
  const cachedVideosMap = new Map();
  for (const catSingers of Object.values(existingData)) {
    if (!Array.isArray(catSingers)) continue;
    for (const singer of catSingers) {
      if (singer.videos) {
        for (const v of singer.videos) {
          cachedVideosMap.set(v.youtubeLinkID, v);
        }
      }
      if (singer.liveVideos) {
        for (const v of singer.liveVideos) {
          cachedVideosMap.set(v.youtubeLinkID, v);
        }
      }
    }
  }

  // Build a lookup for cached singers by id or name
  const cachedSingersMap = new Map();
  for (const [cat, catSingers] of Object.entries(existingData)) {
    if (!Array.isArray(catSingers)) continue;
    for (const singer of catSingers) {
      const key = singer.id || singer.name;
      if (key) cachedSingersMap.set(key, singer);
    }
  }

  const output = {};

  for (const category of categories) {
    const singers = singersInput[category] || [];
    console.log(`\n🎵 Category: ${category} (${singers.length} singers)\n`);

    const results = [];

    // Process singers in chunks of 3
    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const chunks = chunkArray(singers, 3);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`  ⏳ Processing chunk ${i + 1}/${chunks.length}...`);

      const chunkResults = await Promise.all(chunk.map(async (singer) => {
        const tmdbId = extractTmdbId(singer.id);
        const cacheKey = singer.id || singer.name;
        const cached = cachedSingersMap.get(cacheKey);

        // Check if we can use cache
        if (cached && cached.videos && cached.videos.length > 0) {
          const currentCount = await fetchPlaylistCount(singer.YoutubePlaylistID);
          if (currentCount > 0 && currentCount === cached.videos.length && cached.videos[0]?.date) {
            // Also check live playlist
            let liveOk = true;
            if (singer.LivePlaylistID && singer.LivePlaylistID.trim()) {
              const liveCount = await fetchPlaylistCount(singer.LivePlaylistID);
              if (liveCount > 0 && cached.liveVideos && liveCount !== cached.liveVideos.length) {
                liveOk = false;
              }
            }
            if (liveOk) {
              console.log(`  ⚡ CACHED — ${singer.name}`);
              const customImage = singer.customImage || null;
              const profileUrl = customImage || cached.profileUrl;
              return {
                ...cached,
                customImage,
                profileUrl,
                genre: singer.Genre || cached.genre,
                category
              };
            }
          }
          console.log(`  🔄 REFETCHING — ${singer.name}`);
        }

        // ── Fetch TMDB person details ──────────────────────────
        let profilePath = '';
        let profileUrl = null;
        let biography = '';
        let birthday = '';
        let placeOfBirth = '';
        let knownForDepartment = '';

        if (tmdbId) {
          const personData = await tmdbFetch(`/person/${tmdbId}?language=en-US`);
          if (personData) {
            profilePath = personData.profile_path || '';
            profileUrl = personData.profile_path
              ? `https://image.tmdb.org/t/p/w500${personData.profile_path}`
              : null;
            biography = personData.biography || '';
            birthday = personData.birthday || '';
            placeOfBirth = personData.place_of_birth || '';
            knownForDepartment = personData.known_for_department || '';
          }
        }

        // Use customImage if provided (prioritizes customImage over TMDB or as fallback)
        if (singer.customImage) {
          profileUrl = singer.customImage;
        }

        // ── Fetch YouTube playlist videos ────────────────────────
        const videos = await fetchPlaylistVideos(singer.YoutubePlaylistID, cachedVideosMap);
        console.log(`  ✓ ${singer.name} — ${videos.length} songs found`);

        // ── Fetch Live playlist videos (if any) ──────────────────
        let liveVideos = [];
        if (singer.LivePlaylistID && singer.LivePlaylistID.trim()) {
          liveVideos = await fetchPlaylistVideos(singer.LivePlaylistID, cachedVideosMap);
          console.log(`    ✓ ${singer.name} — ${liveVideos.length} live videos found`);
        }

        return {
          id: singer.id,
          name: singer.name,
          genre: singer.Genre || '',
          category,
          customImage: singer.customImage || null,
          profilePath,
          profileUrl,
          biography,
          birthday,
          placeOfBirth,
          knownForDepartment,
          youtubePlaylistId: singer.YoutubePlaylistID,
          livePlaylistId: singer.LivePlaylistID || '',
          videos,
          liveVideos,
        };
      }));

      results.push(...chunkResults.filter(Boolean));
      await sleep(DELAY_MS);
    }

    output[category] = results;
  }

  // ── Write output ──────────────────────────────────────────
  const finalOutput = {
    lastUpdated: new Date().toISOString(),
    singers: output,
  };

  fs.writeFileSync(SINGERS_OUTPUT, JSON.stringify(finalOutput, null, 2));

  const totalVideos = Object.values(output).reduce((sum, catSingers) =>
    sum + catSingers.reduce((s, singer) => s + (singer.videos?.length || 0) + (singer.liveVideos?.length || 0), 0), 0);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Done! ${totalSingers} singers, ${totalVideos} total videos.`);
  console.log(`${'═'.repeat(50)}\n`);
}

// ── CLI Entry ──────────────────────────────────────────────────
fetchSingers().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
