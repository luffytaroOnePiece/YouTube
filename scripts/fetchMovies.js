import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ─────────────────────────────────────────────────────
const MOVIES_INPUT = path.join(__dirname, '../src/data/movies.json');
const MOVIES_OUTPUT = path.join(__dirname, '../src/data/moviesData.json');

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

// ── Fetch YouTube Playlist via yt-dlp ──────────────────────────
function fetchPlaylistVideos(playlistId) {
  if (!playlistId) return [];
  try {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const raw = execSync(
      `yt-dlp --flat-playlist --dump-json --no-warnings "${url}"`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    return raw.trim().split('\n').filter(Boolean).map(line => {
      const entry = JSON.parse(line);
      const durationSec = Math.round(entry.duration || 0);
      return {
        youtubeLinkID: entry.id,
        title: entry.title || 'Untitled',
        thumbnail: `https://img.youtube.com/vi/${entry.id}/maxresdefault.jpg`,
        duration: formatDuration(durationSec),
        durationSec,
        date: '',
        resolution: '',
        viewCount: 0,
      };
    });
  } catch (err) {
    console.error(`  ⚠️  yt-dlp failed for ${playlistId}: ${err.message?.substring(0, 100)}`);
    return [];
  }
}

// ── Main ───────────────────────────────────────────────────────
async function fetchMovies() {
  console.log('\n🎬 Movie Albums — Fetch Script\n');

  if (!fs.existsSync(MOVIES_INPUT)) {
    throw new Error(`movies.json not found at ${MOVIES_INPUT}`);
  }

  const moviesInput = JSON.parse(fs.readFileSync(MOVIES_INPUT, 'utf-8'));
  const tmdbIds = Object.keys(moviesInput);
  console.log(`📋 Found ${tmdbIds.length} movies to process.\n`);

  // Load existing data for caching
  let existingMovies = {};
  if (fs.existsSync(MOVIES_OUTPUT)) {
    try {
      const existing = JSON.parse(fs.readFileSync(MOVIES_OUTPUT, 'utf-8'));
      existingMovies = existing.movies || {};
    } catch (e) {
      console.log('⚠️  Could not parse existing moviesData.json, starting fresh.');
    }
  }

  const movies = {};

  for (let i = 0; i < tmdbIds.length; i++) {
    const tmdbId = tmdbIds[i];
    const entry = moviesInput[tmdbId];
    const progress = `[${i + 1}/${tmdbIds.length}]`;

    console.log(`${progress} 🎥 Processing: ${entry.title} (TMDB: ${tmdbId})`);

    // Check if we have cached TMDB data and playlist videos
    const cached = existingMovies[tmdbId];
    if (cached && cached.posterPath && cached.videos && cached.videos.length > 0) {
      console.log(`  ⚡ CACHED — ${cached.videos.length} videos`);
      // Update language from input in case it changed
      movies[tmdbId] = { ...cached, language: entry.language || cached.language };
      continue;
    }

    // ── Fetch TMDB metadata ──────────────────────────────────
    console.log('  📡 Fetching TMDB metadata...');
    const details = await tmdbFetch(`/movie/${tmdbId}?language=en-US`);
    await sleep(DELAY_MS);

    if (!details) {
      console.log(`  ❌ Failed to fetch TMDB details, skipping.`);
      continue;
    }

    const releaseYear = details.release_date ? new Date(details.release_date).getFullYear() : null;
    const genres = (details.genres || []).map(g => g.name);
    const posterUrl = details.poster_path
      ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
      : null;
    const backdropUrl = details.backdrop_path
      ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
      : null;

    console.log(`  ✓ ${details.title} (${releaseYear}) — ${genres.join(', ')}`);

    // ── Fetch YouTube playlist videos ────────────────────────
    console.log(`  📋 Fetching YouTube playlist: ${entry.YoutubePlaylistId}...`);
    const videos = fetchPlaylistVideos(entry.YoutubePlaylistId);
    console.log(`  ✓ ${videos.length} videos found`);

    movies[tmdbId] = {
      tmdbId: parseInt(tmdbId),
      title: details.title || entry.title,
      originalTitle: details.original_title || '',
      language: entry.language || '',
      year: releaseYear,
      releaseDate: details.release_date || '',
      overview: details.overview || '',
      genres,
      runtime: details.runtime || 0,
      voteAverage: details.vote_average || 0,
      voteCount: details.vote_count || 0,
      posterPath: details.poster_path || '',
      backdropPath: details.backdrop_path || '',
      posterUrl,
      backdropUrl,
      youtubePlaylistId: entry.YoutubePlaylistId,
      videos,
    };

    await sleep(DELAY_MS);
  }

  // ── Write output ──────────────────────────────────────────
  const output = {
    lastUpdated: new Date().toISOString(),
    movies,
  };

  fs.writeFileSync(MOVIES_OUTPUT, JSON.stringify(output, null, 2));

  const totalVideos = Object.values(movies).reduce((sum, m) => sum + (m.videos?.length || 0), 0);
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Done! ${Object.keys(movies).length} movies, ${totalVideos} total videos.`);
  console.log(`${'═'.repeat(50)}\n`);
}

// ── CLI Entry ──────────────────────────────────────────────────
fetchMovies().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
