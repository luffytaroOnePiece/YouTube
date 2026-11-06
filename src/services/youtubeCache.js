// ═══════════════════════════════════════════════════════════════
// YouTube Multi-Tier Persistent Caching Layer
// Tier 1: Fast In-Memory RAM Map
// Tier 2: Persistent LocalStorage (survives refreshes & restarts)
// Saves 100 YouTube Data API quota credits per cached search
// ═══════════════════════════════════════════════════════════════

const STORAGE_PREFIX = 'yt_cache_v2_';
const REGISTRY_KEY = 'yt_cache_registry_v2';

// 24 Hours for search queries; 7 Days for video details (duration, definition, etc.)
export const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const VIDEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_SEARCH_ITEMS = 150;
const MAX_VIDEO_ITEMS = 800;

// Tier 1: RAM In-Memory Caches
const memorySearchCache = new Map();
const memoryVideoCache = new Map();

// Helper to check if localStorage is available
const isStorageAvailable = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__yt_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

// ── Registry & Stats Management ──────────────────────────────
const getRegistry = () => {
  if (!isStorageAvailable()) return { searchKeys: {}, videoKeys: {}, creditsSaved: 0 };
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : { searchKeys: {}, videoKeys: {}, creditsSaved: 0 };
  } catch {
    return { searchKeys: {}, videoKeys: {}, creditsSaved: 0 };
  }
};

const saveRegistry = (reg) => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    // Ignore quota issues
  }
};

export const recordCreditsSaved = (units = 100) => {
  const reg = getRegistry();
  reg.creditsSaved = (reg.creditsSaved || 0) + units;
  saveRegistry(reg);
  return reg.creditsSaved;
};

export const getCacheStats = () => {
  const reg = getRegistry();
  const searchCount = Object.keys(reg.searchKeys || {}).length;
  const videoCount = Object.keys(reg.videoKeys || {}).length;
  return {
    cachedSearches: searchCount,
    cachedVideos: videoCount,
    creditsSaved: reg.creditsSaved || 0,
    memorySearches: memorySearchCache.size,
    memoryVideos: memoryVideoCache.size,
  };
};

// ── Cache Key Normalization ──────────────────────────────────
export const normalizeSearchQuery = (query = '') => {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
};

export const buildSearchKey = ({
  query = '',
  order = 'relevance',
  videoDuration = 'any',
  pageToken = '',
  maxResults = 24,
}) => {
  const qNorm = normalizeSearchQuery(query);
  const ord = order || 'relevance';
  const dur = videoDuration || 'any';
  const page = pageToken || 'p0';
  return `search_${qNorm}__ord:${ord}__dur:${dur}__page:${page}__max:${maxResults}`;
};

