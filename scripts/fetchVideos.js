import fs from 'fs';
import path from 'path';
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
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function fetchVideos() {
  try {
    console.log('\n🎬 YouTube Video Library — Fetch Script\n');

    // 1. Read playlists.json
    if (!fs.existsSync(PLAYLISTS_FILE)) {
      console.error(`❌ Playlists file not found at ${PLAYLISTS_FILE}`);
      process.exit(1);
    }

    const playlists = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));

    // 2. Check for single-category CLI argument
    const args = process.argv.slice(2);
    const targetCategory = args[0];

    let playlistsToFetch = Object.entries(playlists);
    let existingCategories = {};

    // Load existing videos.json
    if (fs.existsSync(VIDEOS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf-8'));
        existingCategories = existing.categories || {};
      } catch (e) {
        console.warn('⚠️  Could not parse existing videos.json, starting fresh.');
      }
    }

    if (targetCategory) {
      if (!playlists[targetCategory]) {
        console.error(`❌ Category "${targetCategory}" not found in playlists.json`);
        console.log('Available categories:', Object.keys(playlists).join(', '));
        process.exit(1);
      }
      console.log(`📂 Mode: Single category update — "${targetCategory}"\n`);
      playlistsToFetch = [[targetCategory, playlists[targetCategory]]];
    } else {
      console.log(`📂 Mode: Full update — All ${playlistsToFetch.length} categories\n`);
      existingCategories = {}; // Reset all on full update
    }

    // 3. Fetch each playlist
    for (const [categoryName, url] of playlistsToFetch) {
      console.log(`\n━━━ Fetching: ${categoryName} ━━━`);
      console.log(`    URL: ${url}`);

      try {
        // Extract playlist ID
        const playlistId = url.split('list=')[1]?.split('&')[0];
        if (!playlistId) {
          console.warn(`⚠️  Invalid playlist URL for "${categoryName}": ${url}`);
          continue;
        }

        // Fetch playlist items via ytpl
        const playlist = await ytpl(playlistId, { limit: Infinity });
        console.log(`    Found ${playlist.items.length} videos. Enriching with metadata...\n`);

        const videos = [];

        for (let i = 0; i < playlist.items.length; i++) {
          const item = playlist.items[i];
          const progress = `    [${i + 1}/${playlist.items.length}]`;

          let publishDate = '';

          // Try to enrich with ytdl-core for publish date
          try {
            const info = await ytdl.getBasicInfo(item.id);
            publishDate = info.videoDetails.publishDate || '';
          } catch (e) {
            // Silently fall back — ytpl data is sufficient
          }

          videos.push({
            youtubeLinkID: item.id,
            title: item.title,
            thumbnail: `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
            duration: formatDuration(item.durationSec || 0),
            durationSec: item.durationSec || 0,
            type: categoryName,
            date: publishDate
          });

          process.stdout.write(`${progress} ✓ ${item.title.substring(0, 55)}...\n`);

          // Rate limiting
          await sleep(DELAY_MS);
        }

        existingCategories[categoryName] = videos;
        console.log(`\n    ✅ ${categoryName}: ${videos.length} videos saved.`);

      } catch (err) {
        console.error(`    ❌ Error fetching "${categoryName}":`, err.message);
      }
    }

    // 4. Write output
    const output = {
      lastUpdated: new Date().toISOString(),
      categories: existingCategories
    };

    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(output, null, 2));

    const totalVideos = Object.values(existingCategories).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`\n════════════════════════════════════`);
    console.log(`✅ Done! ${totalVideos} total videos across ${Object.keys(existingCategories).length} categories.`);
    console.log(`📄 Output: ${VIDEOS_FILE}`);
    console.log(`════════════════════════════════════\n`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

fetchVideos();
