import { CACHE_TTL_MS } from './cacheConfig';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_READ_ACCESS_TOKEN = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN;

const BASE_URL = "https://api.themoviedb.org/3";

// ─── Cache ───────────────────────────────────────────────────────────────────
const tmdbCache = new Map(); // key → { data, timestamp }

const getCached = (key) => {
    const entry = tmdbCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        tmdbCache.delete(key);
        return null;
    }
    return entry.data;
};

const setCache = (key, data) => {
    tmdbCache.set(key, { data, timestamp: Date.now() });
};

/** Manually clear the entire TMDB cache (e.g. after the user logs out). */
export const clearTmdbCache = () => tmdbCache.clear();
// ─────────────────────────────────────────────────────────────────────────────

const getHeaders = () => ({
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`
});

const fetchTmdb = async (endpoint, params = {}) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const cacheKey = url.toString();
    const cached = getCached(cacheKey);
    if (cached) {
        console.debug(`[TMDB Cache HIT] ${cacheKey}`);
        return cached;
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            console.error("TMDB API Error:", response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        setCache(cacheKey, data);
        console.debug(`[TMDB Cache SET] ${cacheKey}`);
        return data;
    } catch (error) {
        console.error("TMDB Request Failed:", error);
        return null;
    }
};

const postTmdb = async (endpoint, body = {}) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                ...getHeaders(),
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error("TMDB API Error:", response.status, response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("TMDB Request Failed:", error);
        return null;
    }
};

export const searchMulti = async (query) => {
    if (!query) return null;
    return fetchTmdb('/search/multi', {
        query: query,
        include_adult: false,
        language: 'en-US',
        page: 1
    });
};

export const getDetails = async (id, type) => {
    // type should be 'movie' or 'tv'
    if (!id || !type) return null;
    return fetchTmdb(`/${type}/${id}`, { language: 'en-US' });
};

export const getImages = async (id, type) => {
    if (!id || !type) return null;
    return fetchTmdb(`/${type}/${id}/images`, {}); // No language param to get all images or specify 'null'
};

export const getImageUrl = (path, size = 'original') => {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getAccountWatchlist = async (accountId, page = 1, type = 'movies') => {
    if (!accountId) return null;
    return fetchTmdb(`/account/${accountId}/watchlist/${type}`, { page, sort_by: 'created_at.desc' });
};

export const getAccountDetails = async () => {
    return fetchTmdb('/account');
};

export const getAccountLists = async (accountId, page = 1) => {
    if (!accountId) return null;
    return fetchTmdb(`/account/${accountId}/lists`, { page });
};

export const getListDetails = async (listId, page = 1) => {
    if (!listId) return null;
    return fetchTmdb(`/list/${listId}`, { page });
};

export const getCredits = async (id, type) => {
    if (!id || !type) return null;
    return fetchTmdb(`/${type}/${id}/credits`);
};


export const getPersonCredits = async (personId) => {
    if (!personId) return null;
    return fetchTmdb(`/person/${personId}/combined_credits`, { language: 'en-US' });
};

export const getExternalIds = async (personId) => {
    if (!personId) return null;
    return fetchTmdb(`/person/${personId}/external_ids`);
};

export const getSeasonDetails = async (tvId, seasonNumber) => {
    if (!tvId || seasonNumber === undefined) return null;
    return fetchTmdb(`/tv/${tvId}/season/${seasonNumber}`);
};

export const getVideos = async (id, type) => {
    if (!id || !type) return null;
    return fetchTmdb(`/${type}/${id}/videos`, { language: 'en-US' });
};

export const getAccountStates = async (id, type) => {
    if (!id || !type) return null;
    return fetchTmdb(`/${type}/${id}/account_states`);
};

export const markAsFavorite = async (accountId, mediaType, mediaId, favorite) => {
    if (!accountId || !mediaType || !mediaId) return null;
    return postTmdb(`/account/${accountId}/favorite`, {
        media_type: mediaType,
        media_id: mediaId,
        favorite: favorite
    });
};

export const toggleWatchlist = async (accountId, mediaType, mediaId, watchlist) => {
    if (!accountId || !mediaType || !mediaId) return null;
    return postTmdb(`/account/${accountId}/watchlist`, {
        media_type: mediaType,
        media_id: mediaId,
        watchlist: watchlist
    });
};

export const rateMedia = async (mediaId, mediaType, rating) => {
    if (!mediaId || !mediaType || !rating) return null;
    return postTmdb(`/${mediaType}/${mediaId}/rating`, {
        value: rating
    });
};

export const deleteRating = async (mediaId, mediaType) => {
    if (!mediaId || !mediaType) return null;
    const url = new URL(`${BASE_URL}/${mediaType}/${mediaId}/rating`);
    try {
        const response = await fetch(url.toString(), {
            method: 'DELETE',
            headers: {
                ...getHeaders(),
                'Content-Type': 'application/json;charset=utf-8'
            }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("TMDB Request Failed:", error);
        return null;
    }
};

export const getAccountFavorites = async (accountId, page = 1, type = 'movies') => {
    if (!accountId) return null;
    return fetchTmdb(`/account/${accountId}/favorite/${type}`, { page, sort_by: 'created_at.desc' });
};

export const getAccountRated = async (accountId, page = 1, type = 'movies') => {
    if (!accountId) return null;
    return fetchTmdb(`/account/${accountId}/rated/${type}`, { page, sort_by: 'created_at.desc' });
};

// Batch Helper Functions
export const batchToggleWatchlist = async (accountId, items, watchlistState) => {
    if (!accountId || !items || !items.length) return { success: false, updated: 0 };

    let successCount = 0;
    for (const item of items) {
        try {
            const mediaType = item.media_type || (item.name ? 'tv' : 'movie'); // Infer type if missing
            const res = await toggleWatchlist(accountId, mediaType, item.id, watchlistState);
            if (res && res.success) successCount++;

            // Tiny delay to be nice to the API rate limits (though TMDB allows 40 req/10sec usually)
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
            console.error(`Failed to batch toggle watchlist for ${item.id}:`, e);
        }
    }
    return { success: successCount > 0, updated: successCount };
};

export const batchToggleFavorite = async (accountId, items, favoriteState) => {
    if (!accountId || !items || !items.length) return { success: false, updated: 0 };

    let successCount = 0;
    for (const item of items) {
        try {
            const mediaType = item.media_type || (item.name ? 'tv' : 'movie');
            const res = await markAsFavorite(accountId, mediaType, item.id, favoriteState);
            if (res && res.success) successCount++;

            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
            console.error(`Failed to batch toggle favorite for ${item.id}:`, e);
        }
    }
    return { success: successCount > 0, updated: successCount };
};
