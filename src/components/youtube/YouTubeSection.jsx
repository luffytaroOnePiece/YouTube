import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoCard from '../VideoCard';
import {
  searchYouTubeVideos,
  getCacheStats,
} from '../../services/youtubeApi';

const RECENT_SEARCHES_KEY = 'yt_search_history_v1';

const CATEGORIES = [
  {
    id: 'trending',
    label: '🔥 Trending',
    suggestions: [
      'Telugu 4K Songs',
      'Hindi 4K Songs',
      'Tamil 4K Songs',
      'Latest Movie Trailers 4K',
      'Telugu Mass Songs',
    ],
  },
  {
    id: 'music',
    label: '🎵 Music',
    suggestions: [
      'Anirudh Hit Songs 4K',
      'A.R. Rahman Live Concert',
      'Coke Studio Hits',
      'Lofi Beats Chill Music',
      'Thaman S Hits 4K',
    ],
  },
  {
    id: 'cinema',
    label: '🎬 Cinema',
    suggestions: [
      'OG Glimpse Pawan Kalyan',
      'Action Movie Scenes 4K',
      'Devara Video Songs 4K',
      'Pushpa 2 Songs 4K',
      'Original Soundtrack BGM',
    ],
  },
  {
    id: 'ultrahd',
    label: '💎 Ultra HD (4K & 8K)',
    suggestions: [
      '8K HDR 60FPS Video',
      '4K 60FPS Telugu Songs',
      'Dolby Atmos 4K Music',
      'Nature 8K 60FPS Landscapes',
    ],
  },
];

const DISCOVERY_CARDS = [
  {
    icon: '🎵',
    title: '4K Telugu Hits',
    desc: 'Mass beats, melodic numbers & 4K 60FPS video songs',
    query: 'Telugu 4K Songs',
  },
  {
    icon: '🍿',
    title: 'Blockbuster Trailers',
    desc: 'Official teasers, theatrical trailers & upcoming glimpses',
    query: 'Latest Movie Trailers 4K',
  },
  {
    icon: '🌌',
    title: '8K Ultra Visuals',
    desc: 'Crisp 8K HDR 60FPS cinematography & stunning landscapes',
    query: '8K HDR 60FPS Video',
  },
  {
    icon: '☕',
    title: 'Lo-Fi Chill & Study',
    desc: 'Calm instrumental vibes, bass relaxation & study beats',
    query: 'Lofi Beats Chill Music',
  },
];

