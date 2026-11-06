import {
  getCachedSearch,
  setCachedSearch,
  getCachedVideoDetails,
  setCachedVideoDetails,
  clearAllYouTubeCache,
  getCacheStats,
} from './youtubeCache';

const YOUTUBE_API_KEY =
  import.meta.env.VITE_YOUTUBE_API_KEY ||
  'AIzaSyB8ZmxwvUfnl3FjOrZhN_zlUD5vjAKzkTg';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export { clearAllYouTubeCache, getCacheStats };

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
 * Leverages persistent multi-tier video cache to query ONLY missing IDs!
 */
export async function getVideoDetails(videoIds) {
  if (!videoIds || videoIds.length === 0) return {};
  const ids = Array.isArray(videoIds) ? videoIds : [videoIds];

  // 1. Check persistent video details cache
  const { cachedMap, missingIds } = getCachedVideoDetails(ids);
  if (missingIds.length === 0) {
    return cachedMap;
  }

  // 2. Fetch ONLY the missing IDs from YouTube API
  try {
    const url = new URL(`${BASE_URL}/videos`);
    url.search = new URLSearchParams({
      part: 'contentDetails,statistics,snippet',
      id: missingIds.join(','),
      key: YOUTUBE_API_KEY,
    }).toString();

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn('YouTube Video Details API Error:', res.status, res.statusText);
      return cachedMap;
    }

    const data = await res.json();
    const fetchedMap = {};
    (data.items || []).forEach((item) => {
      fetchedMap[item.id] = item;
    });

    // 3. Store newly fetched items in persistent video cache (persists for 7 days)
    setCachedVideoDetails(fetchedMap);

    return { ...cachedMap, ...fetchedMap };
  } catch (err) {
    console.warn('Failed to fetch missing video details:', err);
    return cachedMap;
  }
}

/**
 * Search YouTube videos with Multi-Tier Persistent Caching
 * Saves 100 quota units on every cache hit
 * @param {Object} options
 * @param {string} options.query - Search keywords
 * @param {number} [options.maxResults=24] - Max items to return
 * @param {string} [options.pageToken=''] - Pagination pageToken
 * @param {string} [options.order='relevance'] - 'relevance' | 'date' | 'viewCount' | 'rating'
 * @param {string} [options.videoDuration='any'] - 'any' | 'short' | 'medium' | 'long'
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and fetch fresh results
 */
export async function searchYouTubeVideos({
  query,
  maxResults = 24,
  pageToken = '',
  order = 'relevance',
  videoDuration = 'any',
  forceRefresh = false,
} = {}) {
  const q = (query || '').trim();
  if (!q) {
    return { videos: [], nextPageToken: null, totalResults: 0, fromCache: false };
  }

  const cacheParams = {
    query: q,
    maxResults,
    pageToken,
    order,
    videoDuration,
  };

  // 1. Check persistent search cache (survives refreshes & restarts)
  if (!forceRefresh) {
    const cached = getCachedSearch(cacheParams);
    if (cached) {
      console.debug(`[YouTube Search Cache HIT: Saved 100 API Credits]`, q);
      return {
        ...cached.data,
        fromCache: true,
        cachedAt: cached.cachedAt,
      };
    }
  }

  // 2. Query YouTube Data API v3
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

    // Hydrate video details using persistent cache
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
      fromCache: false,
    };

    // Save to persistent multi-tier cache
    setCachedSearch(cacheParams, result);

    return result;
  } catch (error) {
    console.error('YouTube search request failed:', error);
    throw error;
  }
}
