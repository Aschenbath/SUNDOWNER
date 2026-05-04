import { FILM_FILTERS, FILM_STATUS_LABELS, getFilmRatingLabel } from './films-data.js?v=1';

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

export function FilmCard(record = {}) {
  const statusLabel = FILM_STATUS_LABELS[record.status] || '想看';
  const rating = Number.isFinite(Number(record.rating)) ? Number(record.rating).toFixed(1) : '';
  const ratingLabel = rating ? getFilmRatingLabel(record.rating) : '';
  const metaLabel = rating
    ? `${rating} · ${ratingLabel}`
    : statusLabel;
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const originalTitle = normalizeText(record.title || record.localTitle || '');
  const note = normalizeText(record.note || '');
  return `
    <article class="cml-film-card" data-film-id="${escapeHtml(record.id || '')}">
      <div class="cml-film-card__poster-wrap">
        <img class="cml-film-card__poster" src="${escapeHtml(record.posterUrl || '')}" alt="${escapeHtml(localTitle)}" loading="eager" decoding="async" />
        ${record.favorite ? '<span class="cml-film-card__favorite" aria-label="Favorite">★</span>' : ''}
      </div>
      <div class="cml-film-card__body">
        <h3 class="cml-film-card__title">${escapeHtml(localTitle)}</h3>
        <p class="cml-film-card__meta">${escapeHtml([originalTitle && originalTitle !== localTitle ? originalTitle : '', record.year].filter(Boolean).join(' · '))}</p>
        <p class="cml-film-card__status">${escapeHtml(metaLabel)}</p>
        ${note ? `<p class="cml-film-card__note">${escapeHtml(note)}</p>` : ''}
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
