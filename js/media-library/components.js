const icons = {
  photos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m7 15 3.2-3.6 2.6 2.8 2.4-2.2L18 15.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="8.3" r="1.4" fill="currentColor"/></svg>',
  updates: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 16v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 12h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 12h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  collections: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5" width="15" height="4.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="10.8" width="15" height="8.2" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  albums: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="6" width="15" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.8h6l4 4v12A1.8 1.8 0 0 1 16.2 21H8a1.8 1.8 0 0 1-1.8-1.8V5.6A1.8 1.8 0 0 1 8 3.8Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 3.8v4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  favourites: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5.4 1.9 3.8 4.2.6-3 2.9.7 4.1-3.8-2-3.8 2 .7-4.1-3-2.9 4.2-.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 12.8 3.7 3.7 7.5-8.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.8 5.8-6 6.2 6 6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 5.8 6 6.2-6 6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5 2 4.1 4.5.7-3.2 3 .8 4.6-4.1-2.1-4.1 2.1.8-4.6-3.2-3 4.5-.7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.6 17.2 12 8 17.4Z" fill="currentColor"/></svg>',
  memory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 18a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="9.4" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 18.3a4.3 4.3 0 1 1 .8-8.5 5.2 5.2 0 0 1 10.1 1.4A3.6 3.6 0 0 1 18 18.3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.8 7.2h12.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.4 4.8h5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.2 7.2v10.2a1.8 1.8 0 0 0 1.8 1.8h4a1.8 1.8 0 0 0 1.8-1.8V7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  restore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 1.8-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 6.2V12H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="0.9" fill="currentColor"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8M19.1 19.1l-1.8-1.8M6.7 6.7 4.9 4.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

const secondaryIconMap = {
  Albums: 'albums',
  Videos: 'play',
  Documents: 'documents',
  Favourites: 'favourites'
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

function formatCompactNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }
  if (numeric >= 100) {
    return String(Math.round(numeric));
  }
  if (numeric >= 10) {
    return numeric.toFixed(1).replace(/\.0$/, '');
  }
  return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatStorageAmountFromMb(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 MB';
  }
  if (numeric >= 1024 * 1024) {
    return `${formatCompactNumber(numeric / (1024 * 1024))} TB`;
  }
  if (numeric >= 1024) {
    return `${formatCompactNumber(numeric / 1024)} GB`;
  }
  return `${formatCompactNumber(numeric)} MB`;
}

function formatStorageAmountFromGb(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 GB';
  }
  if (numeric >= 1024) {
    return `${formatCompactNumber(numeric / 1024)} TB`;
  }
  if (numeric < 1) {
    return formatStorageAmountFromMb(numeric * 1024);
  }
  return `${formatCompactNumber(numeric)} GB`;
}

