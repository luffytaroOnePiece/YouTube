import React, { useState, useMemo } from 'react';
import MovieCard from './MovieCard';
import MovieDetail from './MovieDetail';
import VideoGrid from '../VideoGrid';

export default function MoviesSection({ moviesData, onVideoSelect, searchQuery = '' }) {
  const [activeLanguage, setActiveLanguage] = useState('All');
  const [sortBy, setSortBy] = useState('Year'); // 'Year', 'Rating'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc', 'asc'
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [viewMode, setViewMode] = useState('albums'); // 'albums', 'flat'

  // Parse movies from data
  const allMovies = useMemo(() => {
    if (!moviesData?.movies) return [];
    return Object.values(moviesData.movies);
  }, [moviesData]);

  // Extract unique languages with counts
  const languages = useMemo(() => {
    const langMap = {};
    allMovies.forEach((m) => {
      const lang = m.language || 'Other';
      langMap[lang] = (langMap[lang] || 0) + 1;
    });
    return Object.entries(langMap).sort((a, b) => b[1] - a[1]);
  }, [allMovies]);

  // Filter by language and search query, then sort
  const filteredMovies = useMemo(() => {
    let result = allMovies;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m => 
        (m.title && m.title.toLowerCase().includes(q)) || 
        (m.originalTitle && m.originalTitle.toLowerCase().includes(q))
      );
    }

    if (activeLanguage !== 'All') {
      result = result.filter((m) => (m.language || 'Other') === activeLanguage);
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      
      if (sortBy === 'Year') {
        valA = parseInt(a.year) || 0;
        valB = parseInt(b.year) || 0;
      } else if (sortBy === 'Rating') {
        valA = parseFloat(a.voteAverage) || 0;
        valB = parseFloat(b.voteAverage) || 0;
      }

      if (sortOrder === 'desc') {
        return valB - valA;
      } else {
        return valA - valB;
      }
    });

    return result;
  }, [allMovies, activeLanguage, searchQuery, sortBy, sortOrder]);

  const flattenedVideos = useMemo(() => {
    if (viewMode !== 'flat') return [];
    
    const videos = [];
    filteredMovies.forEach(movie => {
      if (movie.videos && movie.videos.length > 0) {
        movie.videos.forEach(v => {
          videos.push({
            ...v,
            group: 'Movies',
            category: movie.language || '',
            type: movie.title || '',
          });
        });
      }
    });
    return videos;
  }, [filteredMovies, viewMode]);

  if (allMovies.length === 0) return null;

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
  };

  const handleVideoSelect = (video) => {
    if (!selectedMovie) return;

    // Enrich video with movie context for player display
    const enrich = (v) => ({
      ...v,
      group: 'Movies',
      category: selectedMovie.language || '',
      type: selectedMovie.title || '',
    });

    const enrichedVideo = enrich(video);
    const enrichedAlbum = (selectedMovie.videos || []).map(enrich);
    
    setSelectedMovie(null);
    onVideoSelect(enrichedVideo, enrichedAlbum);
  };

  const handleFlatVideoSelect = (video) => {
    onVideoSelect(video, flattenedVideos);
  };

  return (
    <section className="movies-section">
      {/* Header */}
      <div className="movies-section__header">
        <span className="movies-section__icon">🎬</span>
        <span className="movies-section__title">Movies</span>
        <div className="movies-section__line" />
      </div>

      {/* Controls row */}
      <div className="movies-section__controls">
        {/* Language pills */}
        {languages.length > 1 && (
          <div className="movies-section__lang-pills">
            <button
              className={`movies-section__pill ${activeLanguage === 'All' ? 'movies-section__pill--active' : ''}`}
              onClick={() => setActiveLanguage('All')}
            >
              All
              <span className="movies-section__pill-count">{allMovies.length}</span>
            </button>
            {languages.map(([lang, count]) => (
              <button
                key={lang}
                className={`movies-section__pill ${activeLanguage === lang ? 'movies-section__pill--active' : ''}`}
                onClick={() => setActiveLanguage(lang)}
              >
                {lang}
                <span className="movies-section__pill-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {/* Sort Controls */}
          <div className="movies-section__sort">
            <span className="movies-section__sort-label">Sort by:</span>
            <button 
              className={`movies-section__sort-btn ${sortBy === 'Year' ? 'movies-section__sort-btn--active' : ''}`}
              onClick={() => {
                if (sortBy === 'Year') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortBy('Year'); setSortOrder('desc'); }
              }}
            >
              Year
              {sortBy === 'Year' && (
                <svg className="movies-section__sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none' }}>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              )}
            </button>
            <button 
              className={`movies-section__sort-btn ${sortBy === 'Rating' ? 'movies-section__sort-btn--active' : ''}`}
              onClick={() => {
                if (sortBy === 'Rating') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortBy('Rating'); setSortOrder('desc'); }
              }}
            >
              Rating
              {sortBy === 'Rating' && (
                <svg className="movies-section__sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none' }}>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              )}
            </button>
          </div>

          {/* View Toggle */}
          <div className="movies-section__sort">
            <span className="movies-section__sort-label">View:</span>
            <button 
              className={`movies-section__sort-btn ${viewMode === 'albums' ? 'movies-section__sort-btn--active' : ''}`}
              onClick={() => setViewMode('albums')}
            >
              Albums
            </button>
            <button 
              className={`movies-section__sort-btn ${viewMode === 'flat' ? 'movies-section__sort-btn--active' : ''}`}
              onClick={() => setViewMode('flat')}
            >
              Flat
            </button>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {viewMode === 'albums' ? (
        filteredMovies.length > 0 ? (
          <div className="movies-section__grid">
            {filteredMovies.map((movie, index) => (
              <MovieCard
                key={movie.tmdbId}
                movie={movie}
                onClick={handleMovieClick}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="movies-section__empty">
            <div className="movies-section__empty-icon">🎬</div>
            <p className="movies-section__empty-text">No movies found for this filter.</p>
          </div>
        )
      ) : (
        <VideoGrid 
          videos={flattenedVideos}
          onVideoSelect={handleFlatVideoSelect}
        />
      )}

      {/* Movie Detail Modal */}
      {selectedMovie && (
        <MovieDetail
          movie={selectedMovie}
          allMovies={allMovies}
          onClose={() => setSelectedMovie(null)}
          onVideoSelect={handleVideoSelect}
          onMovieClick={handleMovieClick}
        />
      )}
    </section>
  );
}
