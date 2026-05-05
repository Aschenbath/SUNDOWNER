import { FILM_FILTERS, FILM_STATUS_LABELS, getFilmRatingLabel } from './films-data.js?v=3';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatFilmMonthLabel(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return 'Watchlist';
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatWatchedDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return normalizeText(value);
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '/');
}

function formatWatchedDateLong(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }
  return escapeHtml(date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }));
}

function formatRuntime(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '';
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) {
    return `${rest} min`;
  }
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

function groupFilmsByTimeline(records = []) {
  const watchedGroups = new Map();
  const watchlistRecords = [];

  records.forEach((record) => {
    if (record.status === 'watched' && record.watchedAt) {
      const key = formatFilmMonthLabel(record.watchedAt);
      if (!watchedGroups.has(key)) {
        watchedGroups.set(key, []);
      }
      watchedGroups.get(key).push(record);
      return;
    }
    watchlistRecords.push(record);
  });

  const watchedSections = [...watchedGroups.entries()].map(([label, items]) => ({
    id: `films-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label,
    items: items.slice().sort((left, right) => String(right.watchedAt || '').localeCompare(String(left.watchedAt || '')))
  }));

  watchedSections.sort((left, right) => {
    const leftTime = new Date(left.items[0]?.watchedAt || '').getTime() || 0;
    const rightTime = new Date(right.items[0]?.watchedAt || '').getTime() || 0;
    return rightTime - leftTime;
  });

  if (watchlistRecords.length) {
    watchedSections.push({
      id: 'films-watchlist',
      label: 'Watchlist',
      items: watchlistRecords.slice().sort((left, right) => String(right.addedAt || '').localeCompare(String(left.addedAt || '')))
    });
  }

  return watchedSections;
}

function renderTicketMetaRow(label, value) {
  if (!normalizeText(value)) {
    return '';
  }
  return `
    <div class="cml-film-ticket__row">
      <dt class="cml-film-ticket__label">${escapeHtml(label)}</dt>
      <dd class="cml-film-ticket__value">${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderFilmCardMetaBlock(label, value) {
  if (!normalizeText(value)) {
    return '';
  }
  return `
    <div class="cml-film-card__meta-block">
      <span class="cml-film-card__meta-label">${escapeHtml(label)}</span>
      <strong class="cml-film-card__meta-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildCardBarcode() {
  return Array.from({ length: 16 }, (_, index) => {
    const narrow = index % 4 === 1 || index % 4 === 3 ? 'is-narrow' : '';
    return `<span class="cml-film-card__barcode-bar ${narrow}"></span>`;
  }).join('');
}

export function FilmCard(record = {}) {
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const originalTitle = normalizeText(record.originalTitle || record.title || '');
  const directorLine = normalizeText(record.director || '');
  const localeLine = [record.country, record.language].filter(Boolean).join(' / ');
  const genresLine = Array.isArray(record.genres) ? record.genres.filter(Boolean).join(' / ') : '';
  const runtime = formatRuntime(record.runtime);
  const watchedDate = record.status === 'watched' ? formatWatchedDate(record.watchedAt) : '';
  const normalizedRating = Number(record.rating);
  const hasRating = Number.isFinite(normalizedRating) && normalizedRating > 0;
  const ratingValue = hasRating ? normalizedRating.toFixed(1) : '';
  const ratingLabel = hasRating ? getFilmRatingLabel(record.rating) : '';
  const primaryInfo = directorLine || [record.year, runtime].filter(Boolean).join(' • ');
  const secondaryInfo = directorLine ? [record.year, runtime].filter(Boolean).join(' • ') : localeLine;
  const tertiaryInfo = directorLine ? localeLine : genresLine;
  const metaBlocks = [
    renderFilmCardMetaBlock('Year', record.year ? String(record.year) : ''),
    renderFilmCardMetaBlock('Runtime', runtime),
    renderFilmCardMetaBlock('Watched', watchedDate),
    renderFilmCardMetaBlock('Rating', hasRating ? `${ratingValue} ${ratingLabel}` : '')
  ].filter(Boolean).join('');
  return `
    <article class="cml-film-card" data-film-id="${escapeHtml(record.id || '')}" data-action="open-film-detail" tabindex="0" role="button" aria-label="Open ${escapeHtml(localTitle)} details">
      <div class="cml-film-card__poster-panel">
        <img class="cml-film-card__poster" src="${escapeHtml(record.posterUrl || '')}" alt="${escapeHtml(localTitle)}" loading="eager" decoding="async" />
      </div>
      <div class="cml-film-card__ticket-panel">
        <div class="cml-film-card__notch cml-film-card__notch--left" aria-hidden="true"></div>
        <div class="cml-film-card__notch cml-film-card__notch--right" aria-hidden="true"></div>
        <div class="cml-film-card__ticket-body">
          <h3 class="cml-film-card__title">${escapeHtml(localTitle)}</h3>
          ${originalTitle && originalTitle !== localTitle ? `<p class="cml-film-card__original">${escapeHtml(originalTitle)}</p>` : ''}
          <div class="cml-film-card__separator" aria-hidden="true"></div>
          ${primaryInfo ? `<p class="cml-film-card__line cml-film-card__line--strong">${escapeHtml(primaryInfo)}</p>` : ''}
          ${secondaryInfo ? `<p class="cml-film-card__line">${escapeHtml(secondaryInfo)}</p>` : ''}
          ${tertiaryInfo ? `<p class="cml-film-card__line">${escapeHtml(tertiaryInfo)}</p>` : ''}
          ${metaBlocks ? `<div class="cml-film-card__meta-grid">${metaBlocks}</div>` : ''}
        </div>
        <footer class="cml-film-card__footer" aria-hidden="true">
          <div class="cml-film-card__barcode">${buildCardBarcode()}</div>
          <span class="cml-film-card__footer-copy">FILM DIARY</span>
        </footer>
      </div>
    </article>
  `;
}

export function FilmTimelineSection(section = {}) {
  return `
    <section class="cml-films-section" data-film-section="${escapeHtml(section.id || '')}">
      <div class="cml-films-section__header">
        <div>
          <h2 class="cml-films-section__title">${escapeHtml(section.label || '')}</h2>
          <p class="cml-films-section__meta">${escapeHtml(String(section.items?.length || 0))} film${(section.items?.length || 0) === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div class="cml-films-grid">
        ${(Array.isArray(section.items) ? section.items : []).map((record) => FilmCard(record)).join('')}
      </div>
    </section>
  `;
}

export function FilmDetailModal({ record = null } = {}) {
  if (!record) {
    return '';
  }
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const originalTitle = normalizeText(record.originalTitle || record.title || '');
  const statusLabel = FILM_STATUS_LABELS[record.status] || '想看';
  const rating = Number.isFinite(Number(record.rating)) ? Number(record.rating).toFixed(1) : '';
  const ratingLabel = rating ? getFilmRatingLabel(record.rating) : '';
  const genres = Array.isArray(record.genres) ? record.genres.filter(Boolean).join(' · ') : '';
  const localeLine = [record.country, record.language].filter(Boolean).join(' · ');
  const runtime = formatRuntime(record.runtime);
  const barcodeBars = Array.from({ length: 22 }, (_, index) => {
    const narrow = index % 3 === 0 ? 'is-narrow' : '';
    return `<span class="cml-film-ticket__barcode-bar ${narrow}"></span>`;
  }).join('');
  return `
    <div class="cml-film-modal" data-action="close-film-detail">
      <div class="cml-film-modal__backdrop"></div>
      <article class="cml-film-ticket" role="dialog" aria-modal="true" aria-label="${escapeHtml(localTitle)} film details">
        <button type="button" class="cml-film-ticket__close" data-action="close-film-detail" aria-label="Close film detail">×</button>
        <div class="cml-film-ticket__hero">
          <img class="cml-film-ticket__poster" src="${escapeHtml(record.posterUrl || '')}" alt="${escapeHtml(localTitle)}" />
          <div class="cml-film-ticket__hero-copy">
            <span class="cml-film-ticket__badge">${escapeHtml(statusLabel)}</span>
            <h2 class="cml-film-ticket__title">${escapeHtml(localTitle)}</h2>
            ${originalTitle && originalTitle !== localTitle ? `<p class="cml-film-ticket__original">${escapeHtml(originalTitle)}</p>` : ''}
            ${localeLine ? `<p class="cml-film-ticket__locale">${escapeHtml(localeLine)}</p>` : ''}
          </div>
        </div>
        <div class="cml-film-ticket__perforation" aria-hidden="true"></div>
        <dl class="cml-film-ticket__meta">
          ${renderTicketMetaRow('Director', record.director)}
          ${renderTicketMetaRow('Genres', genres)}
          ${renderTicketMetaRow('Year', record.year ? String(record.year) : '')}
          ${renderTicketMetaRow('Runtime', runtime)}
          ${renderTicketMetaRow('Watched', formatWatchedDateLong(record.watchedAt))}
          ${renderTicketMetaRow('Rating', rating ? `${rating} · ${ratingLabel}` : '')}
        </dl>
        ${record.note ? `
          <section class="cml-film-ticket__section">
            <p class="cml-film-ticket__section-label">Short note</p>
            <p class="cml-film-ticket__note">${escapeHtml(record.note)}</p>
          </section>
        ` : ''}
        ${record.journal ? `
          <section class="cml-film-ticket__section cml-film-ticket__section--journal">
            <p class="cml-film-ticket__section-label">Journal</p>
            <p class="cml-film-ticket__journal">${escapeHtml(record.journal)}</p>
          </section>
        ` : ''}
        <footer class="cml-film-ticket__footer" aria-hidden="true">
          <div class="cml-film-ticket__barcode">${barcodeBars}</div>
          <p class="cml-film-ticket__footer-copy">SUNDOWNER FILM DIARY</p>
        </footer>
      </article>
    </div>
  `;
}

export function FilmsPage({ records = [], activeFilter = 'All', searchQuery = '' } = {}) {
  const sections = groupFilmsByTimeline(records);
  const searchValue = escapeHtml(searchQuery);
  return `
    <section class="cml-films-page">
      <header class="cml-films-page__hero">
        <div class="cml-films-page__hero-copy">
          <p class="cml-films-page__eyebrow">Archive</p>
          <h1 class="cml-films-page__title">Films</h1>
          <p class="cml-films-page__subtitle">Your private film diary.</p>
        </div>
        <div class="cml-films-page__hero-actions">
          <label class="cml-films-search" aria-label="Search films">
            <span class="cml-films-search__icon">⌕</span>
            <input type="search" class="cml-films-search__input" value="${searchValue}" placeholder="Search films / notes..." readonly />
          </label>
          <button type="button" class="cml-films-page__add-button" disabled aria-disabled="true">+ Add film</button>
        </div>
      </header>
      <div class="cml-films-filters" role="tablist" aria-label="Film filters">
        ${FILM_FILTERS.map((filter) => `
          <button type="button" class="cml-films-filters__chip ${filter === activeFilter ? 'is-active' : ''}" aria-pressed="${filter === activeFilter ? 'true' : 'false'}" disabled>
            ${escapeHtml(filter)}
          </button>
        `).join('')}
      </div>
      <div class="cml-films-page__content">
        ${sections.length
          ? sections.map((section) => FilmTimelineSection(section)).join('')
          : '<div class="cml-films-empty">No films yet.</div>'}
      </div>
    </section>
  `;
}
