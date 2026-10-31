import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { isSingerFollowed, toggleFollowSinger, syncFollowedSingersWithApi } from '../../services/favActors';

function formatCompactNumber(count) {
  if (!count) return null;
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function SingerDetail({ singer, allSingers = [], onClose, onVideoSelect, onSingerClick }) {
  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const videos = useMemo(() => singer?.videos || [], [singer?.videos]);
  const liveVideos = useMemo(() => singer?.liveVideos || [], [singer?.liveVideos]);
  const hasLive = liveVideos.length > 0;
  const effectiveProfile = singer?.customImage || singer?.profileUrl;
  const hasProfile = !!effectiveProfile;

  const [activeTab, setActiveTab] = useState('songs');
  const [copied, setCopied] = useState(false);

  // Video search & sort state
  const [videoSearch, setVideoSearch] = useState('');
  const [videoSort, setVideoSort] = useState('default');

  // Follow state persisted via favActors service
  const singerKey = singer?.id || singer?.name;
  const [isFollowed, setIsFollowed] = useState(() => isSingerFollowed(singerKey));

  useEffect(() => {
    const handleUpdate = () => {
      setIsFollowed(isSingerFollowed(singerKey));
    };

    window.addEventListener('followedSingersUpdated', handleUpdate);
    window.addEventListener('favActorsUpdated', handleUpdate);

    syncFollowedSingersWithApi().then(() => {
      setIsFollowed(isSingerFollowed(singerKey));
    });

    return () => {
      window.removeEventListener('followedSingersUpdated', handleUpdate);
      window.removeEventListener('favActorsUpdated', handleUpdate);
    };
  }, [singerKey]);

  const toggleFollow = () => {
    if (!singer) return;
    const next = toggleFollowSinger(singer.id || singer.name);
    setIsFollowed(next);
  };

  // Filtered & sorted videos
  const applySearchAndSort = useCallback((list) => {
    let result = [...list];

    if (videoSearch.trim()) {
      const q = videoSearch.toLowerCase().trim();
      result = result.filter(v => (v.title || '').toLowerCase().includes(q));
    }

    switch (videoSort) {
      case 'views-desc':
        result.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));
        break;
      case 'views-asc':
        result.sort((a, b) => (Number(a.viewCount) || 0) - (Number(b.viewCount) || 0));
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
        break;
      case 'title-az':
        result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'title-za':
        result.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      default:
        break;
    }

    return result;
  }, [videoSearch, videoSort]);

  const displayedVideos = useMemo(() => applySearchAndSort(videos), [videos, applySearchAndSort]);
  const displayedLiveVideos = useMemo(() => applySearchAndSort(liveVideos), [liveVideos, applySearchAndSort]);

  const handleVideoClick = useCallback((video) => {
    if (!singer) return;
    // Enrich video with singer context for player display
    const enrich = (v) => ({
      ...v,
      group: 'Singers',
      category: singer.genre || '',
      type: singer.name || '',
    });

    const enrichedVideo = enrich(video);
    const currentList = activeTab === 'live' ? displayedLiveVideos : displayedVideos;
    const enrichedAlbum = currentList.map(enrich);

    onVideoSelect(enrichedVideo, enrichedAlbum);
  }, [singer, activeTab, displayedLiveVideos, displayedVideos, onVideoSelect]);

  // Play All: Starts first track (from unfiltered list)
  const handlePlayAll = () => {
    const list = videos.length > 0 ? videos : liveVideos;
    if (list.length > 0) {
      handleVideoClick(list[0]);
    }
  };

  // Shuffle: Plays random track with randomized queue
  const handleShuffle = () => {
    const list = videos.length > 0 ? videos : liveVideos;
    if (list.length === 0 || !singer) return;

    const randomIndex = Math.floor(Math.random() * list.length);
    const pickedVideo = list[randomIndex];

    // Create a shuffled list with the picked video first
    const remaining = list.filter((_, idx) => idx !== randomIndex);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const shuffledList = [pickedVideo, ...remaining];

    const enrich = (v) => ({
      ...v,
      group: 'Singers',
      category: singer.genre || '',
      type: singer.name || '',
    });

    onVideoSelect(enrich(pickedVideo), shuffledList.map(enrich));
  };

  // Share artist
  const handleShare = () => {
    if (!singer) return;
    if (navigator.clipboard) {
      const url = `${window.location.origin}?search=${encodeURIComponent(singer.name)}`;
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Total Views across videos
  const totalViews = useMemo(() => {
    const all = [...videos, ...liveVideos];
    const sum = all.reduce((acc, v) => acc + (Number(v.viewCount) || 0), 0);
    if (!sum) return null;
    if (sum >= 1_000_000_000) return `${(sum / 1_000_000_000).toFixed(1)}B views`;
    if (sum >= 1_000_000) return `${(sum / 1_000_000).toFixed(1)}M views`;
    if (sum >= 1_000) return `${(sum / 1_000).toFixed(1)}K views`;
    return `${sum.toLocaleString()} views`;
  }, [videos, liveVideos]);

  // Total Duration
  const totalDuration = useMemo(() => {
    const all = [...videos, ...liveVideos];
    const totalSec = all.reduce((acc, v) => acc + (v.durationSec || 0), 0);
    if (!totalSec) return null;
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  }, [videos, liveVideos]);

  // Average views per song
  const avgViews = useMemo(() => {
    const all = [...videos, ...liveVideos];
    if (all.length === 0) return null;
    const sum = all.reduce((acc, v) => acc + (Number(v.viewCount) || 0), 0);
    if (!sum) return null;
    return formatCompactNumber(Math.round(sum / all.length));
  }, [videos, liveVideos]);

  // Recommendations: similar singers based on category, gender, song count proximity
  const recommendations = useMemo(() => {
    if (!allSingers || allSingers.length <= 1 || !singer) return [];
    const singerId = singer.id || singer.name;
    const singerCategory = (singer.category || '').toLowerCase();
    const singerGenre = (singer.genre || '').toLowerCase();
    const singerSongCount = (singer.videos?.length || 0) + (singer.liveVideos?.length || 0);

    const scored = allSingers
      .filter(s => (s.id || s.name) !== singerId)
      .map(s => {
        let score = 0;
        // Same category (e.g. International): +5
        if (singerCategory && (s.category || '').toLowerCase() === singerCategory) score += 5;
        // Same gender: +3
        if (singerGenre && (s.genre || '').toLowerCase() === singerGenre) score += 3;
        // Song count proximity: closer = higher score
        const otherCount = (s.videos?.length || 0) + (s.liveVideos?.length || 0);
        if (singerSongCount > 0 && otherCount > 0) {
          const diff = Math.abs(singerSongCount - otherCount);
          if (diff <= 2) score += 2;
          else if (diff <= 5) score += 1;
        }
        return { singer: s, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.singer);

    return scored;
  }, [singer, allSingers]);

  // Formatted Birthday & Age
  const birthday = singer?.birthday;
  const formattedBirthday = useMemo(() => {
    if (!birthday) return null;
    try {
      const birthDate = new Date(birthday);
      const formatted = birthDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return { date: formatted, age: `${age} yrs old` };
    } catch {
      return null;
    }
  }, [birthday]);

  // Video card thumbnail fallback helpers
  const handleThumbLoad = useCallback((e, videoId) => {
    if (e.target.naturalWidth <= 120 && e.target.src.includes('maxresdefault')) {
      e.target.src = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
    } else if (e.target.naturalWidth <= 120 && e.target.src.includes('sddefault')) {
      e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } else if (e.target.naturalWidth <= 120 && e.target.src.includes('hqdefault')) {
      e.target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
  }, []);

  const handleThumbError = useCallback((e, videoId) => {
    if (e.target.src.includes('maxresdefault')) {
      e.target.src = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
    } else if (e.target.src.includes('sddefault')) {
      e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } else if (e.target.src.includes('hqdefault')) {
      e.target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
  }, []);

  // Reusable video card renderer
  const renderVideoCard = (video) => (
    <div
      key={video.youtubeLinkID}
      className="singer-detail__video-card"
      onClick={() => handleVideoClick(video)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleVideoClick(video);
        }
      }}
    >
      <div className="singer-detail__video-thumb-wrap">
        <img
          className="singer-detail__video-thumb"
          src={video.thumbnail || `https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`}
          alt={video.title}
          loading="lazy"
          onLoad={(e) => handleThumbLoad(e, video.youtubeLinkID)}
          onError={(e) => handleThumbError(e, video.youtubeLinkID)}
        />
        <div className="singer-detail__video-play">
          <div className="singer-detail__video-play-icon">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
        {video.duration && (
          <span className="singer-detail__video-duration">{video.duration}</span>
        )}
        {video.resolution && (video.resolution === '4K' || video.resolution === '8K') && (
          <span className={`singer-detail__video-res-badge singer-detail__video-res-badge--${video.resolution.toLowerCase()}`}>
            {video.resolution}
          </span>
        )}
      </div>
      <div className="singer-detail__video-info">
        <h4 className="singer-detail__video-title">{video.title}</h4>
        <div className="singer-detail__video-meta">
          {video.viewCount != null && Number(video.viewCount) > 0 && (
            <span className="singer-detail__video-views">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              {formatCompactNumber(Number(video.viewCount))}
            </span>
          )}
          {video.date && (
            <span className="singer-detail__video-date">
              {formatDate(video.date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Videos toolbar (search + sort)
  const renderToolbar = (totalCount) => {
    if (totalCount <= 2) return null;
    return (
      <div className="singer-detail__videos-toolbar">
        <div className="singer-detail__videos-search-wrap">
          <svg className="singer-detail__videos-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="singer-detail__videos-search"
            placeholder="Search songs..."
            value={videoSearch}
            onChange={(e) => setVideoSearch(e.target.value)}
            autoComplete="off"
          />
          {videoSearch && (
            <button className="singer-detail__videos-search-clear" onClick={() => setVideoSearch('')} aria-label="Clear search">✕</button>
          )}
        </div>
        <select
          className="singer-detail__videos-sort-select"
          value={videoSort}
          onChange={(e) => setVideoSort(e.target.value)}
        >
          <option value="default">Default Order</option>
          <option value="views-desc">Most Views</option>
          <option value="views-asc">Least Views</option>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title-az">Title A→Z</option>
          <option value="title-za">Title Z→A</option>
        </select>
      </div>
    );
  };

  if (!singer) return null;

  return (
    <div
      className="singer-detail"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="singer-detail__content">
        {/* Close button */}
        <button className="singer-detail__close-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {/* Hero Section */}
        <div className="singer-detail__hero">
          {hasProfile && (
            <>
              {/* Vibrant Ambient Glow Backdrop */}
              <div
                className="singer-detail__hero-ambient"
                style={{ backgroundImage: `url(${effectiveProfile})` }}
                aria-hidden="true"
              />

              {/* High-res expanded spotlight banner on the right */}
              <div className="singer-detail__hero-spotlight-wrap">
                <img
                  className="singer-detail__hero-spotlight"
                  src={effectiveProfile}
                  alt=""
                  aria-hidden="true"
                />
              </div>
            </>
          )}

          {/* Cinematic Gradients & Meshes */}
          <div className="singer-detail__hero-gradient" />
          <div className="singer-detail__hero-radial" />

          {/* Top-Right Quick Stats / Accents */}
          <div className="singer-detail__hero-stats">
            {singer.category && (
              <span className="singer-detail__stat-badge singer-detail__stat-badge--category">
                {singer.category}
              </span>
            )}
            {videos.length > 0 && (
              <span className="singer-detail__stat-badge">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                {videos.length} {videos.length === 1 ? 'Song' : 'Songs'}
              </span>
            )}
            {liveVideos.length > 0 && (
              <span className="singer-detail__stat-badge singer-detail__stat-badge--live">
                <span className="singer-detail__stat-live-dot" />
                {liveVideos.length} Live
              </span>
            )}
            {totalViews && (
              <span className="singer-detail__stat-badge singer-detail__stat-badge--views">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                {totalViews}
              </span>
            )}
            {totalDuration && (
              <span className="singer-detail__stat-badge singer-detail__stat-badge--duration">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {totalDuration}
              </span>
            )}
            {avgViews && (
              <span className="singer-detail__stat-badge">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                ~{avgViews}/song
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="singer-detail__info">
          {hasProfile && (
            <div className="singer-detail__poster-wrap">
              <img
                className="singer-detail__poster"
                src={effectiveProfile}
                alt={singer.name}
              />
              <div
                className="singer-detail__poster-glow"
                style={{ backgroundImage: `url(${effectiveProfile})` }}
                aria-hidden="true"
              />
            </div>
          )}
          <div className="singer-detail__metadata">
            {/* Verified Artist Badge */}
            <div className="singer-detail__verified-badge">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>Verified Artist</span>
            </div>

            {/* Artist Title with strong contrast */}
            <h1 className="singer-detail__title">{singer.name}</h1>

            {/* Metadata Chips with subtle SVG icon indicators */}
            <div className="singer-detail__meta-chips">
              {singer.genre && (
                <div className="singer-detail__meta-chip" title="Gender">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>{singer.genre}</span>
                </div>
              )}

              {singer.knownForDepartment && (
                <div className="singer-detail__meta-chip" title="Occupation / Known For">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                  <span>{singer.knownForDepartment}</span>
                </div>
              )}

              {singer.placeOfBirth && (
                <div className="singer-detail__meta-chip" title="Origin / Birthplace">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>{singer.placeOfBirth}</span>
                </div>
              )}

              {formattedBirthday && (
                <div className="singer-detail__meta-chip" title="Birthday">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
                    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
                    <path d="M2 21h20"/>
                    <path d="M7 8v3"/>
                    <path d="M12 8v3"/>
                    <path d="M17 8v3"/>
                    <path d="M7 4h.01"/>
                    <path d="M12 4h.01"/>
                    <path d="M17 4h.01"/>
                  </svg>
                  <span>{formattedBirthday.date} ({formattedBirthday.age})</span>
                </div>
              )}
            </div>

            {/* Biography */}
            {singer.biography && (
              <p className="singer-detail__overview">{singer.biography}</p>
            )}

            {/* Call-to-Action (CTA) Buttons */}
            <div className="singer-detail__actions">
              <button
                className="singer-detail__action-btn singer-detail__action-btn--play"
                onClick={handlePlayAll}
                disabled={videos.length === 0 && liveVideos.length === 0}
                title="Play tracks"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Play</span>
              </button>

              <button
                className="singer-detail__action-btn singer-detail__action-btn--shuffle"
                onClick={handleShuffle}
                disabled={videos.length === 0 && liveVideos.length === 0}
                title="Shuffle tracks"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
                <span>Shuffle</span>
              </button>

              <button
                className={`singer-detail__action-btn singer-detail__action-btn--follow ${isFollowed ? 'singer-detail__action-btn--following' : ''}`}
                onClick={toggleFollow}
                title={isFollowed ? 'Click to unfollow' : 'Follow artist'}
              >
                {isFollowed ? (
                  <>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    <span>Follow</span>
                  </>
                )}
              </button>

              <button
                className={`singer-detail__action-btn singer-detail__action-btn--share ${copied ? 'singer-detail__action-btn--copied' : ''}`}
                onClick={handleShare}
                title="Share artist link"
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="singer-detail__tabs">
          <button
            className={`singer-detail__tab ${activeTab === 'songs' ? 'singer-detail__tab--active' : ''}`}
            onClick={() => setActiveTab('songs')}
          >
            Songs ({videos.length})
          </button>
          {hasLive && (
            <button
              className={`singer-detail__tab ${activeTab === 'live' ? 'singer-detail__tab--active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              Live ({liveVideos.length})
            </button>
          )}
        </div>

        {/* Songs Tab */}
        {activeTab === 'songs' && videos.length > 0 && (
          <div className="singer-detail__videos">
            <div className="singer-detail__videos-header">
              <span className="singer-detail__videos-title">Songs</span>
              <span className="singer-detail__videos-count">{displayedVideos.length}{videoSearch ? ` / ${videos.length}` : ''}</span>
              <div className="singer-detail__videos-line" />
            </div>
            {renderToolbar(videos.length)}
            {displayedVideos.length > 0 ? (
              <div className="singer-detail__video-grid">
                {displayedVideos.map(renderVideoCard)}
              </div>
            ) : (
              <div className="singer-detail__empty">No songs matching "{videoSearch}"</div>
            )}
          </div>
        )}

        {/* Live Tab */}
        {activeTab === 'live' && liveVideos.length > 0 && (
          <div className="singer-detail__videos">
            <div className="singer-detail__videos-header">
              <span className="singer-detail__videos-title">Live Performances</span>
              <span className="singer-detail__videos-count">{displayedLiveVideos.length}{videoSearch ? ` / ${liveVideos.length}` : ''}</span>
              <div className="singer-detail__videos-line" />
            </div>
            {renderToolbar(liveVideos.length)}
            {displayedLiveVideos.length > 0 ? (
              <div className="singer-detail__video-grid">
                {displayedLiveVideos.map(renderVideoCard)}
              </div>
            ) : (
              <div className="singer-detail__empty">No live performances matching "{videoSearch}"</div>
            )}
          </div>
        )}

        {/* Empty states */}
        {activeTab === 'songs' && videos.length === 0 && (
          <div className="singer-detail__empty">No songs found.</div>
        )}
        {activeTab === 'live' && liveVideos.length === 0 && (
          <div className="singer-detail__empty">No live performances found.</div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="singer-detail__recommendations">
            <div className="singer-detail__recommendations-header">
              <span className="singer-detail__recommendations-title">Similar Artists</span>
              <span className="singer-detail__recommendations-count">{recommendations.length}</span>
              <div className="singer-detail__recommendations-line" />
            </div>
            <div className="singer-detail__recommendations-grid">
              {recommendations.map((rec) => {
                const recImg = rec.customImage || rec.profileUrl;
                const recSongCount = (rec.videos?.length || 0) + (rec.liveVideos?.length || 0);
                return (
                  <div
                    key={rec.id || rec.name}
                    className="singer-detail__rec-card"
                    onClick={() => onSingerClick && onSingerClick(rec)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSingerClick && onSingerClick(rec);
                      }
                    }}
                  >
                    <div className="singer-detail__rec-poster-wrap">
                      {recImg ? (
                        <img
                          className="singer-detail__rec-poster"
                          src={recImg}
                          alt={rec.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="singer-detail__rec-poster-fallback">🎤</div>
                      )}
                      <div className="singer-detail__rec-gradient" />
                      <div className="singer-detail__rec-bottom">
                        <span className="singer-detail__rec-name">{rec.name}</span>
                        {recSongCount > 0 && (
                          <span className="singer-detail__rec-song-count">{recSongCount} songs</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
