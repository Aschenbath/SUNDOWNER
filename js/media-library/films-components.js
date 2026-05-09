import { FILM_FILTERS, FILM_STATUS_LABELS, getFilmRatingLabel } from './films-data.js?v=4';

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

function normalizeUserRatingValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.min(5, Math.max(0.5, Math.round(numeric * 2) / 2));
}

function getUserRatingMood(value) {
  const rating = normalizeUserRatingValue(value);
  if (rating === null) {
    return 'Not rated';
  }
  if (rating < 2) {
    return '\u4e0d\u63a8\u8350';
  }
  if (rating < 3) {
    return '\u4e00\u822c';
  }
  if (rating < 4) {
    return '\u8fd8\u884c';
  }
  if (rating < 4.5) {
    return '\u63a8\u8350';
  }
  return '\u79c1\u5fc3\u6700\u7231';
}

function buildTmdbImageUrl(path, size = 'w342') {
  const normalized = normalizeText(path);
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) {
    return normalized;
  }
  return `https://image.tmdb.org/t/p/${size}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function renderPosterFallback(title = '') {
  const label = normalizeText(title || 'Film').slice(0, 28) || 'Film';
  return `
    <div class="cml-films-poster-fallback" aria-hidden="true">
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function getRecordPosterUrl(record = {}) {
  return record.posterUrl || buildTmdbImageUrl(record.posterPath, 'w342') || '';
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

function renderFilmCardInfoItem(label, value) {
  if (!normalizeText(value)) {
    return '';
  }
  return `
    <div class="cml-film-card__info-item">
      <span class="cml-film-card__info-label">${escapeHtml(label)}</span>
      <strong class="cml-film-card__info-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function getTicketStatusLabel(status) {
  const map = {
    watchlist: 'WISHLIST',
    wantToWatch: 'WISHLIST',
    watching: 'WATCHING',
    watched: 'WATCHED',
    paused: 'PAUSED',
    dropped: 'DROPPED'
  };
  return map[status] || 'WISHLIST';
}

function buildTicketSerial(record = {}) {
  const tmdbId = Number(record.tmdbId);
  if (Number.isFinite(tmdbId) && tmdbId > 0) {
    return `TMDB #${String(tmdbId).padStart(6, '0')}`;
  }
  const fallbackId = normalizeText(record.id || '').replace(/^tmdb-/, '');
  return fallbackId ? `ENTRY #${fallbackId}` : 'ENTRY #LOCAL';
}

function getCleanStatusLabel(status) {
  const labels = {
    watchlist: '想看',
    wantToWatch: '想看',
    watching: '在看',
    watched: '已看',
    paused: '暂停',
    dropped: '弃看'
  };
  return labels[status] || FILM_STATUS_LABELS[status] || '想看';
}

function getCleanRatingLabel(rating) {
  const normalized = Number(rating);
  if (!Number.isFinite(normalized)) {
    return '';
  }
  if (normalized <= 2.9) {
    return '不推荐';
  }
  if (normalized <= 5.9) {
    return '一般';
  }
  if (normalized <= 7.4) {
    return '还行';
  }
  if (normalized <= 8.9) {
    return '推荐';
  }
  return '私心最爱';
}

function formatUserRating(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0.5 && numeric <= 5
    ? numeric.toFixed(1)
    : '';
}

function formatTmdbRating(record = {}) {
  const average = Number(record.voteAverage);
  if (!Number.isFinite(average) || average <= 0) {
    return '';
  }
  const count = Number(record.voteCount);
  const countLabel = Number.isFinite(count) && count > 0
    ? ` (${new Intl.NumberFormat('en-US', { notation: count >= 10000 ? 'compact' : 'standard' }).format(count)})`
    : '';
  return `TMDb ${average.toFixed(1)}${countLabel}`;
}

