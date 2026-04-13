import React, { useState, useMemo, useCallback } from 'react';
import FilterBar from './components/FilterBar';
import VideoGrid from './components/VideoGrid';
import Player from './components/Player';
import ScriptsPage from './components/ScriptsPage';
import videosData from './data/videos.json';
import './styles/App.css';

function App() {
  const [activeGroup, setActiveGroup] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activePlaylist, setActivePlaylist] = useState('All');
  const [activeResolution, setActiveResolution] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [showScripts, setShowScripts] = useState(false);

  // Parse grouped data
  const { allVideos, groups, groupMeta } = useMemo(() => {
    const grps = Object.keys(videosData.groups || {});
    const meta = {};
    const all = [];

    grps.forEach((groupName) => {
      const group = videosData.groups[groupName];
      const catNames = Object.keys(group.categories || {});
      const catMeta = {};

      catNames.forEach((catName) => {
        const playlists = Object.keys(group.categories[catName] || {});
        catMeta[catName] = { playlists };

        playlists.forEach((plName) => {
          const vids = group.categories[catName][plName] || [];
          vids.forEach((v) => all.push(v));
        });
      });

      meta[groupName] = {
        icon: group.icon || '',
        categories: catNames,
        catMeta,
      };
    });

    return { allVideos: all, groups: grps, groupMeta: meta };
  }, []);

  // Latest videos — sorted by date, top 20
  const latestVideos = useMemo(() => {
    let vids = [...allVideos].filter((v) => v.date);
    if (activeResolution !== 'All') {
      vids = vids.filter((v) => v.resolution === activeResolution);
    }
    return vids.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  }, [allVideos, activeResolution]);

  // Available resolutions
  const availableResolutions = useMemo(() => {
    const resSet = new Set();
    allVideos.forEach((v) => {
      if (v.resolution) resSet.add(v.resolution);
    });
    // Sort by quality descending
    const order = ['8K', '4K', '2K', '1080p', '720p', '480p', '360p'];
    return order.filter((r) => resSet.has(r));
  }, [allVideos]);

  // Active categories and playlists
  const activeCategories = useMemo(() => {
    if (activeGroup === 'All') return [];
    return groupMeta[activeGroup]?.categories || [];
  }, [activeGroup, groupMeta]);

  const activePlaylists = useMemo(() => {
    if (activeGroup === 'All' || activeCategory === 'All') return [];
    return groupMeta[activeGroup]?.catMeta?.[activeCategory]?.playlists || [];
  }, [activeGroup, activeCategory, groupMeta]);

  // Video counts
  const videoCounts = useMemo(() => {
    const counts = { total: allVideos.length, groups: {}, categories: {}, playlists: {} };

    groups.forEach((groupName) => {
      let groupTotal = 0;
      const group = videosData.groups[groupName];

      Object.entries(group.categories || {}).forEach(([catName, catPlaylists]) => {
        let catTotal = 0;

        Object.entries(catPlaylists || {}).forEach(([plName, vids]) => {
          counts.playlists[`${groupName}::${catName}::${plName}`] = vids.length;
          catTotal += vids.length;
        });

        counts.categories[`${groupName}::${catName}`] = catTotal;
        groupTotal += catTotal;
      });

      counts.groups[groupName] = groupTotal;
    });

    return counts;
  }, [allVideos, groups]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    let videos;

    if (activeGroup === 'All') {
      videos = allVideos;
    } else {
      const group = videosData.groups[activeGroup];

      if (activeCategory === 'All') {
        videos = [];
        Object.values(group.categories || {}).forEach((cat) => {
          Object.values(cat || {}).forEach((vids) => {
            vids.forEach((v) => videos.push(v));
          });
        });
      } else if (activePlaylist === 'All') {
        videos = [];
        const cat = group.categories[activeCategory] || {};
        Object.values(cat).forEach((vids) => {
          vids.forEach((v) => videos.push(v));
        });
      } else {
        videos = group.categories?.[activeCategory]?.[activePlaylist] || [];
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      videos = videos.filter((v) => v.title.toLowerCase().includes(q));
    }

    if (activeResolution !== 'All') {
      videos = videos.filter((v) => v.resolution === activeResolution);
    }

    return videos;
  }, [activeGroup, activeCategory, activePlaylist, activeResolution, searchQuery, allVideos]);

  // Is home view (no filters active, no search)
  const isHomeView = activeGroup === 'All' && !searchQuery.trim();

  // Check if any filter is active
  const hasActiveFilters = activeGroup !== 'All' || activeResolution !== 'All' || searchQuery.trim();

  const handleGroupChange = useCallback((group) => {
    setActiveGroup(group);
    setActiveCategory('All');
    setActivePlaylist('All');
  }, []);

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat);
    setActivePlaylist('All');
  }, []);

  const handleReset = useCallback(() => {
    setActiveGroup('All');
    setActiveCategory('All');
    setActivePlaylist('All');
    setActiveResolution('All');
    setSearchQuery('');
  }, []);

  const handleVideoSelect = useCallback((video) => {
    setSelectedVideo(video);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  return (
    <div className="app">
      <div className="sticky-nav">
      {/* Header */}
      <header className="header">
        <div className="header__brand" onClick={handleReset} style={{ cursor: 'pointer' }}>
          <div className="header__play-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="header__logo">YouTube</h1>
        </div>
        <span className="header__subtitle">Personal Library</span>
        <button
          className="header__scripts-btn"
          onClick={() => setShowScripts(true)}
          title="Scripts & Data"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </header>

      {/* Filter Bar */}
      <FilterBar
        groups={groups}
        groupMeta={groupMeta}
        activeGroup={activeGroup}
        onGroupChange={handleGroupChange}
        categories={activeCategories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        playlists={activePlaylists}
        activePlaylist={activePlaylist}
        onPlaylistChange={setActivePlaylist}
        availableResolutions={availableResolutions}
        activeResolution={activeResolution}
        onResolutionChange={setActiveResolution}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        videoCounts={videoCounts}
        gridColumns={gridColumns}
        onGridColumnsChange={setGridColumns}
        hasActiveFilters={hasActiveFilters}
        onReset={handleReset}
      />
      </div>

      {/* Home View: Latest Videos */}
      {isHomeView && latestVideos.length > 0 && (
        <section className="home-section">
          <div className="home-section__header">
            <span className="home-section__title">Recently Added</span>
            <div className="home-section__line" />
          </div>
          <VideoGrid
            videos={latestVideos}
            onVideoSelect={handleVideoSelect}
            gridColumns={gridColumns}
          />
        </section>
      )}

      {/* Filtered View */}
      {!isHomeView && (
        <VideoGrid
          videos={filteredVideos}
          onVideoSelect={handleVideoSelect}
          gridColumns={gridColumns}
        />
      )}

      {/* Player Modal */}
      {selectedVideo && (
        <Player
          video={selectedVideo}
          onClose={handleClosePlayer}
        />
      )}
      {/* Scripts Modal */}
      {showScripts && (
        <ScriptsPage onClose={() => setShowScripts(false)} />
      )}
    </div>
  );
}

export default App;
