import React, { useState, useMemo, useCallback, useEffect } from 'react';
import FilterBar from './components/FilterBar';
import VideoGrid from './components/VideoGrid';
import Player from './components/Player';
import ScriptsPage from './components/ScriptsPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { useUrlFilters } from './hooks/useUrlFilters';
import videosData from './data/videos.json';
import './styles/App.css';

const INITIAL_FILTERS = {
  group: 'All',
  category: 'All',
  playlist: 'All',
  resolution: 'All',
  search: '',
  sort: 'Newest First'
};

// Seeded PRNG for stable shuffling
function pseudoRandom(seed) {
  let value = seed;
  return function() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function App() {
  const [filters, setFilters] = useUrlFilters(INITIAL_FILTERS);
  const { group: activeGroup, category: activeCategory, playlist: activePlaylist, resolution: activeResolution, search: searchQuery, sort: activeSort } = filters;

  const [shuffleActive, setShuffleActive] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [showScripts, setShowScripts] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [playerMode, setPlayerMode] = useState('normal');
  const [isMonitorSize, setIsMonitorSize] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    document.documentElement.style.zoom = isMonitorSize ? '1.75' : '1';
  }, [isMonitorSize]);

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
      let q = searchQuery.toLowerCase().trim();
      let resFilter = null;
      let afterFilter = null;
      let typeFilter = null;

      // Extract inline filters
      const resMatch = q.match(/res:(\S+)/);
      if (resMatch) {
        resFilter = resMatch[1];
        q = q.replace(resMatch[0], '').trim();
      }

      const afterMatch = q.match(/after:(\d{4})/);
      if (afterMatch) {
        afterFilter = parseInt(afterMatch[1], 10);
        q = q.replace(afterMatch[0], '').trim();
      }

      const typeMatch = q.match(/type:(\S+)/);
      if (typeMatch) {
        typeFilter = typeMatch[1];
        q = q.replace(typeMatch[0], '').trim();
      }

      videos = videos.filter((v) => {
        // Apply parsed inline filters
        if (resFilter && (!v.resolution || v.resolution.toLowerCase() !== resFilter)) return false;
        if (afterFilter) {
          if (!v.date) return false;
          const year = new Date(v.date).getFullYear();
          if (year < afterFilter) return false;
        }
        if (typeFilter && (!v.type || !v.type.toLowerCase().includes(typeFilter))) return false;

        // Default query: title + type combined
        if (q) {
          const combinedText = `${v.title || ''} ${v.type || ''}`.toLowerCase();
          if (!combinedText.includes(q)) return false;
        }

        return true;
      });
    }

    if (activeResolution !== 'All') {
      videos = videos.filter((v) => v.resolution === activeResolution);
    }

    if (shuffleActive) {
      const rng = pseudoRandom(shuffleSeed);
      const shuffled = [...videos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      videos = shuffled;
    } else if (activeSort === 'Newest First') {
      videos.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } else if (activeSort === 'Oldest First') {
      videos.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    }

    return videos;
  }, [activeGroup, activeCategory, activePlaylist, activeResolution, activeSort, searchQuery, allVideos, shuffleActive, shuffleSeed]);

  // Is home view (no filters active, no search)
  const isHomeView = activeGroup === 'All' && !searchQuery.trim();

  // Check if any filter is active
  const hasActiveFilters = activeGroup !== 'All' || activeResolution !== 'All' || searchQuery.trim();

  const handleGroupChange = useCallback((group) => {
    setFilters({ group, category: 'All', playlist: 'All' });
  }, [setFilters]);

  const handleCategoryChange = useCallback((cat) => {
    setFilters({ category: cat, playlist: 'All' });
  }, [setFilters]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setShuffleActive(false);
  }, [setFilters]);

  const handleToggleShuffle = useCallback(() => {
    setShuffleActive(prev => {
      if (!prev) setShuffleSeed(Date.now());
      return !prev;
    });
  }, []);

  const handleVideoSelect = useCallback((video) => {
    setSelectedVideo(video);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setSelectedVideo(null);
    setIsMiniPlayer(false);
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
                onChange={(e) => setFilters({ search: e.target.value })}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                autoComplete="off"
              />
              <div className="header__search-actions">
                <div className="header__search-tips" title="Search tips">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <div className="header__search-tips-content">
                    <strong>Search Filters</strong>
                    <div><code>res:8K</code> (Quality)</div>
                    <div><code>after:2020</code> (Year)</div>
                    <div><code>type:music</code> (Type)</div>
                    <div style={{ marginTop: '6px' }}><small>Example: <code>avatar res:8K after:2022</code></small></div>
                  </div>
                </div>

                {searchQuery ? (
                  <button
                    className="header__search-clear"
                    onClick={() => setFilters({ search: '' })}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <kbd className="header__search-kbd">⌘K</kbd>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {isSearchFocused && searchQuery.trim() && (
                <div className="header__search-suggestions">
                  {filteredVideos.length > 0 ? (
                    filteredVideos.slice(0, 5).map((v) => (
                      <div 
                        key={v.id || v.title} 
                        className="search-suggestion"
                        onMouseDown={() => setFilters({ search: v.title })}
                      >
                        <svg className="suggestion-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span className="suggestion-text">{v.title}</span>
                      </div>
                    ))
                  ) : (
                    <div className="search-suggestion suggestion-empty">
                      No matching videos found
                    </div>
                  )}
                </div>
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
                onClick={() => setIsMonitorSize(!isMonitorSize)}
                title={isMonitorSize ? "Switch to Laptop Size (100%)" : "Switch to Monitor Size (175%)"}
                style={{ padding: '8px' }}
              >
                {isMonitorSize ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M2 20h20" />
                  </svg>
                )}
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
          onPlaylistChange={(playlist) => setFilters({ playlist })}
          availableResolutions={availableResolutions}
          activeResolution={activeResolution}
          onResolutionChange={(resolution) => setFilters({ resolution })}
          activeSort={activeSort}
          onSortChange={(sort) => setFilters({ sort })}
          searchQuery={searchQuery}
          onSearchChange={(search) => setFilters({ search })}
          videoCounts={videoCounts}
          gridColumns={gridColumns}
          onGridColumnsChange={setGridColumns}
          hasActiveFilters={hasActiveFilters}
          onReset={handleReset}
          shuffleActive={shuffleActive}
          onToggleShuffle={handleToggleShuffle}
          onQuickAccess={(group, category, resolution) => {
            setFilters({ group, category, playlist: 'All', resolution });
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
          allVideos={allVideos}
          onVideoSelect={handleVideoSelect}
          onClose={handleClosePlayer}
          isMiniPlayer={isMiniPlayer}
          onToggleMini={() => setIsMiniPlayer((prev) => !prev)}
        />
      )}
      {/* Scripts Modal */}
      {showScripts && (
        <ScriptsPage onClose={() => setShowScripts(false)} />
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <AnalyticsDashboard onClose={() => setShowAnalytics(false)} allVideos={allVideos} isMonitorSize={isMonitorSize} />
      )}
    </div>
  );
}

export default App;
