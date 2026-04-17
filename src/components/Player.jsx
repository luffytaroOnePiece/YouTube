import React, { useEffect, useCallback } from 'react';
import YouTube from 'react-youtube';

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

export default function Player({ video, onClose }) {
  // Close on ESC
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

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
      className="player-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="player-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="player-modal__header">
          <h2 className="player-modal__title">{video.title}</h2>
          <div className="player-modal__actions">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="player-modal__btn"
              title="Open in YouTube"
            >
              ↗ YouTube
            </a>
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
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
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
    </div>
  );
}
