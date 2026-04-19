import React, { useMemo } from 'react';

export default function RelatedPanel({ currentVideo, allVideos, onVideoSelect }) {
  const relatedVideos = useMemo(() => {
    if (!currentVideo || !allVideos) return [];

    let pool = allVideos.filter(v => v.youtubeLinkID !== currentVideo.youtubeLinkID);

    // Try to find videos of the same type/category first
    let related = pool.filter(v => v.type === currentVideo.type);

    // If too few, just expand pool to all other videos
    if (related.length < 8) {
      // Find videos not already in related to append
      const existingIds = new Set(related.map(v => v.youtubeLinkID));
      const remaining = pool.filter(v => !existingIds.has(v.youtubeLinkID));
      related = [...related, ...remaining];
    }

    // Sort by nearest date (most similar context)
    const currentMs = currentVideo.date ? new Date(currentVideo.date).getTime() : 0;
    
    // Sort logic prioritizing videos of same type first (since we already shoved them in front, let's keep it stable, or re-sort the whole related slice)
    // Actually, sorting the whole pool:
    related.sort((a, b) => {
      // If one matches type and other doesn't, prioritize matcher
      if (a.type === currentVideo.type && b.type !== currentVideo.type) return -1;
      if (a.type !== currentVideo.type && b.type === currentVideo.type) return 1;

      // Otherwise, sort by nearest date
      const aMs = a.date ? new Date(a.date).getTime() : 0;
      const bMs = b.date ? new Date(b.date).getTime() : 0;
      return Math.abs(aMs - currentMs) - Math.abs(bMs - currentMs);
    });

    return related.slice(0, 10);
  }, [currentVideo, allVideos]);

  return (
    <div className="related-panel">
      <h3 className="related-panel__title">Related Videos</h3>
      <div className="related-panel__list">
        {relatedVideos.map(video => (
          <div 
            key={video.youtubeLinkID} 
            className="related-video-card"
            onClick={() => onVideoSelect(video)}
          >
            <div className="related-video-card__thumbnail">
              <img 
                src={`https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`} 
                alt={video.title} 
                loading="lazy" 
              />
              {video.duration && (
                <span className="related-video-card__duration">{video.duration}</span>
              )}
            </div>
            <div className="related-video-card__info">
              <h4 className="related-video-card__title" title={video.title}>{video.title}</h4>
              <span className="related-video-card__type">{video.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
