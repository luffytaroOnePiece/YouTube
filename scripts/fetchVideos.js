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

function getResolutionLabel(formats) {
  if (!formats || !Array.isArray(formats)) return '';
  const videoFormats = formats
    .filter(f => f.qualityLabel)
    .map(f => {
      const match = f.qualityLabel.match(/(\d+)p/);
      return match ? parseInt(match[1]) : 0;
    })
    .filter(h => h > 0);

  if (videoFormats.length === 0) return '';
  const maxRes = Math.max(...videoFormats);
  if (maxRes >= 4320) return '8K';
  if (maxRes >= 2160) return '4K';
  if (maxRes >= 1440) return '2K';
  if (maxRes >= 1080) return '1080p';
  if (maxRes >= 720) return '720p';
  if (maxRes >= 480) return '480p';
  return `${maxRes}p`;
}

async function fetchPlaylist(url, groupName, categoryName, playlistName) {
  const playlistId = url.split('list=')[1]?.split('&')[0];
  if (!playlistId) {
    console.warn(`    ⚠️  Invalid playlist URL: ${url}`);
    return [];
  }

  const playlist = await ytpl(playlistId, { limit: Infinity });
  console.log(`    Found ${playlist.items.length} videos. Enriching...\n`);

  const videos = [];

  for (let i = 0; i < playlist.items.length; i++) {
    const item = playlist.items[i];
    const progress = `    [${i + 1}/${playlist.items.length}]`;

    let publishDate = '';
    let resolution = '';

    try {
      const info = await ytdl.getBasicInfo(item.id);
      publishDate = info.videoDetails.publishDate || '';
      resolution = getResolutionLabel(info.formats || []);
    } catch (e) {
      // Fall back — ytpl data is sufficient
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
      resolution
    });

    const resLabel = resolution ? ` [${resolution}]` : '';
    process.stdout.write(`${progress} ✓${resLabel} ${item.title.substring(0, 50)}...\n`);
    await sleep(DELAY_MS);
  }

  return videos;
}

async function fetchVideos() {
  try {
    console.log('\n🎬 YouTube Video Library — Fetch Script (3-Level)\n');

    if (!fs.existsSync(PLAYLISTS_FILE)) {
      console.error(`❌ Playlists file not found at ${PLAYLISTS_FILE}`);
      process.exit(1);
    }

    const playlists = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
    const args = process.argv.slice(2);
    const targetGroup = args[0] || null;
    const targetCategory = args[1] || null;
    const targetPlaylist = args[2] || null;

    let existingGroups = {};
    if (fs.existsSync(VIDEOS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf-8'));
        existingGroups = existing.groups || {};
      } catch (e) {
        console.warn('⚠️  Could not parse existing videos.json, starting fresh.');
      }
    }

    if (targetGroup) {
      if (!playlists[targetGroup]) {
        console.error(`❌ Group "${targetGroup}" not found.`);
        console.log('Available:', Object.keys(playlists).join(', '));
        process.exit(1);
      }
      if (targetCategory) {
        const cats = playlists[targetGroup].categories || {};
        if (!cats[targetCategory]) {
          console.error(`❌ Category "${targetCategory}" not found in "${targetGroup}".`);
          console.log('Available:', Object.keys(cats).join(', '));
          process.exit(1);
        }
        if (targetPlaylist) {
          if (!cats[targetCategory][targetPlaylist]) {
            console.error(`❌ Playlist "${targetPlaylist}" not found.`);
            console.log('Available:', Object.keys(cats[targetCategory]).join(', '));
            process.exit(1);
          }
          console.log(`📂 Mode: Single playlist — "${targetGroup}" > "${targetCategory}" > "${targetPlaylist}"\n`);
        } else {
          console.log(`📂 Mode: Category update — "${targetGroup}" > "${targetCategory}"\n`);
        }
      } else {
        console.log(`📂 Mode: Group update — "${targetGroup}"\n`);
      }
    } else {
      console.log(`📂 Mode: Full update — All groups\n`);
      existingGroups = {};
    }

    const groupsToProcess = targetGroup
      ? [[targetGroup, playlists[targetGroup]]]
      : Object.entries(playlists);

    for (const [groupName, groupConfig] of groupsToProcess) {
      const icon = groupConfig.icon || '';
      const allCategories = groupConfig.categories || {};

      if (!existingGroups[groupName]) {
        existingGroups[groupName] = { icon, categories: {} };
      }
      existingGroups[groupName].icon = icon;

      if (!targetCategory) {
        existingGroups[groupName].categories = {};
      }

      const catsToProcess = targetCategory
        ? [[targetCategory, allCategories[targetCategory]]]
        : Object.entries(allCategories);

      if (catsToProcess.length === 0) {
        console.log(`⏭  Skipping "${groupName}" — no categories defined.\n`);
        continue;
      }

      for (const [catName, catPlaylists] of catsToProcess) {
        if (!existingGroups[groupName].categories[catName]) {
          existingGroups[groupName].categories[catName] = {};
        }

        if (!targetPlaylist) {
          existingGroups[groupName].categories[catName] = {};
        }

        const playlistsToProcess = targetPlaylist
          ? [[targetPlaylist, catPlaylists[targetPlaylist]]]
          : Object.entries(catPlaylists || {});

        for (const [plName, url] of playlistsToProcess) {
          console.log(`\n━━━ ${icon} ${groupName} > ${catName} > ${plName} ━━━`);
          console.log(`    URL: ${url}`);

          if (!url) {
            console.warn(`    ⚠️  No URL provided, skipping.`);
            continue;
          }

          try {
            const videos = await fetchPlaylist(url, groupName, catName, plName);
            existingGroups[groupName].categories[catName][plName] = videos;
            console.log(`\n    ✅ ${plName}: ${videos.length} videos saved.`);
          } catch (err) {
            console.error(`    ❌ Error fetching "${plName}":`, err.message);
          }
        }
      }
    }

    const output = {
      lastUpdated: new Date().toISOString(),
      groups: existingGroups
    };

    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(output, null, 2));

    let totalVideos = 0;
    let totalPlaylists = 0;
    for (const group of Object.values(existingGroups)) {
      for (const cat of Object.values(group.categories || {})) {
        for (const vids of Object.values(cat || {})) {
          totalVideos += vids.length;
          totalPlaylists++;
        }
      }
    }

    console.log(`\n════════════════════════════════════`);
    console.log(`✅ Done! ${totalVideos} videos across ${totalPlaylists} playlists in ${Object.keys(existingGroups).length} groups.`);
    console.log(`📄 Output: ${VIDEOS_FILE}`);
    console.log(`════════════════════════════════════\n`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

fetchVideos();