// ── Pruning to prevent LocalStorage overflows ────────────────
const pruneOldEntries = (type = 'search') => {
  if (!isStorageAvailable()) return;
  const reg = getRegistry();
  const keysMap = type === 'search' ? reg.searchKeys : reg.videoKeys;
  const maxLimit = type === 'search' ? MAX_SEARCH_ITEMS : MAX_VIDEO_ITEMS;

  const entries = Object.entries(keysMap || {});
  if (entries.length <= maxLimit) return;

  // Sort ascending by timestamp (oldest first)
  entries.sort((a, b) => a[1] - b[1]);
  const toRemove = entries.slice(0, Math.ceil(entries.length * 0.25)); // remove oldest 25%

  toRemove.forEach(([k]) => {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${k}`);
      delete keysMap[k];
    } catch {
      // Ignore
    }
  });

  saveRegistry(reg);
};

// ── Search Cache Operations ──────────────────────────────────
export const getCachedSearch = (params) => {
  const key = buildSearchKey(params);
  const now = Date.now();

  // 1. Check Tier 1 (RAM)
  const mem = memorySearchCache.get(key);
  if (mem) {
    if (now - mem.timestamp < SEARCH_CACHE_TTL_MS) {
      recordCreditsSaved(100);
      return { data: mem.data, fromCache: true, cachedAt: mem.timestamp };
    }
    memorySearchCache.delete(key);
  }

  // 2. Check Tier 2 (Persistent LocalStorage)
  if (!isStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || !parsed.data) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    if (now - parsed.timestamp > SEARCH_CACHE_TTL_MS) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      const reg = getRegistry();
      if (reg.searchKeys) delete reg.searchKeys[key];
      saveRegistry(reg);
      return null;
    }

    // Hydrate into Tier 1 RAM for instant future access
    memorySearchCache.set(key, { data: parsed.data, timestamp: parsed.timestamp });
    recordCreditsSaved(100);

    return { data: parsed.data, fromCache: true, cachedAt: parsed.timestamp };
  } catch (err) {
    console.warn('[YouTubeCache] Error reading search cache:', err);
    return null;
  }
};

export const setCachedSearch = (params, data) => {
  const key = buildSearchKey(params);
  const now = Date.now();

  // Save to Tier 1 RAM
  memorySearchCache.set(key, { data, timestamp: now });

  // Save to Tier 2 Persistent LocalStorage
  if (!isStorageAvailable()) return;

  try {
    const payload = JSON.stringify({ data, timestamp: now });
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, payload);

    const reg = getRegistry();
    if (!reg.searchKeys) reg.searchKeys = {};
    reg.searchKeys[key] = now;
    saveRegistry(reg);

    pruneOldEntries('search');
  } catch (err) {
    console.warn('[YouTubeCache] Failed to write to localStorage, pruning...', err);
    pruneOldEntries('search');
  }
};

// ── Video Details Cache Operations ───────────────────────────
export const getCachedVideoDetails = (videoIds) => {
  if (!videoIds || videoIds.length === 0) return { cachedMap: {}, missingIds: [] };

  const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
  const now = Date.now();
  const cachedMap = {};
  const missingIds = [];

  ids.forEach((id) => {
    // 1. Check RAM
    const mem = memoryVideoCache.get(id);
    if (mem && now - mem.timestamp < VIDEO_CACHE_TTL_MS) {
      cachedMap[id] = mem.data;
      return;
    }

    // 2. Check LocalStorage
    if (isStorageAvailable()) {
      try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}vid_${id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.data && now - parsed.timestamp < VIDEO_CACHE_TTL_MS) {
            cachedMap[id] = parsed.data;
            memoryVideoCache.set(id, { data: parsed.data, timestamp: parsed.timestamp });
            return;
          }
        }
      } catch {
        // Fall through
      }
    }

    missingIds.push(id);
  });

  return { cachedMap, missingIds };
};

export const setCachedVideoDetails = (itemsMap) => {
  if (!itemsMap || typeof itemsMap !== 'object') return;
  const now = Date.now();
  const reg = isStorageAvailable() ? getRegistry() : null;

  Object.entries(itemsMap).forEach(([id, itemData]) => {
    // Save to RAM
    memoryVideoCache.set(id, { data: itemData, timestamp: now });

    // Save to LocalStorage
    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(
          `${STORAGE_PREFIX}vid_${id}`,
          JSON.stringify({ data: itemData, timestamp: now }),
        );
        if (reg) {
          if (!reg.videoKeys) reg.videoKeys = {};
          reg.videoKeys[`vid_${id}`] = now;
        }
      } catch {
        // Ignore individual storage failures
      }
    }
  });

  if (reg) {
    saveRegistry(reg);
    pruneOldEntries('video');
  }
};

// ── Clear All Cache ──────────────────────────────────────────
export const clearAllYouTubeCache = () => {
  memorySearchCache.clear();
  memoryVideoCache.clear();

  if (!isStorageAvailable()) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith(STORAGE_PREFIX) || k === REGISTRY_KEY)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) {
    console.warn('[YouTubeCache] Clear error:', e);
  }
};
