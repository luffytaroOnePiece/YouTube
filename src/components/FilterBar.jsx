import React from 'react';

const GRID_OPTIONS = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
];

export default function FilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  videoCounts,
  gridColumns,
  onGridColumnsChange,
}) {
  return (
    <div className="filter-bar">
      {/* Top row: search + grid control */}
      <div className="filter-bar__top">
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

        {/* Grid density control */}
        <div className="filter-bar__grid-control">
          <svg className="filter-bar__grid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
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

      {/* Category Tabs */}
      <div className="filter-bar__tabs">
        <button
          id="tab-all"
          className={`filter-bar__tab ${activeCategory === 'All' ? 'filter-bar__tab--active' : ''}`}
          onClick={() => onCategoryChange('All')}
        >
          All
          <span className="filter-bar__count">{videoCounts.total}</span>
        </button>
        {categories.map((cat) => (
          <button
            id={`tab-${cat.replace(/\s+/g, '-').toLowerCase()}`}
            key={cat}
            className={`filter-bar__tab ${activeCategory === cat ? 'filter-bar__tab--active' : ''}`}
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
            <span className="filter-bar__count">{videoCounts[cat] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