export function FilmCard(record = {}) {
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const originalTitle = normalizeText(record.originalTitle || record.title || '');
  const directorLine = normalizeText(record.director || '');
  const localeLine = [record.country, record.language].filter(Boolean).join(' / ');
  const genresLine = Array.isArray(record.genres) ? record.genres.filter(Boolean).join(' · ') : '';
  const runtime = formatRuntime(record.runtime);
  const watchedDate = record.status === 'watched' ? formatWatchedDate(record.watchedAt) : '';
  const ratingValue = formatUserRating(record.userRating ?? record.rating);
  const ratingLabel = ratingValue ? 'My rating' : 'Not rated';
  const coverMeta = [record.year ? String(record.year) : '', runtime].filter(Boolean).join(' • ');
  const infoItems = [
    renderFilmCardInfoItem('Release', [record.year ? String(record.year) : '', runtime].filter(Boolean).join(' • ')),
    renderFilmCardInfoItem('Locale', localeLine),
    renderFilmCardInfoItem('Watched', watchedDate)
  ].filter(Boolean).join('');
  return `
    <article class="cml-film-card" data-film-id="${escapeHtml(record.id || '')}" data-action="open-film-detail" tabindex="0" role="button" aria-label="Open ${escapeHtml(localTitle)} details">
      <div class="cml-film-card__poster-panel">
        <img class="cml-film-card__poster" src="${escapeHtml(getRecordPosterUrl(record))}" alt="${escapeHtml(localTitle)}" loading="eager" decoding="async" />
      </div>
      <div class="cml-film-card__ticket-panel">
        <span class="cml-film-card__notch cml-film-card__notch--left" aria-hidden="true"></span>
        <span class="cml-film-card__notch cml-film-card__notch--right" aria-hidden="true"></span>
        <div class="cml-film-card__ticket-body">
          <div class="cml-film-card__ticket-head">
            <div class="cml-film-card__title-block">
              <h4 class="cml-film-card__title">${escapeHtml(localTitle)}</h4>
              ${originalTitle && originalTitle !== localTitle ? `<p class="cml-film-card__original">${escapeHtml(originalTitle)}</p>` : ''}
            </div>
          </div>
          <div class="cml-film-card__separator" aria-hidden="true"></div>
          ${infoItems ? `<div class="cml-film-card__info-grid">${infoItems}</div>` : ''}
        </div>
        <footer class="cml-film-card__footer" aria-hidden="true">
          <div class="cml-film-card__perforation"></div>
          <div class="cml-film-card__footer-spotlight">
            ${directorLine ? `
              <div class="cml-film-card__director">
                <span class="cml-film-card__director-label">Director</span>
                <strong class="cml-film-card__director-value">${escapeHtml(directorLine)}</strong>
              </div>
            ` : ''}
            <div class="cml-film-card__rating ${ratingValue ? '' : 'is-pending'}" aria-label="${escapeHtml(ratingLabel)} ${escapeHtml(ratingValue || 'pending')}">
                <span class="cml-film-card__rating-value">${escapeHtml(ratingValue || '待')}</span>
                <span class="cml-film-card__rating-label">${escapeHtml(ratingLabel)}</span>
              </div>
          </div>
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

function LegacyFilmDetailModal({ record = null } = {}) {
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
  const canSaveEntry = Boolean(record.tmdbId);
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
          <img class="cml-film-ticket__poster" src="${escapeHtml(getRecordPosterUrl(record))}" alt="${escapeHtml(localTitle)}" />
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
        ${canSaveEntry ? `<div class="cml-film-ticket__actions">
          <button type="button" class="cml-film-ticket__action" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(record.tmdbId || '')}">加入想看</button>
          <button type="button" class="cml-film-ticket__action cml-film-ticket__action--primary" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(record.tmdbId || '')}">标记看过</button>
        </div>` : ''}
        <footer class="cml-film-ticket__footer" aria-hidden="true">
          <div class="cml-film-ticket__barcode">${barcodeBars}</div>
          <p class="cml-film-ticket__footer-copy">SUNDOWNER FILM DIARY</p>
        </footer>
      </article>
    </div>
  `;
}

