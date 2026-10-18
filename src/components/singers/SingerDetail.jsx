import React, { useEffect, useCallback, useState } from 'react';

export default function SingerDetail({ singer, onClose, onVideoSelect }) {
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

  if (!singer) return null;

  const [activeTab, setActiveTab] = useState('songs');
  const videos = singer.videos || [];
  const liveVideos = singer.liveVideos || [];
  const hasLive = liveVideos.length > 0;
  const effectiveProfile = singer.customImage || singer.profileUrl;
  const hasProfile = !!effectiveProfile;

  const handleVideoClick = (video) => {
    // Enrich video with singer context for player display
    const enrich = (v) => ({
      ...v,
      group: 'Singers',
      category: singer.genre || '',
      type: singer.name || '',
    });

    const enrichedVideo = enrich(video);
    const currentList = activeTab === 'live' ? liveVideos : videos;
    const enrichedAlbum = currentList.map(enrich);

    onVideoSelect(enrichedVideo, enrichedAlbum);
  };

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

        {/* Hero */}
        <div className="singer-detail__hero">
          {hasProfile && (
            <div className="singer-detail__hero-img-wrap">
              <img
                className="singer-detail__hero-img"
                src={effectiveProfile}
                alt=""
              />
            </div>
          )}
          <div className="singer-detail__hero-gradient" />
        </div>

        {/* Info */}
        <div className="singer-detail__info">
          {hasProfile && (
            <img
              className="singer-detail__poster"
              src={effectiveProfile}
              alt={singer.name}
            />
          )}
          <div className="singer-detail__metadata">
            <h1 className="singer-detail__title">{singer.name}</h1>

            <div className="singer-detail__meta">
              {singer.genre && (
                <span className="singer-detail__meta-item">{singer.genre}</span>
              )}
              {singer.genre && singer.knownForDepartment && (
                <span className="singer-detail__meta-dot" />
              )}
              {singer.knownForDepartment && (
                <span className="singer-detail__meta-item">{singer.knownForDepartment}</span>
              )}
              {singer.placeOfBirth && (
                <>
                  <span className="singer-detail__meta-dot" />
                  <span className="singer-detail__meta-item">{singer.placeOfBirth}</span>
                </>
              )}
            </div>

            {singer.birthday && (
              <div className="singer-detail__birthday">
                🎂 {new Date(singer.birthday).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
                {(() => {
                  const birthDate = new Date(singer.birthday);
                  const today = new Date();
                  let age = today.getFullYear() - birthDate.getFullYear();
                  const m = today.getMonth() - birthDate.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
                  return ` (${age} years old)`;
                })()}
              </div>
            )}

            {singer.biography && (
              <p className="singer-detail__overview">{singer.biography}</p>
            )}
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
              <span className="singer-detail__videos-count">{videos.length}</span>
              <div className="singer-detail__videos-line" />
            </div>
            <div className="singer-detail__video-grid">
              {videos.map((video) => (
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
                    />
                    <div className="singer-detail__video-play">
                      <div className="singer-detail__video-play-icon">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    {video.duration && (
                      <span className="singer-detail__video-duration">{video.duration}</span>
                    )}
                  </div>
                  <div className="singer-detail__video-info">
                    <h4 className="singer-detail__video-title">{video.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Tab */}
        {activeTab === 'live' && liveVideos.length > 0 && (
          <div className="singer-detail__videos">
            <div className="singer-detail__videos-header">
              <span className="singer-detail__videos-title">Live Performances</span>
              <span className="singer-detail__videos-count">{liveVideos.length}</span>
              <div className="singer-detail__videos-line" />
            </div>
            <div className="singer-detail__video-grid">
              {liveVideos.map((video) => (
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
                    />
                    <div className="singer-detail__video-play">
                      <div className="singer-detail__video-play-icon">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    {video.duration && (
                      <span className="singer-detail__video-duration">{video.duration}</span>
                    )}
                  </div>
                  <div className="singer-detail__video-info">
                    <h4 className="singer-detail__video-title">{video.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {activeTab === 'songs' && videos.length === 0 && (
          <div className="singer-detail__empty">No songs found.</div>
        )}
        {activeTab === 'live' && liveVideos.length === 0 && (
          <div className="singer-detail__empty">No live performances found.</div>
        )}
      </div>
    </div>
  );
}