function formatTakenAt(item) {
  if (item.displayTakenAt) {
    return item.displayTakenAt;
  }
  const date = new Date(item.takenAt);
  if (Number.isNaN(date.getTime())) {
    return item.timelineLabel || 'Unknown date';
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${item.monthLabel} ${item.day}, ${item.year} ${hh}:${mm}`;
}

function clampAspectRatio(value) {
  return Math.max(0.58, Math.min(2.4, value || 1));
}

function getLayoutConfig(containerWidth, denseGrid) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const isMobile = viewportWidth <= 640;
  const isTablet = viewportWidth <= 960;
  const gap = isMobile ? 6 : 8;
  const fallbackWidth = Math.max(280, viewportWidth - (isTablet ? 36 : 410));
  const availableWidth = Math.max(280, Math.floor(containerWidth || fallbackWidth));
  const rowHeightBase = denseGrid ? (isMobile ? 118 : viewportWidth <= 1180 ? 160 : 188) : (isMobile ? 132 : viewportWidth <= 1180 ? 180 : 212);
  return {
    availableWidth,
    gap,
    targetRowHeight: rowHeightBase,
    minRowHeight: denseGrid ? (isMobile ? 98 : 134) : (isMobile ? 110 : 148),
    maxRowHeight: denseGrid ? (isMobile ? 148 : 206) : (isMobile ? 168 : 248),
    maxItemsPerRow: isMobile ? 3 : denseGrid ? 6 : 5
  };
}

function buildJustifiedRows(items, options = {}) {
  const { availableWidth, gap, targetRowHeight, minRowHeight, maxRowHeight, maxItemsPerRow } = getLayoutConfig(options.containerWidth, options.denseGrid);
  const rows = [];
  let currentRow = [];
  let aspectSum = 0;

  items.forEach((item, index) => {
    const aspectRatio = clampAspectRatio(item.width / item.height);
    currentRow.push({ item, aspectRatio });
    aspectSum += aspectRatio;

    const projectedWidth = aspectSum * targetRowHeight + gap * (currentRow.length - 1);
    const isLastItem = index === items.length - 1;
    const shouldFlush = projectedWidth >= availableWidth || currentRow.length >= maxItemsPerRow || isLastItem;

    if (!shouldFlush) {
      return;
    }

    const shouldFillWidth = projectedWidth >= availableWidth && currentRow.length > 1;
    const fittedHeight = shouldFillWidth
      ? (availableWidth - gap * (currentRow.length - 1)) / aspectSum
      : Math.min(targetRowHeight, (availableWidth - gap * (currentRow.length - 1)) / aspectSum);
    const rowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, fittedHeight));

    rows.push({
      items: currentRow.map(({ item: rowItem, aspectRatio: rowAspectRatio }) => ({
        item: rowItem,
        width: Math.max(88, Math.round(rowAspectRatio * rowHeight)),
        height: Math.round(rowHeight)
      }))
    });

    currentRow = [];
    aspectSum = 0;
  });

  return rows;
}

function renderMediaAsset(item, className, withControls = false) {
  const sourceUrl = item.sourceUrl || item.thumbnailUrl;
  const imageUrl = withControls ? sourceUrl : (item.thumbnailUrl || sourceUrl);
  const mediaUrl = escapeHtml(item.type === 'video' ? sourceUrl : imageUrl);
  const alt = escapeHtml(item.label || item.album || 'Library item');
  if (item.type === 'video' && item.thumbnailUrl === sourceUrl) {
    return `<video class="${className}" src="${mediaUrl}" ${withControls ? 'controls' : ''} muted playsinline preload="metadata"></video>`;
  }
  if (item.type === 'video' && withControls) {
    const poster = item.posterUrl ? ` poster="${escapeHtml(item.posterUrl)}"` : '';
    return `<video class="${className}" src="${mediaUrl}"${poster} controls playsinline preload="metadata"></video>`;
  }
  return `<img class="${className}" src="${mediaUrl}" alt="${alt}" loading="lazy" decoding="async" />`;
}

export function StorageCard(storage) {
  const usedMb = Math.max(0, Number(storage?.usedMb) || 0);
  const totalQuotaGb = Math.max(0, Number(storage?.totalQuotaGb) || 0);
  const totalCount = Math.max(0, Number(storage?.totalCount) || 0);
  const isLoading = Boolean(storage?.isLoading);
  const hasQuota = totalQuotaGb > 0;
  const usedRatio = hasQuota
    ? Math.max(4, Math.min(100, Math.round((usedMb / (totalQuotaGb * 1024)) * 100)))
    : Math.max(16, Math.min(52, totalCount ? 22 + totalCount : (isLoading ? 24 : 18)));
  const usageLine = hasQuota
    ? `${formatStorageAmountFromMb(usedMb)} of ${formatStorageAmountFromGb(totalQuotaGb)} used`
    : (isLoading ? 'Reading live library usage' : `${formatStorageAmountFromMb(usedMb)} indexed`);
  const detailLine = totalCount
    ? `${totalCount} live file${totalCount === 1 ? '' : 's'} in the indexed library`
    : (isLoading ? 'Refreshing from the live media index.' : 'No indexed media found yet.');
  return `
    <section class="cml-storage-card" aria-label="Storage usage">
      <div class="cml-storage-card__header">
        <div class="cml-storage-card__icon">${icon('cloud')}</div>
        <div>
          <p class="cml-storage-card__eyebrow">Private archive</p>
          <strong>${usageLine}</strong>
          <p class="cml-storage-card__copy">${detailLine}</p>
        </div>
      </div>
      <div class="cml-storage-card__meter ${hasQuota ? '' : 'is-open-ended'}" aria-hidden="true">
        <span style="width:${usedRatio}%"></span>
      </div>
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
          const iconName = key === 'photos' ? 'photos' : key === 'bin' ? 'trash' : 'collections';
          return `
            <button type="button" class="cml-sidebar__nav-item ${active}" data-primary="${escapeHtml(label)}">
              ${icon(iconName)}
              <span>${escapeHtml(label)}</span>
            </button>
          `;
        }).join('')}
      </nav>
      ${navigationModel.secondary.length ? `
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
      ` : ''}
      <div class="cml-sidebar__footer">
        <a href="/dashboard" class="cml-sidebar__nav-item cml-sidebar__admin-link">
          ${icon('settings')}
          <span>Admin</span>
        </a>
        ${StorageCard(storageSummary)}
      </div>
    </aside>
  `;
}

function AvatarButton({ adminUsername = '', avatarMenuOpen = false }) {
  const initial = adminUsername ? adminUsername.charAt(0).toUpperCase() : '?';
  const menuHtml = avatarMenuOpen ? `
    <div class="cml-avatar-menu" role="menu">
      <div class="cml-avatar-menu__header">
        <div class="cml-avatar-menu__avatar-lg">${escapeHtml(initial)}</div>
        <div>
          <p class="cml-avatar-menu__name">${escapeHtml(adminUsername || 'Admin')}</p>
          <p class="cml-avatar-menu__role">Administrator</p>
        </div>
      </div>
      <div class="cml-avatar-menu__divider"></div>
      <button type="button" class="cml-avatar-menu__item" data-action="open-admin-dashboard" role="menuitem">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Admin dashboard
      </button>
      <div class="cml-avatar-menu__divider"></div>
      <button type="button" class="cml-avatar-menu__item cml-avatar-menu__item--danger" data-action="logout" role="menuitem">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m16 17 5-5-5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        Sign out
      </button>
    </div>
  ` : '';
  return `
    <div class="cml-avatar-wrap">
      <button type="button" class="cml-avatar-btn ${avatarMenuOpen ? 'is-open' : ''}" data-action="toggle-avatar" aria-label="Account menu" aria-expanded="${avatarMenuOpen}">
        ${escapeHtml(initial)}
      </button>
      ${menuHtml}
    </div>
  `;
}

export function TopSearchBar({ state, canDeleteSelection = false, canSetAlbumCover = false }) {
  const selectedCount = state.selectedIds.size;
  const searchValue = escapeHtml(state.searchQuery);
  const activeAlbumName = String(state.activeAlbumName || '');
  const albumSelectionTarget = String(state.albumSelectionTarget || '');
  const isAlbumPickerMode = Boolean(albumSelectionTarget);
  const canCreateAlbum = state.primaryFilter === 'Collections' && !activeAlbumName;
  if (selectedCount) {
    if (isAlbumPickerMode) {
      return `
        <header class="cml-topbar is-selection-mode">
          <div class="cml-topbar__selection-shell">
            <div class="cml-topbar__selection-meta">
              <button type="button" class="cml-topbar__clear-button" data-action="clear-selection" aria-label="Clear selection">${icon('close')}</button>
              <strong>${selectedCount} selected</strong>
            </div>
            <div class="cml-topbar__selection-actions">
              <button type="button" class="cml-topbar__secondary-button" data-action="cancel-add-to-current-album">Cancel</button>
              <button type="button" class="cml-topbar__upload-button" data-action="confirm-add-to-current-album">Add to ${escapeHtml(albumSelectionTarget)}</button>
            </div>
          </div>
        </header>
      `;
    }
    return `
      <header class="cml-topbar is-selection-mode">
        <div class="cml-topbar__selection-shell">
          <div class="cml-topbar__selection-meta">
            <button type="button" class="cml-topbar__clear-button" data-action="clear-selection" aria-label="Clear selection">${icon('close')}</button>
            <strong>${selectedCount} selected</strong>
          </div>
          <div class="cml-topbar__selection-actions">
            <button type="button" class="cml-topbar__secondary-button" data-action="open-add-to-album">Add to album</button>
            ${activeAlbumName && canSetAlbumCover ? `
              <button type="button" class="cml-topbar__secondary-button" data-action="set-album-cover">Set as cover</button>
            ` : ''}
            <button type="button" class="cml-topbar__secondary-button is-destructive" data-action="delete-selected" ${canDeleteSelection ? '' : 'disabled'}>${icon('trash')}<span>Delete</span></button>
          </div>
        </div>
      </header>
    `;
  }
  return `
    <header class="cml-topbar">
      <div class="cml-topbar__search-shell">
        <label class="cml-topbar__search" aria-label="Search memories">
          ${icon('search', 'cml-topbar__search-icon')}
          <input type="search" class="cml-topbar__search-input" placeholder="Search memories, places, albums and people" value="${searchValue}" />
        </label>
      </div>
      <div class="cml-topbar__actions">
        ${isAlbumPickerMode ? `
          <button type="button" class="cml-topbar__secondary-button" data-action="cancel-add-to-current-album">
            ${icon('previous')}
            <span>Back to album</span>
          </button>
        ` : activeAlbumName ? `
          <button type="button" class="cml-topbar__secondary-button" data-action="open-add-to-current-album">
            ${icon('plus')}
            <span>Add photos</span>
          </button>
        ` : canCreateAlbum ? `
          <button type="button" class="cml-topbar__secondary-button" data-action="open-create-album">
            ${icon('plus')}
            <span>New album</span>
          </button>
        ` : ''}
        <button type="button" class="cml-topbar__upload-button" data-action="open-upload">
          ${icon('plus')}
          <span>Upload</span>
        </button>
      </div>
      ${AvatarButton({ adminUsername: state.adminUsername, avatarMenuOpen: state.avatarMenuOpen })}
    </header>
  `;
}

export function MediaTile({ item, selected, layout, isCover = false }) {
  const previewLabel = `${item.label || item.album} - ${formatTakenAt(item)}`;
  const style = `width:${layout.width}px;height:${layout.height}px;`;
  return `
    <article class="cml-media-tile ${selected ? 'is-selected' : ''}" data-action="open-preview" data-id="${escapeHtml(item.id)}" data-tile-id="${escapeHtml(item.id)}" tabindex="0" aria-label="${escapeHtml(previewLabel)}" style="${style}">
      <button type="button" class="cml-media-tile__select" data-action="toggle-select" data-id="${escapeHtml(item.id)}" aria-label="Select item">
        ${selected ? icon('check') : '<span class="cml-media-tile__select-ring"></span>'}
      </button>
      ${renderMediaAsset(item, 'cml-media-tile__image')}
      ${item.type === 'video' ? `<span class="cml-media-tile__video-badge" aria-hidden="true">${icon('play')}</span>` : ''}
      ${isCover ? `<span class="cml-media-tile__cover-badge" aria-label="Album cover">${icon('star')}</span>` : ''}
      <div class="cml-media-tile__scrim"></div>
    </article>
  `;
}

export function MediaGrid({ items, state, layoutWidth, coverItemId = '' }) {
  const rows = buildJustifiedRows(items, {
    containerWidth: layoutWidth,
    denseGrid: false
  });

  return `
    <div class="cml-media-grid">
      ${rows.map((row) => `
        <div class="cml-media-row">
          ${row.items.map((layout) => MediaTile({
            item: layout.item,
            layout,
            selected: state.selectedIds.has(layout.item.id),
            isCover: coverItemId && layout.item.id === coverItemId
          })).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

export function MediaTimelineSection({ section, state, layoutWidth, coverItemId = '' }) {
  return `
    <section class="cml-timeline-section" id="${escapeHtml(section.anchorId)}" data-year="${escapeHtml(section.year)}">
      <header class="cml-timeline-section__header">
        <div class="cml-timeline-section__heading">
          <div class="cml-timeline-section__heading-line">
            <h2 class="cml-timeline-section__title">${escapeHtml(section.label)}</h2>
            ${section.metaLine ? `<p class="cml-timeline-section__summary">${escapeHtml(section.metaLine)}</p>` : ''}
          </div>
          <p class="cml-timeline-section__count">${section.items.length} memories</p>
        </div>
      </header>
      ${MediaGrid({ items: section.items, state, layoutWidth, coverItemId })}
    </section>
  `;
}

export function CollectionSummary({ activeAlbumName = '', collectionCount = 0, itemCount = 0, coverLabel = '', hasCustomCover = false }) {
  const hasActiveAlbum = Boolean(activeAlbumName);
  const title = hasActiveAlbum ? activeAlbumName : `${collectionCount} album${collectionCount === 1 ? '' : 's'}`;
  const copy = hasActiveAlbum
    ? `${itemCount} item${itemCount === 1 ? '' : 's'} in this album`
    : 'Collections now show album categories first. Open an album to browse its photos.';
  const coverLine = hasActiveAlbum && coverLabel
    ? `${hasCustomCover ? 'Custom cover' : 'Cover'}: ${coverLabel}`
    : '';
  return `
    <section class="cml-view-summary">
      ${hasActiveAlbum ? `
        <button type="button" class="cml-topbar__secondary-button cml-view-summary__back" data-action="close-collection">
          ${icon('previous')}
          <span>All collections</span>
        </button>
      ` : ''}
      <p class="cml-view-summary__eyebrow">${hasActiveAlbum ? 'Collection' : 'Collections'}</p>
      <h2 class="cml-view-summary__title">${escapeHtml(title)}</h2>
      <p class="cml-view-summary__copy">${escapeHtml(copy)}</p>
      ${coverLine ? `<p class="cml-view-summary__cover">${escapeHtml(coverLine)}</p>` : ''}
    </section>
  `;
}

export function CollectionGrid({ collections }) {
  return `
    <section class="cml-collection-grid" aria-label="Album collections">
      ${collections.map((collection) => `
        <button
          type="button"
          class="cml-collection-card"
          data-action="open-collection"
          data-album-name="${escapeHtml(collection.name)}"
          aria-label="Open album ${escapeHtml(collection.name)}"
        >
          <span class="cml-collection-card__cover ${collection.coverItem ? '' : 'is-empty'}">
            ${collection.coverItem
              ? renderMediaAsset(collection.coverItem, 'cml-collection-card__image')
              : `<span class="cml-collection-card__placeholder">${icon('albums')}</span>`}
            ${collection.hasCustomCover ? `<span class="cml-collection-card__cover-badge">Cover</span>` : ''}
            ${collection.coverItem?.type === 'video' ? `<span class="cml-collection-card__badge">${icon('play')}</span>` : ''}
          </span>
          <span class="cml-collection-card__body">
            <span class="cml-collection-card__eyebrow">Album</span>
            <strong class="cml-collection-card__title">${escapeHtml(collection.name)}</strong>
            <span class="cml-collection-card__meta">${collection.itemCount} item${collection.itemCount === 1 ? '' : 's'}</span>
            <span class="cml-collection-card__copy">${escapeHtml(collection.metaLine || 'Empty album')}</span>
          </span>
        </button>
      `).join('')}
    </section>
  `;
}

export function YearScroller({ years, activeYear }) {
  if (years.length < 2) {
    return '';
  }
  return `
    <aside class="cml-scrubber" aria-label="Timeline navigation">
      <div class="cml-scrubber__track">
        ${years.map((year, i) => {
          const pct = years.length > 1 ? (i / (years.length - 1)) * 100 : 0;
          const isActive = String(activeYear) === String(year);
          return `
            <div class="cml-scrubber__tick ${isActive ? 'is-active' : ''}" style="top:${pct.toFixed(1)}%" data-year="${escapeHtml(year)}">
              <span class="cml-scrubber__label">${escapeHtml(year)}</span>
              <button type="button" class="cml-scrubber__dot" data-year="${escapeHtml(year)}" aria-label="Jump to ${escapeHtml(year)}"></button>
            </div>
          `;
        }).join('')}
        <div class="cml-scrubber__thumb" style="top:0%"></div>
      </div>
    </aside>
  `;
}

export function PreviewModal({ item, selected, favorited, currentIndex, totalCount, infoOpen = false }) {
  if (!item) {
    return '';
  }
  const detailLine = item.tags && item.tags.length
    ? item.tags.join(' / ')
    : (item.displayTakenAt || item.timelineLabel || 'No additional details');

  const infoPanel = `
    <aside class="cml-preview__info ${infoOpen ? 'is-open' : ''}" aria-label="Photo details">
      <div class="cml-preview__info-inner">
        <div class="cml-preview__info-thumb">
          <img src="${escapeHtml(item.thumbnailUrl || item.sourceUrl)}" alt="" loading="lazy" />
        </div>
        <dl class="cml-preview__info-meta">
          ${item.label ? `
            <dt class="cml-preview__info-label">File</dt>
            <dd class="cml-preview__info-value cml-preview__info-value--filename" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</dd>
          ` : ''}
          ${item.displayTakenAt ? `
            <dt class="cml-preview__info-label">Date</dt>
            <dd class="cml-preview__info-value">${escapeHtml(item.displayTakenAt)}</dd>
          ` : ''}
          ${item.location ? `
            <dt class="cml-preview__info-label">Location</dt>
            <dd class="cml-preview__info-value">${escapeHtml(item.location)}</dd>
          ` : ''}
          ${item.width && item.height ? `
            <dt class="cml-preview__info-label">Dimensions</dt>
            <dd class="cml-preview__info-value">${item.width} × ${item.height}</dd>
          ` : ''}
          <dt class="cml-preview__info-label">Type</dt>
          <dd class="cml-preview__info-value">${item.type === 'video' ? 'Video' : 'Photo'}</dd>
          ${item.album ? `
            <dt class="cml-preview__info-label">Album</dt>
            <dd class="cml-preview__info-value">${escapeHtml(item.album)}</dd>
          ` : ''}
          ${item.personLabels && item.personLabels.length ? `
            <dt class="cml-preview__info-label">People</dt>
            <dd class="cml-preview__info-value">${escapeHtml(item.personLabels.join(', '))}</dd>
          ` : ''}
          ${item.tags && item.tags.length ? `
            <dt class="cml-preview__info-label">Tags</dt>
            <dd class="cml-preview__info-value">
              <span class="cml-preview__info-tags">
                ${item.tags.map((tag) => `<span class="cml-preview__info-tag">${escapeHtml(tag)}</span>`).join('')}
              </span>
            </dd>
          ` : ''}
        </dl>
      </div>
    </aside>
  `;

  return `
    <div class="cml-preview ${infoOpen ? 'has-info' : ''}" role="dialog" aria-modal="true">
      <div class="cml-preview__backdrop" data-action="close-preview"></div>
      <div class="cml-preview__panel">
        <header class="cml-preview__header">
          <div>
            <p class="cml-preview__eyebrow">${escapeHtml(item.album || 'Library item')}</p>
            <h3 class="cml-preview__title">${escapeHtml(formatTakenAt(item))}</h3>
          </div>
          <div class="cml-preview__header-actions">
            <button type="button" class="cml-preview__chip ${selected ? 'is-selected' : ''}" data-action="toggle-select" data-id="${escapeHtml(item.id)}">${selected ? 'Selected' : 'Select'}</button>
            <button type="button" class="cml-preview__chip ${favorited ? 'is-favorited' : ''}" data-action="toggle-favorite" data-id="${escapeHtml(item.id)}">Favourite</button>
            <button type="button" class="cml-preview__chip ${infoOpen ? 'is-selected' : ''}" data-action="toggle-info" aria-label="Photo details">${icon('info')}</button>
            <button type="button" class="cml-preview__close" data-action="close-preview" aria-label="Close preview">${icon('close')}</button>
          </div>
        </header>
        <div class="cml-preview__body">
          <button type="button" class="cml-preview__nav is-prev" data-action="preview-previous" aria-label="Previous item">${icon('previous')}</button>
          <figure class="cml-preview__figure">
            <div class="cml-preview__stage">
              ${renderMediaAsset(item, 'cml-preview__media', true)}
            </div>
            <figcaption class="cml-preview__caption">
              <strong>${escapeHtml(item.location || item.label || item.album || 'Private library')}</strong>
              <span>${escapeHtml(detailLine)}</span>
            </figcaption>
          </figure>
          <button type="button" class="cml-preview__nav is-next" data-action="preview-next" aria-label="Next item">${icon('next')}</button>
        </div>
        <footer class="cml-preview__footer">
          <span>${currentIndex + 1} / ${totalCount}</span>
          <span>${escapeHtml(item.personLabels.join(', ') || item.label || 'No people labels')}</span>
        </footer>
        ${infoPanel}
      </div>
    </div>
  `;
}
export function AlbumDialog({ state, albums }) {
  if (!state.albumDialogOpen) {
    return '';
  }
  const selectedCount = state.selectedIds.size;
  const isAssignMode = state.albumDialogMode === 'assign';
  const title = isAssignMode ? 'Add to album' : 'Create album';
  const description = isAssignMode
    ? `Add ${selectedCount} selected item${selectedCount === 1 ? '' : 's'} to an existing album or create a new one.`
    : 'Create a new album shell now and fill it later from the library.';
  return `
    <div class="cml-dialog" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="cml-dialog__backdrop" data-action="close-album-dialog"></div>
      <div class="cml-dialog__panel cml-album-dialog">
        <header class="cml-dialog__header">
          <div>
            <h3 class="cml-dialog__title">${title}</h3>
            <p class="cml-dialog__copy">${description}</p>
          </div>
          <button type="button" class="cml-dialog__close" data-action="close-album-dialog" aria-label="Close dialog">${icon('close')}</button>
        </header>
        ${isAssignMode && albums.length ? `
          <div class="cml-album-dialog__section">
            <p class="cml-album-dialog__label">Existing albums</p>
            <div class="cml-album-dialog__list">
              ${albums.map((album) => `
                <button type="button" class="cml-album-dialog__album-chip" data-action="assign-album" data-album-name="${escapeHtml(album)}">${escapeHtml(album)}</button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="cml-album-dialog__section">
          <label class="cml-album-dialog__field">
            <span class="cml-album-dialog__label">New album name</span>
            <input type="text" class="cml-album-dialog__input" value="${escapeHtml(state.albumDraftName || '')}" placeholder="Weekend in Guangzhou" maxlength="64" />
          </label>
          ${state.albumDialogError ? `<p class="cml-album-dialog__error">${escapeHtml(state.albumDialogError)}</p>` : ''}
        </div>
        <footer class="cml-dialog__footer">
          <button type="button" class="cml-topbar__secondary-button" data-action="close-album-dialog">Cancel</button>
          <button type="button" class="cml-topbar__upload-button" data-action="submit-album-dialog">${isAssignMode ? 'Create and add' : 'Create album'}</button>
        </footer>
      </div>
    </div>
  `;
}

export function ConfirmDialog({ state }) {
  if (!state.confirmDialogOpen) {
    return '';
  }

  const isDestructive = ['delete', 'delete-permanently', 'delete-bin-permanently', 'empty-bin'].includes(state.confirmDialogMode);
  const countLabel = state.confirmDialogSelectionCount > 1
    ? `${state.confirmDialogSelectionCount} items selected`
    : state.confirmDialogSelectionCount === 1
      ? '1 item selected'
      : '';

  return `
    <div class="cml-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.confirmDialogTitle || 'Confirm action')}">
      <div class="cml-dialog__backdrop" data-action="close-confirm-dialog"></div>
      <div class="cml-dialog__panel cml-confirm-dialog">
        <header class="cml-dialog__header">
          <div>
            <p class="cml-confirm-dialog__eyebrow">${escapeHtml(countLabel || 'Action confirmation')}</p>
            <h3 class="cml-dialog__title">${escapeHtml(state.confirmDialogTitle || 'Confirm action')}</h3>
            <p class="cml-dialog__copy">${escapeHtml(state.confirmDialogCopy || '')}</p>
          </div>
          <button type="button" class="cml-dialog__close" data-action="close-confirm-dialog" aria-label="Close dialog">${icon('close')}</button>
        </header>
        <footer class="cml-dialog__footer">
          <button type="button" class="cml-topbar__secondary-button" data-action="close-confirm-dialog" ${state.confirmDialogBusy ? 'disabled' : ''}>Cancel</button>
          <button type="button" class="cml-topbar__secondary-button ${isDestructive ? 'is-destructive' : ''}" data-action="confirm-delete-selected" ${state.confirmDialogBusy ? 'disabled' : ''}>
            ${state.confirmDialogBusy ? 'Working…' : escapeHtml(state.confirmDialogConfirmLabel || 'Confirm')}
          </button>
        </footer>
      </div>
    </div>
  `;
}

export function EmptyState({ query, isLoading = false, mode = 'media', actionLabel = '', actionAction = '' }) {
  const title = isLoading ? 'Loading your library' : 'Nothing to show right now';
  const emptyCopy = mode === 'collections'
    ? 'No albums are available for this view yet. Create a new album or add media to an existing one.'
    : mode === 'album-detail'
      ? 'This album is empty. Pick from your uploaded photos to start filling it.'
      : mode === 'album-picker'
        ? 'No uploaded photos are available to add from the current library view.'
    : 'No real photos or videos are available for this view yet. Upload media to populate the library.';
  const copy = isLoading
    ? 'Pulling real photos and videos from the underlying library index.'
    : query
      ? (mode === 'collections'
        ? `No albums match \"${escapeHtml(query)}\". Try an album name or related memory.`
        : mode === 'album-picker'
          ? `No uploaded photos match \"${escapeHtml(query)}\" for adding to this album.`
        : `No memories match \"${escapeHtml(query)}\". Try a place, person or album.`)
      : emptyCopy;
  return `
    <section class="cml-empty-state">
      <div class="cml-empty-state__icon">${icon('memory')}</div>
      <h2 class="cml-empty-state__title">${title}</h2>
      <p class="cml-empty-state__copy">${copy}</p>
      ${!isLoading && !query && actionLabel && actionAction ? `
        <div class="cml-empty-state__actions">
          <button type="button" class="cml-topbar__secondary-button" data-action="${escapeHtml(actionAction)}">${escapeHtml(actionLabel)}</button>
        </div>
      ` : ''}
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
      <h2 class="cml-search-summary__title">${resultCount} matches for \"${escapeHtml(query)}\"</h2>
    </section>
  `;
}

export function BinGrid({ items, binSelectedIds, isBinLoading }) {
  const selectedCount = binSelectedIds.size;
  const hasItems = items.length > 0;

  const headerActions = selectedCount > 0
    ? `
      <button type="button" class="cml-topbar__upload-button" data-action="restore-bin-selection">
        ${icon('restore')}<span>Restore (${selectedCount})</span>
      </button>
      <button type="button" class="cml-topbar__secondary-button is-destructive" data-action="delete-bin-permanently">
        ${icon('trash')}<span>Delete forever (${selectedCount})</span>
      </button>
    `
    : hasItems
      ? `<button type="button" class="cml-topbar__secondary-button is-destructive" data-action="request-empty-bin">Empty bin</button>`
      : '';

  const gridContent = isBinLoading
    ? `<div class="cml-bin-loading"><span class="cml-bin-loading__text">Loading bin…</span></div>`
    : !hasItems
      ? `
        <section class="cml-empty-state">
          <div class="cml-empty-state__icon">${icon('trash')}</div>
          <h2 class="cml-empty-state__title">Bin is empty</h2>
          <p class="cml-empty-state__copy">Items you delete will appear here for up to 45 days before permanent removal.</p>
        </section>
      `
      : `
        <div class="cml-bin-grid">
          ${items.map((item) => {
            const selected = binSelectedIds.has(item.id);
            const urgency = item.daysLeft <= 7 ? 'is-urgent' : item.daysLeft <= 14 ? 'is-warning' : '';
            const daysLabel = item.daysLeft === 1 ? '1 day left' : `${item.daysLeft} days left`;
            return `
              <div class="cml-bin-tile ${selected ? 'is-selected' : ''}" data-bin-id="${escapeHtml(item.id)}">
                <label class="cml-bin-tile__thumb-wrap">
                  <input type="checkbox" class="cml-bin-tile__checkbox" data-action="toggle-bin-select" data-bin-id="${escapeHtml(item.id)}" ${selected ? 'checked' : ''} aria-label="Select ${escapeHtml(item.label)}" />
                  ${renderMediaAsset(item, 'cml-bin-tile__image')}
                  ${item.type === 'video' ? `<span class="cml-media-tile__video-badge" aria-hidden="true">${icon('play')}</span>` : ''}
                  <span class="cml-bin-tile__expiry ${urgency}">${escapeHtml(daysLabel)}</span>
                </label>
                <div class="cml-bin-tile__info">
                  <span class="cml-bin-tile__name" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

  return `
    <div class="cml-bin-view">
      <header class="cml-bin-view__header">
        <div class="cml-bin-view__meta">
          ${selectedCount > 0
            ? `<strong>${selectedCount} selected</strong>`
            : hasItems
              ? `<span>${items.length} item${items.length === 1 ? '' : 's'} in bin</span>`
              : ''}
        </div>
        <div class="cml-bin-view__actions">${headerActions}</div>
      </header>
      ${gridContent}
    </div>
  `;
}

export function LoginOverlay({ error = '', isLoading = false } = {}) {
  const logoSvg = `<svg class="cml-login__logo" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="18" stroke="#8ab4f8" stroke-width="1.6"/>
    <path d="M10 26 Q20 10 30 26" stroke="#8ab4f8" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="20" cy="20" r="3.5" fill="#8ab4f8"/>
  </svg>`;

  const errorHtml = error
    ? `<p class="cml-login__error" role="alert">${escapeHtml(error)}</p>`
    : '';

  const btnLabel = isLoading
    ? `<span class="cml-login__spinner"></span> Signing in…`
    : 'Sign in';

  return `
    <div class="cml-login-overlay" role="main" aria-label="Sign in">
      <div class="cml-login-card">
        <div class="cml-login__brand">
          ${logoSvg}
          <span class="cml-login__wordmark">SUNDOWNER</span>
        </div>
        <p class="cml-login__subtitle">Your private photo space</p>
        <form class="cml-login__form" data-form="login" method="post" action="">
          <label class="cml-login__field">
            <span class="cml-login__label">Username</span>
            <input
              class="cml-login__input"
              type="text"
              name="username"
              autocomplete="username"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              placeholder="admin"
              data-login="username"
              ${isLoading ? 'disabled' : ''}
            />
          </label>
          <label class="cml-login__field">
            <span class="cml-login__label">Password</span>
            <input
              class="cml-login__input"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••"
              data-login="password"
              ${isLoading ? 'disabled' : ''}
            />
          </label>
          ${errorHtml}
            <button
              class="cml-login__btn${isLoading ? ' is-loading' : ''}"
              type="button"
              data-action="submit-login"
              ${isLoading ? 'disabled' : ''}
            >${btnLabel}</button>
        </form>
      </div>
    </div>
  `;
}