export function FilmDetailModal({ record = null } = {}) {
  if (!record) {
    return '';
  }
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const originalTitle = normalizeText(record.originalTitle || record.title || '');
  const statusLabel = getCleanStatusLabel(record.status);
  const userRating = formatUserRating(record.userRating ?? record.rating);
  const ratingInputValue = userRating || '4.0';
  const ratingMood = getUserRatingMood(userRating);
  const ratingFill = normalizeUserRatingValue(ratingInputValue) ? `${(normalizeUserRatingValue(ratingInputValue) / 5) * 100}%` : '80%';
  const tmdbRating = formatTmdbRating(record);
  const watchedDateValue = normalizeText(record.watchedAt || '').slice(0, 10);
  const genres = Array.isArray(record.genres) ? record.genres.filter(Boolean).join(' / ') : '';
  const localeLine = [record.country, record.language].filter(Boolean).join(' / ');
  const runtime = formatRuntime(record.runtime);
  const canSaveEntry = Boolean(record.tmdbId);
  const isSaving = Boolean(record.isSaving);
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
          <img class="cml-film-ticket__poster" src="${escapeHtml(getRecordPosterUrl(record))}" alt="${escapeHtml(localTitle)}" />
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
          ${renderTicketMetaRow('TMDb rating', tmdbRating || 'No TMDb rating')}
          ${renderTicketMetaRow('My rating', userRating ? `${userRating} / 5.0` : 'Not rated')}
        </dl>
        ${canSaveEntry ? `
          <section class="cml-film-ticket__section cml-film-ticket__section--rating" style="--film-rating-fill: ${escapeHtml(ratingFill)};">
            <div class="cml-film-ticket__rating-head">
              <p class="cml-film-ticket__section-label">My rating</p>
              <strong class="cml-film-ticket__rating-output" data-film-rating-output>${escapeHtml(userRating || '4.0')}</strong>
            </div>
            <div class="cml-film-ticket__rating-control">
              <input type="range" class="cml-film-ticket__rating-slider" data-film-rating-input data-tmdb-id="${escapeHtml(record.tmdbId || '')}" min="0.5" max="5" step="0.5" value="${escapeHtml(ratingInputValue)}" ${isSaving ? 'disabled' : ''} />
              <button type="button" class="cml-film-ticket__rating-clear" data-action="clear-film-rating" data-tmdb-id="${escapeHtml(record.tmdbId || '')}" ${(!userRating || isSaving) ? 'disabled' : ''}>Clear rating</button>
            </div>
            <p class="cml-film-ticket__rating-note"><span data-film-rating-mood>${escapeHtml(ratingMood)}</span> · User rating is local. TMDb rating stays external.</p>
          </section>
        ` : ''}
        ${canSaveEntry ? `
          <section class="cml-film-ticket__section cml-film-ticket__section--watched-date">
            <div class="cml-film-ticket__date-head">
              <p class="cml-film-ticket__section-label">Watched date</p>
              <span class="cml-film-ticket__date-current" data-film-watched-at-output>${escapeHtml(watchedDateValue ? formatWatchedDateLong(watchedDateValue) : 'Not set')}</span>
            </div>
            <div class="cml-film-ticket__date-control">
              <input type="date" class="cml-film-ticket__date-input" data-film-watched-at-input data-tmdb-id="${escapeHtml(record.tmdbId || '')}" value="${escapeHtml(watchedDateValue)}" ${isSaving ? 'disabled' : ''} />
              <button type="button" class="cml-film-ticket__date-save" data-action="save-film-watched-date" data-tmdb-id="${escapeHtml(record.tmdbId || '')}" ${isSaving ? 'disabled' : ''}>Save date</button>
            </div>
            <p class="cml-film-ticket__rating-note">Defaults to the day you marked watched; edit it if the real viewing date was different.</p>
          </section>
        ` : ''}
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
        ${canSaveEntry ? `<div class="cml-film-ticket__actions">
          <button type="button" class="cml-film-ticket__action" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(record.tmdbId || '')}" ${isSaving ? 'disabled' : ''}>${isSaving ? 'Saving...' : '加入想看'}</button>
          <button type="button" class="cml-film-ticket__action cml-film-ticket__action--primary" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(record.tmdbId || '')}" ${isSaving ? 'disabled' : ''}>${isSaving ? 'Saving...' : '标记看过'}</button>
        </div>` : ''}
        <footer class="cml-film-ticket__footer" aria-hidden="true">
          <div class="cml-film-ticket__barcode">${barcodeBars}</div>
          <p class="cml-film-ticket__footer-copy">SUNDOWNER FILM DIARY</p>
        </footer>
      </article>
    </div>
  `;
}

export function FilmsPage({ records = [], totalCount = records.length, activeFilter = 'All', searchQuery = '', searchPanelHtml = '' } = {}) {
  const sections = groupFilmsByTimeline(records);
  const searchValue = escapeHtml(searchQuery);
  const hasAnySavedFilms = Number(totalCount) > 0;
  return `
    <section class="cml-films-page">
      <header class="cml-films-page__hero">
        <div class="cml-films-page__hero-copy">
          <p class="cml-films-page__eyebrow">Archive</p>
          <h1 class="cml-films-page__title">Films</h1>
          <p class="cml-films-page__subtitle">Your private film diary.</p>
        </div>
        <form class="cml-films-page__hero-actions" data-form="films-search">
          <label class="cml-films-search" aria-label="Search films">
            <span class="cml-films-search__icon">⌕</span>
            <input type="search" class="cml-films-search__input" data-films-search-input value="${searchValue}" placeholder="Search TMDb movies..." />
          </label>
          <button type="submit" class="cml-films-page__add-button">Search</button>
        </form>
      </header>
      ${searchPanelHtml}
      <div class="cml-films-filters" role="tablist" aria-label="Film filters">
        ${FILM_FILTERS.map((filter) => `
          <button type="button" class="cml-films-filters__chip ${filter === activeFilter ? 'is-active' : ''}" data-action="filter-films" data-film-filter="${escapeHtml(filter)}" aria-pressed="${filter === activeFilter ? 'true' : 'false'}">
            ${escapeHtml(filter)}
          </button>
        `).join('')}
      </div>
      <div class="cml-films-page__content">
        ${sections.length
          ? sections.map((section) => FilmTimelineSection(section)).join('')
          : `
            <section class="cml-films-empty" data-has-saved-films="${hasAnySavedFilms ? 'true' : 'false'}">
              <p class="cml-films-empty__eyebrow">Start from TMDb</p>
              <h2 class="cml-films-empty__title">No saved films yet.</h2>
              <p class="cml-films-empty__copy">Search a title above, then save a TMDb result as 想看 or 看过. Only movies you save will appear in this diary.</p>
            </section>
          `}
      </div>
    </section>
  `;
}

function LegacyFilmSearchResults({ results = [], loading = false, error = '', query = '' } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery && !results.length && !error) {
    return '';
  }
  const friendlyError = error && /TMDb access token is not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error && /TMDb credentials are not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error;
  return `
    <section class="cml-films-mvp">
      <div class="cml-films-mvp__head">
        <div>
          <p class="cml-films-mvp__eyebrow">TMDb MVP</p>
          <h2 class="cml-films-mvp__title">${loading ? 'Searching...' : 'Search results'}</h2>
        </div>
        ${friendlyError ? `<p class="cml-films-mvp__error">${escapeHtml(friendlyError)}</p>` : ''}
      </div>
      <div class="cml-films-mvp__results">
        ${results.length ? results.map((movie) => `
          <article class="cml-films-result" data-action="open-tmdb-film-detail" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">
            <img class="cml-films-result__poster" src="${escapeHtml(buildTmdbImageUrl(movie.posterPath, 'w185'))}" alt="${escapeHtml(movie.title || 'Movie poster')}" loading="lazy" decoding="async" />
            <div class="cml-films-result__body">
              <h3 class="cml-films-result__title">${escapeHtml(movie.title || 'Untitled film')}</h3>
              <p class="cml-films-result__meta">${escapeHtml([movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '', movie.voteAverage ? `TMDb ${Number(movie.voteAverage).toFixed(1)}` : ''].filter(Boolean).join(' · '))}</p>
              ${movie.overview ? `<p class="cml-films-result__overview">${escapeHtml(movie.overview)}</p>` : ''}
            </div>
          </article>
        `).join('') : `<p class="cml-films-mvp__empty">${loading ? 'Contacting TMDb...' : 'No search results yet.'}</p>`}
      </div>
    </section>
  `;
}

function LegacyAddableFilmSearchResults({ results = [], loading = false, error = '', query = '', savingTmdbIds = new Set() } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery && !results.length && !error) {
    return '';
  }
  const friendlyError = error && /TMDb access token is not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error && /TMDb credentials are not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error;
  const resultCards = results.length ? results.map((movie) => `
    <article class="cml-films-result" data-action="open-tmdb-film-detail" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">
      <div class="cml-films-result__poster-wrap">
        ${movie.posterPath
          ? `<img class="cml-films-result__poster" src="${escapeHtml(buildTmdbImageUrl(movie.posterPath, 'w342'))}" alt="${escapeHtml(movie.title || 'Movie poster')}" loading="lazy" decoding="async" />`
          : renderPosterFallback(movie.title)}
      </div>
      <div class="cml-films-result__body">
        <p class="cml-films-result__source">TMDb result</p>
        <h3 class="cml-films-result__title">${escapeHtml(movie.title || 'Untitled film')}</h3>
        <p class="cml-films-result__meta">${escapeHtml([movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '', movie.voteAverage ? `TMDb ${Number(movie.voteAverage).toFixed(1)}` : ''].filter(Boolean).join(' · '))}</p>
        ${movie.overview ? `<p class="cml-films-result__overview">${escapeHtml(movie.overview)}</p>` : ''}
        <div class="cml-films-result__actions">
          <button type="button" class="cml-films-result__button" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">想看</button>
          <button type="button" class="cml-films-result__button cml-films-result__button--primary" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">看过</button>
        </div>
      </div>
    </article>
  `).join('') : `<p class="cml-films-mvp__empty">${loading ? 'Contacting TMDb...' : 'No search results yet.'}</p>`;
  return `
    <section class="cml-films-mvp">
      <div class="cml-films-mvp__head">
        <div>
          <p class="cml-films-mvp__eyebrow">TMDb search</p>
          <h2 class="cml-films-mvp__title">${loading ? 'Searching...' : 'Add from TMDb'}</h2>
        </div>
        ${friendlyError ? `<p class="cml-films-mvp__error">${escapeHtml(friendlyError)}</p>` : ''}
      </div>
      <div class="cml-films-mvp__results">
        ${resultCards}
      </div>
    </section>
  `;
}

export function FilmSearchResults({ results = [], loading = false, error = '', query = '', savingTmdbIds = new Set() } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery && !results.length && !error) {
    return '';
  }
  const friendlyError = error && /TMDb access token is not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error && /TMDb credentials are not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error;
  const resultCards = results.length ? results.map((movie) => {
    const isSaving = savingTmdbIds instanceof Set && savingTmdbIds.has(Number(movie.tmdbId));
    return `
      <article class="cml-films-result ${isSaving ? 'is-saving' : ''}" data-action="open-tmdb-film-detail" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">
        <div class="cml-films-result__poster-wrap">
          ${movie.posterPath
            ? `<img class="cml-films-result__poster" src="${escapeHtml(buildTmdbImageUrl(movie.posterPath, 'w342'))}" alt="${escapeHtml(movie.title || 'Movie poster')}" loading="lazy" decoding="async" />`
            : renderPosterFallback(movie.title)}
        </div>
        <div class="cml-films-result__body">
          <p class="cml-films-result__source">TMDb result</p>
          <h3 class="cml-films-result__title">${escapeHtml(movie.title || 'Untitled film')}</h3>
          <p class="cml-films-result__meta">${escapeHtml([movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '', movie.voteAverage ? `TMDb ${Number(movie.voteAverage).toFixed(1)}` : ''].filter(Boolean).join(' · '))}</p>
          ${movie.overview ? `<p class="cml-films-result__overview">${escapeHtml(movie.overview)}</p>` : ''}
          <div class="cml-films-result__actions">
            <button type="button" class="cml-films-result__button" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}" ${isSaving ? 'disabled' : ''}>${isSaving ? 'Saving...' : '想看'}</button>
            <button type="button" class="cml-films-result__button cml-films-result__button--primary" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}" ${isSaving ? 'disabled' : ''}>${isSaving ? 'Saving...' : '看过'}</button>
          </div>
        </div>
      </article>
    `;
  }).join('') : `<p class="cml-films-mvp__empty">${loading ? 'Contacting TMDb...' : 'No search results yet.'}</p>`;
  return `
    <section class="cml-films-mvp">
      <div class="cml-films-mvp__head">
        <div>
          <p class="cml-films-mvp__eyebrow">TMDb search</p>
          <h2 class="cml-films-mvp__title">${loading ? 'Searching...' : 'Add from TMDb'}</h2>
        </div>
        ${friendlyError ? `<p class="cml-films-mvp__error">${escapeHtml(friendlyError)}</p>` : ''}
      </div>
      <div class="cml-films-mvp__results">
        ${resultCards}
      </div>
    </section>
  `;
}
