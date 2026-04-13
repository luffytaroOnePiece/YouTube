import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchVideos } from './fetchVideos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYLISTS_FILE = path.join(__dirname, '../src/data/playlists.json');

const app = express();
app.use(cors());
app.use(express.json());

// Active jobs tracker
const activeJobs = new Map();
let jobIdCounter = 0;

// GET /api/playlists — return current playlists.json structure
app.get('/api/playlists', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — return video counts
app.get('/api/stats', (req, res) => {
  try {
    const videosFile = path.join(__dirname, '../src/data/videos.json');
    if (!fs.existsSync(videosFile)) return res.json({ total: 0, groups: {} });
    const data = JSON.parse(fs.readFileSync(videosFile, 'utf-8'));
    const stats = { lastUpdated: data.lastUpdated, total: 0, groups: {} };

    for (const [gName, group] of Object.entries(data.groups || {})) {
      stats.groups[gName] = { icon: group.icon, total: 0, categories: {} };
      for (const [cName, cat] of Object.entries(group.categories || {})) {
        stats.groups[gName].categories[cName] = {};
        for (const [pName, vids] of Object.entries(cat || {})) {
          stats.groups[gName].categories[cName][pName] = vids.length;
          stats.groups[gName].total += vids.length;
          stats.total += vids.length;
        }
      }
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fetch — trigger a fetch job
app.post('/api/fetch', (req, res) => {
  const { group, category, playlist } = req.body || {};
  const jobId = ++jobIdCounter;
  const logs = [];
  const log = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  activeJobs.set(jobId, { status: 'running', logs, startedAt: new Date().toISOString() });

  fetchVideos({ targetGroup: group || null, targetCategory: category || null, targetPlaylist: playlist || null, log })
    .then((summary) => {
      activeJobs.set(jobId, { status: 'done', logs, summary, finishedAt: new Date().toISOString() });
    })
    .catch((err) => {
      activeJobs.set(jobId, { status: 'error', logs, error: err.message, finishedAt: new Date().toISOString() });
    });

  res.json({ jobId, status: 'started' });
});

// GET /api/jobs/:id — check job status
app.get('/api/jobs/:id', (req, res) => {
  const job = activeJobs.get(parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 YouTube Library API running at http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   GET  /api/playlists  — View playlists config`);
  console.log(`   GET  /api/stats      — Video stats`);
  console.log(`   POST /api/fetch      — Start fetch job`);
  console.log(`   GET  /api/jobs/:id   — Check job status\n`);
});
