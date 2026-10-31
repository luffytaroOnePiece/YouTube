import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getPersonDetails, getImageUrl } from '../../services/tmdbApi';

const FALLBACK_POSTER = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#1e1e1e"/>
  <text x="150" y="215" text-anchor="middle" fill="#444" font-family="sans-serif" font-size="48">🎤</text>
  <text x="150" y="260" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="12">No Photo</text>
</svg>`);

// In-memory module-level cache for fetched TMDB profile images
const tmdbProfileCache = new Map();

function formatCompactNumber(count) {
  if (!count) return null;
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function getCachedProfile(singer) {
  if (!singer) return null;
  const match = singer.id ? String(singer.id).match(/^(\d+)/) : null;
  const numericId = match ? match[1] : null;
  return (numericId && tmdbProfileCache.get(numericId)) || (singer.id && tmdbProfileCache.get(String(singer.id))) || null;
}

export default function SingerCard({ singer, onClick, onQuickPlay, onToggleFollow, isFollowed = false, index }) {
  const cardRef = useRef(null);
  const [dynamicImg, setDynamicImg] = useState(() => getCachedProfile(singer));
  const effectiveUrl = singer.customImage || singer.profileUrl || dynamicImg;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Lazy render state initialized to true if already have image or IntersectionObserver unsupported
  const [isInViewport, setIsInViewport] = useState(() => {
    return typeof IntersectionObserver === 'undefined' || Boolean(effectiveUrl);
  });

  const posterSrc = imgError || !effectiveUrl ? FALLBACK_POSTER : effectiveUrl;

  // IntersectionObserver for lazy TMDB fetching
  useEffect(() => {
    if (isInViewport || !cardRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isInViewport]);

  // Fetch TMDB image only when card enters viewport and doesn't already have an image
  useEffect(() => {
    if (singer.customImage || singer.profileUrl || dynamicImg || !isInViewport) return;
    const match = singer.id ? String(singer.id).match(/^(\d+)/) : null;
    if (!match) return;
    const numericId = match[1];
    if (tmdbProfileCache.has(numericId)) return;

    getPersonDetails(numericId)
      .then((data) => {
        if (data?.profile_path) {
          const url = getImageUrl(data.profile_path, 'w500');
          tmdbProfileCache.set(numericId, url);
          if (singer.id) tmdbProfileCache.set(String(singer.id), url);
          setDynamicImg(url);
        }
      })
      .catch(() => {});
  }, [singer.id, singer.customImage, singer.profileUrl, dynamicImg, isInViewport]);

  const animationDelay = `${Math.min(index * 0.04, 0.6)}s`;
  const normalCount = singer.videos?.length || 0;
  const liveCount = singer.liveVideos?.length || 0;
  const videoCount = normalCount + liveCount;
  const hasLive = liveCount > 0;

  const totalViews = useMemo(() => {
    const all = [...(singer.videos || []), ...(singer.liveVideos || [])];
    return all.reduce((acc, v) => acc + (Number(v.viewCount) || 0), 0);
  }, [singer.videos, singer.liveVideos]);

  const handleQuickPlay = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const list = normalCount > 0 ? singer.videos : (singer.liveVideos || []);
    if (list.length > 0 && onQuickPlay) {
      onQuickPlay(singer, list[0]);
    }
  };

  const handleFollowClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onToggleFollow) {
      onToggleFollow(singer);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`singer-card ${isFollowed ? 'singer-card--followed' : ''}`}
      onClick={() => onClick(singer)}
      style={{ animationDelay }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(singer);
        }
      }}
    >
      {/* Poster Skeleton */}
      {!imgLoaded && !imgError && (
        <div className="singer-card__poster-skeleton" />
      )}
      <img
        key={posterSrc}
        className="singer-card__poster"
        src={posterSrc}
        alt={singer.name}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        onError={() => { setImgError(true); setImgLoaded(true); }}
        style={{ opacity: imgLoaded ? 1 : 0 }}
      />

      {/* Gradient overlay */}
      <div className="singer-card__gradient" />

      {/* Top Left: Genre badge */}
      {singer.genre && (
        <span className="singer-card__genre-badge">{singer.genre}</span>
      )}

      {/* Top Right: Badges cluster */}
      <div className="singer-card__top-actions">
        {/* Favorite / Follow button */}
        <button
          className={`singer-card__fav-btn ${isFollowed ? 'singer-card__fav-btn--active' : ''}`}
          onClick={handleFollowClick}
          title={isFollowed ? 'Following (click to unfollow)' : 'Follow artist'}
          aria-label={isFollowed ? 'Unfollow artist' : 'Follow artist'}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill={isFollowed ? '#ef4444' : 'none'} stroke={isFollowed ? '#ef4444' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Video count badge */}
        {videoCount > 0 && (
          <span className="singer-card__count-badge">
            {videoCount}
          </span>
        )}
      </div>

      {/* Live indicator */}
      {hasLive && (
        <span className="singer-card__live-indicator" title={`${liveCount} live performance${liveCount > 1 ? 's' : ''}`}>
          <span className="singer-card__live-pulse" />
          LIVE
        </span>
      )}

      {/* Bottom info */}
      <div className="singer-card__info">
        <h3 className="singer-card__title">{singer.name}</h3>
        <div className="singer-card__meta-row">
          {totalViews > 0 && (
            <span className="singer-card__views">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              {formatCompactNumber(totalViews)}
            </span>
          )}
          {singer.category && (
            <span className="singer-card__cat-label">
              {singer.category}
            </span>
          )}
        </div>
      </div>

      {/* Play overlay on hover */}
      <div className="singer-card__play-overlay">
        {videoCount > 0 && (
          <button
            className="singer-card__quick-play"
            onClick={handleQuickPlay}
            title="Quick play"
            aria-label="Quick play first song"
          >
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
