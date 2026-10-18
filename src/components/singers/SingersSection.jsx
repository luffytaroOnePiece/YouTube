import React, { useState, useMemo } from 'react';
import SingerCard from './SingerCard';
import SingerDetail from './SingerDetail';
import VideoGrid from '../VideoGrid';
import Dropdown from '../Dropdown';

export default function SingersSection({ singersData, onVideoSelect, searchQuery = '' }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeGenre, setActiveGenre] = useState('All');
  const [activeSort, setActiveSort] = useState('Name (A-Z)');
  const [viewMode, setViewMode] = useState('Albums');
  const [activeResolution, setActiveResolution] = useState('All Quality');
  const [selectedSinger, setSelectedSinger] = useState(null);

  // Parse all singers from data
  const allSingers = useMemo(() => {
    if (!singersData?.singers) return [];
    const result = [];
    for (const [category, singers] of Object.entries(singersData.singers)) {
      if (!Array.isArray(singers)) continue;
      singers.forEach(s => result.push({ ...s, category }));
    }
    return result;
  }, [singersData]);

  // Extract unique categories with counts
  const categories = useMemo(() => {
    const catMap = {};
    allSingers.forEach((s) => {
      const cat = s.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    return Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  }, [allSingers]);

  // Extract unique genres with counts
  const genres = useMemo(() => {
    const genreMap = {};
    allSingers.forEach((s) => {
      const genre = s.genre || 'Other';
      genreMap[genre] = (genreMap[genre] || 0) + 1;
    });
    return Object.entries(genreMap).sort((a, b) => b[1] - a[1]);
  }, [allSingers]);

  // Filter and sort
  const filteredSingers = useMemo(() => {
    let result = allSingers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        (s.name && s.name.toLowerCase().includes(q))
      );
    }

    if (activeCategory !== 'All') {
      result = result.filter((s) => (s.category || 'Other') === activeCategory);
    }

    if (activeGenre !== 'All') {
      result = result.filter((s) => (s.genre || 'Other') === activeGenre);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (activeSort === 'Name (A-Z)') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (activeSort === 'Name (Z-A)') {
        return (b.name || '').localeCompare(a.name || '');
      } else if (activeSort === 'Most Songs') {
        const countA = (a.videos?.length || 0) + (a.liveVideos?.length || 0);
        const countB = (b.videos?.length || 0) + (b.liveVideos?.length || 0);
        return countB - countA;
      }
      return 0;
    });

    return result;
  }, [allSingers, activeCategory, activeGenre, searchQuery, activeSort]);

  const flattenedVideos = useMemo(() => {
    if (viewMode !== 'Flat') return [];

    const videos = [];
    filteredSingers.forEach(singer => {
      const allVids = [...(singer.videos || []), ...(singer.liveVideos || [])];
      allVids.forEach(v => {
        const is8K = v.resolution === '8K';
        const is4K = v.resolution === '4K';
        const res = is8K ? '8K' : is4K ? '4K' : 'Other';

        if (activeResolution === 'All Quality' || activeResolution === res) {
          videos.push({
            ...v,
            group: 'Singers',
            category: singer.category || '',
            type: singer.name || '',
            resolution: v.resolution || ''
          });
        }
      });
    });
    return videos;
  }, [filteredSingers, viewMode, activeResolution]);

  if (allSingers.length === 0) return null;

  const handleSingerClick = (singer) => {
    setSelectedSinger(singer);
  };

  const handleVideoSelect = (video, album) => {
    setSelectedSinger(null);
    onVideoSelect(video, album);
  };

  const handleFlatVideoSelect = (video) => {
    onVideoSelect(video, flattenedVideos);
  };

  const categoryOptions = [
    { value: 'All', label: 'All Categories', count: allSingers.length },
    ...categories.map(([cat, count]) => ({
      value: cat,
      label: cat,
      count
    }))
  ];

  const genreOptions = [
    { value: 'All', label: 'All Genres', count: allSingers.length },
    ...genres.map(([genre, count]) => ({
      value: genre,
      label: genre,
      count
    }))
  ];

  const sortOptions = [
    { value: 'Name (A-Z)', label: 'Name (A-Z)' },
    { value: 'Name (Z-A)', label: 'Name (Z-A)' },
    { value: 'Most Songs', label: 'Most Songs' },
  ];

  const viewOptions = [
    { value: 'Albums', label: 'Albums' },
    { value: 'Flat', label: 'Flat' }
  ];

  const resolutionOptions = [
    { value: 'All Quality', label: 'All Quality' },
    { value: '8K', label: '8K Ultra' },
    { value: '4K', label: '4K' }
  ];

  return (
    <section className="singers-section">
      {/* Header */}
      <div className="singers-section__header">
        <span className="singers-section__icon">🎤</span>
        <span className="singers-section__title">Singers</span>
        <div className="singers-section__line" />
      </div>

      {/* Controls row */}
      <div className="singers-section__controls">
        {/* Category dropdown */}
        {categories.length > 1 && (
          <div className="singers-section__dropdown">
            <Dropdown
              id="singer-category-select"
              value={activeCategory}
              options={categoryOptions}
              onChange={setActiveCategory}
              placeholder="All Categories"
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Genre Filter */}
          {genres.length > 1 && (
            <div className="singers-section__sort">
              <span className="singers-section__sort-label">Genre:</span>
              <Dropdown
                id="singer-genre-select"
                value={activeGenre}
                options={genreOptions}
                onChange={setActiveGenre}
                placeholder="All Genres"
              />
            </div>
          )}

          {/* Resolution Filter (only in Flat view) */}
          {viewMode === 'Flat' && (
            <div className="singers-section__sort">
              <span className="singers-section__sort-label">Quality:</span>
              <Dropdown
                id="singer-res-select"
                value={activeResolution}
                options={resolutionOptions}
                onChange={setActiveResolution}
                placeholder="All Quality"
              />
            </div>
          )}

          {/* Sort Controls */}
          <div className="singers-section__sort">
            <span className="singers-section__sort-label">Sort by:</span>
            <Dropdown
              id="singer-sort-select"
              value={activeSort}
              options={sortOptions}
              onChange={setActiveSort}
              placeholder="Sort by"
            />
          </div>

          {/* View Toggle */}
          <div className="singers-section__sort">
            <span className="singers-section__sort-label">View:</span>
            <Dropdown
              id="singer-view-select"
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
        filteredSingers.length > 0 ? (
          <div className="singers-section__grid">
            {filteredSingers.map((singer, index) => (
              <SingerCard
                key={singer.id}
                singer={singer}
                onClick={handleSingerClick}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="singers-section__empty">
            <div className="singers-section__empty-icon">🎤</div>
            <p className="singers-section__empty-text">No singers found for this filter.</p>
          </div>
        )
      ) : (
        <VideoGrid
          videos={flattenedVideos}
          onVideoSelect={handleFlatVideoSelect}
        />
      )}

      {/* Singer Detail Modal */}
      {selectedSinger && (
        <SingerDetail
          singer={selectedSinger}
          onClose={() => setSelectedSinger(null)}
          onVideoSelect={handleVideoSelect}
        />
      )}
    </section>
  );
}
