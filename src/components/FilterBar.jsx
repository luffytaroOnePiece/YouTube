import React from 'react';
import Dropdown from './Dropdown';


export default function FilterBar({
  groups,
  groupMeta,
  activeGroup,
  onGroupChange,
  categories,
  activeCategory,
  onCategoryChange,
  playlists,
  activePlaylist,
  onPlaylistChange,
  availableResolutions,
  activeResolution,
  onResolutionChange,
  searchQuery,
  onSearchChange,
  videoCounts,
  gridColumns,
  onGridColumnsChange,
  hasActiveFilters,
  onReset,
  onQuickAccess,
}) {
  // Build group options
  const groupOptions = [
    { value: 'All', label: `All Groups`, count: videoCounts.total },
    ...groups.map((g) => ({
      value: g,
      label: `${groupMeta[g]?.icon || ''} ${g}`,
      count: videoCounts.groups[g] || 0,
    })),
  ];

  // Build category options
  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    ...categories.map((c) => ({
      value: c,
      label: c,
      count: videoCounts.categories[`${activeGroup}::${c}`] || 0,
    })),
  ];

  // Build resolution options
  const resolutionOptions = [
    { value: 'All', label: 'All Quality' },
    ...availableResolutions.map((r) => ({ value: r, label: r })),
  ];

  const isTeluguActive = activeGroup === 'Music' && activeCategory === 'Telugu';
  const isEnglishActive = activeGroup === 'Music' && activeCategory === 'English';
  const is8KActive = activeResolution === '8K' && activeGroup === 'All';

  return (
    <div className="filter-bar">
      <div className="filter-bar__top">

        {/* Dropdowns */}
        <div className="filter-bar__dropdowns">
          <Dropdown
            id="group-select"
            value={activeGroup}
            options={groupOptions}
            onChange={onGroupChange}
            placeholder="All Groups"
          />

          {activeGroup !== 'All' && categories.length > 0 && (
            <Dropdown
              id="category-select"
              value={activeCategory}
              options={categoryOptions}
              onChange={onCategoryChange}
              placeholder="All Categories"
            />
          )}

          {availableResolutions.length > 0 && (
            <Dropdown
              id="resolution-select"
              value={activeResolution}
              options={resolutionOptions}
              onChange={onResolutionChange}
              placeholder="All Quality"
            />
          )}
        </div>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            className="filter-bar__reset"
            onClick={onReset}
            title="Reset all filters"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
          </button>
        )}

        {/* Quick Access — right side */}
        <div className="filter-bar__quick-group">
          <div className="filter-bar__divider" />
          <span className="filter-bar__quick-label">Quick Access</span>
          <button
            className={`filter-bar__quick-chip ${isTeluguActive ? 'filter-bar__quick-chip--active' : ''}`}
            onClick={() => isTeluguActive ? onReset() : onQuickAccess('Music', 'Telugu', 'All')}
          >
            🎵 Telugu
          </button>
          <button
            className={`filter-bar__quick-chip ${isEnglishActive ? 'filter-bar__quick-chip--active' : ''}`}
            onClick={() => isEnglishActive ? onReset() : onQuickAccess('Music', 'English', 'All')}
          >
            🎶 English
          </button>
          <button
            className={`filter-bar__quick-chip ${is8KActive ? 'filter-bar__quick-chip--active' : ''}`}
            onClick={() => is8KActive ? onReset() : onQuickAccess('All', 'All', '8K')}
          >
            ✦ 8K Ultra
          </button>
        </div>
      </div>

      {/* Row 2: Playlist Tabs */}
      {activeGroup !== 'All' && activeCategory !== 'All' && playlists.length > 0 && (
        <div className="filter-bar__tabs">
          <button
            className={`filter-bar__tab ${activePlaylist === 'All' ? 'filter-bar__tab--active' : ''}`}
            onClick={() => onPlaylistChange('All')}
          >
            All
          </button>
          {playlists.map((pl) => {
            const count = videoCounts.playlists[`${activeGroup}::${activeCategory}::${pl}`] || 0;
            return (
              <button
                key={pl}
                className={`filter-bar__tab ${activePlaylist === pl ? 'filter-bar__tab--active' : ''}`}
                onClick={() => onPlaylistChange(pl)}
              >
                {pl}
                <span className="filter-bar__count">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
