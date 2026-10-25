import favActorsData from '../data/favActors.json';
import favSingersData from '../data/favSingers.json';

const ACTOR_EVENT_NAME = 'favActorsUpdated';
const SINGER_EVENT_NAME = 'followedSingersUpdated';

// In-memory caches initialized directly from JSON files
let followedActorIds = Array.isArray(favActorsData) ? favActorsData.map(String) : [];
let followedSingerIds = Array.isArray(favSingersData) ? favSingersData.map(String) : [];

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

/**
 * Get current list of followed actor IDs (as string array).
 * Directly backed by favActors.json data and memory cache.
 */
export function getFollowedActorIds() {
  return [...followedActorIds];
}

/**
 * Check if a person ID is followed.
 */
export function isActorFollowed(personId) {
  if (!personId) return false;
  const pid = personId.toString();
  return followedActorIds.includes(pid);
}

/**
 * Toggle follow status for an actor.
 * Persists directly to favActors.json via local backend API.
 * Returns the new followed status (boolean).
 */
export function toggleFollowActor(personId) {
  if (!personId) return false;
  const pid = personId.toString();
  const isFollowingNow = !followedActorIds.includes(pid);

  if (isFollowingNow) {
    followedActorIds = [pid, ...followedActorIds.filter((id) => id !== pid)];
  } else {
    followedActorIds = followedActorIds.filter((id) => id !== pid);
  }

  // Dispatch event for instant UI update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTOR_EVENT_NAME, { detail: [...followedActorIds] }));
  }

  // Sync to backend JSON file
  if (isLocalHost()) {
    fetch('http://localhost:3001/api/favActors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: pid }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          followedActorIds = data.map(String);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(ACTOR_EVENT_NAME, { detail: [...followedActorIds] }));
          }
        }
      })
      .catch((err) => {
        console.error('Failed to persist favorite actor to server:', err);
      });
  }

  return isFollowingNow;
}

/**
 * Synchronize followed actor IDs with backend API / JSON storage.
 */
export async function syncFollowedActorsWithApi() {
  if (!isLocalHost()) return [...followedActorIds];

  try {
    const res = await fetch('http://localhost:3001/api/favActors');
    if (res.ok) {
      const serverIds = await res.json();
      if (Array.isArray(serverIds)) {
        followedActorIds = serverIds.map(String);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(ACTOR_EVENT_NAME, { detail: [...followedActorIds] }));
        }
        return [...followedActorIds];
      }
    }
  } catch {
    // API server not running, fall back to JSON import data
  }
  return [...followedActorIds];
}

/**
 * Get current list of followed singer IDs/names (as string array).
 * Directly backed by favSingers.json data and memory cache.
 */
export function getFollowedSingerIds() {
  return [...followedSingerIds];
}

/**
 * Check if a singer ID or name is followed.
 */
export function isSingerFollowed(singerId) {
  if (!singerId) return false;
  const sid = singerId.toString().toLowerCase().trim();
  return followedSingerIds.some((id) => id.toLowerCase().trim() === sid);
}

/**
 * Toggle follow status for a singer.
 * Persists directly to favSingers.json via local backend API.
 * Returns the new followed status (boolean).
 */
export function toggleFollowSinger(singerId) {
  if (!singerId) return false;
  const sid = singerId.toString().trim();
  const sidLower = sid.toLowerCase();
  const isFollowingNow = !followedSingerIds.some((id) => id.toLowerCase().trim() === sidLower);

  if (isFollowingNow) {
    followedSingerIds = [sid, ...followedSingerIds.filter((id) => id.toLowerCase().trim() !== sidLower)];
  } else {
    followedSingerIds = followedSingerIds.filter((id) => id.toLowerCase().trim() !== sidLower);
  }

  // Dispatch events for instant UI update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SINGER_EVENT_NAME, { detail: [...followedSingerIds] }));
    window.dispatchEvent(new CustomEvent(ACTOR_EVENT_NAME, { detail: [...followedActorIds] }));
  }

  // Sync to backend JSON file
  if (isLocalHost()) {
    fetch('http://localhost:3001/api/favSingers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ singerId: sid }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          followedSingerIds = data.map(String);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SINGER_EVENT_NAME, { detail: [...followedSingerIds] }));
            window.dispatchEvent(new CustomEvent(ACTOR_EVENT_NAME, { detail: [...followedActorIds] }));
          }
        }
      })
      .catch((err) => {
        console.error('Failed to persist favorite singer to server:', err);
      });
  }

  return isFollowingNow;
}

/**
 * Synchronize followed singer IDs with backend API / JSON storage.
 */
export async function syncFollowedSingersWithApi() {
  if (!isLocalHost()) return [...followedSingerIds];

  try {
    const res = await fetch('http://localhost:3001/api/favSingers');
    if (res.ok) {
      const serverIds = await res.json();
      if (Array.isArray(serverIds)) {
        followedSingerIds = serverIds.map(String);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(SINGER_EVENT_NAME, { detail: [...followedSingerIds] }));
          window.dispatchEvent(new CustomEvent(ACTOR_EVENT_NAME, { detail: [...followedActorIds] }));
        }
        return [...followedSingerIds];
      }
    }
  } catch {
    // API server not running, fall back to JSON import data
  }
  return [...followedSingerIds];
}

// Perform initial sync on startup if running in browser
if (typeof window !== 'undefined') {
  syncFollowedActorsWithApi();
  syncFollowedSingersWithApi();
}
