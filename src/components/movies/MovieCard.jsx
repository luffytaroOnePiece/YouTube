import React, { useState } from 'react';

const FALLBACK_POSTER = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#1e1e1e"/>
  <text x="150" y="215" text-anchor="middle" fill="#444" font-family="sans-serif" font-size="48">🎬</text>
  <text x="150" y="260" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="12">No Poster</text>
</svg>`);

export default function MovieCard({ movie, onClick, index }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const posterSrc = imgError || !movie.posterUrl ? FALLBACK_POSTER : movie.posterUrl;
  const animationDelay = `${Math.min(index * 0.05, 0.8)}s`;
  const videoCount = movie.videos?.length || 0;
  const ratingDisplay = movie.voteAverage ? movie.voteAverage.toFixed(1) : null;

  return (
    <div
      className="movie-card"
      onClick={() => onClick(movie)}
      style={{ animationDelay }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(movie);
        }
      }}
    >
      {/* Poster */}
      {!imgLoaded && !imgError && (
        <div className="movie-card__poster-skeleton" />
      )}
      <img
        className="movie-card__poster"
        src={posterSrc}
        alt={movie.title}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        onError={() => { setImgError(true); setImgLoaded(true); }}
        style={{ opacity: imgLoaded ? 1 : 0 }}
      />

      {/* Gradient overlay */}
      <div className="movie-card__gradient" />

      {/* Language badge */}
      {movie.language && (
        <span className="movie-card__lang-badge">{movie.language}</span>
      )}

      {/* Rating badge */}
      {ratingDisplay && (
        <span className="movie-card__rating">
          <span className="movie-card__rating-star">★</span>
          {ratingDisplay}
        </span>
      )}

      {/* Bottom info */}
      <div className="movie-card__info">
        <h3 className="movie-card__title">{movie.title}</h3>
        <div className="movie-card__meta-row">
          {movie.year && <span className="movie-card__year">{movie.year}</span>}
          {(movie.genres || []).slice(0, 2).map((g) => (
            <span key={g} className="movie-card__genre">{g}</span>
          ))}
        </div>
      </div>


      {/* Play overlay on hover */}
      <div className="movie-card__play-overlay">
        <div className="movie-card__play-icon">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    </div>
  );
}
