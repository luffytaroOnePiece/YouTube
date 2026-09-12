import React, { useState, useEffect, useMemo } from 'react';
import PersonDetail from './PersonDetail';
import { getPersonDetails, getImageUrl } from '../../services/tmdbApi';
import favActorsData from '../../data/favActors.json';

export default function ActorsSection({ moviesData }) {
  const [favActorIds, setFavActorIds] = useState([]);
  const [actorsData, setActorsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [activeSort, setActiveSort] = useState('None'); // 'None', 'Age (Youngest)', 'Age (Oldest)'
  const [genderFilter, setGenderFilter] = useState('All'); // 'All', 'Male', 'Female'

  const genderOptions = [
    { value: 'All', label: 'All Genders' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' }
  ];

  const sortOptions = [
    { value: 'None', label: 'No Sort' },
    { value: 'Age (Youngest)', label: 'Age (Youngest)' },
    { value: 'Age (Oldest)', label: 'Age (Oldest)' }
  ];

  useEffect(() => {
    const fetchFavs = async () => {
      setLoading(true);
      try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        let ids = Array.isArray(favActorsData) ? [...favActorsData] : [];
        if (isLocal) {
          try {
            const res = await fetch('http://localhost:3001/api/favActors');
            if (res.ok) {
              ids = await res.json();
            }
          } catch (e) {
            console.warn("API not running, falling back to local favActorsData", e);
          }
        }
        setFavActorIds(ids);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFavs();
  }, [selectedPersonId]); // Re-fetch on close in case of un-fav

  useEffect(() => {
    const fetchActorDetails = async () => {
      setLoading(true);
      try {
        const details = await Promise.all(
          favActorIds.map(id => getPersonDetails(id))
        );
        setActorsData(details.filter(Boolean));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (favActorIds.length > 0) {
      fetchActorDetails();
    } else {
      setActorsData([]);
      setLoading(false);
    }
  }, [favActorIds]);

  const filteredActors = useMemo(() => {
    const calcAge = (birthday) => {
      if (!birthday) return 999;
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // TMDB gender: 1 = Female, 2 = Male
    let result = actorsData;
    if (genderFilter === 'Male') {
      result = result.filter(a => a.gender === 2);
    } else if (genderFilter === 'Female') {
      result = result.filter(a => a.gender === 1);
    }

    if (activeSort !== 'None') {
      result = [...result].sort((a, b) => {
        if (!a.birthday) return 1;
        if (!b.birthday) return -1;
        
        // localeCompare returns -1 if string A is smaller than string B
        // string A smaller = older date = older age
        // 'Age (Youngest)' = youngest first (smallest age) = largest date first
        // 'Age (Oldest)' = oldest first (largest age) = smallest date first
        if (activeSort === 'Age (Youngest)') {
          return b.birthday.localeCompare(a.birthday);
        } else {
          return a.birthday.localeCompare(b.birthday);
        }
      });
    }

    return result;
  }, [actorsData, activeSort, genderFilter]);

  return (
    <section className="movies-section">
      <div className="movies-section__header">
        <span className="movies-section__title">Favorite Actors</span>
        <div className="movies-section__line" />
      </div>

      <div className="movies-section__controls">
        <div className="movies-section__lang-dropdown">
          <Dropdown
            id="gender-select"
            value={genderFilter}
            options={genderOptions}
            onChange={setGenderFilter}
            placeholder="All Genders"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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

      {loading ? (
        <div className="movie-detail__loader">Loading actors...</div>
      ) : filteredActors.length > 0 ? (
        <div className="actors-section__grid">
          {filteredActors.map((actor) => (
            <div
              key={actor.id}
              className="actors-section__card"
              onClick={() => setSelectedPersonId(actor.id)}
            >
              <div className="actors-section__img-wrap">
                {actor.profile_path ? (
                  <img
                    className="actors-section__img"
                    src={getImageUrl(actor.profile_path, 'h632')}
                    alt={actor.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="actors-section__placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                )}
              </div>
              <div className="actors-section__info">
                <span className="actors-section__name">{actor.name}</span>
                {actor.birthday && (
                  <span className="actors-section__age">
                    Age: {(() => {
                      const birthDate = new Date(actor.birthday);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const m = today.getMonth() - birthDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                      }
                      return age;
                    })()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="movies-section__empty">
          <p className="movies-section__empty-text">No favorite actors found. Add some from the Movies section!</p>
        </div>
      )}

      {selectedPersonId && (
        <PersonDetail
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
          moviesData={moviesData}
        />
      )}
    </section>
  );
}
