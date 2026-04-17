import React, { useState, useMemo, useCallback, useEffect } from 'react';
import FilterBar from './components/FilterBar';
import VideoGrid from './components/VideoGrid';
import Player from './components/Player';
import ScriptsPage from './components/ScriptsPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
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
  const [showAnalytics, setShowAnalytics] = useState(false);

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

  // ⌘K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app">
      <div className="sticky-nav">
      {/* Header */}
      <header className="header">
        <div className="header__top-row">
          <div className="header__brand" onClick={handleReset} style={{ cursor: 'pointer' }}>
            <div className="header__play-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="header__brand-text">
              <h1 className="header__logo">YouTube</h1>
              <span className="header__tagline">Library</span>
            </div>
          </div>
          <div className="header__search">
            <svg className="header__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="search-input"
              type="text"
              className="header__search-input"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery ? (
              <button
                className="header__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : (
              <kbd className="header__search-kbd">⌘K</kbd>
            )}
          </div>
          <div className="header__right">
            <button
              className="header__analytics-btn"
              onClick={() => setShowAnalytics(true)}
              title="View Analytics"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="18" y="3" width="4" height="18"></rect>
                <rect x="10" y="8" width="4" height="13"></rect>
                <rect x="2" y="13" width="4" height="8"></rect>
              </svg>
              <span>Analytics</span>
            </button>
            <button
              className="header__scripts-btn"
              onClick={() => setShowScripts(true)}
              title="Scripts & Data"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
          </div>
        </div>
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
        onQuickAccess={(group, category, resolution) => {
          setActiveGroup(group);
          setActiveCategory(category);
          setActivePlaylist('All');
          setActiveResolution(resolution);
        }}
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
      
      {/* Analytics Modal */}
      {showAnalytics && (
        <AnalyticsDashboard onClose={() => setShowAnalytics(false)} allVideos={allVideos} />
      )}
    </div>
  );
}

export default App;
