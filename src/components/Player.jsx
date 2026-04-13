import React, { useEffect, useCallback } from 'react';
import YouTube from 'react-youtube';

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
            <span className="player-modal__date">{video.date}</span>
          )}
          {video.duration && (
            <span className="player-modal__date">⏱ {video.duration}</span>
          )}
        </div>
      </div>
    </div>
  );
}
