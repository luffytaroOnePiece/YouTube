import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoCard from '../VideoCard';
import { searchYouTubeVideos } from '../../services/youtubeApi';

const DEFAULT_SUGGESTIONS = [
  'Telugu 4K Songs',
  'Hindi 4K Songs',
  'Latest Trailers',
  'Anime 4K 60FPS',
  'Lofi Beats',
  '8K HDR 60FPS',
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
  const [order, setOrder] = useState('relevance');
  const [videoDuration, setVideoDuration] = useState('any');

  const [videos, setVideos] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);

  const isMountedRef = useRef(true);

  // Sync with initialQuery if changed externally
  useEffect(() => {
    if (initialQuery && initialQuery !== activeQuery) {
      setSearchInput(initialQuery);
      setActiveQuery(initialQuery);
    }
  }, [initialQuery, activeQuery]);

  // Main search fetcher
  const executeSearch = useCallback(
    async (queryToSearch, pageToken = '', isAppend = false) => {
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
        }

        setNextPageToken(result.nextPageToken || null);
        setTotalResults(result.totalResults || 0);
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
    [order, videoDuration],
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
      // Pass the current search results as the custom playlist pool for autoplay / queue!
      onVideoSelect(video, videos);
    }
  };

  const gridStyle = gridColumns
    ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
    : {};

  return (
    <section className="youtube-section">
      {/* Header */}
      <div className="youtube-section__header">
        <div className="youtube-section__icon-wrap">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
        <div className="youtube-section__title-wrap">
          <h2 className="youtube-section__title">YouTube Live Search</h2>
          <span className="youtube-section__subtitle">
            Direct YouTube Data API v3 search with instant video playback
          </span>
        </div>
        <div className="youtube-section__line" />
      </div>

      {/* Search Bar & Filters */}
      <div className="youtube-search-bar">
        <form className="youtube-search-bar__input-row" onSubmit={handleSubmit}>
          <div className="youtube-search-bar__input-wrapper">
            <svg
              className="youtube-search-bar__input-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="youtube-search-bar__input"
              placeholder="Search anything on YouTube (e.g. movies, 4K songs, trailers)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="youtube-search-bar__clear"
                onClick={() => setSearchInput('')}
                title="Clear input"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="youtube-search-bar__submit"
            disabled={loading || !searchInput.trim()}
          >
            {loading ? (
              <span>Searching...</span>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search</span>
              </>
            )}
          </button>
        </form>

        <div className="youtube-search-bar__filters">
          <div className="youtube-search-bar__chips">
            <span className="youtube-search-bar__chip-label">Suggestions:</span>
            {DEFAULT_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                className="youtube-search-chip"
                onClick={() => handleChipClick(sug)}
              >
                {sug}
              </button>
            ))}
          </div>

          <div className="youtube-search-bar__select-group">
            <select
              className="youtube-filter-select"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              title="Sort Order"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Upload Date</option>
              <option value="viewCount">View Count</option>
              <option value="rating">Rating</option>
            </select>

            <select
              className="youtube-filter-select"
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value)}
              title="Duration Filter"
            >
              <option value="any">Any Duration</option>
              <option value="short">Short (&lt; 4m)</option>
              <option value="medium">Medium (4–20m)</option>
              <option value="long">Long (&gt; 20m)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="youtube-section__error">
          <svg
            width="20"
            height="20"
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
          <span>{error}</span>
          <button
            type="button"
            className="youtube-section__retry-btn"
            onClick={() => executeSearch(activeQuery, '', false)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Status Bar */}
      {!loading && !error && videos.length > 0 && (
        <div className="youtube-section__status-bar">
          <span>
            Results for <strong>"{activeQuery}"</strong> ({videos.length}
            {totalResults > 0 ? ` of ~${totalResults.toLocaleString()} found` : ''})
          </span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="youtube-skeleton-grid">
          {[...Array(12)].map((_, i) => (
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
            width="48"
            height="48"
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
            No YouTube results for "{activeQuery}"
          </div>
          <p>Try searching for different keywords or check your spelling.</p>
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
                <span>Load More Results</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
