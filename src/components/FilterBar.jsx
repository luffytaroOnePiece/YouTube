import React from 'react';

const GRID_OPTIONS = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
];

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
}) {
  return (
    <div className="filter-bar">
      {/* Row 1: Search + Dropdowns + Reset + Grid */}
      <div className="filter-bar__top">
        {/* Search */}
        <div className="filter-bar__search">
          <svg className="filter-bar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search-input"
            type="text"
            className="filter-bar__search-input"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button
              className="filter-bar__search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="filter-bar__dropdowns">
          {/* Group dropdown */}
          <div className="filter-bar__select-wrapper">
            <select
              id="group-select"
              className="filter-bar__select"
              value={activeGroup}
              onChange={(e) => onGroupChange(e.target.value)}
            >
              <option value="All">All Groups ({videoCounts.total})</option>
              {groups.map((group) => {
                const meta = groupMeta[group];
                const count = videoCounts.groups[group] || 0;
                return (
                  <option key={group} value={group}>
                    {meta?.icon} {group} ({count})
                  </option>
                );
              })}
            </select>
            <svg className="filter-bar__select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Category dropdown */}
          {activeGroup !== 'All' && categories.length > 0 && (
            <div className="filter-bar__select-wrapper">
              <select
                id="category-select"
                className="filter-bar__select"
                value={activeCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categories.map((cat) => {
                  const count = videoCounts.categories[`${activeGroup}::${cat}`] || 0;
                  return (
                    <option key={cat} value={cat}>
                      {cat} ({count})
                    </option>
                  );
                })}
              </select>
              <svg className="filter-bar__select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}

          {/* Resolution dropdown */}
          {availableResolutions.length > 0 && (
            <div className="filter-bar__select-wrapper">
              <select
                id="resolution-select"
                className="filter-bar__select filter-bar__select--res"
                value={activeResolution}
                onChange={(e) => onResolutionChange(e.target.value)}
              >
                <option value="All">All Quality</option>
                {availableResolutions.map((res) => (
                  <option key={res} value={res}>{res}</option>
                ))}
              </select>
              <svg className="filter-bar__select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
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

        {/* Grid density */}
        <div className="filter-bar__grid-control">
          <div className="filter-bar__grid-btns">
            {GRID_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`filter-bar__grid-btn ${gridColumns === opt.value ? 'filter-bar__grid-btn--active' : ''}`}
                onClick={() => onGridColumnsChange(opt.value)}
                title={`${opt.value} per row`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
