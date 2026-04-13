import React, { useState, useMemo, useCallback } from 'react';
import FilterBar from './components/FilterBar';
import VideoGrid from './components/VideoGrid';
import Player from './components/Player';
import videosData from './data/videos.json';
import './styles/App.css';

function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [gridColumns, setGridColumns] = useState(3);

  // Flatten all videos and extract categories
  const { allVideos, categories } = useMemo(() => {
    const cats = Object.keys(videosData.categories || {});
    const all = [];
    cats.forEach((cat) => {
      const vids = videosData.categories[cat] || [];
      vids.forEach((v) => all.push(v));
    });
    return { allVideos: all, categories: cats };
  }, []);

  // Video counts per category
  const videoCounts = useMemo(() => {
    const counts = { total: allVideos.length };
    categories.forEach((cat) => {
      counts[cat] = (videosData.categories[cat] || []).length;
    });
    return counts;
  }, [allVideos, categories]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    let videos = activeCategory === 'All'
      ? allVideos
      : videosData.categories[activeCategory] || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      videos = videos.filter((v) =>
        v.title.toLowerCase().includes(q)
      );
    }

    return videos;
  }, [activeCategory, searchQuery, allVideos]);

  const handleVideoSelect = useCallback((video) => {
    setSelectedVideo(video);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header__brand">
          <div className="header__play-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="header__logo">YouTube</h1>
        </div>
        <span className="header__subtitle">Personal Library</span>
      </header>

      {/* Filter Bar */}
      <FilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        videoCounts={videoCounts}
        gridColumns={gridColumns}
        onGridColumnsChange={setGridColumns}
      />

      {/* Video Grid */}
      <VideoGrid
        videos={filteredVideos}
        onVideoSelect={handleVideoSelect}
        gridColumns={gridColumns}
      />

      {/* Player Modal */}
      {selectedVideo && (
        <Player
          video={selectedVideo}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
}

export default App;
