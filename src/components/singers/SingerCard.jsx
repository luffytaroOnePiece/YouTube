import React, { useState, useEffect } from 'react';
import { getPersonDetails, getImageUrl } from '../../services/tmdbApi';

const FALLBACK_POSTER = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#1e1e1e"/>
  <text x="150" y="215" text-anchor="middle" fill="#444" font-family="sans-serif" font-size="48">🎤</text>
  <text x="150" y="260" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="12">No Photo</text>
</svg>`);

export default function SingerCard({ singer, onClick, index }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [dynamicImg, setDynamicImg] = useState(null);

  const effectiveUrl = singer.customImage || singer.profileUrl || dynamicImg;
  const posterSrc = imgError || !effectiveUrl ? FALLBACK_POSTER : effectiveUrl;

  // Reset image state when effectiveUrl changes
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [effectiveUrl]);

  // Fetch TMDB image client-side if no image exists yet and singer has an ID
  useEffect(() => {
    if (singer.customImage || singer.profileUrl) return;
    const match = singer.id ? String(singer.id).match(/^(\d+)/) : null;
    if (match) {
      getPersonDetails(match[1])
        .then((data) => {
          if (data?.profile_path) {
            setDynamicImg(getImageUrl(data.profile_path, 'w500'));
          }
        })
        .catch(() => {});
    }
  }, [singer.id, singer.customImage, singer.profileUrl]);

  const animationDelay = `${Math.min(index * 0.05, 0.8)}s`;
  const videoCount = (singer.videos?.length || 0) + (singer.liveVideos?.length || 0);

  return (
    <div
      className="singer-card"
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
      {/* Poster */}
      {!imgLoaded && !imgError && (
        <div className="singer-card__poster-skeleton" />
      )}
      <img
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

      {/* Genre badge */}
      {singer.genre && (
        <span className="singer-card__genre-badge">{singer.genre}</span>
      )}

      {/* Video count badge */}
      {videoCount > 0 && (
        <span className="singer-card__count-badge">
          {videoCount} {videoCount === 1 ? 'song' : 'songs'}
        </span>
      )}

      {/* Bottom info */}
      <div className="singer-card__info">
        <h3 className="singer-card__title">{singer.name}</h3>
      </div>

      {/* Play overlay on hover */}
      <div className="singer-card__play-overlay">
        <div className="singer-card__play-icon">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    </div>
  );
}