export default function YouTubeSection({
  onVideoSelect,
  initialQuery = '',
  gridColumns = 3,
  isLocal = false,
  favorites = [],
  onToggleFav,
  tags = {},
  onToggleTag,
  ratings = {},
  onSetRating,
}) {
  const [searchInput, setSearchInput] = useState(initialQuery || '');
  const [activeQuery, setActiveQuery] = useState(initialQuery || 'Telugu 4K Songs');
  const [activeCategoryTab, setActiveCategoryTab] = useState('trending');
  const [order, setOrder] = useState('relevance');
  const [videoDuration, setVideoDuration] = useState('any');
  const [columns, setColumns] = useState(gridColumns || 3);

  const [videos, setVideos] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [cacheStats, setCacheStats] = useState(() => getCacheStats());

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [showBackToTop, setShowBackToTop] = useState(false);
  const isMountedRef = useRef(true);

  // Sync gridColumns prop with local columns state
  useEffect(() => {
    if (gridColumns) setColumns(gridColumns);
  }, [gridColumns]);

  // Back to top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const saveRecentSearch = useCallback((query) => {
    const q = query.trim();
    if (!q) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== q.toLowerCase());
      const updated = [q, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = (e, qToRemove) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== qToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  };

  // Sync with initialQuery if changed externally
  useEffect(() => {
    if (initialQuery && initialQuery !== activeQuery) {
      setSearchInput(initialQuery);
      setActiveQuery(initialQuery);
    }
  }, [initialQuery, activeQuery]);

  // Main search fetcher with forceRefresh support
  const executeSearch = useCallback(
    async (queryToSearch, pageToken = '', isAppend = false, forceRefresh = false) => {
      const q = (queryToSearch || '').trim();
      if (!q) return;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await searchYouTubeVideos({
          query: q,
          maxResults: 24,
          pageToken,
          order,
          videoDuration,
          forceRefresh,
        });

        if (!isMountedRef.current) return;

        if (isAppend) {
          setVideos((prev) => {
            const existingIds = new Set(prev.map((v) => v.youtubeLinkID));
            const newUnique = result.videos.filter(
              (v) => !existingIds.has(v.youtubeLinkID),
            );
            return [...prev, ...newUnique];
          });
        } else {
          setVideos(result.videos || []);
          setIsCachedResult(!!result.fromCache);
        }

        setNextPageToken(result.nextPageToken || null);
        setTotalResults(result.totalResults || 0);
        setCacheStats(getCacheStats());

        if (!isAppend) {
          saveRecentSearch(q);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err.message || 'Failed to search YouTube videos. Please try again.');
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [order, videoDuration, saveRecentSearch],
  );

  // Fetch when activeQuery, order, or videoDuration changes
  useEffect(() => {
    isMountedRef.current = true;
    if (activeQuery.trim()) {
      executeSearch(activeQuery, '', false);
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [activeQuery, executeSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) {
      setActiveQuery(q);
    }
  };

  const handleChipClick = (suggestion) => {
    setSearchInput(suggestion);
    setActiveQuery(suggestion);
  };

  const handleLoadMore = () => {
    if (nextPageToken && !loadingMore) {
      executeSearch(activeQuery, nextPageToken, true);
    }
  };

  const handleCardClick = (video) => {
    if (onVideoSelect) {
      onVideoSelect(video, videos);
    }
  };

  const handlePlayAll = () => {
    if (videos.length === 0 || !onVideoSelect) return;
    onVideoSelect(videos[0], videos);
  };

  const handleShufflePlay = () => {
    if (videos.length === 0 || !onVideoSelect) return;
    const shuffled = [...videos].sort(() => Math.random() - 0.5);
    onVideoSelect(shuffled[0], shuffled);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentTabObj = CATEGORIES.find((c) => c.id === activeCategoryTab) || CATEGORIES[0];

  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };

  return (
    <section className="youtube-section">
      {/* Ambient Red Glow */}
      <div className="youtube-section__ambient-glow" />

      {/* Hero Header */}
      <div className="youtube-hero">
        <div className="youtube-hero__badge">
          <span className="youtube-hero__badge-dot" />
          <span>Live YouTube API • Multi-Tier Caching</span>
          {cacheStats.creditsSaved > 0 && (
            <span style={{ color: '#4ade80', marginLeft: '6px' }}>
              (~{cacheStats.creditsSaved.toLocaleString()} Credits Saved)
            </span>
          )}
        </div>
        <h1 className="youtube-hero__title">
          Explore YouTube in <span>Ultra HD</span>
        </h1>
        <p className="youtube-hero__subtitle">
          Search millions of 4K & 8K videos, movie trailers, and songs with instant playback.
        </p>

        {/* Search Input Box */}
        <div className="youtube-search-box">
          <form className="youtube-search-box__wrapper" onSubmit={handleSubmit}>
            <svg
              className="youtube-search-box__icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="youtube-search-box__input"
              placeholder="Search YouTube (e.g. 'OG Glimpse 4K', 'Telugu songs', '8K 60FPS')..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            <div className="youtube-search-box__actions">
              {searchInput && (
                <button
                  type="button"
                  className="youtube-search-box__clear"
                  onClick={() => setSearchInput('')}
                  title="Clear input"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="youtube-search-box__submit"
                disabled={loading || !searchInput.trim()}
              >
                {loading ? (
                  <span>Searching...</span>
                ) : (
                  <>
                    <span>Search</span>
                    <kbd className="youtube-search-box__kbd">↵</kbd>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="youtube-recent-bar">
              <span className="youtube-recent-bar__label">Recent:</span>
              {recentSearches.map((item) => (
                <div
                  key={item}
                  className="youtube-recent-chip"
                  onClick={() => handleChipClick(item)}
                >
                  <span>{item}</span>
                  <button
                    className="youtube-recent-chip__remove"
                    onClick={(e) => removeRecentSearch(e, item)}
                    title="Remove from history"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="youtube-recent-bar__clear"
                onClick={clearAllRecent}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Curated Category Exploration Tabs */}
      <div className="youtube-categories">
        <div className="youtube-categories__tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`youtube-categories__tab ${
                activeCategoryTab === cat.id ? 'youtube-categories__tab--active' : ''
              }`}
              onClick={() => setActiveCategoryTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Category Subchips */}
        <div className="youtube-categories__subchips">
          {currentTabObj.suggestions.map((sug) => {
            const isSelected = activeQuery.toLowerCase() === sug.toLowerCase();
            return (
              <button
                key={sug}
                type="button"
                className={`youtube-subchip ${isSelected ? 'youtube-subchip--active' : ''}`}
                onClick={() => handleChipClick(sug)}
              >
                {sug}
              </button>
            );
          })}
        </div>
      </div>

      {/* Discovery Showcase Cards (shown when results haven't been searched or on launch) */}
      {!activeQuery && (
        <div className="youtube-discovery">
          <div className="youtube-discovery__title">
            <span>✨ Curated Discovery</span>
          </div>
          <div className="youtube-discovery__grid">
            {DISCOVERY_CARDS.map((card) => (
              <div
                key={card.title}
                className="youtube-discovery-card"
                onClick={() => handleChipClick(card.query)}
              >
                <div className="youtube-discovery-card__icon">{card.icon}</div>
                <h3 className="youtube-discovery-card__heading">{card.title}</h3>
                <p className="youtube-discovery-card__desc">{card.desc}</p>
                <span className="youtube-discovery-card__action">
                  Explore now →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="youtube-section__error">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <strong>YouTube API Notice:</strong> {error}
          </div>
          <button
            type="button"
            className="youtube-section__retry-btn"
            onClick={() => executeSearch(activeQuery, '', false)}
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Results Toolbar */}
      {!loading && !error && videos.length > 0 && (
        <div className="youtube-toolbar">
          <div className="youtube-toolbar__left">
            <div className="youtube-toolbar__query-badge">
              <span>Results for</span>
              <span className="youtube-toolbar__query-text">"{activeQuery}"</span>
            </div>
            <span className="youtube-toolbar__count">
              {videos.length}
              {totalResults > 0 ? ` of ~${totalResults.toLocaleString()} found` : ' videos'}
            </span>
            {isCachedResult ? (
              <span
                className="youtube-cache-indicator youtube-cache-indicator--cached"
                title="Served instantly from persistent multi-tier cache. Consumed 0 YouTube API quota credits!"
              >
                ⚡ 0 Credits (Cached)
              </span>
            ) : (
              <span
                className="youtube-cache-indicator youtube-cache-indicator--live"
                title="Fetched fresh from YouTube Data API v3"
              >
                🌐 Live Fetch
              </span>
            )}
          </div>

          <div className="youtube-toolbar__center-actions">
            <button
              type="button"
              className="youtube-action-btn youtube-action-btn--play-all"
              onClick={handlePlayAll}
              title="Play all videos in queue"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play All ({videos.length})</span>
            </button>

            <button
              type="button"
              className="youtube-action-btn youtube-action-btn--shuffle"
              onClick={handleShufflePlay}
              title="Shuffle all videos"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
              <span>Shuffle</span>
            </button>

            <button
              type="button"
              className="youtube-action-btn youtube-action-btn--refresh"
              onClick={() => executeSearch(activeQuery, '', false, true)}
              title="Bypass cache and force a fresh live fetch from YouTube API"
              disabled={loading}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          <div className="youtube-toolbar__right">
            {/* Sort Filter */}
            <select
              className="youtube-filter-select"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              title="Sort Order"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Upload Date</option>
              <option value="viewCount">Most Viewed</option>
              <option value="rating">Top Rated</option>
            </select>

            {/* Duration Filter */}
            <select
              className="youtube-filter-select"
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value)}
              title="Duration Filter"
            >
              <option value="any">Any Length</option>
              <option value="short">Short (&lt; 4m)</option>
              <option value="medium">Medium (4–20m)</option>
              <option value="long">Long (&gt; 20m)</option>
            </select>

            {/* Grid Density Switcher */}
            <div className="youtube-grid-toggle" title="Layout columns">
              {[2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`youtube-grid-toggle__btn ${
                    columns === num ? 'youtube-grid-toggle__btn--active' : ''
                  }`}
                  onClick={() => setColumns(num)}
                  title={`${num} columns`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="youtube-skeleton-grid" style={gridStyle}>
          {[...Array(columns * 3)].map((_, i) => (
            <div key={i} className="youtube-skeleton-card">
              <div className="youtube-skeleton-thumb" />
              <div className="youtube-skeleton-info">
                <div className="youtube-skeleton-line youtube-skeleton-line--title" />
                <div className="youtube-skeleton-line youtube-skeleton-line--sub" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Results Grid */}
      {!loading && videos.length > 0 && (
        <div className="video-grid" style={gridStyle}>
          {videos.map((video, index) => (
            <VideoCard
              key={`${video.youtubeLinkID}-${index}`}
              video={video}
              onClick={handleCardClick}
              index={index}
              isLocal={isLocal}
              isFav={favorites?.includes(video.youtubeLinkID)}
              onToggleFav={onToggleFav}
              tags={tags}
              onToggleTag={onToggleTag}
              rating={ratings?.[video.youtubeLinkID] || 0}
              onSetRating={onSetRating}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && videos.length === 0 && activeQuery && (
        <div className="youtube-section__empty">
          <svg
            className="youtube-section__empty-icon"
            width="54"
            height="54"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <div className="youtube-section__empty-title">
            No YouTube results found for "{activeQuery}"
          </div>
          <p>Try searching for popular music, actor names, movie titles, or select one of the curated chips above.</p>
        </div>
      )}

      {/* Load More Button */}
      {!loading && nextPageToken && (
        <div className="youtube-section__load-more-wrap">
          <button
            type="button"
            className="youtube-section__load-more"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <span>Loading more videos...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                <span>Load 24 More Results</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Floating Back To Top */}
      {showBackToTop && (
        <button
          type="button"
          className="youtube-back-to-top"
          onClick={scrollToTop}
          title="Back to top"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          <span>Top</span>
        </button>
      )}
    </section>
  );
}
