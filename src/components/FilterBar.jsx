import React from 'react';
import Dropdown from './Dropdown';

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
