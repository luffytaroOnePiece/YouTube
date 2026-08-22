import React, { useState, useMemo } from 'react';
import MovieCard from './MovieCard';
import MovieDetail from './MovieDetail';

export default function MoviesSection({ moviesData, onVideoSelect }) {
  const [activeLanguage, setActiveLanguage] = useState('All');
  const [selectedMovie, setSelectedMovie] = useState(null);

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

  // Filter by language
  const filteredMovies = useMemo(() => {
    if (activeLanguage === 'All') return allMovies;
    return allMovies.filter((m) => (m.language || 'Other') === activeLanguage);
  }, [allMovies, activeLanguage]);

  if (allMovies.length === 0) return null;

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
  };

  const handleVideoSelect = (video) => {
    // Enrich video with movie context for player display
    const enriched = {
      ...video,
      group: 'Movies',
      category: selectedMovie?.language || '',
      type: selectedMovie?.title || '',
    };
    setSelectedMovie(null);
    onVideoSelect(enriched);
  };

  return (
    <section className="movies-section">
      {/* Header */}
      <div className="movies-section__header">
        <span className="movies-section__icon">🎬</span>
        <span className="movies-section__title">Movies</span>
        <div className="movies-section__line" />
      </div>

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

      {/* Movie Grid */}
      {filteredMovies.length > 0 ? (
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
          <p className="movies-section__empty-text">No movies found for this language.</p>
        </div>
      )}

      {/* Movie Detail Modal */}
      {selectedMovie && (
        <MovieDetail
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onVideoSelect={handleVideoSelect}
        />
      )}
    </section>
  );
}
