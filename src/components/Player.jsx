import React, { useEffect, useCallback, useState, useRef } from 'react';
import YouTube from 'react-youtube';
import RelatedPanel from './RelatedPanel';
import QueuePanel from './QueuePanel';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Upcoming';
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  } catch {
    return dateStr;
  }
}

export default function Player({
  video,
  allVideos,
  onVideoSelect,
  onClose,
  isMiniPlayer,
  onToggleMini,
  queue,
  autoplay,
  onAdvance,
  onQueueReorder,
  onQueueRemove,
  onToggleAutoplay
}) {
  const [sidebarTab, setSidebarTab] = useState('queue'); // 'queue' | 'related'
  const [upNextCountdown, setUpNextCountdown] = useState(null); // null or { seconds, video }
  const countdownRef = useRef(null);

  // Close on ESC
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        if (upNextCountdown) {
          cancelCountdown();
        } else {
          onClose();
        }
      }
    },
    [onClose, upNextCountdown]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    if (!isMiniPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown, isMiniPlayer]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setUpNextCountdown(null);
  }, []);

  const handleVideoEnd = useCallback(() => {
    if (!autoplay || !queue || queue.length === 0) return;

    const nextVideo = queue[0];
    setUpNextCountdown({ seconds: 3, video: nextVideo });

    let secs = 3;
    countdownRef.current = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setUpNextCountdown(null);
        onAdvance();
      } else {
        setUpNextCountdown({ seconds: secs, video: nextVideo });
      }
    }, 1000);
  }, [autoplay, queue, onAdvance]);

  if (!video) return null;

  const youtubeOpts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeLinkID}`;

  return (
    <div
      className={`player-overlay ${isMiniPlayer ? 'mini' : ''}`}
      onClick={(e) => {
        if (!isMiniPlayer && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`player-modal ${!isMiniPlayer ? 'player-modal--with-sidebar' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="player-modal__main">
          {/* Header */}
          <div className="player-modal__header">
            <h2 className="player-modal__title">{video.title}</h2>
            <div className="player-modal__actions">
              {!isMiniPlayer && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="player-modal__btn"
                  title="Open in YouTube"
                >
                  ↗ YouTube
                </a>
              )}
              <button
                className="player-modal__close"
                onClick={onToggleMini}
                aria-label={isMiniPlayer ? "Expand player" : "Minimize player"}
                title={isMiniPlayer ? "Expand" : "Minimize"}
              >
                {isMiniPlayer ? '↖' : '↘'}
              </button>
              <button
                id="player-close-btn"
                className="player-modal__close"
                onClick={onClose}
                aria-label="Close player"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Video */}
          <div className="player-modal__video">
            <YouTube
              videoId={video.youtubeLinkID}
              opts={youtubeOpts}
              onEnd={handleVideoEnd}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />

            {/* Up Next Countdown Overlay */}
            {upNextCountdown && (
              <div className="player-modal__up-next">
                <div className="player-modal__up-next-card">
                  <div className="player-modal__up-next-header">
                    <span className="player-modal__up-next-label">Up Next</span>
                    <span className="player-modal__up-next-timer">
                      <svg className="player-modal__up-next-ring" width="28" height="28" viewBox="0 0 28 28">
                        <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
                        <circle
                          cx="14" cy="14" r="12"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2.5"
                          strokeDasharray={2 * Math.PI * 12}
                          strokeDashoffset={2 * Math.PI * 12 * (1 - upNextCountdown.seconds / 3)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                        />
                      </svg>
                      <span className="player-modal__up-next-sec">{upNextCountdown.seconds}</span>
                    </span>
                  </div>
                  <div className="player-modal__up-next-info">
                    <img
                      className="player-modal__up-next-thumb"
                      src={`https://img.youtube.com/vi/${upNextCountdown.video.youtubeLinkID}/mqdefault.jpg`}
                      alt=""
                    />
                    <span className="player-modal__up-next-title">{upNextCountdown.video.title}</span>
                  </div>
                  <button className="player-modal__up-next-cancel" onClick={cancelCountdown}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="player-modal__info">
            <span className="player-modal__category-tag">{video.type}</span>
            {video.date && (
              <span className="player-modal__date" title={video.date}>
                {formatDate(video.date)}
              </span>
            )}
            {video.duration && (
              <span className="player-modal__date">⏱ {video.duration}</span>
            )}
          </div>
        </div>
        
        {!isMiniPlayer && (
          <div className="player-modal__sidebar-wrapper">
            <div className="player-sidebar">
              {/* Apple-style Segmented Control */}
              <div className="player-sidebar__tabs">
                <button
                  className={`player-sidebar__tab ${sidebarTab === 'queue' ? 'player-sidebar__tab--active' : ''}`}
                  onClick={() => setSidebarTab('queue')}
                >
                  Up Next
                  {queue && queue.length > 0 && (
                    <span className="player-sidebar__tab-count">{queue.length}</span>
                  )}
                </button>
                <button
                  className={`player-sidebar__tab ${sidebarTab === 'related' ? 'player-sidebar__tab--active' : ''}`}
                  onClick={() => setSidebarTab('related')}
                >
                  Related
                </button>
              </div>

              {/* Tab Content */}
              <div className="player-sidebar__content">
                {sidebarTab === 'queue' ? (
                  <QueuePanel
                    queue={queue || []}
                    onReorder={onQueueReorder}
                    onRemove={onQueueRemove}
                    onSelect={onVideoSelect}
                    autoplay={autoplay}
                    onToggleAutoplay={onToggleAutoplay}
                    currentVideo={video}
                  />
                ) : (
                  <RelatedPanel
                    currentVideo={video}
                    allVideos={allVideos}
                    onVideoSelect={onVideoSelect}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
