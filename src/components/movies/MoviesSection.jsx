import React, { useState, useMemo } from 'react';
import MovieCard from './MovieCard';
import MovieDetail from './MovieDetail';
import VideoGrid from '../VideoGrid';
import Dropdown from '../Dropdown';

export default function MoviesSection({ moviesData, onVideoSelect, searchQuery = '' }) {
  const [activeLanguage, setActiveLanguage] = useState('All');
  const [activeSort, setActiveSort] = useState('Date (Newest)');
  const [viewMode, setViewMode] = useState('Albums');
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
      if (activeSort.startsWith('Date')) {
        const dateA = a.releaseDate || `${a.year || '1970'}-01-01`;
        const dateB = b.releaseDate || `${b.year || '1970'}-01-01`;
        if (activeSort === 'Date (Newest)') {
          return dateB.localeCompare(dateA);
        } else {
          return dateA.localeCompare(dateB);
        }
      } else {
        const valA = parseFloat(a.voteAverage) || 0;
        const valB = parseFloat(b.voteAverage) || 0;
        if (activeSort === 'Rating (Highest)') {
          return valB - valA;
        } else {
          return valA - valB;
        }
      }
    });

    return result;
  }, [allMovies, activeLanguage, searchQuery, activeSort]);

  const flattenedVideos = useMemo(() => {
    if (viewMode !== 'Flat') return [];
    
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

  const languageOptions = [
    { value: 'All', label: 'All Languages', count: allMovies.length },
    ...languages.map(([lang, count]) => ({
      value: lang,
      label: lang,
      count
    }))
  ];

  const sortOptions = [
    { value: 'Date (Newest)', label: 'Date (Newest)' },
    { value: 'Date (Oldest)', label: 'Date (Oldest)' },
    { value: 'Rating (Highest)', label: 'Rating (Highest)' },
    { value: 'Rating (Lowest)', label: 'Rating (Lowest)' }
  ];

  const viewOptions = [
    { value: 'Albums', label: 'Albums' },
    { value: 'Flat', label: 'Flat' }
  ];

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
        {/* Language dropdown */}
        {languages.length > 1 && (
          <div className="movies-section__lang-dropdown">
            <Dropdown
              id="language-select"
              value={activeLanguage}
              options={languageOptions}
              onChange={setActiveLanguage}
              placeholder="All Languages"
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Sort Controls */}
          <div className="movies-section__sort">
            <span className="movies-section__sort-label">Sort by:</span>
            <Dropdown
              id="sort-select"
              value={activeSort}
              options={sortOptions}
              onChange={setActiveSort}
              placeholder="Sort by"
            />
          </div>

          {/* View Toggle */}
          <div className="movies-section__sort">
            <span className="movies-section__sort-label">View:</span>
            <Dropdown
              id="view-select"
              value={viewMode}
              options={viewOptions}
              onChange={setViewMode}
              placeholder="View Mode"
            />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {viewMode === 'Albums' ? (
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
