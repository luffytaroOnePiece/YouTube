import React, { useEffect, useState, useMemo } from 'react';
import { getPersonDetails, getPersonImages, getExternalIds, getPersonCredits, getImageUrl } from '../../services/tmdbApi';
import favActorsData from '../../data/favActors.json';

export default function PersonDetail({ personId, onClose, moviesData }) {
  const [person, setPerson] = useState(null);
  const [images, setImages] = useState([]);
  const [externalIds, setExternalIds] = useState(null);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    const fetchPersonData = async () => {
      setLoading(true);
      try {
        const [detailsData, imagesData, externalIdsData, creditsData] = await Promise.all([
          getPersonDetails(personId),
          getPersonImages(personId),
          getExternalIds(personId),
          getPersonCredits(personId)
        ]);
        setPerson(detailsData);
        if (imagesData && imagesData.profiles) {
          setImages(imagesData.profiles);
        }
        setExternalIds(externalIdsData);
        if (creditsData && creditsData.cast) {
          setCredits(creditsData.cast);
        }
        
        // Check fav status — try API first, fallback to local JSON
        const pid = personId.toString();
        let favs = Array.isArray(favActorsData) ? favActorsData : [];
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
          try {
            const res = await fetch('http://localhost:3001/api/favActors');
            if (res.ok) {
              favs = await res.json();
            }
          } catch (e) {
            // API not running, use local JSON
          }
        }
        setIsFav(favs.includes(pid) || favs.includes(Number(personId)));
      } catch (err) {
        console.error("Failed to fetch person data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (personId) {
      fetchPersonData();
    }
  }, [personId]);

  const toggleFav = async (e) => {
    e.stopPropagation();
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) return;

    try {
      const res = await fetch('http://localhost:3001/api/favActors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: personId.toString() })
      });
      if (res.ok) {
        const favs = await res.json();
        setIsFav(favs.includes(personId.toString()));
      }
    } catch (err) {
      console.error("Failed to toggle fav actor", err);
    }
  };

  // Handle ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // prevent closing MovieDetail too if nested
        onClose();
      }
    };
    // Use capture to handle it before MovieDetail does
    document.addEventListener('keydown', handleEsc, true);
    return () => document.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  const timelineMovies = useMemo(() => {
    if (!credits || credits.length === 0) return [];
    
    const localTmdbIds = new Set();
    if (moviesData && moviesData.movies) {
      Object.values(moviesData.movies).forEach(m => {
        if (m.tmdbId) localTmdbIds.add(m.tmdbId.toString());
      });
    }

    // Sort by release_date descending
    return [...credits]
      .filter(c => c.media_type === 'movie' && c.release_date) // filter only movies with a date
      .map(c => ({
        ...c,
        isLocal: localTmdbIds.has(c.id.toString())
      }))
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  }, [credits, moviesData]);

  if (!personId) return null;

  return (
    <div className="person-detail" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="person-detail__content">
         <button className="person-detail__close-btn" onClick={onClose} aria-label="Close">✕</button>
         {loading ? (
             <div className="person-detail__loader">Loading details...</div>
         ) : person ? (
            <div className="person-detail__inner">
               <div className="person-detail__header">
                  {person.profile_path ? (
                      <img className="person-detail__profile-main" src={getImageUrl(person.profile_path, 'h632')} alt={person.name} />
                  ) : (
                      <div className="person-detail__profile-placeholder">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      </div>
                  )}
                  <div className="person-detail__info">
                      <h1 className="person-detail__name">{person.name}</h1>
                      <div className="person-detail__metadata">
                        {person.birthday && <p className="person-detail__meta"><strong>Born:</strong> {person.birthday}</p>}
                        {person.place_of_birth && <p className="person-detail__meta"><strong>Place of Birth:</strong> {person.place_of_birth}</p>}
                        {person.known_for_department && <p className="person-detail__meta"><strong>Known For:</strong> {person.known_for_department}</p>}
                      </div>
                      
                      {externalIds && externalIds.instagram_id && (
                          <a 
                             href={`https://instagram.com/${externalIds.instagram_id}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="person-detail__social-link"
                          >
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                            Follow on Instagram
                          </a>
                      )}

                      {/* Favorite Button — only on localhost */}
                      {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                        <button 
                          className={`person-detail__fav-btn ${isFav ? 'person-detail__fav-btn--active' : ''}`}
                          onClick={toggleFav}
                        >
                          <svg viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                          {isFav ? 'Favorited' : 'Add to Favorites'}
                        </button>
                      )}
                  </div>
               </div>
               
               {person.biography && (
                   <div className="person-detail__bio">
                       <h2>Biography</h2>
                       <p>{person.biography.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}</p>
                   </div>
               )}

               {images && images.length > 0 && (
                   <div className="person-detail__images">
                       <h2>Gallery</h2>
                       <div className="person-detail__images-grid">
                           {images.map((img, idx) => (
                               <img 
                                 key={idx} 
                                 className="person-detail__gallery-img" 
                                 src={getImageUrl(img.file_path, 'original')} 
                                 alt={`${person.name} ${idx}`} 
                                 loading="lazy" 
                               />
                           ))}
                       </div>
                   </div>
               )}

               {/* Timeline Section */}
               {timelineMovies && timelineMovies.length > 0 && (
                 <div className="person-detail__timeline">
                   <h2>Movie Timeline</h2>
                   <div className="person-detail__timeline-list">
                     {timelineMovies.map(m => (
                       <div key={m.id} className={`person-detail__timeline-item ${m.isLocal ? 'person-detail__timeline-item--local' : ''}`}>
                         <span className="person-detail__timeline-year">
                           {m.release_date ? m.release_date.split('-')[0] : 'TBA'}
                         </span>
                         <div className="person-detail__timeline-content">
                           <span className="person-detail__timeline-title">{m.title}</span>
                           {m.character && <span className="person-detail__timeline-character"> as {m.character}</span>}
                           {m.isLocal && <span className="person-detail__timeline-badge">In Library</span>}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
         ) : (
            <div className="person-detail__error">Failed to load person details.</div>
         )}
      </div>
    </div>
  );
}
