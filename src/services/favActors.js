import favActorsData from '../data/favActors.json';

const STORAGE_KEY = 'yt_fav_actors';
const EVENT_NAME = 'favActorsUpdated';

/**
 * Get current list of followed actor IDs (as string array).
 * Reads from localStorage if available, falls back to favActors.json.
 */
export function getFollowedActorIds() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    }
  } catch {
    // Fall back to static dataset
  }

  const initial = Array.isArray(favActorsData) ? favActorsData.map(String) : [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // Ignore storage quota or access errors
  }
  return initial;
}

/**
 * Check if a person ID is followed.
 */
export function isActorFollowed(personId) {
  if (!personId) return false;
  const ids = getFollowedActorIds();
  return ids.includes(personId.toString());
}

/**
 * Toggle follow status for an actor.
 * Updates localStorage, dispatches window event, and syncs to backend API if available.
 * Returns the new followed status (boolean).
 */
export async function toggleFollowActor(personId) {
  if (!personId) return false;
  const pid = personId.toString();
  const current = getFollowedActorIds();
  let updated;
  const isFollowingNow = !current.includes(pid);

  if (isFollowingNow) {
    updated = [pid, ...current.filter(id => id !== pid)];
  } else {
    updated = current.filter(id => id !== pid);
  }

  // 1. Update localStorage immediately
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write error
  }

  // 2. Dispatch event for instant UI update everywhere
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));

  // 3. Try local API if available on localhost or 127.0.0.1
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    try {
      await fetch('http://localhost:3001/api/favActors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: pid })
      });
    } catch {
      // Backend not running, localStorage already updated
    }
  }

  return isFollowingNow;
}

/**
 * Synchronize followed actor IDs with backend API if online.
 * Merges any IDs from server with localStorage.
 */
export async function syncFollowedActorsWithApi() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocal) return getFollowedActorIds();

  try {
    const res = await fetch('http://localhost:3001/api/favActors');
    if (res.ok) {
      const serverIds = await res.json();
      if (Array.isArray(serverIds)) {
        const localIds = getFollowedActorIds();
        const merged = Array.from(new Set([...serverIds.map(String), ...localIds]));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // Ignore storage error
        }
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: merged }));
        return merged;
      }
    }
  } catch {
    // API not running
  }
  return getFollowedActorIds();
}

const SINGER_STORAGE_KEY = 'yt_followed_singers';
const SINGER_EVENT_NAME = 'followedSingersUpdated';

/**
 * Get current list of followed singer IDs/names (as string array).
 */
export function getFollowedSingerIds() {
  try {
    const stored = localStorage.getItem(SINGER_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return [];
}

/**
 * Check if a singer ID or name is followed.
 */
export function isSingerFollowed(singerId) {
  if (!singerId) return false;
  const sid = singerId.toString().toLowerCase().trim();
  const ids = getFollowedSingerIds();
  return ids.some(id => id.toLowerCase().trim() === sid);
}

/**
 * Toggle follow status for a singer.
 * Returns the new followed status (boolean).
 */
export function toggleFollowSinger(singerId) {
  if (!singerId) return false;
  const sid = singerId.toString();
  const current = getFollowedSingerIds();
  let updated;
  const isFollowingNow = !current.some(id => id.toLowerCase().trim() === sid.toLowerCase().trim());

  if (isFollowingNow) {
    updated = [sid, ...current.filter(id => id.toLowerCase().trim() !== sid.toLowerCase().trim())];
  } else {
    updated = current.filter(id => id.toLowerCase().trim() !== sid.toLowerCase().trim());
  }

  try {
    localStorage.setItem(SINGER_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write error
  }

  window.dispatchEvent(new CustomEvent(SINGER_EVENT_NAME, { detail: updated }));
  window.dispatchEvent(new CustomEvent(EVENT_NAME)); // Also notify general followed list

  return isFollowingNow;
}
