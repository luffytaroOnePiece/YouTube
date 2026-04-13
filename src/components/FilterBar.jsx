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

        {/* Grid density */}
        <div className="filter-bar__grid-control">
          <svg className="filter-bar__grid-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <input
            type="range"
            className="filter-bar__grid-slider"
            min="2"
            max="6"
            value={gridColumns}
            onChange={(e) => onGridColumnsChange(Number(e.target.value))}
            title={`${gridColumns} per row`}
          />
          <span className="filter-bar__grid-value">{gridColumns}</span>
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
