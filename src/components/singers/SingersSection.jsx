import React, { useState, useMemo, useEffect, useCallback } from 'react';
import SingerCard from './SingerCard';
import SingerDetail from './SingerDetail';
import VideoGrid from '../VideoGrid';
import Dropdown from '../Dropdown';
import rawSingersData from '../../data/singers.json';
import {
  getFollowedSingerIds,
  isSingerFollowed,
  toggleFollowSinger,
  syncFollowedSingersWithApi,
} from '../../services/favActors';

function formatCompactNumber(count) {
  if (!count) return '0';
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function cleanSongTitle(title, artistName = '') {
  if (!title) return '';
  let clean = title;
  if (artistName) {
    const prefixRegex = new RegExp(`^${artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i');
    clean = clean.replace(prefixRegex, '');
  }
  clean = clean.replace(/^[^-–—:]+[-–—:]\s*/, (match) => {
    if (artistName && match.toLowerCase().includes(artistName.toLowerCase())) {
      return '';
    }
    return match;
  });
  clean = clean
    .replace(/\s*[([]\s*(official\s*(music\s*)?video|official\s*audio|official\s*hd\s*video|music\s*video|video|visualizer|lyric\s*video|audio|4k|hd|remastered)[)\]]/gi, '')
    .trim();
  return clean || title;
}

export default function SingersSection({ singersData, onVideoSelect, searchQuery = '' }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeGenre, setActiveGenre] = useState('All');
  const [activeSort, setActiveSort] = useState('Name (A-Z)');
  const [viewMode, setViewMode] = useState('Albums');
  const [activeLetter, setActiveLetter] = useState('All');
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [randomSeed, setRandomSeed] = useState(() => Math.random());

  // Followed singers state synced with favActors service
  const [followedIds, setFollowedIds] = useState(() => getFollowedSingerIds());

  useEffect(() => {
    const handleUpdate = () => {
      setFollowedIds(getFollowedSingerIds());
    };
    window.addEventListener('followedSingersUpdated', handleUpdate);
    window.addEventListener('favActorsUpdated', handleUpdate);
    syncFollowedSingersWithApi().then(() => {
      setFollowedIds(getFollowedSingerIds());
    });
    return () => {
      window.removeEventListener('followedSingersUpdated', handleUpdate);
      window.removeEventListener('favActorsUpdated', handleUpdate);
    };
  }, []);

  const followedSet = useMemo(() => {
    return new Set(followedIds.map(id => id.toLowerCase().trim()));
  }, [followedIds]);

  const handleToggleFollow = useCallback((singer) => {
    const key = singer.id || singer.name;
    toggleFollowSinger(key);
  }, []);

  const flatOnlySorts = ['Most Views', 'Newest First', 'Oldest First'];
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode !== 'Flat' && flatOnlySorts.includes(activeSort)) {
      setActiveSort('Name (A-Z)');
    }
  };
  const [activeResolution, setActiveResolution] = useState('All Quality');
  const [activeSongType, setActiveSongType] = useState('All'); // 'All', 'Normal', 'Live'
  const [selectedSinger, setSelectedSinger] = useState(null);

  // Parse all singers from data and merge latest customImage overrides from singers.json
  const allSingers = useMemo(() => {
    const rawMap = new Map();
    const allRawItems = [];
    if (rawSingersData && typeof rawSingersData === 'object') {
      for (const [category, list] of Object.entries(rawSingersData)) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          const entry = { ...item, category };
          allRawItems.push(entry);
          if (item.id) rawMap.set(String(item.id), entry);
          if (item.name) rawMap.set(item.name.toLowerCase().trim(), entry);
        }
      }
    }

    const result = [];
    const seenKeys = new Set();

    if (singersData?.singers) {
      for (const [category, singers] of Object.entries(singersData.singers)) {
        if (!Array.isArray(singers)) continue;
        singers.forEach((s) => {
          const raw = (s.id && rawMap.get(String(s.id))) || (s.name && rawMap.get(s.name.toLowerCase().trim()));
          const customImage = raw && raw.customImage ? raw.customImage : (s.customImage || null);
          const profileUrl = customImage || s.profileUrl || null;
          const key = s.id || s.name;
          if (key) seenKeys.add(String(key));
          if (s.name) seenKeys.add(s.name.toLowerCase().trim());

          result.push({
            ...s,
            category: raw?.category || category,
            genre: raw?.Genre || s.genre || '',
            customImage,
            profileUrl,
          });
        });
      }
    }

    // Include any new singers in singers.json that haven't been fetched into singersData.json yet
    for (const raw of allRawItems) {
      const keyId = raw.id ? String(raw.id) : null;
      const keyName = raw.name ? raw.name.toLowerCase().trim() : null;
      if ((keyId && seenKeys.has(keyId)) || (keyName && seenKeys.has(keyName))) {
        continue;
      }
      result.push({
        id: raw.id || '',
        name: raw.name || '',
        genre: raw.Genre || '',
        category: raw.category || 'Other',
        customImage: raw.customImage || null,
        profileUrl: raw.customImage || null,
        biography: '',
        birthday: '',
        placeOfBirth: '',
        knownForDepartment: '',
        youtubePlaylistId: raw.YoutubePlaylistID || '',
        livePlaylistId: raw.LivePlaylistID || '',
        videos: [],
        liveVideos: [],
      });
    }

    return result;
  }, [singersData]);

  // Extract available initial letters for alphabet navigation
  const availableLetters = useMemo(() => {
    const letters = new Set();
    allSingers.forEach(s => {
      const first = (s.name || '').trim().charAt(0).toUpperCase();
      if (first && /[A-Z]/.test(first)) {
        letters.add(first);
      }
    });
    return Array.from(letters).sort();
  }, [allSingers]);

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

  // Stats overview
  const stats = useMemo(() => {
    let totalSongs = 0;
    let totalLive = 0;
    let totalViews = 0;
    let totalDurationSec = 0;
    allSingers.forEach(s => {
      totalSongs += (s.videos?.length || 0);
      totalLive += (s.liveVideos?.length || 0);
      const all = [...(s.videos || []), ...(s.liveVideos || [])];
      totalViews += all.reduce((acc, v) => acc + (Number(v.viewCount) || 0), 0);
      totalDurationSec += all.reduce((acc, v) => acc + (v.durationSec || 0), 0);
    });
    const hours = Math.floor(totalDurationSec / 3600);
    const mins = Math.floor((totalDurationSec % 3600) / 60);
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return {
      artists: allSingers.length,
      songs: totalSongs,
      live: totalLive,
      views: totalViews,
      duration,
    };
  }, [allSingers]);

  // Featured artist spotlight candidates (artists with image and songs)
  const spotlightCandidates = useMemo(() => {
    return allSingers.filter(s =>
      (s.customImage || s.profileUrl) &&
      ((s.videos?.length || 0) + (s.liveVideos?.length || 0)) > 0
    );
  }, [allSingers]);

  // True random artist per session / reload (with manual shuffle support)
  const featuredArtist = useMemo(() => {
    if (spotlightCandidates.length === 0) return allSingers[0] || null;
    const index = Math.floor(randomSeed * spotlightCandidates.length) % spotlightCandidates.length;
    return spotlightCandidates[index];
  }, [spotlightCandidates, randomSeed, allSingers]);

  // Top 3 songs for the spotlight artist
  const spotlightTopSongs = useMemo(() => {
    if (!featuredArtist) return [];
    const all = [...(featuredArtist.videos || []), ...(featuredArtist.liveVideos || [])];
    return all
      .sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0))
      .slice(0, 3);
  }, [featuredArtist]);

  const handleShuffleSpotlight = useCallback(() => {
    setRandomSeed(Math.random());
  }, []);

  // Filter and sort
  const filteredSingers = useMemo(() => {
    let result = allSingers;

    if (onlyFollowed) {
      result = result.filter(s => {
        const idKey = s.id ? String(s.id).toLowerCase().trim() : '';
        const nameKey = s.name ? s.name.toLowerCase().trim() : '';
        return followedSet.has(idKey) || followedSet.has(nameKey);
      });
    }

    if (activeLetter !== 'All') {
      result = result.filter(s =>
        (s.name || '').trim().toUpperCase().startsWith(activeLetter)
      );
    }

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
  }, [allSingers, onlyFollowed, followedSet, activeLetter, activeCategory, activeGenre, searchQuery, activeSort]);

  const flattenedVideos = useMemo(() => {
    if (viewMode !== 'Flat') return [];

    const videos = [];
    filteredSingers.forEach(singer => {
      // Normal video songs
      if (activeSongType === 'All' || activeSongType === 'Normal') {
        (singer.videos || []).forEach(v => {
          const is8K = v.resolution === '8K';
          const is4K = v.resolution === '4K';
          const res = is8K ? '8K' : is4K ? '4K' : 'Other';

          if (activeResolution === 'All Quality' || activeResolution === res) {
            videos.push({
              ...v,
              group: 'Singers',
              category: singer.category || '',
              type: singer.name || '',
              isLive: false,
              resolution: v.resolution || ''
            });
          }
        });
      }

      // Live video songs
      if (activeSongType === 'All' || activeSongType === 'Live') {
        (singer.liveVideos || []).forEach(v => {
          const is8K = v.resolution === '8K';
          const is4K = v.resolution === '4K';
          const res = is8K ? '8K' : is4K ? '4K' : 'Other';

          if (activeResolution === 'All Quality' || activeResolution === res) {
            videos.push({
              ...v,
              group: 'Singers',
              category: singer.category || '',
              type: `${singer.name} (Live)`,
              isLive: true,
              resolution: v.resolution || ''
            });
          }
        });
      }
    });

    // Sort flattened videos
    if (activeSort === 'Most Views') {
      videos.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));
    } else if (activeSort === 'Newest First') {
      videos.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    } else if (activeSort === 'Oldest First') {
      videos.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    } else if (activeSort === 'Name (A-Z)') {
      videos.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (activeSort === 'Name (Z-A)') {
      videos.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    }

    return videos;
  }, [filteredSingers, viewMode, activeResolution, activeSongType, activeSort]);

  const categoryOptions = useMemo(() => [
    { value: 'All', label: 'All Categories', count: allSingers.length },
    ...categories.map(([cat, count]) => ({
      value: cat,
      label: cat,
      count
    }))
  ], [allSingers.length, categories]);

  const genreOptions = useMemo(() => [
    { value: 'All', label: 'All Genders', count: allSingers.length },
    ...genres.map(([genre, count]) => ({
      value: genre,
      label: genre,
      count
    }))
  ], [allSingers.length, genres]);

  const songTypeOptions = useMemo(() => {
    let normalCount = 0;
    let liveCount = 0;
    filteredSingers.forEach(s => {
      normalCount += (s.videos?.length || 0);
      liveCount += (s.liveVideos?.length || 0);
    });
    return [
      { value: 'All', label: 'All Songs', count: normalCount + liveCount },
      { value: 'Normal', label: 'Normal Videos', count: normalCount },
      { value: 'Live', label: 'Live Songs', count: liveCount },
    ];
  }, [filteredSingers]);

  const sortOptions = useMemo(() => [
    { value: 'Name (A-Z)', label: 'Name (A-Z)' },
    { value: 'Name (Z-A)', label: 'Name (Z-A)' },
    { value: 'Most Songs', label: 'Most Songs' },
    ...(viewMode === 'Flat' ? [
      { value: 'Most Views', label: 'Most Views' },
      { value: 'Newest First', label: 'Newest First' },
      { value: 'Oldest First', label: 'Oldest First' },
    ] : []),
  ], [viewMode]);

  const viewOptions = [
    { value: 'Albums', label: 'Albums' },
    { value: 'Flat', label: 'Flat' }
  ];

  const resolutionOptions = [
    { value: 'All Quality', label: 'All Quality' },
    { value: '8K', label: '8K Ultra' },
    { value: '4K', label: '4K' }
  ];

  const followedCount = useMemo(() => {
    return allSingers.filter(s => {
      const idKey = s.id ? String(s.id).toLowerCase().trim() : '';
      const nameKey = s.name ? s.name.toLowerCase().trim() : '';
      return followedSet.has(idKey) || followedSet.has(nameKey);
    }).length;
  }, [allSingers, followedSet]);

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

  // Quick play from card — plays first song without opening detail
  const handleQuickPlay = (singer, video) => {
    const enrich = (v) => ({
      ...v,
      group: 'Singers',
      category: singer.category || '',
      type: singer.name || '',
    });
    const allVideos = [...(singer.videos || []), ...(singer.liveVideos || [])];
    onVideoSelect(enrich(video), allVideos.map(enrich));
  };

  if (allSingers.length === 0) return null;

  return (
    <section className="singers-section">
      {/* Header */}
      <div className="singers-section__header">
        <span className="singers-section__icon">🎤</span>
        <span className="singers-section__title">Singers</span>
        <div className="singers-section__line" />

        {/* View Mode Switcher Pills */}
        <div className="singers-section__view-pills">
          <button
            className={`singers-section__view-pill ${!onlyFollowed ? 'singers-section__view-pill--active' : ''}`}
            onClick={() => setOnlyFollowed(false)}
          >
            All Artists ({allSingers.length})
          </button>
          <button
            className={`singers-section__view-pill ${onlyFollowed ? 'singers-section__view-pill--active' : ''}`}
            onClick={() => setOnlyFollowed(true)}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            Following ({followedCount})
          </button>
        </div>
      </div>

      {/* Featured Artist Hero Banner (Spotlight) */}
      {featuredArtist && viewMode === 'Albums' && !onlyFollowed && !searchQuery.trim() && (
        <div className="singers-spotlight">
          <div
            className="singers-spotlight__backdrop"
            style={{ backgroundImage: `url(${featuredArtist.customImage || featuredArtist.profileUrl})` }}
            aria-hidden="true"
          />
          <div className="singers-spotlight__overlay" />
          <div className="singers-spotlight__content">
            <div
              className="singers-spotlight__avatar-container"
              onClick={() => handleSingerClick(featuredArtist)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSingerClick(featuredArtist);
                }
              }}
              title={`View ${featuredArtist.name}`}
            >
              <div
                className="singers-spotlight__avatar-glow"
                style={{ backgroundImage: `url(${featuredArtist.customImage || featuredArtist.profileUrl})` }}
                aria-hidden="true"
              />
              <div className="singers-spotlight__avatar-wrap">
                <img
                  className="singers-spotlight__avatar"
                  src={featuredArtist.customImage || featuredArtist.profileUrl}
                  alt={featuredArtist.name}
                  loading="eager"
                />
              </div>
            </div>
            <div className="singers-spotlight__info">
              <div className="singers-spotlight__badge-row">
                <span className="singers-spotlight__tag">★ Spotlight Artist</span>
                {featuredArtist.category && (
                  <span className="singers-spotlight__tag singers-spotlight__tag--category">
                    {featuredArtist.category}
                  </span>
                )}
              </div>
              <h2 className="singers-spotlight__name">{featuredArtist.name}</h2>
              {featuredArtist.biography && (
                <p className="singers-spotlight__bio">{featuredArtist.biography}</p>
              )}
              <div className="singers-spotlight__actions">
                <button
                  className="singers-spotlight__btn singers-spotlight__btn--play"
                  onClick={() => {
                    const first = featuredArtist.videos?.[0] || featuredArtist.liveVideos?.[0];
                    if (first) handleQuickPlay(featuredArtist, first);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play Top Songs
                </button>
                <button
                  className="singers-spotlight__btn singers-spotlight__btn--view"
                  onClick={() => handleSingerClick(featuredArtist)}
                >
                  View Profile
                </button>
                <button
                  className={`singers-spotlight__btn singers-spotlight__btn--follow ${isSingerFollowed(featuredArtist.id || featuredArtist.name) ? 'singers-spotlight__btn--following' : ''}`}
                  onClick={() => handleToggleFollow(featuredArtist)}
                >
                  {isSingerFollowed(featuredArtist.id || featuredArtist.name) ? 'Following' : '+ Follow'}
                </button>
              </div>
            </div>

            {/* Right side: Top 3 songs */}
            {spotlightTopSongs.length > 0 && (
              <div className="singers-spotlight__top-songs">
                <div className="singers-spotlight__top-songs-header">
                  <div className="singers-spotlight__top-songs-label">
                    <span className="singers-spotlight__top-songs-dot" />
                    <span>POPULAR TRACKS</span>
                  </div>
                  <span className="singers-spotlight__top-songs-count">Top 3</span>
                </div>
                <div className="singers-spotlight__top-songs-list">
                  {spotlightTopSongs.map((track, i) => {
                    const cleanTitle = cleanSongTitle(track.title, featuredArtist.name);
                    return (
                      <div
                        key={track.youtubeLinkID}
                        className="singers-spotlight__track-card"
                        onClick={() => handleQuickPlay(featuredArtist, track)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleQuickPlay(featuredArtist, track);
                          }
                        }}
                        title={`Play "${cleanTitle}"`}
                      >
                        <div className="singers-spotlight__track-num-wrap">
                          <span className="singers-spotlight__track-num">0{i + 1}</span>
                          <span className="singers-spotlight__track-play-icon">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </div>

                        <div className="singers-spotlight__track-details">
                          <span className="singers-spotlight__track-name">{cleanTitle}</span>
                          <div className="singers-spotlight__track-sub">
                            {track.viewCount != null && Number(track.viewCount) > 0 && (
                              <span className="singers-spotlight__track-views">
                                {formatCompactNumber(Number(track.viewCount))} plays
                              </span>
                            )}
                            {track.duration && (
                              <>
                                <span className="singers-spotlight__track-sep">•</span>
                                <span className="singers-spotlight__track-duration">{track.duration}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="singers-spotlight__track-action">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="singers-spotlight__top-controls">
              <button
                className="singers-spotlight__shuffle-btn"
                onClick={handleShuffleSpotlight}
                title="Shuffle spotlight artist (Random)"
                aria-label="Pick another random spotlight artist"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview Bar */}
      <div className="singers-stats-bar">
        <div className="singers-stats-bar__item">
          <span className="singers-stats-bar__icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <span className="singers-stats-bar__value">{stats.artists}</span>
          <span className="singers-stats-bar__label">Artists</span>
        </div>
        <div className="singers-stats-bar__divider" />
        <div className="singers-stats-bar__item">
          <span className="singers-stats-bar__icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </span>
          <span className="singers-stats-bar__value">{stats.songs + stats.live}</span>
          <span className="singers-stats-bar__label">Songs</span>
        </div>
        <div className="singers-stats-bar__divider" />
        <div className="singers-stats-bar__item">
          <span className="singers-stats-bar__icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </span>
          <span className="singers-stats-bar__value">{formatCompactNumber(stats.views)}</span>
          <span className="singers-stats-bar__label">Total Views</span>
        </div>
        <div className="singers-stats-bar__divider" />
        <div className="singers-stats-bar__item">
          <span className="singers-stats-bar__icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span className="singers-stats-bar__value">{stats.duration}</span>
          <span className="singers-stats-bar__label">Total Duration</span>
        </div>
        {stats.live > 0 && (
          <>
            <div className="singers-stats-bar__divider" />
            <div className="singers-stats-bar__item singers-stats-bar__item--live">
              <span className="singers-stats-bar__icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </span>
              <span className="singers-stats-bar__value">{stats.live}</span>
              <span className="singers-stats-bar__label">Live Shows</span>
            </div>
          </>
        )}
      </div>

      {/* Alphabet Quick Jump Bar (Albums view) */}
      {viewMode === 'Albums' && availableLetters.length > 3 && (
        <div className="singers-alphabet-bar">
          <button
            className={`singers-alphabet-btn ${activeLetter === 'All' ? 'singers-alphabet-btn--active' : ''}`}
            onClick={() => setActiveLetter('All')}
          >
            All
          </button>
          {availableLetters.map(letter => (
            <button
              key={letter}
              className={`singers-alphabet-btn ${activeLetter === letter ? 'singers-alphabet-btn--active' : ''}`}
              onClick={() => setActiveLetter(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

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
          {/* Gender Filter */}
          {genres.length > 1 && (
            <div className="singers-section__sort">
              <span className="singers-section__sort-label">Gender:</span>
              <Dropdown
                id="singer-genre-select"
                value={activeGenre}
                options={genreOptions}
                onChange={setActiveGenre}
                placeholder="All Genders"
              />
            </div>
          )}

          {/* Song Type Filter (Live vs Normal) — only in Flat view */}
          {viewMode === 'Flat' && (
            <div className="singers-section__sort">
              <span className="singers-section__sort-label">Type:</span>
              <Dropdown
                id="singer-type-select"
                value={activeSongType}
                options={songTypeOptions}
                onChange={setActiveSongType}
                placeholder="All Songs"
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
              onChange={handleViewModeChange}
              placeholder="View Mode"
            />
          </div>
        </div>
      </div>

      {/* Filtered count indicator */}
      {(activeCategory !== 'All' || activeGenre !== 'All' || activeLetter !== 'All' || onlyFollowed || searchQuery.trim()) && (
        <div className="singers-section__filter-info">
          <span className="singers-section__filter-count">
            Showing {filteredSingers.length} of {allSingers.length} artists
            {onlyFollowed && ' (Following)'}
            {activeLetter !== 'All' && ` • Starting with "${activeLetter}"`}
          </span>
          {(activeCategory !== 'All' || activeGenre !== 'All' || activeLetter !== 'All' || onlyFollowed) && (
            <button
              className="singers-section__clear-filters"
              onClick={() => {
                setActiveCategory('All');
                setActiveGenre('All');
                setActiveLetter('All');
                setOnlyFollowed(false);
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Content Grid */}
      {viewMode === 'Albums' ? (
        filteredSingers.length > 0 ? (
          <div className="singers-section__grid">
            {filteredSingers.map((singer, index) => (
              <SingerCard
                key={singer.id || singer.name}
                singer={singer}
                onClick={handleSingerClick}
                onQuickPlay={handleQuickPlay}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="singers-section__empty">
            <div className="singers-section__empty-icon">🎤</div>
            <p className="singers-section__empty-text">No singers found for this filter.</p>
            <p className="singers-section__empty-hint">Try adjusting your filters or following artists.</p>
          </div>
        )
      ) : (
        flattenedVideos.length > 0 ? (
          <VideoGrid
            videos={flattenedVideos}
            onVideoSelect={handleFlatVideoSelect}
            gridColumns={3}
          />
        ) : (
          <div className="singers-section__empty">
            <div className="singers-section__empty-icon">🎤</div>
            <p className="singers-section__empty-text">No videos found for this filter.</p>
            <p className="singers-section__empty-hint">Try adjusting your search or filters.</p>
          </div>
        )
      )}

      {/* Singer Detail Modal */}
      {selectedSinger && (
        <SingerDetail
          key={selectedSinger.id || selectedSinger.name}
          singer={allSingers.find(s => (s.id && s.id === selectedSinger.id) || s.name === selectedSinger.name) || selectedSinger}
          allSingers={allSingers}
          onClose={() => setSelectedSinger(null)}
          onVideoSelect={handleVideoSelect}
          onSingerClick={handleSingerClick}
        />
      )}
    </section>
  );
}
