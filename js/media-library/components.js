const icons = {
  photos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m7 15 3.2-3.6 2.6 2.8 2.4-2.2L18 15.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="8.3" r="1.4" fill="currentColor"/></svg>',
  updates: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 16v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 12h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 12h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  collections: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5" width="15" height="4.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="10.8" width="15" height="8.2" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  albums: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="6" width="15" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.8h6l4 4v12a1.8 1.8 0 0 1-1.8 1.8H8A1.8 1.8 0 0 1 6.2 19.8V5.6A1.8 1.8 0 0 1 8 3.8Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 3.8v4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  screens: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5" width="15" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 19h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 15.5V19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  favourites: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5.4 1.9 3.8 4.2.6-3 2.9.7 4.1-3.8-2-3.8 2 .7-4.1-3-2.9 4.2-.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 18a4.2 4.2 0 0 1 8.4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17.2" cy="9.6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14.8 17.6a3.4 3.4 0 0 1 5.4-2.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  places: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2s5.3-5.6 5.3-9.6A5.3 5.3 0 1 0 6.7 10.6c0 4 5.3 9.6 5.3 9.6Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10.2" r="1.9" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.7 9a2.5 2.5 0 1 1 4.4 1.6c-.9.8-1.9 1.3-1.9 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1" fill="currentColor"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4.3v2.1M12 17.6v2.1M19.7 12h-2.1M6.4 12H4.3M17.5 6.5 16 8M8 16l-1.5 1.5M17.5 17.5 16 16M8 8 6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  apps: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="4" height="4" rx="1" fill="currentColor"/><rect x="10" y="5" width="4" height="4" rx="1" fill="currentColor"/><rect x="15" y="5" width="4" height="4" rx="1" fill="currentColor"/><rect x="5" y="10" width="4" height="4" rx="1" fill="currentColor"/><rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor"/><rect x="15" y="10" width="4" height="4" rx="1" fill="currentColor"/><rect x="5" y="15" width="4" height="4" rx="1" fill="currentColor"/><rect x="10" y="15" width="4" height="4" rx="1" fill="currentColor"/><rect x="15" y="15" width="4" height="4" rx="1" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 12.8 3.7 3.7 7.5-8.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.8 5.8-6 6.2 6 6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 5.8 6 6.2-6 6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5 2 4.1 4.5.7-3.2 3 .8 4.6-4.1-2.1-4.1 2.1.8-4.6-3.2-3 4.5-.7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 10.3v5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1" fill="currentColor"/></svg>',
  memory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 18a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="9.4" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 18.3a4.3 4.3 0 1 1 .8-8.5 5.2 5.2 0 0 1 10.1 1.4A3.6 3.6 0 0 1 18 18.3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const secondaryIconMap = {
  Albums: 'albums',
  Documents: 'documents',
  'Screenshots and recordings': 'screens',
  Favourites: 'favourites',
  'People and pets': 'people',
  Places: 'places'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function icon(name, extraClass = '') {
  return `<span class="cml-icon ${extraClass}">${icons[name] || ''}</span>`;
}

function tileSpanClass(item) {
  const ratio = item.width / item.height;
  if (ratio >= 1.58) {
    return 'is-wide';
  }
  if (ratio <= 0.84) {
    return 'is-tall';
  }
  return 'is-standard';
}

function formatTakenAt(item) {
  const date = new Date(item.takenAt);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${item.monthLabel} ${item.day}, ${item.year} ${hh}:${mm}`;
}

export function StorageCard(storage) {
  const usedRatio = Math.max(4, Math.min(100, Math.round((storage.usedGb / storage.totalGb) * 100)));
  return `
    <section class="cml-storage-card" aria-label="Storage usage">
      <div class="cml-storage-card__header">
        <div class="cml-storage-card__icon">${icon('cloud')}</div>
        <div>
          <p class="cml-storage-card__eyebrow">Private archive</p>
          <strong>${storage.usedGb} GB of ${storage.totalGb} GB used</strong>
        </div>
      </div>
      <div class="cml-storage-card__meter" aria-hidden="true">
        <span style="width:${usedRatio}%"></span>
      </div>
      <button class="cml-storage-card__cta" type="button" data-action="upgrade">${escapeHtml(storage.upgradeLabel)}</button>
    </section>
  `;
}

export function Sidebar({ navigationModel, state, storageSummary }) {
  return `
    <aside class="cml-sidebar">
      <div class="cml-sidebar__brand">
        <img class="cml-sidebar__brand-logo" src="/logo-sundowner.svg" alt="SUNDOWNER" />
        <div>
          <strong class="cml-sidebar__brand-name">SUNDOWNER</strong>
          <p class="cml-sidebar__brand-copy">Media library</p>
        </div>
      </div>
      <nav class="cml-sidebar__nav" aria-label="Primary navigation">
        ${navigationModel.primary.map((label) => {
          const key = label.toLowerCase();
          const active = state.primaryFilter === label ? 'is-active' : '';
          const iconName = key === 'photos' ? 'photos' : key === 'updates' ? 'updates' : 'collections';
          return `
            <button type="button" class="cml-sidebar__nav-item ${active}" data-primary="${escapeHtml(label)}">
              ${icon(iconName)}
              <span>${escapeHtml(label)}</span>
            </button>
          `;
        }).join('')}
      </nav>
      <div class="cml-sidebar__section-label">Browse</div>
      <div class="cml-sidebar__subnav">
        ${navigationModel.secondary.map((label) => {
          const active = state.secondaryFilter === label ? 'is-active' : '';
          return `
            <button type="button" class="cml-sidebar__subnav-item ${active}" data-secondary="${escapeHtml(label)}">
              ${icon(secondaryIconMap[label])}
              <span>${escapeHtml(label)}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="cml-sidebar__footer">
        ${StorageCard(storageSummary)}
      </div>
    </aside>
  `;
}

export function TopSearchBar({ state }) {
  const selectedCount = state.selectedIds.size;
  const searchValue = escapeHtml(state.searchQuery);
  return `
    <header class="cml-topbar">
      <div class="cml-topbar__search-shell ${selectedCount ? 'is-selection-mode' : ''}">
        <label class="cml-topbar__search" aria-label="Search memories">
          ${icon('search', 'cml-topbar__search-icon')}
          <input type="search" class="cml-topbar__search-input" placeholder="Search memories, places, albums and people" value="${searchValue}" />
        </label>
        ${selectedCount ? `<div class="cml-topbar__selection-pill">${selectedCount} selected</div>` : ''}
      </div>
      <div class="cml-topbar__actions">
        <div class="cml-topbar__create-wrap">
          <button type="button" class="cml-topbar__create-button" data-action="toggle-create-menu">
            ${icon('plus')}
            <span>Create</span>
          </button>
          ${state.isCreateMenuOpen ? `
            <div class="cml-topbar__menu" role="menu">
              <button type="button" data-action="mock-upload">Upload media</button>
              <button type="button" data-action="mock-album">New album</button>
              <button type="button" data-action="mock-collection">Highlight reel</button>
            </div>
          ` : ''}
        </div>
        <button type="button" class="cml-topbar__icon-button" data-action="help" aria-label="Help">${icon('help')}</button>
        <button type="button" class="cml-topbar__icon-button" data-action="settings" aria-label="Settings">${icon('settings')}</button>
        <button type="button" class="cml-topbar__icon-button" data-action="apps" aria-label="Apps">${icon('apps')}</button>
        <button type="button" class="cml-topbar__avatar" data-action="account" aria-label="Account">SU</button>
      </div>
    </header>
  `;
}

export function MediaTile({ item, selected, favorited }) {
  const previewLabel = `${item.album} - ${formatTakenAt(item)}`;
  const favoriteClass = favorited ? 'is-favorited' : '';
  return `
    <article class="cml-media-tile ${tileSpanClass(item)} ${selected ? 'is-selected' : ''}" data-tile-id="${escapeHtml(item.id)}" tabindex="0" aria-label="${escapeHtml(previewLabel)}">
      <button type="button" class="cml-media-tile__select" data-action="toggle-select" data-id="${escapeHtml(item.id)}" aria-label="Select item">
        ${selected ? icon('check') : '<span class="cml-media-tile__select-ring"></span>'}
      </button>
      <button type="button" class="cml-media-tile__favorite ${favoriteClass}" data-action="toggle-favorite" data-id="${escapeHtml(item.id)}" aria-label="Toggle favourite">
        ${icon('star')}
      </button>
      <button type="button" class="cml-media-tile__info" data-action="open-preview" data-id="${escapeHtml(item.id)}" aria-label="Open preview">
        ${icon('info')}
      </button>
      <img class="cml-media-tile__image" src="${escapeHtml(item.thumbnailUrl)}" alt="${escapeHtml(item.album)}" loading="lazy" decoding="async" />
      <div class="cml-media-tile__scrim"></div>
      <div class="cml-media-tile__meta">
        <span>${item.type === 'video' ? 'Video' : 'Photo'}</span>
        <span>${escapeHtml(item.location)}</span>
      </div>
    </article>
  `;
}

export function MediaGrid({ items, state }) {
  return `
    <div class="cml-media-grid">
      ${items.map((item) => MediaTile({
        item,
        selected: state.selectedIds.has(item.id),
        favorited: state.favoriteIds.has(item.id)
      })).join('')}
    </div>
  `;
}

export function MediaTimelineSection({ section, state }) {
  return `
    <section class="cml-timeline-section" id="${escapeHtml(section.anchorId)}" data-year="${escapeHtml(section.year)}">
      <header class="cml-timeline-section__header">
        <div>
          <h2 class="cml-timeline-section__title">${escapeHtml(section.label)}</h2>
          <p class="cml-timeline-section__count">${section.items.length} memories</p>
        </div>
      </header>
      ${MediaGrid({ items: section.items, state })}
    </section>
  `;
}

export function YearScroller({ years, activeYear }) {
  if (!years.length) {
    return '';
  }
  return `
    <aside class="cml-year-scroller" aria-label="Jump by year">
      ${years.map((year) => `
        <button type="button" class="cml-year-scroller__item ${String(activeYear) === String(year) ? 'is-active' : ''}" data-year="${escapeHtml(year)}">${escapeHtml(year)}</button>
      `).join('')}
    </aside>
  `;
}

export function PreviewModal({ item, selected, favorited, currentIndex, totalCount }) {
  if (!item) {
    return '';
  }
  return `
    <div class="cml-preview" role="dialog" aria-modal="true">
      <div class="cml-preview__backdrop" data-action="close-preview"></div>
      <div class="cml-preview__panel">
        <header class="cml-preview__header">
          <div>
            <p class="cml-preview__eyebrow">${escapeHtml(item.album)}</p>
            <h3 class="cml-preview__title">${escapeHtml(formatTakenAt(item))}</h3>
          </div>
          <div class="cml-preview__header-actions">
            <button type="button" class="cml-preview__chip ${selected ? 'is-selected' : ''}" data-action="toggle-select" data-id="${escapeHtml(item.id)}">${selected ? 'Selected' : 'Select'}</button>
            <button type="button" class="cml-preview__chip ${favorited ? 'is-favorited' : ''}" data-action="toggle-favorite" data-id="${escapeHtml(item.id)}">Favourite</button>
            <button type="button" class="cml-preview__close" data-action="close-preview" aria-label="Close preview">${icon('close')}</button>
          </div>
        </header>
        <div class="cml-preview__body">
          <button type="button" class="cml-preview__nav is-prev" data-action="preview-previous" aria-label="Previous item">${icon('previous')}</button>
          <figure class="cml-preview__figure">
            <img src="${escapeHtml(item.thumbnailUrl)}" alt="${escapeHtml(item.album)}" class="cml-preview__image" />
            <figcaption class="cml-preview__caption">
              <strong>${escapeHtml(item.location)}</strong>
              <span>${escapeHtml(item.tags.join(' - '))}</span>
            </figcaption>
          </figure>
          <button type="button" class="cml-preview__nav is-next" data-action="preview-next" aria-label="Next item">${icon('next')}</button>
        </div>
        <footer class="cml-preview__footer">
          <span>${currentIndex + 1} / ${totalCount}</span>
          <span>${escapeHtml(item.personLabels.join(', ') || 'No people labels')}</span>
        </footer>
      </div>
    </div>
  `;
}

export function EmptyState({ query }) {
  const copy = query
    ? `No memories match \"${escapeHtml(query)}\". Try a place, person or album.`
    : 'No memories are visible yet. Try another collection or add mock uploads.';
  return `
    <section class="cml-empty-state">
      <div class="cml-empty-state__icon">${icon('memory')}</div>
      <h2 class="cml-empty-state__title">Nothing to show right now</h2>
      <p class="cml-empty-state__copy">${copy}</p>
    </section>
  `;
}

export function SearchSummary({ query, resultCount }) {
  if (!query) {
    return '';
  }
  return `
    <section class="cml-search-summary">
      <p class="cml-search-summary__eyebrow">Search results</p>
      <h2 class="cml-search-summary__title">${resultCount} matches for "${escapeHtml(query)}"</h2>
    </section>
  `;
}