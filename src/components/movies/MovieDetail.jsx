import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { getImages, getImageUrl } from '../../services/tmdbApi';
import MovieCard from './MovieCard';

function formatRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function MovieDetail({ movie, allMovies = [], onClose, onVideoSelect, onMovieClick }) {
  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!movie) return null;

  const hasBackdrop = !!movie.backdropUrl;
  const videos = movie.videos || [];

  const [activeTab, setActiveTab] = useState('videos');
  const [galleryImages, setGalleryImages] = useState(null);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  // Compute recommendations based on genre, language, and year
  const recommendations = useMemo(() => {
    if (!allMovies || allMovies.length <= 1) return [];
    const movieGenres = new Set(movie.genres || []);
    const movieYear = movie.year || 0;
    const movieLang = (movie.language || '').toLowerCase();

    const scored = allMovies
      .filter(m => m.tmdbId !== movie.tmdbId)
      .map(m => {
        let score = 0;
        // Same language: +5
        if (movieLang && (m.language || '').toLowerCase() === movieLang) score += 5;
        // Matching genres: +2 per shared genre
        const otherGenres = m.genres || [];
        for (const g of otherGenres) {
          if (movieGenres.has(g)) score += 2;
        }
        // Year proximity
        const otherYear = m.year || 0;
        if (movieYear && otherYear) {
          const diff = Math.abs(movieYear - otherYear);
          if (diff === 0) score += 3;
          else if (diff <= 2) score += 2;
          else if (diff <= 5) score += 1;
        }
        return { movie: m, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.movie);

    return scored;
  }, [movie, allMovies]);

  useEffect(() => {
    if (activeTab === 'gallery' && !galleryImages && !isLoadingGallery) {
      setIsLoadingGallery(true);
      getImages(movie.tmdbId, 'movie').then(data => {
        setGalleryImages(data);
        setIsLoadingGallery(false);
      }).catch(err => {
        console.error("Failed to fetch gallery images:", err);
        setIsLoadingGallery(false);
      });
    }
  }, [activeTab, movie.tmdbId, galleryImages, isLoadingGallery]);

  return (
    <div
      className="movie-detail"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Close button */}
      <button className="movie-detail__close-btn" onClick={onClose} aria-label="Close">
        ✕
      </button>

      <div className="movie-detail__content">
        {/* Hero */}
        <div className={`movie-detail__hero ${!hasBackdrop ? 'movie-detail__hero--fallback' : ''}`}>
          {hasBackdrop && (
            <img
              className="movie-detail__backdrop"
              src={movie.backdropUrl}
              alt=""
            />
          )}
          <div className="movie-detail__hero-gradient" />
        </div>

        {/* Info */}
        <div className="movie-detail__info">
          {movie.posterUrl && (
            <img
              className="movie-detail__poster"
              src={movie.posterUrl}
              alt={movie.title}
            />
          )}
          <div className="movie-detail__metadata">
            <h1 className="movie-detail__title">{movie.title}</h1>

            <div className="movie-detail__meta">
              {movie.year && (
                <span className="movie-detail__meta-item">{movie.year}</span>
              )}
              {movie.year && movie.runtime > 0 && (
                <span className="movie-detail__meta-dot" />
              )}
              {movie.runtime > 0 && (
                <span className="movie-detail__meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {formatRuntime(movie.runtime)}
                </span>
              )}
              {movie.language && (
                <>
                  <span className="movie-detail__meta-dot" />
                  <span className="movie-detail__meta-item">{movie.language}</span>
                </>
              )}
            </div>

            {movie.voteAverage > 0 && (
              <div className="movie-detail__rating">
                <span className="movie-detail__rating-star">★</span>
                <span className="movie-detail__rating-score">
                  {movie.voteAverage.toFixed(1)}
                </span>
                {movie.voteCount > 0 && (
                  <span className="movie-detail__rating-count">
                    ({movie.voteCount.toLocaleString()} votes)
                  </span>
                )}
              </div>
            )}

            {movie.genres && movie.genres.length > 0 && (
              <div className="movie-detail__genres">
                {movie.genres.map((g) => (
                  <span key={g} className="movie-detail__genre">{g}</span>
                ))}
              </div>
            )}

            {movie.overview && (
              <p className="movie-detail__overview">{movie.overview}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="movie-detail__tabs">
          <button 
            className={`movie-detail__tab ${activeTab === 'videos' ? 'movie-detail__tab--active' : ''}`}
            onClick={() => setActiveTab('videos')}
          >
            Videos
          </button>
          <button 
            className={`movie-detail__tab ${activeTab === 'gallery' ? 'movie-detail__tab--active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            Gallery
          </button>
        </div>

        {/* Videos */}
        {activeTab === 'videos' && videos.length > 0 && (
          <div className="movie-detail__videos">
            <div className="movie-detail__videos-header">
              <span className="movie-detail__videos-title">Videos</span>
              <span className="movie-detail__videos-count">{videos.length}</span>
              <div className="movie-detail__videos-line" />
            </div>
            <div className="movie-detail__video-grid">
              {videos.map((video) => (
                <div
                  key={video.youtubeLinkID}
                  className="movie-detail__video-card"
                  onClick={() => onVideoSelect(video)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onVideoSelect(video);
                    }
                  }}
                >
                  <div className="movie-detail__video-thumb-wrap">
                    <img
                      className="movie-detail__video-thumb"
                      src={video.thumbnail || `https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`}
                      alt={video.title}
                      loading="lazy"
                    />
                    <div className="movie-detail__video-play">
                      <div className="movie-detail__video-play-icon">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    {video.duration && (
                      <span className="movie-detail__video-duration">{video.duration}</span>
                    )}
                  </div>
                  <div className="movie-detail__video-info">
                    <h4 className="movie-detail__video-title">{video.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {activeTab === 'gallery' && (
          <div className="movie-detail__gallery">
            {isLoadingGallery && (
              <div className="movie-detail__loader">Loading high-quality images...</div>
            )}
            {!isLoadingGallery && galleryImages && (
              <div className="movie-detail__gallery-grid">
                {(galleryImages.backdrops || []).map((img, i) => (
                  <div key={i} className="movie-detail__gallery-item">
                    <img
                      src={getImageUrl(img.file_path, 'original')}
                      alt=""
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
            {!isLoadingGallery && galleryImages && (!galleryImages.backdrops || galleryImages.backdrops.length === 0) && (
              <div className="movie-detail__empty">No gallery images found.</div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="movie-detail__recommendations">
            <h2 className="movie-detail__recommendations-title">More Like This</h2>
            <div className="movie-detail__recommendations-grid">
              {recommendations.map((rec, index) => (
                <MovieCard
                  key={rec.tmdbId}
                  movie={rec}
                  onClick={onMovieClick}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
