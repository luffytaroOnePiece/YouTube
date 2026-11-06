import { CACHE_TTL_MS } from './cacheConfig';

const YOUTUBE_API_KEY =
  import.meta.env.VITE_YOUTUBE_API_KEY ||
  'AIzaSyB8ZmxwvUfnl3FjOrZhN_zlUD5vjAKzkTg';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// ─── Cache ───────────────────────────────────────────────────────────────────
const youtubeCache = new Map(); // key → { data, timestamp }

const getCached = (key) => {
  const entry = youtubeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    youtubeCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCache = (key, data) => {
  youtubeCache.set(key, { data, timestamp: Date.now() });
};

/** Clear in-memory YouTube cache */
export const clearYouTubeCache = () => youtubeCache.clear();

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function decodeHtmlEntities(str) {
  if (!str) return '';
  if (typeof document !== 'undefined') {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
}

export function parseIsoDuration(durationStr) {
  if (!durationStr) return { formatted: '', seconds: 0 };
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { formatted: '', seconds: 0 };
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return { formatted, seconds: totalSeconds };
}

export function formatViewCount(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return '';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B views`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

/**
 * Fetch video details (duration, definition, views) in batch for given IDs
 */
export async function getVideoDetails(videoIds) {
  if (!videoIds || videoIds.length === 0) return {};
  const idsStr = Array.isArray(videoIds) ? videoIds.join(',') : videoIds;
  const url = new URL(`${BASE_URL}/videos`);
  url.search = new URLSearchParams({
    part: 'contentDetails,statistics,snippet',
    id: idsStr,
    key: YOUTUBE_API_KEY,
  }).toString();

  const cacheKey = url.toString();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn('YouTube Video Details API Error:', res.status, res.statusText);
      return {};
    }
    const data = await res.json();
    const map = {};
    (data.items || []).forEach((item) => {
      map[item.id] = item;
    });
    setCache(cacheKey, map);
    return map;
  } catch (err) {
    console.warn('Failed to fetch video details:', err);
    return {};
  }
}

/**
 * Search YouTube videos
 * @param {Object} options
 * @param {string} options.query - Search keywords
 * @param {number} [options.maxResults=24] - Max items to return
 * @param {string} [options.pageToken=''] - Pagination pageToken
 * @param {string} [options.order='relevance'] - 'relevance' | 'date' | 'viewCount' | 'rating'
 * @param {string} [options.videoDuration='any'] - 'any' | 'short' | 'medium' | 'long'
 */
export async function searchYouTubeVideos({
  query,
  maxResults = 24,
  pageToken = '',
  order = 'relevance',
  videoDuration = 'any',
} = {}) {
  const q = (query || '').trim();
  if (!q) {
    return { videos: [], nextPageToken: null, totalResults: 0 };
  }

  const url = new URL(`${BASE_URL}/search`);
  const params = {
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q,
    key: YOUTUBE_API_KEY,
  };

  if (pageToken) params.pageToken = pageToken;
  if (order && order !== 'relevance') params.order = order;
  if (videoDuration && videoDuration !== 'any') params.videoDuration = videoDuration;

  url.search = new URLSearchParams(params).toString();
  const cacheKey = url.toString();

  const cached = getCached(cacheKey);
  if (cached) {
    console.debug(`[YouTube Cache HIT] ${cacheKey}`);
    return cached;
  }

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `YouTube API error: ${response.status}`;
      console.error('YouTube Search API Error:', errorMsg);
      throw new Error(errorMsg);
    }

    const items = data.items || [];
    const videoIds = items
      .map((item) => item.id?.videoId)
      .filter(Boolean);

    // Hydrate with video duration, definition, views
    let detailsMap = {};
    if (videoIds.length > 0) {
      try {
        detailsMap = await getVideoDetails(videoIds);
      } catch (e) {
        console.warn('Failed to hydrate video details:', e);
      }
    }

    const videos = items
      .filter((item) => item.id?.videoId)
      .map((item) => {
        const id = item.id.videoId;
        const details = detailsMap[id] || {};
        const contentDetails = details.contentDetails || {};
        const stats = details.statistics || {};
        const durationInfo = parseIsoDuration(contentDetails.duration);

        const thumbnail =
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.maxres?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

        const title = decodeHtmlEntities(item.snippet.title);
        const channelTitle = decodeHtmlEntities(item.snippet.channelTitle);
        const description = decodeHtmlEntities(item.snippet.description);

        const definition = contentDetails.definition === 'hd' ? 'HD' : '';

        return {
          youtubeLinkID: id,
          title,
          channel: channelTitle,
          description,
          thumbnail,
          date: item.snippet.publishedAt,
          publishedAt: item.snippet.publishedAt,
          duration: durationInfo.formatted,
          durationSec: durationInfo.seconds,
          viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : undefined,
          viewCountFormatted: formatViewCount(stats.viewCount),
          resolution: definition,
          group: 'YouTube',
          category: channelTitle,
          type: channelTitle,
        };
      });

    const result = {
      videos,
      nextPageToken: data.nextPageToken || null,
      prevPageToken: data.prevPageToken || null,
      totalResults: data.pageInfo?.totalResults || videos.length,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('YouTube search request failed:', error);
    throw error;
  }
}
