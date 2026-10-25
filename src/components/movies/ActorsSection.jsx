import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PersonDetail from './PersonDetail';
import SingerDetail from '../singers/SingerDetail';
import Dropdown from '../Dropdown';
import { getPersonDetails, getImageUrl } from '../../services/tmdbApi';
import {
  getFollowedActorIds,
  syncFollowedActorsWithApi,
  getFollowedSingerIds,
  syncFollowedSingersWithApi
} from '../../services/favActors';
import defaultSingersData from '../../data/singersData.json';
import rawSingersData from '../../data/singers.json';

export default function ActorsSection({ moviesData, singersData, searchQuery = '', onVideoSelect }) {
  const [favActorIds, setFavActorIds] = useState(() => getFollowedActorIds());
  const [favSingerIds, setFavSingerIds] = useState(() => getFollowedSingerIds());
  const [actorsData, setActorsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [selectedSinger, setSelectedSinger] = useState(null);
  const [activeType, setActiveType] = useState('All'); // 'All', 'Actors', 'Singers'
  const [activeSort, setActiveSort] = useState('None'); // 'None', 'Name (A-Z)', 'Name (Z-A)', 'Age (Youngest)', 'Age (Oldest)'
  const [genderFilter, setGenderFilter] = useState('All'); // 'All', 'Male', 'Female'

  // Extract all singers flattened from singers data
  const allSingers = useMemo(() => {
    const rawMap = new Map();
    if (rawSingersData && typeof rawSingersData === 'object') {
      for (const [category, list] of Object.entries(rawSingersData)) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          const entry = { ...item, category };
          if (item.id) rawMap.set(String(item.id), entry);
          if (item.name) rawMap.set(item.name.toLowerCase().trim(), entry);
        }
      }
    }

    const dataSource = singersData?.singers || defaultSingersData?.singers || {};
    const result = [];
    const seen = new Set();

    for (const [category, list] of Object.entries(dataSource)) {
      if (!Array.isArray(list)) continue;
      list.forEach((s) => {
        const raw = (s.id && rawMap.get(String(s.id))) || (s.name && rawMap.get(s.name.toLowerCase().trim()));
        const customImage = raw?.customImage || s.customImage || null;
        const profileUrl = customImage || s.profileUrl || null;
        const key = String(s.id || s.name).toLowerCase().trim();
        if (seen.has(key)) return;
        seen.add(key);

        result.push({
          ...s,
          category: raw?.category || category,
          genre: raw?.Genre || s.genre || '',
          customImage,
          profileUrl,
        });
      });
    }

    return result;
  }, [singersData]);

  // Sync followed actors & singers, and listen for real-time events
  useEffect(() => {
    setFavActorIds(getFollowedActorIds());
    setFavSingerIds(getFollowedSingerIds());

    syncFollowedActorsWithApi().then((ids) => {
      if (ids && ids.length > 0) {
        setFavActorIds(ids);
      }
    });

    syncFollowedSingersWithApi().then((ids) => {
      if (ids && ids.length > 0) {
        setFavSingerIds(ids);
      }
    });

    const handleActorUpdate = (e) => {
      const ids = e?.detail || getFollowedActorIds();
      setFavActorIds(ids);
    };

    const handleSingerUpdate = (e) => {
      const ids = e?.detail || getFollowedSingerIds();
      setFavSingerIds(ids);
    };

    window.addEventListener('favActorsUpdated', handleActorUpdate);
    window.addEventListener('followedSingersUpdated', handleSingerUpdate);

    return () => {
      window.removeEventListener('favActorsUpdated', handleActorUpdate);
      window.removeEventListener('followedSingersUpdated', handleSingerUpdate);
    };
  }, []);

  // Fetch details for followed actors
  useEffect(() => {
    let isCancelled = false;

    const fetchActorDetails = async () => {
      setLoading(true);
      try {
        const details = await Promise.all(
          favActorIds.map((id) => getPersonDetails(id))
        );
        if (!isCancelled) {
          setActorsData(details.filter(Boolean));
        }
      } catch (err) {
        console.error("Failed to load followed actors details:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    if (favActorIds.length > 0) {
      fetchActorDetails();
    } else {
      setActorsData([]);
      setLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [favActorIds]);

  // Find followed singers
  const followedSingers = useMemo(() => {
    if (!favSingerIds || favSingerIds.length === 0) return [];
    const idSet = new Set(favSingerIds.map((id) => id.toLowerCase().trim()));

    return allSingers.filter((s) => {
      const matchId = s.id && idSet.has(String(s.id).toLowerCase().trim());
      const matchName = s.name && idSet.has(s.name.toLowerCase().trim());
      return matchId || matchName;
    });
  }, [allSingers, favSingerIds]);

  // Combine followed actors and followed singers
  const combinedArtists = useMemo(() => {
    const actorsList = (actorsData || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: 'actor',
      profilePath: a.profile_path ? getImageUrl(a.profile_path, 'h632') : null,
      birthday: a.birthday,
      gender: a.gender, // 1 = female, 2 = male
      raw: a,
    }));

    const singersList = (followedSingers || []).map((s) => ({
      id: s.id || s.name,
      name: s.name,
      type: 'singer',
      profilePath: s.customImage || s.profileUrl,
      birthday: s.birthday,
      gender: s.genre === 'Male' ? 2 : s.genre === 'Female' ? 1 : 0,
      raw: s,
    }));

    return [...actorsList, ...singersList];
  }, [actorsData, followedSingers]);

  const calcAge = useCallback((birthday) => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, []);

  const typeOptions = useMemo(() => {
    const actorCount = actorsData.length;
    const singerCount = followedSingers.length;
    return [
      { value: 'All', label: 'All Artists', count: actorCount + singerCount },
      { value: 'Actors', label: 'Actors', count: actorCount },
      { value: 'Singers', label: 'Singers', count: singerCount },
    ];
  }, [actorsData.length, followedSingers.length]);

  const genderOptions = [
    { value: 'All', label: 'All Genders' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' }
  ];

  const sortOptions = [
    { value: 'None', label: 'No Sort' },
    { value: 'Name (A-Z)', label: 'Name (A-Z)' },
    { value: 'Name (Z-A)', label: 'Name (Z-A)' },
    { value: 'Age (Youngest)', label: 'Age (Youngest)' },
    { value: 'Age (Oldest)', label: 'Age (Oldest)' }
  ];

  const filteredArtists = useMemo(() => {
    let result = combinedArtists;

    // Type filter
    if (activeType === 'Actors') {
      result = result.filter((a) => a.type === 'actor');
    } else if (activeType === 'Singers') {
      result = result.filter((a) => a.type === 'singer');
    }

    // Search query filter
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((a) => a.name && a.name.toLowerCase().includes(q));
    }

    // Gender filter
    if (genderFilter === 'Male') {
      result = result.filter((a) => a.gender === 2);
    } else if (genderFilter === 'Female') {
      result = result.filter((a) => a.gender === 1);
    }

    // Sort
    if (activeSort === 'Name (A-Z)') {
      result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (activeSort === 'Name (Z-A)') {
      result = [...result].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (activeSort === 'Age (Youngest)') {
      result = [...result].sort((a, b) => {
        if (!a.birthday) return 1;
        if (!b.birthday) return -1;
        return b.birthday.localeCompare(a.birthday);
      });
    } else if (activeSort === 'Age (Oldest)') {
      result = [...result].sort((a, b) => {
        if (!a.birthday) return 1;
        if (!b.birthday) return -1;
        return a.birthday.localeCompare(b.birthday);
      });
    }

    return result;
  }, [combinedArtists, activeType, searchQuery, genderFilter, activeSort]);

  const handleCardClick = (artist) => {
    if (artist.type === 'singer') {
      setSelectedSinger(artist.raw);
    } else {
      setSelectedPersonId(artist.id);
    }
  };

  return (
    <section className="movies-section">
      <div className="movies-section__header">
        <span className="movies-section__title">Followed Artists</span>
        <span className="singer-detail__videos-count" style={{ marginLeft: '12px' }}>
          {filteredArtists.length}
        </span>
        <div className="movies-section__line" />
      </div>

      <div className="movies-section__controls">
        {/* Type Filter (All, Actors, Singers) */}
        <div className="movies-section__lang-dropdown">
          <Dropdown
            id="artist-type-select"
            value={activeType}
            options={typeOptions}
            onChange={setActiveType}
            placeholder="All Artists"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Gender Filter */}
          <div className="movies-section__sort">
            <span className="movies-section__sort-label">Gender:</span>
            <Dropdown
              id="gender-select"
              value={genderFilter}
              options={genderOptions}
              onChange={setGenderFilter}
              placeholder="All Genders"
            />
          </div>

          {/* Sort Dropdown */}
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
        </div>
      </div>

      {loading && favActorIds.length > 0 && actorsData.length === 0 ? (
        <div className="movie-detail__loader">Loading followed artists...</div>
      ) : filteredArtists.length > 0 ? (
        <div className="actors-section__grid">
          {filteredArtists.map((artist) => {
            const age = calcAge(artist.birthday);
            return (
              <div
                key={`${artist.type}-${artist.id}`}
                className="actors-section__card"
                onClick={() => handleCardClick(artist)}
              >
                <div className="actors-section__img-wrap">
                  {artist.profilePath ? (
                    <img
                      className="actors-section__img"
                      src={artist.profilePath}
                      alt={artist.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="actors-section__placeholder">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                  )}

                  {/* Discipline Icon (Singer / Actor) */}
                  <span
                    className="actors-section__type-icon"
                    title={artist.type === 'singer' ? 'Singer' : 'Actor'}
                  >
                    {artist.type === 'singer' ? '🎤' : '🎬'}
                  </span>
                </div>
                <div className="actors-section__info">
                  <span className="actors-section__name">{artist.name}</span>
                  {age !== null && (
                    <span className="actors-section__age">
                      Age: {age}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="movies-section__empty">
          <p className="movies-section__empty-text">
            {searchQuery
              ? `No artists matching "${searchQuery}".`
              : "No followed artists yet. Click 'Follow' on any singer or actor to add them here!"}
          </p>
        </div>
      )}

      {selectedPersonId && (
        <PersonDetail
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
          moviesData={moviesData}
        />
      )}

      {selectedSinger && (
        <SingerDetail
          singer={selectedSinger}
          onClose={() => setSelectedSinger(null)}
          onVideoSelect={onVideoSelect}
        />
      )}
    </section>
  );
}
