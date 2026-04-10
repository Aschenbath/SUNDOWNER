import { shouldDisplayMediaItem } from './media-support.js';

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
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v2.4M17 4.8v2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="4.8" y="6.8" width="14.4" height="12.4" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 10.2h14.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2s5-5.3 5-9a5 5 0 1 0-10 0c0 3.7 5 9 5 9Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="11.2" r="1.9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.8 7.2h12.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.4 4.8h5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.2 7.2v10.2a1.8 1.8 0 0 0 1.8 1.8h4a1.8 1.8 0 0 0 1.8-1.8V7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  restore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 1.8-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 6.2V12H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="0.9" fill="currentColor"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8M19.1 19.1l-1.8-1.8M6.7 6.7 4.9 4.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.6" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.4 19.2a6.6 6.6 0 0 1 13.2 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m7.5 15.5 3-3 2.2 2.2 3.8-4.2L19 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.8" cy="9" r="1.2" fill="currentColor"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.8h11l3 3v11.4A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.8v5.2h8V6.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 16h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v9.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m8.2 10.9 3.8 3.8 3.8-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 18.5h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
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

function renderAvatarVisual({ displayName = '', username = '', avatarData = '', large = false } = {}) {
  const initialSource = displayName || username || '?';
  const initial = escapeHtml(initialSource.charAt(0).toUpperCase() || '?');
  const className = large ? 'cml-avatar-visual cml-avatar-visual--large' : 'cml-avatar-visual';
  if (avatarData) {
    return `<span class="${className}"><img src="${escapeHtml(avatarData)}" alt="${escapeHtml(displayName || username || 'Admin')}" class="cml-avatar-visual__image"></span>`;
  }
  return `<span class="${className} cml-avatar-visual--fallback">${initial}</span>`;
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

function formatAdminDateTime(value) {
  if (!value) {
    return 'Not available';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(String(value));
  }
  return escapeHtml(date.toLocaleString());
}

function getMigrationStateMeta(migration) {
  switch (migration?.state) {
    case 'complete':
      return {
        label: 'Complete',
        tone: 'success',
        description: 'D1 is active and the migration marker is complete.'
      };
    case 'in_progress':
      return {
        label: 'In progress',
        tone: 'warning',
        description: 'Migration has started but still has pending cursor work.'
      };
    case 'disabled':
      return {
        label: 'Disabled',
        tone: 'muted',
        description: 'No D1 binding is available in the current environment.'
      };
    case 'not_started':
    default:
      return {
        label: 'Not started',
        tone: 'muted',
        description: 'D1 exists, but the KV to D1 migration marker has not been written yet.'
      };
  }
}

function getDatabaseModeLabel(database) {
  if (database?.usingHybrid) {
    return 'Hybrid KV + D1';
  }
  if (database?.usingD1) {
    return 'D1 only';
  }
  if (database?.usingKV) {
    return 'KV only';
  }
  return 'Unavailable';
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

function formatAlbumDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPreviewTypeLabel(item) {
  if (!item) {
    return 'Photo';
  }
  const mimeType = String(item.mimeType || '');
  return item.type === 'video'
    ? `Video${mimeType ? ` - ${mimeType}` : ''}`
    : `Photo${mimeType ? ` - ${mimeType}` : ''}`;
}

function formatPreviewSize(sizeMb) {
  const numeric = Math.max(0, Number(sizeMb) || 0);
  if (!numeric) {
    return '';
  }
  return formatStorageAmountFromMb(numeric);
}

function clampAspectRatio(value) {
  return Math.max(0.4, Math.min(2.4, value || 1));
}

function getLayoutConfig(containerWidth, denseGrid) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const isMobile = viewportWidth <= 640;
  const isTablet = viewportWidth <= 960;
  const gap = 2;
  const fallbackWidth = Math.max(280, viewportWidth - (isTablet ? 36 : 410));
  const availableWidth = Math.max(280, Math.floor(containerWidth || fallbackWidth));
  const rowHeightBase = denseGrid ? (isMobile ? 118 : viewportWidth <= 1180 ? 160 : 188) : (isMobile ? 132 : viewportWidth <= 1180 ? 180 : 212);
  return {
    availableWidth,
    gap,
    targetRowHeight: rowHeightBase,
    minRowHeight: denseGrid ? (isMobile ? 98 : 134) : (isMobile ? 110 : 148),
    maxRowHeight: denseGrid ? (isMobile ? 240 : isTablet ? 300 : 380) : (isMobile ? 240 : isTablet ? 300 : 380),
    maxItemsPerRow: isMobile ? 3 : denseGrid ? 6 : 5
  };
}

export function buildJustifiedRows(items, options = {}) {
  const { availableWidth, gap, targetRowHeight, minRowHeight, maxRowHeight, maxItemsPerRow } = getLayoutConfig(options.containerWidth, options.denseGrid);
  const rows = [];
  let currentRow = [];
  let aspectSum = 0;

  items.forEach((item, index) => {
    const aspectRatio = clampAspectRatio(item.width / item.height);
    currentRow.push({ item, aspectRatio });
    aspectSum += aspectRatio;

    const avgAspect = aspectSum / currentRow.length;
    const portraitHeavyRow = avgAspect < 0.72;
    const effectiveMaxItems = portraitHeavyRow
      ? Math.min(maxItemsPerRow, 3)
      : maxItemsPerRow;
    const effectiveMaxHeight = portraitHeavyRow
      ? Math.min(530, maxRowHeight * 1.4)
      : maxRowHeight;
    const sparseRowHeightCap = currentRow.length <= 1
      ? Math.min(effectiveMaxHeight, Math.round(Math.max(minRowHeight, targetRowHeight * 1.22)))
      : currentRow.length === 2
        ? Math.min(effectiveMaxHeight, Math.round(Math.max(minRowHeight + 18, targetRowHeight * 1.34)))
        : effectiveMaxHeight;
    const projectedWidth = aspectSum * targetRowHeight + gap * (currentRow.length - 1);
    const isLastItem = index === items.length - 1;
    const shouldFlush = projectedWidth >= availableWidth || currentRow.length >= effectiveMaxItems || isLastItem;

    if (!shouldFlush) {
      return;
    }

    const shouldFillWidth = projectedWidth >= availableWidth && currentRow.length > 1;
    const fittedHeight = shouldFillWidth
      ? (availableWidth - gap * (currentRow.length - 1)) / aspectSum
      : Math.min(sparseRowHeightCap, (availableWidth - gap * (currentRow.length - 1)) / aspectSum);
    const rowHeight = Math.max(minRowHeight, Math.min(sparseRowHeightCap, fittedHeight));

    rows.push({
      height: Math.round(rowHeight),
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

function renderMediaAsset(item, className, withControls = false, { noAction = false } = {}) {
  const sourceUrl = item.sourceUrl || item.thumbnailUrl;
  const imageUrl = withControls ? sourceUrl : (item.thumbnailUrl || sourceUrl);
  const mediaUrl = escapeHtml(item.type === 'video' ? sourceUrl : imageUrl);
  const alt = escapeHtml(item.label || item.album || 'Library item');
  const originalPhotoUrl = item.type === 'photo' && sourceUrl && sourceUrl !== imageUrl
    ? escapeHtml(sourceUrl)
    : '';
  const previewActionAttr = (withControls || noAction)
    ? ''
    : ` data-action="open-preview" data-id="${escapeHtml(item.id)}"`;
  if (item.type === 'photo' && item.browserPreviewSupported === false) {
    // HEIC/HEIF: prefer separate thumbnail (JPEG) when available
    const fallbackUrl = item.thumbnailUrl && item.thumbnailUrl !== item.sourceUrl
      ? item.thumbnailUrl
      : (item.posterUrl || '');
    const imgSrc = escapeHtml(fallbackUrl || (item.sourceUrl || ''));
    if (imgSrc) {
      // Try rendering — Safari supports HEIC natively; on failure, onerror
      // hides the broken img and reveals a CSS fallback label on the tile.
      const w = item.width > 0 ? ` width="${Math.round(item.width)}"` : '';
      const h = item.height > 0 ? ` height="${Math.round(item.height)}"` : '';
      const mimeTag = String(item.mimeType || 'image').replace(/^image\//i, '').toUpperCase();
      const errorHandler = `this.style.display='none';this.parentElement.classList.add('is-heic-fallback');this.parentElement.dataset.mimeTag='${escapeHtml(mimeTag)}'`;
      return `<img class="${className}" src="${imgSrc}" alt="${alt}" data-format-label="${escapeHtml(`${mimeTag} original`)}"${w}${h}${previewActionAttr} loading="eager" decoding="async" onerror="${escapeHtml(errorHandler)}" />`;
    }
  }
  if (item.type === 'video' && item.thumbnailUrl === sourceUrl) {
    return `<video class="${className}" src="${mediaUrl}"${previewActionAttr} ${withControls ? 'controls' : ''} muted playsinline preload="metadata"></video>`;
  }
  if (item.type === 'video' && withControls) {
    const poster = item.posterUrl ? ` poster="${escapeHtml(item.posterUrl)}"` : '';
    return `<video class="${className}" src="${mediaUrl}"${poster} controls playsinline preload="metadata"></video>`;
  }
  const w = item.width > 0 ? ` width="${Math.round(item.width)}"` : '';
  const h = item.height > 0 ? ` height="${Math.round(item.height)}"` : '';
  const fallbackAttr = originalPhotoUrl ? ` data-original-src="${originalPhotoUrl}"` : '';
  const genericErrorHandler = item.type === 'photo'
    ? `if(!this.dataset.retryOriginal&&this.dataset.originalSrc){this.dataset.retryOriginal='1';this.src=this.dataset.originalSrc;}`
    : '';
  const errorAttr = genericErrorHandler ? ` onerror="${escapeHtml(genericErrorHandler)}"` : '';
  return `<img class="${className}" src="${mediaUrl}" alt="${alt}"${w}${h}${fallbackAttr}${previewActionAttr} loading="eager" decoding="async"${errorAttr} />`;
}

function formatItemCount(count) {
  const numeric = Math.max(0, Number(count) || 0);
  return `${numeric} item${numeric === 1 ? '' : 's'}`;
}

export function StorageCard(storage, isActive = false) {
  const usedMb = Math.max(0, Number(storage?.usedMb) || 0);
  const totalCount = Math.max(0, Number(storage?.totalCount) || 0);
  const isLoading = Boolean(storage?.isLoading);
  const usedRatio = 0;
  const usageLine = isLoading
    ? 'Calculating... / INFINITE'
    : `${formatStorageAmountFromMb(usedMb)} / INFINITE`;
  return `
    <button type="button" class="cml-storage-strip ${isActive ? 'is-active' : ''}" data-action="open-storage-panel" aria-label="Storage usage" aria-pressed="${isActive}">
      <span class="cml-storage-strip__heading">
        ${icon('cloud')}
        <span>Storage</span>
      </span>
      <div class="cml-storage-strip__meter" aria-hidden="true"><span style="width:${usedRatio}%"></span></div>
      <p class="cml-storage-strip__text">${usageLine}</p>
      <p class="cml-storage-strip__meta">${formatItemCount(totalCount)}</p>
    </button>
  `;
}

export function Sidebar({
  navigationModel,
  state,
  storageSummary,
  searchQuery = '',
}) {
  const searchValue = escapeHtml(searchQuery || state.searchQuery || '');
  return `
    <aside class="cml-sidebar">
      <div class="cml-sidebar__brand">
        <img class="cml-sidebar__brand-logo" src="/logo-sundowner.svg?v=2" alt="SUNDOWNER" />
      </div>
      <label class="cml-sidebar__search" aria-label="Search">
        ${icon('search', 'cml-sidebar__search-icon')}
        <input type="search" class="cml-sidebar__search-input" placeholder="Search photos, type:video, loc:guangzhou" value="${searchValue}" />
      </label>
      <div class="cml-sidebar__nav" role="navigation" aria-label="Primary navigation">
        ${navigationModel.primary.map((label) => {
          const key = label.toLowerCase();
          const active = state.primaryFilter === label ? 'is-active' : '';
          const iconName = key === 'photos' ? 'photos' : key === 'bin' ? 'trash' : 'collections';
          return `
            <button type="button" class="cml-sidebar__nav-item ${active}" data-primary="${escapeHtml(label)}" aria-current="${state.primaryFilter === label ? 'page' : 'false'}">
              ${icon(iconName)}
              <span class="cml-sidebar__nav-label">${escapeHtml(label)}</span>
            </button>
          `;
        }).join('')}
      </div>
      ${navigationModel.secondary.length ? `
        <div class="cml-sidebar__section-label">collection</div>
        <div class="cml-sidebar__subnav">
          ${navigationModel.secondary.map((label) => {
            const active = state.secondaryFilter === label ? 'is-active' : '';
            return `
              <button type="button" class="cml-sidebar__subnav-item ${active}" data-secondary="${escapeHtml(label)}" aria-current="${state.secondaryFilter === label ? 'page' : 'false'}">
                <span class="cml-sidebar__subnav-arrow">&#9656;</span>
                ${icon(secondaryIconMap[label])}
                <span class="cml-sidebar__subnav-label">${escapeHtml(label)}</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}
      <div class="cml-sidebar__footer">
        ${StorageCard(storageSummary, Boolean(state.storagePanelOpen))}
        <div class="cml-sidebar__legal">privacy - terms of service</div>
      </div>
    </aside>
  `;
}

function AvatarButton({
  adminUsername = '',
  adminDisplayName = '',
  adminAvatarData = '',
  avatarMenuOpen = false
}) {
  const nameLabel = adminDisplayName || adminUsername || 'Admin';
  const menuHtml = avatarMenuOpen ? `
    <div class="cml-avatar-menu" role="menu">
      <div class="cml-avatar-menu__header">
        ${renderAvatarVisual({
          displayName: adminDisplayName,
          username: adminUsername,
          avatarData: adminAvatarData,
          large: true
        })}
        <div>
          <p class="cml-avatar-menu__name">${escapeHtml(nameLabel)}</p>
          <p class="cml-avatar-menu__meta">@${escapeHtml(adminUsername || 'admin')}</p>
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
        ${renderAvatarVisual({
          displayName: adminDisplayName,
          username: adminUsername,
          avatarData: adminAvatarData
        })}
      </button>
      ${menuHtml}
    </div>
  `;
}

export function TopSearchBar({ state, canDeleteSelection = false, canDownloadSelection = false, canSetAlbumCover = false }) {
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
            <button type="button" class="cml-topbar__secondary-button" data-action="download-selected" ${canDownloadSelection ? '' : 'disabled'}>${icon('download')}<span>Download</span></button>
            ${activeAlbumName && canSetAlbumCover ? `
              <button type="button" class="cml-topbar__secondary-button" data-action="set-album-cover">Set as cover</button>
            ` : ''}
            ${activeAlbumName ? `
              <button type="button" class="cml-topbar__secondary-button" data-action="remove-from-album">Remove from album</button>
            ` : ''}
            <button type="button" class="cml-topbar__secondary-button is-destructive" data-action="delete-selected" ${canDeleteSelection ? '' : 'disabled'}>${icon('trash')}<span>Delete</span></button>
          </div>
        </div>
      </header>
    `;
  }
  return `
    <header class="cml-topbar">
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
      ${AvatarButton({
        adminUsername: state.adminUsername,
        adminDisplayName: state.adminDisplayName,
        adminAvatarData: state.adminAvatarData,
        avatarMenuOpen: state.avatarMenuOpen
      })}
    </header>
  `;
}

export function MediaTile({ item, selected, layout, isCover = false }) {
  if (!shouldDisplayMediaItem(item)) {
    return '';
  }
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

export function renderMediaRows(rows, state, coverItemId = '') {
  return rows.map((row) => {
    const visibleItems = row.items.filter((layout) => shouldDisplayMediaItem(layout.item));
    if (!visibleItems.length) {
      return '';
    }
    return `
      <div class="cml-media-row">
        ${visibleItems.map((layout) => MediaTile({
          item: layout.item,
          layout,
          selected: state.selectedIds.has(layout.item.id),
          isCover: coverItemId && layout.item.id === coverItemId
        })).join('')}
      </div>
    `;
  }).join('');
}

export function MediaGrid({ rows, state, coverItemId = '', topSpacerHeight = 0, bottomSpacerHeight = 0 }) {
  return `
    <div class="cml-media-grid">
      ${topSpacerHeight > 0 ? `<div class="cml-media-grid__spacer" style="height:${Math.max(0, Math.round(topSpacerHeight))}px" aria-hidden="true"></div>` : ''}
      ${renderMediaRows(rows, state, coverItemId)}
      ${bottomSpacerHeight > 0 ? `<div class="cml-media-grid__spacer" style="height:${Math.max(0, Math.round(bottomSpacerHeight))}px" aria-hidden="true"></div>` : ''}
    </div>
  `;
}

export function MediaTimelineSection({ section, state, layoutWidth, coverItemId = '' }) {
  const isSectionSelected = section.items.length > 0 && section.items.every((item) => state.selectedIds.has(item.id));
  const isActiveSection = String(state.activeSectionAnchor || '') === String(section.anchorId || '');
  return `
    <section
      class="cml-timeline-section ${isActiveSection ? 'is-active' : ''}"
      id="${escapeHtml(section.anchorId)}"
      data-year="${escapeHtml(section.year)}"
      data-scrubber-label="${escapeHtml(section.scrubberLabel || section.year)}"
    >
      <header class="cml-timeline-section__header ${isActiveSection ? 'is-active' : ''}" aria-current="${isActiveSection ? 'true' : 'false'}">
        <button
          type="button"
          class="cml-timeline-section__select ${isSectionSelected ? 'is-active' : ''}"
          data-action="select-section"
          data-section="${escapeHtml(section.anchorId)}"
          aria-label="Select all in section"
          aria-pressed="${isSectionSelected ? 'true' : 'false'}"
        >${icon('check')}</button>
        <div class="cml-timeline-section__heading">
          <h2 class="cml-timeline-section__title">${escapeHtml(section.label)}</h2>
          ${section.metaLine ? `<span class="cml-timeline-section__meta">${escapeHtml(section.metaLine)}</span>` : ''}
        </div>
      </header>
      ${MediaGrid({
        rows: section.visibleRows || section.rows || [],
        state,
        coverItemId,
        topSpacerHeight: section.topSpacerHeight,
        bottomSpacerHeight: section.bottomSpacerHeight
      })}
    </section>
  `;
}

export function CollectionSummary({ activeAlbumName = '', collectionCount = 0, itemCount = 0, coverLabel = '', hasCustomCover = false }) {
  const hasActiveAlbum = Boolean(activeAlbumName);
  const title = hasActiveAlbum ? activeAlbumName : `${collectionCount} album${collectionCount === 1 ? '' : 's'}`;
  const copy = hasActiveAlbum
    ? `${itemCount} item${itemCount === 1 ? '' : 's'} in this album`
    : 'Collections now show album categories first. Open an album to browse its photos.';
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
      ${hasActiveAlbum ? `
        <div class="cml-view-summary__actions">
          <button type="button" class="cml-topbar__secondary-button" data-action="rename-album" data-album-name="${escapeHtml(activeAlbumName)}">${icon('settings')}<span>Rename</span></button>
          <button type="button" class="cml-topbar__secondary-button is-destructive" data-action="delete-album" data-album-name="${escapeHtml(activeAlbumName)}">${icon('trash')}<span>Delete album</span></button>
        </div>
      ` : ''}
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
              ? renderMediaAsset(collection.coverItem, 'cml-collection-card__image', false, { noAction: true })
              : `<span class="cml-collection-card__placeholder">${icon('albums')}</span>`}
            ${collection.hasCustomCover ? `<span class="cml-collection-card__cover-badge">Cover</span>` : ''}
            ${collection.coverItem?.type === 'video' ? `<span class="cml-collection-card__badge">${icon('play')}</span>` : ''}
          </span>
          <span class="cml-collection-card__body">
            <span class="cml-collection-card__eyebrow">Album</span>
            <strong class="cml-collection-card__title">${escapeHtml(collection.name)}</strong>
            <span class="cml-collection-card__meta">${collection.itemCount} item${collection.itemCount === 1 ? '' : 's'}</span>
            <span class="cml-collection-card__copy">${escapeHtml(formatAlbumDate(collection.createdAt || collection.lastModifiedAt) || 'Empty album')}</span>
          </span>
        </button>
      `).join('')}
    </section>
  `;
}

export function YearScroller({ scrubberSections, activeSectionAnchor, activeScrubberLabel }) {
  if (scrubberSections.length < 2) {
    return '';
  }
  return `
    <aside class="cml-scrubber" aria-label="Timeline navigation">
      <div class="cml-scrubber__track">
        <div class="cml-scrubber__badge" aria-hidden="true">${escapeHtml(activeScrubberLabel || scrubberSections[0].scrubberLabel || scrubberSections[0].year)}</div>
        ${scrubberSections.map((section, i) => {
          const pct = scrubberSections.length > 1 ? (i / (scrubberSections.length - 1)) * 100 : 0;
          const isActive = String(activeSectionAnchor) === String(section.anchorId);
          return `
            <div
              class="cml-scrubber__tick ${section.isYearBoundary ? 'has-year-label' : ''} ${isActive ? 'is-active' : ''}"
              style="top:${pct.toFixed(1)}%"
              data-anchor="${escapeHtml(section.anchorId)}"
              data-year="${escapeHtml(section.year)}"
              data-pct="${pct.toFixed(1)}"
              data-label="${escapeHtml(section.scrubberLabel || section.year)}"
            >
              ${section.isYearBoundary ? `<span class="cml-scrubber__year-label">${escapeHtml(section.year)}</span>` : ''}
              <button
                type="button"
                class="cml-scrubber__dot"
                data-anchor="${escapeHtml(section.anchorId)}"
                data-year="${escapeHtml(section.year)}"
                data-label="${escapeHtml(section.scrubberLabel || section.year)}"
                aria-label="Jump to ${escapeHtml(section.scrubberLabel || section.year)}"
              ></button>
            </div>
          `;
        }).join('')}
      </div>
    </aside>
  `;
}

function buildCameraRows(exif) {
  if (!exif) return [];
  const rows = [];
  const cam = exif.camera;
  if (cam) {
    const model = [cam.make, cam.model].filter(Boolean).join(' ');
    if (model) rows.push({ label: 'Camera', value: model });
    if (cam.lens) rows.push({ label: 'Lens', value: cam.lens });
  }
  const s = exif.shooting;
  if (s) {
    const parts = [];
    if (s.fNumber != null) parts.push(`\u0192/${s.fNumber}`);
    if (s.exposureTime) parts.push(`${s.exposureTime}s`);
    if (s.iso != null) parts.push(`ISO ${s.iso}`);
    if (s.focalLength != null) parts.push(`${s.focalLength}mm`);
    if (parts.length) rows.push({ label: 'Settings', value: parts.join('  ') });
  }
  return rows;
}

function normalizePreviewMetaText(value) {
  return String(value || '').trim();
}

function isDefaultPreviewAlbum(value) {
  const album = normalizePreviewMetaText(value).toLowerCase();
  if (!album) {
    return true;
  }
  return album === 'library'
    || album === 'telegram'
    || album.startsWith('telegram_')
    || album.startsWith('telegram-')
    || album === 'tg'
    || album.startsWith('tg_')
    || album.startsWith('tg-');
}

function getPreviewAlbumLabel(item) {
  const candidates = [
    normalizePreviewMetaText(item?.collectionAlbum),
    normalizePreviewMetaText(item?.album),
  ].filter(Boolean);
  return candidates.find((album) => !isDefaultPreviewAlbum(album)) || '';
}

function formatPreviewMegapixels(item) {
  const width = Number(item?.width) || 0;
  const height = Number(item?.height) || 0;
  if (!width || !height) {
    return '';
  }
  const mp = (width * height) / 1000000;
  if (!Number.isFinite(mp) || mp <= 0) {
    return '';
  }
  return `${mp >= 10 ? mp.toFixed(0) : mp.toFixed(1).replace(/\.0$/, '')} MP`;
}

function formatPreviewDateMeta(item) {
  const date = new Date(item?.takenAt || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] || '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const offsetMins = String(absMinutes % 60).padStart(2, '0');
  return [weekday, `${hh}:${mm}`, `GMT${sign}${offsetHours}:${offsetMins}`].filter(Boolean).join('  ');
}

function getMeaningfulPreviewTags(item) {
  const genericTags = new Set(['photo', 'video', 'image', 'jpeg', 'jpg', 'png']);
  return (item?.tags || [])
    .map((tag) => normalizePreviewMetaText(tag))
    .filter((tag) => tag && !genericTags.has(tag.toLowerCase()));
}

function renderPreviewInfoItem({ iconName, title, meta = '', titleClass = '' }) {
  if (!title) {
    return '';
  }
  return `
    <div class="cml-preview__info-item">
      <div class="cml-preview__info-item-icon" aria-hidden="true">${icon(iconName)}</div>
      <div class="cml-preview__info-item-copy">
        <p class="cml-preview__info-item-title ${titleClass}">${escapeHtml(title)}</p>
        ${meta ? `<p class="cml-preview__info-item-meta">${escapeHtml(meta)}</p>` : ''}
      </div>
    </div>
  `;
}

function formatAlbumItemCountLabel(count) {
  const total = Math.max(0, Number(count) || 0);
  if (!total) {
    return 'No items';
  }
  return `${total} item${total === 1 ? '' : 's'}`;
}

function renderAlbumDrawerCover(entry, { create = false } = {}) {
  if (create) {
    return `<span class="cml-preview__album-entry-thumb cml-preview__album-entry-thumb--create" aria-hidden="true">${icon('plus')}</span>`;
  }
  if (entry?.coverUrl) {
    return `<span class="cml-preview__album-entry-thumb"><img src="${escapeHtml(entry.coverUrl)}" alt="${escapeHtml(entry.name || 'Album')}" class="cml-preview__album-entry-image"></span>`;
  }
  return `<span class="cml-preview__album-entry-thumb cml-preview__album-entry-thumb--placeholder" aria-hidden="true"></span>`;
}

export function PreviewModal({
  item,
  selected,
  favorited,
  currentIndex,
  totalCount,
  infoOpen = false,
  immersive = false,
  albumDrawerOpen = false,
  albumEntries = [],
  albumDraftName = '',
  albumDialogError = '',
  albumDrawerSearch = '',
  albumDrawerCreateMode = false
}) {
  if (!item) {
    return '';
  }
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < Math.max(0, totalCount - 1);
  const albumLabel = getPreviewAlbumLabel(item);
  const meaningfulTags = getMeaningfulPreviewTags(item);
  const cameraRows = buildCameraRows(item.exif);
  const canDownload = Boolean(item.sourceId);
  const fileMeta = [
    formatPreviewMegapixels(item),
    item.width && item.height ? `${item.width} x ${item.height}` : '',
  ].filter(Boolean).join('  ');
  const backupMeta = item.sizeMb ? `Original quality - ${formatPreviewSize(item.sizeMb)}` : 'Original quality';
  const detailItems = [
    renderPreviewInfoItem({
      iconName: 'calendar',
      title: item.displayTakenAt || formatTakenAt(item),
      meta: formatPreviewDateMeta(item),
      titleClass: 'is-prominent'
    }),
    renderPreviewInfoItem({
      iconName: 'image',
      title: item.label || 'Library item',
      meta: fileMeta
    }),
    renderPreviewInfoItem({
      iconName: 'cloud',
      title: item.sizeMb ? `Backed up (${formatPreviewSize(item.sizeMb)})` : 'Backed up',
      meta: backupMeta
    }),
    item.location ? renderPreviewInfoItem({
      iconName: 'pin',
      title: item.location
    }) : '',
    albumLabel ? renderPreviewInfoItem({
      iconName: 'albums',
      title: albumLabel
    }) : '',
  ].filter(Boolean).join('');

  const infoPanel = `
    <aside class="cml-preview__info ${infoOpen ? 'is-open' : ''}" aria-label="Photo details" aria-hidden="${infoOpen ? 'false' : 'true'}">
      <div class="cml-preview__info-inner">
        <div class="cml-preview__info-toolbar">
          <button type="button" class="cml-preview__info-close" data-action="toggle-info" aria-label="Close details">${icon('close')}</button>
          <h4 class="cml-preview__info-toolbar-title">Info</h4>
        </div>
        <section class="cml-preview__info-section cml-preview__info-section--description">
          <p class="cml-preview__info-description">Add a description</p>
        </section>
        ${item.personLabels && item.personLabels.length ? `
          <section class="cml-preview__info-section">
            <h5 class="cml-preview__info-heading">People</h5>
            <div class="cml-preview__info-row">
              <div class="cml-preview__info-row-copy">
                <p class="cml-preview__info-row-title">${escapeHtml(item.personLabels.join(', '))}</p>
              </div>
            </div>
          </section>
        ` : ''}
        <section class="cml-preview__info-section">
          <h5 class="cml-preview__info-heading">Details</h5>
          <div class="cml-preview__info-list">
            ${detailItems}
          </div>
        </section>
        ${cameraRows.length ? `
          <section class="cml-preview__info-section cml-preview__info-section--camera">
            <h5 class="cml-preview__info-heading">Camera</h5>
            <dl class="cml-preview__info-meta">
              ${cameraRows.map((row) => `
                <dt class="cml-preview__info-label">${escapeHtml(row.label)}</dt>
                <dd class="cml-preview__info-value ${row.label === 'Settings' ? 'cml-preview__info-value--settings' : ''}">${escapeHtml(row.value)}</dd>
              `).join('')}
            </dl>
          </section>
        ` : ''}
        ${meaningfulTags.length ? `
          <section class="cml-preview__info-section">
            <h5 class="cml-preview__info-heading">Tags</h5>
            <div class="cml-preview__info-tags">
              ${meaningfulTags.map((tag) => `<span class="cml-preview__info-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
          </section>
        ` : ''}
      </div>
    </aside>
  `;

  const normalizedAlbumSearch = String(albumDrawerSearch || '').trim().toLowerCase();
  const visibleAlbumEntries = albumEntries
    .filter((entry) => !normalizedAlbumSearch || String(entry.name || '').toLowerCase().includes(normalizedAlbumSearch));

  const albumPanel = `
    <div class="cml-preview__album-panel ${albumDrawerOpen ? 'is-open' : ''}" aria-label="Add to album" aria-hidden="${albumDrawerOpen ? 'false' : 'true'}">
      <div class="cml-preview__album-backdrop" data-action="close-album-dialog"></div>
      <section class="cml-preview__album-sheet">
        <div class="cml-preview__album-toolbar">
          <h4 class="cml-preview__album-title">Add to album</h4>
          <button type="button" class="cml-preview__info-close" data-action="close-album-dialog" aria-label="Close album picker">${icon('close')}</button>
        </div>
        <div class="cml-preview__album-search">
          <span class="cml-preview__album-search-icon" aria-hidden="true">${icon('search')}</span>
          <input
            type="text"
            class="cml-preview__album-search-input"
            data-focus-key="album-search"
            value="${escapeHtml(albumDrawerSearch || '')}"
            placeholder="Search albums"
            autocomplete="off"
          />
        </div>
        <div class="cml-preview__album-sort-row">
          <span class="cml-preview__album-sort-icon" aria-hidden="true">${icon('updates')}</span>
          <span>Last modified</span>
        </div>
        <div class="cml-preview__album-list">
          ${albumDrawerCreateMode ? `
            <section class="cml-preview__album-create-card">
              <label class="cml-album-dialog__field">
                <span class="cml-album-dialog__label">New album name</span>
                <input
                  type="text"
                  class="cml-album-dialog__input cml-preview__album-create-input"
                  data-focus-key="album-create"
                  value="${escapeHtml(albumDraftName || '')}"
                  placeholder="Weekend in Guangzhou"
                  maxlength="64"
                  autocomplete="off"
                />
              </label>
              ${albumDialogError ? `<p class="cml-album-dialog__error">${escapeHtml(albumDialogError)}</p>` : ''}
              <div class="cml-preview__album-create-actions">
                <button type="button" class="cml-topbar__secondary-button" data-action="cancel-album-create">Cancel</button>
                <button type="button" class="cml-topbar__upload-button" data-action="submit-album-dialog">Create and add</button>
              </div>
            </section>
          ` : `
            <button type="button" class="cml-preview__album-entry cml-preview__album-entry--create" data-action="toggle-album-create">
              ${renderAlbumDrawerCover(null, { create: true })}
              <span class="cml-preview__album-entry-copy">
                <span class="cml-preview__album-entry-title">New album</span>
              </span>
            </button>
          `}
          ${visibleAlbumEntries.length ? visibleAlbumEntries.map((entry) => `
            <button type="button" class="cml-preview__album-entry" data-action="assign-album" data-album-name="${escapeHtml(entry.name)}">
              ${renderAlbumDrawerCover(entry)}
              <span class="cml-preview__album-entry-copy">
                <span class="cml-preview__album-entry-title">${escapeHtml(entry.name)}</span>
                <span class="cml-preview__album-entry-meta">${escapeHtml(formatAlbumItemCountLabel(entry.itemCount))}</span>
              </span>
            </button>
          `).join('') : `
            <div class="cml-preview__album-empty">
              ${normalizedAlbumSearch ? 'No albums match this search.' : 'No albums are available yet.'}
            </div>
          `}
        </div>
      </section>
    </div>
  `;

  return `
    <div class="cml-preview ${infoOpen ? 'has-info' : ''} ${albumDrawerOpen ? 'has-album' : ''} ${immersive ? 'is-immersive' : ''}" role="dialog" aria-modal="true" data-preview-id="${escapeHtml(item.id)}">
      <div class="cml-preview__backdrop" data-action="close-preview"></div>
      <div class="cml-preview__panel">
        <div class="cml-preview__main">
          <header class="cml-preview__header">
            <div class="cml-preview__header-actions">
              <button type="button" class="cml-preview__icon-action ${albumDrawerOpen ? 'is-selected' : ''}" data-action="open-preview-add-to-album" data-id="${escapeHtml(item.id)}" aria-label="Add to album" aria-pressed="${albumDrawerOpen ? 'true' : 'false'}">${icon('plus')}</button>
              <button type="button" class="cml-preview__icon-action ${favorited ? 'is-favorited' : ''}" data-action="toggle-favorite" data-id="${escapeHtml(item.id)}" aria-label="${favorited ? 'Remove from favourites' : 'Add to favourites'}">${icon('star')}</button>
              <button type="button" class="cml-preview__icon-action is-destructive" data-action="request-delete-preview" data-id="${escapeHtml(item.id)}" aria-label="Delete">${icon('trash')}</button>
              <button type="button" class="cml-preview__icon-action ${infoOpen ? 'is-selected' : ''}" data-action="toggle-info" aria-label="${infoOpen ? 'Hide details' : 'Show details'}" aria-pressed="${infoOpen ? 'true' : 'false'}">${icon('info')}</button>
              <button type="button" class="cml-preview__close" data-action="close-preview" aria-label="Close preview">${icon('close')}</button>
            </div>
          </header>
          <div class="cml-preview__body">
            <button type="button" class="cml-preview__nav is-prev" data-action="preview-previous" aria-label="Previous item" ${canGoPrevious ? '' : 'disabled aria-disabled="true"'}>${icon('previous')}</button>
            <figure class="cml-preview__figure">
              <div class="cml-preview__stage">
                ${renderMediaAsset(item, 'cml-preview__media', true)}
              </div>
            </figure>
            <button type="button" class="cml-preview__nav is-next" data-action="preview-next" aria-label="Next item" ${canGoNext ? '' : 'disabled aria-disabled="true"'}>${icon('next')}</button>
          </div>
          <footer class="cml-preview__footer">
            <div class="cml-preview__footer-meta">
              <span class="cml-preview__footer-primary">${currentIndex + 1} / ${totalCount}</span>
              <span class="cml-preview__footer-secondary">${escapeHtml(item.label || item.location || 'Library item')}</span>
            </div>
            <div class="cml-preview__footer-actions">
              <button type="button" class="cml-preview__footer-action" data-action="download-preview" data-id="${escapeHtml(item.id)}" ${canDownload ? '' : 'disabled'}>${icon('download')}<span>Download original</span></button>
            </div>
          </footer>
        </div>
        ${infoPanel}
        ${albumPanel}
      </div>
    </div>
  `;
}
export function AlbumDialog({ state, albums }) {
  if (!state.albumDialogOpen || state.albumDialogOrigin === 'preview') {
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

export function RenameAlbumDialog({ state }) {
  if (!state.renameAlbumDialogOpen) {
    return '';
  }
  return `
    <div class="cml-dialog" role="dialog" aria-modal="true" aria-label="Rename album">
      <div class="cml-dialog__backdrop" data-action="close-rename-album-dialog"></div>
      <div class="cml-dialog__panel cml-album-dialog">
        <header class="cml-dialog__header">
          <div>
            <h3 class="cml-dialog__title">Rename album</h3>
            <p class="cml-dialog__copy">Enter a new name for "${escapeHtml(state.renameAlbumTarget)}".</p>
          </div>
          <button type="button" class="cml-dialog__close" data-action="close-rename-album-dialog" aria-label="Close dialog">${icon('close')}</button>
        </header>
        <div class="cml-album-dialog__section">
          <label class="cml-album-dialog__field">
            <span class="cml-album-dialog__label">Album name</span>
            <input type="text" class="cml-album-dialog__input" data-rename-album-input value="${escapeHtml(state.renameAlbumDraftName || '')}" placeholder="New album name" maxlength="64" />
          </label>
          ${state.renameAlbumError ? `<p class="cml-album-dialog__error">${escapeHtml(state.renameAlbumError)}</p>` : ''}
        </div>
        <footer class="cml-dialog__footer">
          <button type="button" class="cml-topbar__secondary-button" data-action="close-rename-album-dialog">Cancel</button>
          <button type="button" class="cml-topbar__upload-button" data-action="submit-rename-album" ${state.renameAlbumBusy ? 'disabled' : ''}>${state.renameAlbumBusy ? 'Renaming...' : 'Rename'}</button>
        </footer>
      </div>
    </div>
  `;
}

export function ConfirmDialog({ state }) {
  if (!state.confirmDialogOpen) {
    return '';
  }

  const isDestructive = ['delete', 'delete-permanently', 'delete-bin-permanently', 'empty-bin', 'delete-album'].includes(state.confirmDialogMode);
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
            ${state.confirmDialogBusy ? 'Working...' : escapeHtml(state.confirmDialogConfirmLabel || 'Confirm')}
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

export function SearchSummary({ query, resultCount, filterParts = [], hasActiveFilters = false }) {
  if (!query && !hasActiveFilters) {
    return '';
  }
  return `
    <section class="cml-search-summary">
      <p class="cml-search-summary__eyebrow">Search results</p>
      <div class="cml-search-summary__head">
        <h2 class="cml-search-summary__title">${resultCount} match${resultCount === 1 ? '' : 'es'}${query ? ` for \"${escapeHtml(query)}\"` : ''}</h2>
        <button type="button" class="cml-search-summary__clear" data-action="clear-search-filters">Reset</button>
      </div>
      ${filterParts.length ? `
        <div class="cml-search-summary__tags">
          ${filterParts.map((part) => `<span class="cml-search-summary__tag">${escapeHtml(part)}</span>`).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function BinMediaTile({ item, selected, layout }) {
  const urgency = item.daysLeft <= 7 ? 'is-urgent' : item.daysLeft <= 14 ? 'is-warning' : '';
  const daysLabel = item.daysLeft === 1 ? '1 day left' : `${item.daysLeft} days left`;
  const style = `width:${layout.width}px;height:${layout.height}px;`;
  return `
    <article class="cml-media-tile cml-bin-media-tile ${selected ? 'is-selected' : ''}" data-tile-id="${escapeHtml(item.id)}" style="${style}" aria-label="${escapeHtml(item.label)}">
      <button type="button" class="cml-media-tile__select" data-action="toggle-bin-select" data-bin-id="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.label)}">
        ${selected ? icon('check') : '<span class="cml-media-tile__select-ring"></span>'}
      </button>
      ${renderMediaAsset(item, 'cml-media-tile__image')}
      <div class="cml-media-tile__scrim"></div>
      ${item.type === 'video' ? `<span class="cml-media-tile__video-badge" aria-hidden="true">${icon('play')}</span>` : ''}
      <div class="cml-bin-media-tile__meta">
        <span class="cml-bin-media-tile__name" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
        <span class="cml-bin-media-tile__expiry ${urgency}">${escapeHtml(daysLabel)}</span>
      </div>
    </article>
  `;
}

function BinTimelineSection({ section, binSelectedIds, layoutWidth }) {
  const isSectionSelected = section.items.length > 0 && section.items.every((item) => binSelectedIds.has(item.id));
  const isActiveSection = String(section.anchorId || '') === String(section.activeAnchorId || '');
  return `
    <section
      class="cml-timeline-section cml-timeline-section--bin ${isActiveSection ? 'is-active' : ''}"
      id="${escapeHtml(section.anchorId)}"
      data-year="${escapeHtml(section.year)}"
      data-scrubber-label="${escapeHtml(section.scrubberLabel || section.year)}"
    >
      <header class="cml-timeline-section__header cml-timeline-section__header--bin ${isActiveSection ? 'is-active' : ''}" aria-current="${isActiveSection ? 'true' : 'false'}">
        <button
          type="button"
          class="cml-timeline-section__select ${isSectionSelected ? 'is-active' : ''}"
          data-action="select-bin-section"
          data-section="${escapeHtml(section.anchorId)}"
          aria-label="Select all in section"
          aria-pressed="${isSectionSelected ? 'true' : 'false'}"
        >${icon('check')}</button>
        <div class="cml-timeline-section__heading">
          <h2 class="cml-timeline-section__title">${escapeHtml(section.label)}</h2>
          ${section.metaLine ? `<span class="cml-timeline-section__meta">${escapeHtml(section.metaLine)}</span>` : ''}
        </div>
      </header>
      <div class="cml-bin-grid">
        ${section.topSpacerHeight > 0 ? `<div class="cml-media-grid__spacer" style="height:${Math.max(0, Math.round(section.topSpacerHeight))}px" aria-hidden="true"></div>` : ''}
        ${(section.visibleRows || section.rows || []).map((row) => `
          <div class="cml-media-row">
            ${row.items.map((layout) => BinMediaTile({
              item: layout.item,
              selected: binSelectedIds.has(layout.item.id),
              layout
            })).join('')}
          </div>
        `).join('')}
        ${section.bottomSpacerHeight > 0 ? `<div class="cml-media-grid__spacer" style="height:${Math.max(0, Math.round(section.bottomSpacerHeight))}px" aria-hidden="true"></div>` : ''}
      </div>
    </section>
  `;
}

export function BinGrid({ items, sections, binSelectedIds, isBinLoading, layoutWidth, activeSectionAnchor = '' }) {
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
    ? `<div class="cml-bin-loading"><span class="cml-bin-loading__text">Loading bin...</span></div>`
    : !hasItems
      ? `
        <section class="cml-empty-state">
          <div class="cml-empty-state__icon">${icon('trash')}</div>
          <h2 class="cml-empty-state__title">Bin is empty</h2>
          <p class="cml-empty-state__copy">Items you delete will appear here for up to 45 days before permanent removal.</p>
        </section>
      `
      : `
        <div class="cml-bin-timeline">
          ${sections.map((section) => BinTimelineSection({
            section: { ...section, activeAnchorId: activeSectionAnchor },
            binSelectedIds,
            layoutWidth
          })).join('')}
        </div>
      `;

  return `
    <div class="cml-bin-view">
      <header class="cml-bin-view__header">
        <div class="cml-bin-view__meta cml-view-summary">
          <p class="cml-view-summary__eyebrow">Recycle bin</p>
          ${selectedCount > 0
            ? `<h2 class="cml-view-summary__title">${selectedCount} selected</h2><p class="cml-view-summary__copy">Restore or permanently delete the selected items.</p>`
            : hasItems
              ? `<h2 class="cml-view-summary__title">${items.length} item${items.length === 1 ? '' : 's'} in bin</h2><p class="cml-view-summary__copy">Deleted items stay here for up to 45 days before permanent removal.</p>`
              : ''}
        </div>
        <div class="cml-bin-view__actions">${headerActions}</div>
      </header>
      ${gridContent}
    </div>
  `;
}

export function LoginOverlay({ error = '', isLoading = false } = {}) {
  const errorHtml = error
    ? `<p class="cml-login__error" role="alert">${escapeHtml(error)}</p>`
    : '';

  const btnLabel = isLoading
    ? '<span class="cml-login__spinner"></span> Signing in...'
    : 'Sign in';

  return `
    <div class="cml-login-overlay" role="main" aria-label="Sign in">
      <div class="cml-login-card">
        <div class="cml-login__brand">
          <img class="cml-login__logo" src="/logo-sundowner.svg?v=2" alt="SUNDOWNER" />
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
              placeholder="********"
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

export function AdminPanel({ state, storageSummary }) {
  if (!state.adminPanelOpen) {
    return '';
  }

  const activeTab = state.adminPanelTab || 'account';
  const tabs = [
    { id: 'account', label: 'Account', iconName: 'user' },
    { id: 'site', label: 'Site', iconName: 'settings' },
    { id: 'cloud', label: 'Cloud', iconName: 'cloud' },
    { id: 'telegram', label: 'Telegram', iconName: 'updates' }
  ];
  const usedMb = Math.max(0, Number(storageSummary?.usedMb) || 0);
  const totalCount = Math.max(0, Number(storageSummary?.totalCount) || 0);
  const quotaLabel = storageSummary?.totalQuotaGb ? formatStorageAmountFromGb(storageSummary.totalQuotaGb) : 'Unmetered';
  const statusHtml = state.adminPanelError
    ? `<p class="cml-admin-panel__status is-error">${escapeHtml(state.adminPanelError)}</p>`
    : '';
  const migrationSummary = state.adminMigrationStatus?.migration || null;
  const migrationDatabase = state.adminMigrationStatus?.database || null;
  const migrationStateMeta = getMigrationStateMeta(migrationSummary);
  const migrationCursorLabel = migrationSummary?.nextCursor || 'None';
  const orphanScanResult = state.adminOrphanScanResult;
  const orphanFiles = Array.isArray(orphanScanResult?.files) ? orphanScanResult.files : [];
  const orphanScanSummary = orphanScanResult
    ? `Showing ${escapeHtml(String(orphanScanResult.returned || orphanFiles.length || 0))} of ${escapeHtml(String(orphanScanResult.total || 0))}${orphanScanResult.truncated ? ' candidates' : ' candidates'}`
    : '';

  const accountBody = `
    <section class="cml-admin-panel__section">
      <div class="cml-admin-panel__hero">
        <div class="cml-admin-panel__avatar-stage">
          ${renderAvatarVisual({
            displayName: state.adminProfileDraft.displayName,
            username: state.adminProfileDraft.username,
            avatarData: state.adminProfileDraft.avatarData,
            large: true
          })}
          <div class="cml-admin-panel__avatar-actions">
            <button type="button" class="cml-admin-panel__secondary" data-action="trigger-admin-avatar-upload">${icon('image')}<span>Upload avatar</span></button>
            <button type="button" class="cml-admin-panel__ghost" data-action="remove-admin-avatar" ${state.adminProfileDraft.avatarData ? '' : 'disabled'}>Remove</button>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="cml-admin-panel__avatar-input" data-admin-avatar-input hidden>
        </div>
        <div class="cml-admin-panel__hero-copy">
          <p class="cml-admin-panel__eyebrow">Profile</p>
          <h3 class="cml-admin-panel__section-title">${escapeHtml(state.adminDisplayName || state.adminUsername || 'Administrator')}</h3>
          <p class="cml-admin-panel__copy">Update the admin avatar, display name, sign-in username, and password from the media-library shell.</p>
        </div>
      </div>
      <div class="cml-admin-panel__form-grid">
        <label class="cml-admin-panel__field">
          <span>Display name</span>
          <input type="text" value="${escapeHtml(state.adminProfileDraft.displayName)}" data-admin-section="account" data-admin-field="displayName" class="cml-admin-panel__input" placeholder="SUNDOWNER Admin">
        </label>
        <label class="cml-admin-panel__field">
          <span>Username</span>
          <input type="text" value="${escapeHtml(state.adminProfileDraft.username)}" data-admin-section="account" data-admin-field="username" class="cml-admin-panel__input" placeholder="admin">
        </label>
        <label class="cml-admin-panel__field">
          <span>Current password</span>
          <input type="password" value="${escapeHtml(state.adminProfileDraft.currentPassword)}" data-admin-section="account" data-admin-field="currentPassword" class="cml-admin-panel__input" placeholder="Required for username or password changes">
        </label>
        <label class="cml-admin-panel__field">
          <span>New password</span>
          <input type="password" value="${escapeHtml(state.adminProfileDraft.newPassword)}" data-admin-section="account" data-admin-field="newPassword" class="cml-admin-panel__input" placeholder="Leave blank to keep current password">
        </label>
        <label class="cml-admin-panel__field cml-admin-panel__field--wide">
          <span>Confirm new password</span>
          <input type="password" value="${escapeHtml(state.adminProfileDraft.confirmPassword)}" data-admin-section="account" data-admin-field="confirmPassword" class="cml-admin-panel__input" placeholder="Repeat the new password">
        </label>
      </div>
      ${statusHtml}
      <div class="cml-admin-panel__section-footer">
        <div class="cml-admin-panel__footer-actions">
          <button type="button" class="cml-admin-panel__primary" data-action="save-admin-account" ${state.adminPanelBusy ? 'disabled' : ''}>${icon('save')}<span>${state.adminPanelBusy ? 'Saving...' : 'Save account'}</span></button>
        </div>
      </div>
    </section>
  `;

  const siteBody = `
    <section class="cml-admin-panel__section">
      <div class="cml-admin-panel__hero-copy cml-admin-panel__hero-copy--compact">
        <p class="cml-admin-panel__eyebrow">Site</p>
        <h3 class="cml-admin-panel__section-title">Brand and entry surfaces</h3>
        <p class="cml-admin-panel__copy">These fields map to the existing page config and control the public identity of this cloud space.</p>
      </div>
      <div class="cml-admin-panel__form-grid">
        <label class="cml-admin-panel__field">
          <span>Site title</span>
          <input type="text" value="${escapeHtml(state.adminPageDraft.siteTitle)}" data-admin-section="site" data-admin-field="siteTitle" class="cml-admin-panel__input" placeholder="SUNDOWNER">
        </label>
        <label class="cml-admin-panel__field">
          <span>Owner name</span>
          <input type="text" value="${escapeHtml(state.adminPageDraft.ownerName)}" data-admin-section="site" data-admin-field="ownerName" class="cml-admin-panel__input" placeholder="SUNDOWNER">
        </label>
        <label class="cml-admin-panel__field cml-admin-panel__field--wide">
          <span>Logo URL</span>
          <input type="url" value="${escapeHtml(state.adminPageDraft.logoUrl)}" data-admin-section="site" data-admin-field="logoUrl" class="cml-admin-panel__input" placeholder="https://example.com/logo.svg">
        </label>
        <label class="cml-admin-panel__field cml-admin-panel__field--wide">
          <span>Announcement</span>
          <textarea data-admin-section="site" data-admin-field="announcement" class="cml-admin-panel__textarea" placeholder="Short notice shown on the entry surface">${escapeHtml(state.adminPageDraft.announcement)}</textarea>
        </label>
        <label class="cml-admin-panel__field">
          <span>Admin background</span>
          <input type="text" value="${escapeHtml(state.adminPageDraft.adminBkImg)}" data-admin-section="site" data-admin-field="adminBkImg" class="cml-admin-panel__input" placeholder='["https://..."] or bing'>
        </label>
        <label class="cml-admin-panel__field">
          <span>Admin login background</span>
          <input type="text" value="${escapeHtml(state.adminPageDraft.adminLoginBkImg)}" data-admin-section="site" data-admin-field="adminLoginBkImg" class="cml-admin-panel__input" placeholder='["https://..."] or bing'>
        </label>
      </div>
      ${statusHtml}
      <div class="cml-admin-panel__section-footer">
        <div class="cml-admin-panel__footer-actions">
          <button type="button" class="cml-admin-panel__primary" data-action="save-admin-site" ${state.adminPanelBusy ? 'disabled' : ''}>${icon('save')}<span>${state.adminPanelBusy ? 'Saving...' : 'Save site settings'}</span></button>
        </div>
      </div>
    </section>
  `;

  const cloudBody = `
    <section class="cml-admin-panel__section">
      <div class="cml-admin-panel__hero-copy cml-admin-panel__hero-copy--compact">
        <p class="cml-admin-panel__eyebrow">Cloud operations</p>
        <h3 class="cml-admin-panel__section-title">Service controls</h3>
        <p class="cml-admin-panel__copy">Review current usage and tune the public access surfaces exposed by this cloud disk.</p>
        <button type="button" class="cml-admin-panel__inline-link" data-action="open-native-dashboard">Open original dashboard</button>
      </div>
      <div class="cml-admin-panel__stats">
        <article class="cml-admin-panel__stat-card">
          <span class="cml-admin-panel__stat-label">Stored media</span>
          <strong class="cml-admin-panel__stat-value">${escapeHtml(formatStorageAmountFromMb(usedMb))}</strong>
          <span class="cml-admin-panel__stat-meta">Quota ${escapeHtml(quotaLabel)}</span>
        </article>
        <article class="cml-admin-panel__stat-card">
          <span class="cml-admin-panel__stat-label">Indexed files</span>
          <strong class="cml-admin-panel__stat-value">${escapeHtml(String(totalCount))}</strong>
          <span class="cml-admin-panel__stat-meta">Live media-library count</span>
        </article>
      </div>
      <div class="cml-admin-panel__stack">
        <section class="cml-admin-panel__subsection">
          <div class="cml-admin-panel__subheader">
            <div>
              <p class="cml-admin-panel__eyebrow">Migration</p>
              <h4 class="cml-admin-panel__subheading">KV to D1 rollout</h4>
              <p class="cml-admin-panel__copy">This status comes from the new migration endpoints, so you can see whether production is still on KV fallback or has completed the D1 switch.</p>
            </div>
            <div class="cml-admin-panel__subactions">
              <button type="button" class="cml-admin-panel__inline-link" data-action="refresh-admin-migration-status" ${state.adminMigrationLoading ? 'disabled' : ''}>${state.adminMigrationLoading ? 'Refreshing...' : 'Refresh status'}</button>
            </div>
          </div>
          ${state.adminMigrationError ? `<p class="cml-admin-panel__status is-error">${escapeHtml(state.adminMigrationError)}</p>` : ''}
          <div class="cml-admin-panel__migration-grid">
            <article class="cml-admin-panel__migration-card">
              <span class="cml-admin-panel__migration-label">Rollout state</span>
              <strong class="cml-admin-panel__migration-value">${escapeHtml(migrationStateMeta.label)}</strong>
              <span class="cml-admin-panel__migration-pill is-${escapeHtml(migrationStateMeta.tone)}">${escapeHtml(migrationStateMeta.description)}</span>
            </article>
            <article class="cml-admin-panel__migration-card">
              <span class="cml-admin-panel__migration-label">Database mode</span>
              <strong class="cml-admin-panel__migration-value">${escapeHtml(getDatabaseModeLabel(migrationDatabase))}</strong>
              <span class="cml-admin-panel__migration-meta">Bindings: KV ${migrationDatabase?.hasKV ? 'on' : 'off'} · D1 ${migrationDatabase?.hasD1 ? 'on' : 'off'}</span>
            </article>
            <article class="cml-admin-panel__migration-card">
              <span class="cml-admin-panel__migration-label">Next cursor</span>
              <strong class="cml-admin-panel__migration-value">${escapeHtml(migrationCursorLabel)}</strong>
              <span class="cml-admin-panel__migration-meta">Last updated ${formatAdminDateTime(migrationSummary?.updatedAt)}</span>
            </article>
          </div>
        </section>
        <section class="cml-admin-panel__subsection">
          <div class="cml-admin-panel__subheader">
            <div>
              <p class="cml-admin-panel__eyebrow">Recovery</p>
              <h4 class="cml-admin-panel__subheading">Telegram orphan scan</h4>
              <p class="cml-admin-panel__copy">Run the read-only scan for timestamp-style Telegram records that still lack both <code>TgFileId</code> and <code>TgMessageId</code>.</p>
            </div>
            <div class="cml-admin-panel__subactions">
              <button type="button" class="cml-admin-panel__inline-link" data-action="scan-admin-orphan-files" ${state.adminOrphanScanLoading ? 'disabled' : ''}>${state.adminOrphanScanLoading ? 'Scanning...' : 'Run orphan scan'}</button>
            </div>
          </div>
          ${state.adminOrphanScanError ? `<p class="cml-admin-panel__status is-error">${escapeHtml(state.adminOrphanScanError)}</p>` : ''}
          ${orphanScanResult ? `
            <div class="cml-admin-panel__scan-summary">
              <strong>${orphanScanSummary}</strong>
              <span>${escapeHtml(orphanScanResult.truncated ? 'The API truncated the result set. Re-run with filters or a higher limit if you need the full tail.' : 'The current result reflects the full candidate set returned by the endpoint.')}</span>
            </div>
            ${orphanFiles.length ? `
              <div class="cml-admin-panel__scan-list">
                ${orphanFiles.map((file) => `
                  <article class="cml-admin-panel__scan-item">
                    <strong class="cml-admin-panel__scan-id">${escapeHtml(file.id || '')}</strong>
                    <span class="cml-admin-panel__scan-meta">${escapeHtml(file.channelName || file.channel || 'Telegram')} · ${escapeHtml(file.directory || '/')}</span>
                    <span class="cml-admin-panel__scan-meta">${escapeHtml(file.reason || 'Missing Telegram recovery metadata')}</span>
                  </article>
                `).join('')}
              </div>
            ` : `
              <p class="cml-admin-panel__scan-empty">No orphan Telegram records matched the current scan.</p>
            `}
          ` : `
            <p class="cml-admin-panel__scan-empty">No scan has been run in this browser session yet.</p>
          `}
        </section>
      </div>
      <div class="cml-admin-panel__form-grid">
        <label class="cml-admin-panel__toggle">
          <input type="checkbox" ${state.adminCloudDraft.publicBrowseEnabled ? 'checked' : ''} data-admin-section="cloud" data-admin-field="publicBrowseEnabled">
          <span>Enable public browse</span>
        </label>
        <label class="cml-admin-panel__field">
          <span>Public browse directory</span>
          <input type="text" value="${escapeHtml(state.adminCloudDraft.publicBrowseAllowedDir)}" data-admin-section="cloud" data-admin-field="publicBrowseAllowedDir" class="cml-admin-panel__input" placeholder="/albums/public">
        </label>
        <label class="cml-admin-panel__toggle">
          <input type="checkbox" ${state.adminCloudDraft.randomImageEnabled ? 'checked' : ''} data-admin-section="cloud" data-admin-field="randomImageEnabled">
          <span>Enable random image API</span>
        </label>
        <label class="cml-admin-panel__field">
          <span>Random image directory</span>
          <input type="text" value="${escapeHtml(state.adminCloudDraft.randomImageAllowedDir)}" data-admin-section="cloud" data-admin-field="randomImageAllowedDir" class="cml-admin-panel__input" placeholder="/wallpaper">
        </label>
        <label class="cml-admin-panel__toggle cml-admin-panel__toggle--wide">
          <input type="checkbox" ${state.adminCloudDraft.telemetryEnabled ? 'checked' : ''} data-admin-section="cloud" data-admin-field="telemetryEnabled">
          <span>Enable telemetry</span>
        </label>
      </div>
      ${statusHtml}
      <div class="cml-admin-panel__section-footer">
        <div class="cml-admin-panel__footer-actions">
          <button type="button" class="cml-admin-panel__primary" data-action="save-admin-cloud" ${state.adminPanelBusy ? 'disabled' : ''}>${icon('save')}<span>${state.adminPanelBusy ? 'Saving...' : 'Save cloud settings'}</span></button>
        </div>
      </div>
    </section>
  `;

  const tgChannels = Array.isArray(state.adminTelegramChannels) ? state.adminTelegramChannels : [];
  const telegramBody = `
    <section class="cml-admin-panel__section">
      <div class="cml-admin-panel__hero-copy cml-admin-panel__hero-copy--compact">
        <p class="cml-admin-panel__eyebrow">Telegram</p>
        <h3 class="cml-admin-panel__section-title">Channel sync</h3>
        <p class="cml-admin-panel__copy">Manage Telegram channel sync webhooks and trigger manual imports from this panel.</p>
      </div>
      <div class="cml-admin-panel__section-footer" style="margin-bottom:12px">
        <div class="cml-admin-panel__footer-actions">
          <button type="button" class="cml-admin-panel__secondary" data-action="refresh-admin-telegram" ${state.adminTelegramLoading ? 'disabled' : ''}>${icon('restore')}<span>${state.adminTelegramLoading ? 'Refreshing...' : 'Refresh status'}</span></button>
        </div>
      </div>
      ${state.adminTelegramError ? `<p class="cml-admin-panel__status is-error">${escapeHtml(state.adminTelegramError)}</p>` : ''}
      ${!tgChannels.length && !state.adminTelegramLoading ? `
        <p class="cml-admin-panel__scan-empty">No Telegram channels configured.</p>
      ` : ''}
      <div class="cml-admin-panel__stack">
        ${tgChannels.map((ch) => {
          const webhookUrl = ch.webhookInfo?.url || '';
          const fmtTime = (v) => { if (!v) return '--'; const d = new Date(Number(v)); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(); };
          return `
            <section class="cml-admin-panel__subsection">
              <div class="cml-admin-panel__subheader">
                <div>
                  <h4 class="cml-admin-panel__subheading">${escapeHtml(ch.name)}</h4>
                  <p class="cml-admin-panel__copy">chatId: ${escapeHtml(ch.chatId || 'N/A')} &middot; ${escapeHtml(ch.importDirectory || '/')}</p>
                </div>
                <div class="cml-admin-panel__subactions" style="display:flex;gap:6px;flex-wrap:wrap">
                  <span class="cml-admin-panel__migration-pill is-${ch.syncEnabled ? 'success' : 'warning'}">${ch.syncEnabled ? 'Sync on' : 'Sync off'}</span>
                  <span class="cml-admin-panel__migration-pill is-${webhookUrl ? 'success' : 'warning'}">${webhookUrl ? 'Webhook active' : 'No webhook'}</span>
                </div>
              </div>
              <div class="cml-admin-panel__migration-grid">
                <article class="cml-admin-panel__migration-card">
                  <span class="cml-admin-panel__migration-label">Last sync</span>
                  <strong class="cml-admin-panel__migration-value" style="font-size:13px">${escapeHtml(fmtTime(ch.lastSyncAt))}</strong>
                  <span class="cml-admin-panel__migration-meta">Source: ${escapeHtml(ch.lastSyncSource || '--')}</span>
                </article>
                <article class="cml-admin-panel__migration-card">
                  <span class="cml-admin-panel__migration-label">Last processed</span>
                  <strong class="cml-admin-panel__migration-value">${ch.lastProcessedCount || 0}</strong>
                  <span class="cml-admin-panel__migration-meta">Update ID: ${ch.lastUpdateId || 0}</span>
                </article>
                <article class="cml-admin-panel__migration-card">
                  <span class="cml-admin-panel__migration-label">Webhook queue</span>
                  <strong class="cml-admin-panel__migration-value">${ch.webhookInfo?.pending_update_count != null ? ch.webhookInfo.pending_update_count : '--'}</strong>
                  <span class="cml-admin-panel__migration-meta">Last event: ${escapeHtml(fmtTime(ch.lastWebhookEventAt))}</span>
                </article>
              </div>
              ${ch.lastError ? `<p class="cml-admin-panel__status is-error" style="margin-top:8px">Error: ${escapeHtml(ch.lastError)}</p>` : ''}
              <div class="cml-admin-panel__footer-actions" style="margin-top:10px;gap:8px">
                <button type="button" class="cml-admin-panel__primary" data-action="tg-setup-webhook" data-channel="${escapeHtml(ch.name)}" ${state.adminTelegramBusy ? 'disabled' : ''}>${icon('save')}<span>Setup webhook</span></button>
                <button type="button" class="cml-admin-panel__secondary" data-action="tg-run-sync" data-channel="${escapeHtml(ch.name)}" ${!ch.manualRunAllowed || state.adminTelegramBusy ? 'disabled' : ''}><span>Manual sync</span></button>
                <button type="button" class="cml-admin-panel__ghost is-destructive" data-action="tg-delete-webhook" data-channel="${escapeHtml(ch.name)}" ${state.adminTelegramBusy ? 'disabled' : ''}>Delete webhook</button>
              </div>
              <p class="cml-admin-panel__copy" style="margin-top:6px;font-size:12px">Webhook: ${escapeHtml(webhookUrl || 'Not set')}</p>
            </section>
          `;
        }).join('')}
      </div>
    </section>
  `;

  const panelBody = state.adminPanelLoading
    ? `<div class="cml-admin-panel__loading">Loading admin settings...</div>`
    : activeTab === 'site'
      ? siteBody
      : activeTab === 'cloud'
        ? cloudBody
        : activeTab === 'telegram'
          ? telegramBody
          : accountBody;

  return `
    <div class="cml-dialog cml-admin-panel" role="dialog" aria-modal="true" aria-labelledby="cml-admin-panel-title">
      <div class="cml-dialog__backdrop" data-action="close-admin-panel"></div>
      <div class="cml-dialog__panel cml-admin-panel__panel">
        <div class="cml-dialog__header cml-admin-panel__header">
          <div>
            <h2 class="cml-dialog__title" id="cml-admin-panel-title">Admin dashboard</h2>
            <p class="cml-dialog__copy">Manage the account, site identity, and cloud-disk switches without leaving the media-library shell.</p>
          </div>
          <button type="button" class="cml-dialog__close" data-action="close-admin-panel" aria-label="Close">${icon('close')}</button>
        </div>
        <div class="cml-admin-panel__layout">
          <nav class="cml-admin-panel__tabs" aria-label="Admin sections">
            ${tabs.map((tab) => `
              <button type="button" class="cml-admin-panel__tab ${activeTab === tab.id ? 'is-active' : ''}" data-action="switch-admin-tab" data-tab="${tab.id}">
                ${icon(tab.iconName)}
                <span>${escapeHtml(tab.label)}</span>
              </button>
            `).join('')}
          </nav>
          <div class="cml-admin-panel__content">
            ${panelBody}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function StoragePanel({ state, insights }) {
  if (!state.storagePanelOpen) {
    return '';
  }

  return `
    <div class="cml-dialog cml-storage-panel" role="dialog" aria-modal="true" aria-labelledby="cml-storage-panel-title">
      <div class="cml-dialog__backdrop" data-action="close-storage-panel"></div>
      <div class="cml-dialog__panel cml-storage-panel__panel">
        <div class="cml-dialog__header">
          <div>
            <h2 class="cml-dialog__title" id="cml-storage-panel-title">Review and delete</h2>
            <p class="cml-dialog__copy">A Google-Photos-style storage summary for the current library and recycle bin.</p>
          </div>
          <button type="button" class="cml-dialog__close" data-action="close-storage-panel" aria-label="Close">${icon('close')}</button>
        </div>
        <div class="cml-storage-panel__summary">
          <div class="cml-storage-panel__summary-card">
            <span class="cml-storage-panel__summary-label">Used storage</span>
            <strong class="cml-storage-panel__summary-value">${escapeHtml(insights.totalUsageLabel)}</strong>
            <span class="cml-storage-panel__summary-meta">${escapeHtml(insights.quotaLabel)}</span>
          </div>
          <div class="cml-storage-panel__summary-card">
            <span class="cml-storage-panel__summary-label">Indexed items</span>
            <strong class="cml-storage-panel__summary-value">${escapeHtml(String(insights.totalCount))}</strong>
            <span class="cml-storage-panel__summary-meta">${escapeHtml(insights.totalCountLabel)}</span>
          </div>
        </div>
        <div class="cml-storage-panel__list">
          ${insights.categories.map((entry) => `
            <div class="cml-storage-panel__row">
              <div class="cml-storage-panel__icon">${icon(entry.iconName)}</div>
              <div class="cml-storage-panel__body">
                <strong class="cml-storage-panel__row-title">${escapeHtml(entry.title)}</strong>
                <span class="cml-storage-panel__row-copy">${escapeHtml(entry.copy)}</span>
              </div>
              <div class="cml-storage-panel__metric">
                <strong>${escapeHtml(entry.sizeLabel)}</strong>
                <span>${escapeHtml(entry.countLabel)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}


