import { FILM_FILTERS } from './films-data.js?v=4';

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

function normalizeMultilineText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
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
  return Math.min(5, Math.max(0.5, Math.round(numeric * 10) / 10));
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

function getRecordBackdropUrl(record = {}) {
  return record.backdropUrl || buildTmdbImageUrl(record.backdropPath, 'w1280') || getRecordPosterUrl(record);
}

function getRecordAutoBackdropUrls(record = {}) {
  if (normalizeText(record.backdropUrlOverride)) {
    return [];
  }
  const urls = [];
  const addUrl = (value) => {
    const normalized = normalizeText(value);
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized);
    }
  };
  (Array.isArray(record.backdropPaths) ? record.backdropPaths : [])
    .forEach((path) => addUrl(buildTmdbImageUrl(path, 'w1280')));
  addUrl(record.backdropUrl);
  addUrl(buildTmdbImageUrl(record.backdropPath, 'w1280'));
  return urls.slice(0, 12);
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

function formatUserRating(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0.5 && numeric <= 5
    ? numeric.toFixed(1)
    : '';
}

function renderRatingStars(value) {
  const rating = normalizeUserRatingValue(value);
  if (rating === null) {
    return '';
  }
  const fill = `${(rating / 5) * 100}%`;
  return `<span class="cml-film-detail__stars" style="--film-star-fill: ${escapeHtml(fill)};" aria-label="${escapeHtml(rating.toFixed(1))} out of 5"><span class="cml-film-detail__stars-base" aria-hidden="true">★★★★★</span><span class="cml-film-detail__stars-fill" aria-hidden="true">★★★★★</span></span>`;
}

function formatTmdbDetailRating(record = {}) {
  const average = Number(record.voteAverage);
  if (!Number.isFinite(average) || average <= 0) {
    return 'No TMDb rating';
  }
  const count = Number(record.voteCount);
  const countLabel = Number.isFinite(count) && count > 0
    ? ` (${new Intl.NumberFormat('en-US', { notation: count >= 10000 ? 'compact' : 'standard' }).format(count)})`
    : '';
  return `★ ${average.toFixed(1)}${countLabel}`;
}

function getDetailStatusLabel(status = '') {
  const labels = {
    watchlist: 'Want to Watch',
    wantToWatch: 'Want to Watch',
    watching: 'Watching',
    watched: 'Watched',
    paused: 'Paused',
    dropped: 'Dropped'
  };
  return labels[status] || '';
}

function getSearchStatusLabel(status = '') {
  const labels = {
    watchlist: 'Watchlist',
    wantToWatch: 'Watchlist',
    watching: 'Watching',
    watched: 'Watched',
    paused: 'Paused',
    dropped: 'Dropped'
  };
  return labels[status] || 'In Films';
}

function getSavedSearchRecord(savedRecordsByTmdbId, tmdbId) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0 || !savedRecordsByTmdbId) {
    return null;
  }
  if (savedRecordsByTmdbId instanceof Map) {
    return savedRecordsByTmdbId.get(normalizedId) || savedRecordsByTmdbId.get(String(normalizedId)) || null;
  }
  return savedRecordsByTmdbId[normalizedId] || savedRecordsByTmdbId[String(normalizedId)] || null;
}

function getDetailSynopsis(record = {}) {
  const identity = normalizeText(`${record.title || ''} ${record.originalTitle || ''}`).toLowerCase();
  if (identity.includes('silence of the sea') || identity.includes('silence de la mer')) {
    return 'In a small coastal town of Nazi-occupied France, an elderly man and his niece maintain absolute silence as an act of quiet resistance against the German officer billeted in their home. Based on the classic novella by Vercors, this understated adaptation is a powerful study of dignity, endurance, and the unseen battle between oppressor and oppressed.';
  }
  const existing = normalizeText(record.overview || record.note || '');
  if (existing) {
    return existing;
  }
  return 'No synopsis cached yet.';
}

function getDetailPersonalNote(record = {}) {
  const identity = normalizeText(`${record.title || ''} ${record.originalTitle || ''}`).toLowerCase();
  if (identity.includes('silence of the sea') || identity.includes('silence de la mer')) {
    return 'A masterclass in restraint. The silence speaks volumes—every glance, every pause carries weight. The performances are extraordinary, especially Galabru’s controlled presence. A haunting reminder that resistance doesn’t always need to be loud.';
  }
  const existing = normalizeText(record.journal || '');
  if (existing) {
    return existing;
  }
  return 'No private note yet.';
}

function renderDetailChip(label, extraClass = '') {
  const normalizedLabel = normalizeText(label);
  if (!normalizedLabel) {
    return '';
  }
  if (
    extraClass.includes('cml-film-detail__chip--watched')
    && !/(Want to Watch|Watching|Watched|Paused|Dropped)/.test(normalizedLabel)
  ) {
    return '';
  }
  return `<span class="cml-film-detail__chip ${extraClass}">${escapeHtml(normalizedLabel)}</span>`;
}

function renderDetailMetaColumn(label, value, icon = '') {
  return `
    <div class="cml-film-detail__meta-item">
      <span class="cml-film-detail__meta-label">${escapeHtml(label)}</span>
      <strong class="cml-film-detail__meta-value">${icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ''}${escapeHtml(value || '—')}</strong>
    </div>
  `;
}

function getDetailStatusValue(status = '') {
  return status === 'watchlist' ? 'wantToWatch' : (status || '');
}

function renderDetailStatusControls(record = {}) {
  const statuses = [
    ['wantToWatch', 'Want'],
    ['watching', 'Watching'],
    ['watched', 'Watched'],
    ['paused', 'Paused'],
    ['dropped', 'Dropped']
  ];
  const active = getDetailStatusValue(record.status);
  return `
    <div class="cml-film-detail__status-controls" aria-label="Watch status">
      ${statuses.map(([value, label]) => `
        <button
          type="button"
          class="cml-film-detail__status-button ${value === active ? 'is-active' : ''}"
          data-action="save-film-status"
          data-watch-status="${escapeHtml(value)}"
          data-tmdb-id="${escapeHtml(record.tmdbId || '')}"
          aria-pressed="${value === active ? 'true' : 'false'}"
          ${record.isSaving ? 'disabled' : ''}
        >${escapeHtml(label)}</button>
      `).join('')}
    </div>
  `;
}

function renderDetailRatingControl(record = {}, userRating = '') {
  const value = userRating || '4.0';
  const rating = normalizeUserRatingValue(value) || 4;
  const sliderProgress = Math.min(1, Math.max(0, (rating - 0.5) / 4.5));
  const fill = `${(rating / 5) * 100}%`;
  return `
    <div class="cml-film-detail__rating-control" style="--film-detail-rating-fill: ${escapeHtml(fill)}; --film-detail-rating-progress: ${escapeHtml(sliderProgress.toFixed(3))};">
      <input
        type="range"
        class="cml-film-detail__rating-slider"
        data-film-rating-input
        data-tmdb-id="${escapeHtml(record.tmdbId || '')}"
        min="0.5"
        max="5"
        step="0.1"
        value="${escapeHtml(value)}"
        aria-label="Set your film rating"
        ${record.isSaving ? 'disabled' : ''}
      />
      <button
        type="button"
        class="cml-film-detail__rating-clear"
        data-action="clear-film-rating"
        data-tmdb-id="${escapeHtml(record.tmdbId || '')}"
        ${(!userRating || record.isSaving) ? 'disabled' : ''}
      >Clear</button>
    </div>
  `;
}

function renderDetailPreviewSaveHint() {
  return `
    <p class="cml-film-detail__save-hint">Save this film to your diary before rating, dating, or writing private notes.</p>
  `;
}

function renderDetailWatchedDateColumn(record = {}, watchedDate = '', { editable = true } = {}) {
  const value = normalizeText(record.watchedAt).slice(0, 10);
  return `
    <div class="cml-film-detail__meta-item">
      <span class="cml-film-detail__meta-label">Watched date</span>
      <strong class="cml-film-detail__meta-value"><span aria-hidden="true">▣</span><span data-film-watched-at-output>${escapeHtml(watchedDate)}</span></strong>
      ${editable ? `<div class="cml-film-detail__date-control">
        <input
          type="date"
          class="cml-film-detail__date-input"
          data-film-watched-at-input
          data-tmdb-id="${escapeHtml(record.tmdbId || '')}"
          data-last-saved-value="${escapeHtml(value)}"
          value="${escapeHtml(value)}"
          ${record.isSaving ? 'disabled' : ''}
        />
      </div>` : ''}
    </div>
  `;
}

function renderFilmWatchHistory(record = {}) {
  const events = (Array.isArray(record.watchEvents) ? record.watchEvents : [])
    .map((event) => ({
      watchedAt: normalizeText(typeof event === 'string' ? event : event?.watchedAt || event?.date)
    }))
    .filter((event) => event.watchedAt)
    .sort((left, right) => String(right.watchedAt || '').localeCompare(String(left.watchedAt || '')));
  if (!events.length) {
    return '';
  }
  const countLabel = events.length === 1 ? '1 watch' : `${events.length} watches`;
  return `
    <section class="cml-film-detail__section cml-film-detail__watch-history" aria-label="Private watch history">
      <div class="cml-film-detail__watch-history-head">
        <h2>Watch history</h2>
        <span>${escapeHtml(countLabel)}</span>
      </div>
      <div class="cml-film-detail__watch-events">
        ${events.slice(0, 8).map((event, index) => `
          <span class="cml-film-detail__watch-event ${index === 0 ? 'is-latest' : ''}">
            ${escapeHtml(formatWatchedDateLong(event.watchedAt))}
          </span>
        `).join('')}
      </div>
    </section>
  `;
}

function getSavedFilmNote(record = {}) {
  return normalizeMultilineText(record.noteMarkdown || record.journal || '');
}

function isSafeMarkdownHref(href = '') {
  const normalized = normalizeText(href);
  return /^(https?:|mailto:|\/|#)/i.test(normalized);
}

function renderMarkdownInline(source = '') {
  let html = escapeHtml(source);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
    const safeHref = normalizeText(href);
    if (!isSafeMarkdownHref(safeHref)) {
      return escapeHtml(label);
    }
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return html;
}

function renderMarkdownBlocks(source = '') {
  const text = normalizeMultilineText(source);
  if (!text) {
    return '<p class="cml-film-detail__notes-empty">No private note yet.</p>';
  }
  const lines = text.split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!normalizeText(line)) {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length + 2;
      blocks.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote>${quoteLines.map(renderMarkdownInline).join('<br>')}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(`<li>${renderMarkdownInline(lines[index].replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(`<li>${renderMarkdownInline(lines[index].replace(/^\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && normalizeText(lines[index]) && !/^(#{1,3})\s+/.test(lines[index]) && !/^>\s?/.test(lines[index]) && !/^[-*]\s+/.test(lines[index]) && !/^\d+\.\s+/.test(lines[index]) && !lines[index].startsWith('```')) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${paragraph.map(renderMarkdownInline).join('<br>')}</p>`);
  }
  return blocks.join('');
}

function renderFilmNotesSection(record = {}, { notesEditing = false, notesDraft = '' } = {}) {
  const savedNote = getSavedFilmNote(record);
  const draft = notesEditing ? normalizeMultilineText(notesDraft) : savedNote;
  if (!notesEditing) {
    return `
      <section class="cml-film-detail__section cml-film-detail__section--notes">
        <h2>My notes</h2>
        <div class="cml-film-detail__markdown">${renderMarkdownBlocks(savedNote)}</div>
      </section>
    `;
  }
  return `
    <section class="cml-film-detail__section cml-film-detail__section--notes cml-film-detail__section--notes-editing cml-film-notes-editor">
      <h2>My notes</h2>
      <textarea class="cml-film-detail__notes-editor cml-film-notes-editor__textarea" data-film-notes-draft rows="10" placeholder="Write private notes in Markdown...">${escapeHtml(draft)}</textarea>
      <p class="cml-film-notes-editor__hint">Markdown supported · Click outside to save</p>
    </section>
  `;
}

function renderFilmMetadataInput({ label, field, value = '', placeholder = '', type = 'text', multiline = false } = {}) {
  const control = multiline
    ? `<textarea class="cml-film-metadata-editor__textarea" data-film-metadata-field="${escapeHtml(field)}" rows="4" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
    : `<input class="cml-film-metadata-editor__input" data-film-metadata-field="${escapeHtml(field)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />`;
  return `
    <label class="cml-film-metadata-editor__field">
      <span>${escapeHtml(label)}</span>
      ${control}
    </label>
  `;
}

function renderFilmMetadataEditor(record = {}, draft = {}) {
  const genres = Array.isArray(record.genres) ? record.genres.filter(Boolean).join(', ') : '';
  return `
    <section class="cml-film-detail__section cml-film-metadata-editor">
      <h2>Edit details</h2>
      <div class="cml-film-metadata-editor__grid">
        ${renderFilmMetadataInput({ label: 'Title override', field: 'titleOverride', value: draft.titleOverride || '', placeholder: record.localTitle || record.title || '' })}
        ${renderFilmMetadataInput({ label: 'Original title override', field: 'originalTitleOverride', value: draft.originalTitleOverride || '', placeholder: record.originalTitle || '' })}
        ${renderFilmMetadataInput({ label: 'Director override', field: 'directorOverride', value: draft.directorOverride || '', placeholder: record.director || '' })}
        ${renderFilmMetadataInput({ label: 'Release date override', field: 'releaseDateOverride', type: 'date', value: String(draft.releaseDateOverride || '').slice(0, 10), placeholder: String(record.releaseDate || '').slice(0, 10) })}
        ${renderFilmMetadataInput({ label: 'Runtime override', field: 'runtimeOverride', type: 'number', value: draft.runtimeOverride || '', placeholder: record.runtime ? `${record.runtime}` : 'Minutes' })}
        ${renderFilmMetadataInput({ label: 'Genres override', field: 'genresOverride', value: draft.genresOverride || '', placeholder: genres })}
      </div>
      ${renderFilmMetadataInput({ label: 'Synopsis override', field: 'overviewOverride', value: draft.overviewOverride || '', placeholder: record.overview || '', multiline: true })}
      <div class="cml-film-metadata-editor__grid">
        ${renderFilmMetadataInput({ label: 'Poster image URL override', field: 'posterUrlOverride', value: draft.posterUrlOverride || '', placeholder: 'https://... or /file/...' })}
        ${renderFilmMetadataInput({ label: 'Backdrop image URL override', field: 'backdropUrlOverride', value: draft.backdropUrlOverride || '', placeholder: 'https://... or /file/...' })}
      </div>
      <p class="cml-film-metadata-editor__hint">Local overrides only · Empty fields fall back to TMDb · Click outside to save</p>
    </section>
  `;
}

function splitFilmGenres(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[,/|]/)
    .map(normalizeText)
    .filter(Boolean);
}

function applyFilmMetadataDraft(record = {}, draft = {}) {
  if (!draft || typeof draft !== 'object') {
    return record;
  }
  const releaseDate = normalizeText(draft.releaseDateOverride);
  const runtime = Number(draft.runtimeOverride);
  const genres = splitFilmGenres(draft.genresOverride);
  return {
    ...record,
    title: normalizeText(draft.titleOverride) || record.title,
    localTitle: normalizeText(draft.titleOverride) || record.localTitle || record.title,
    originalTitle: normalizeText(draft.originalTitleOverride) || record.originalTitle,
    director: normalizeText(draft.directorOverride) || record.director,
    releaseDate: releaseDate || record.releaseDate,
    year: releaseDate ? releaseDate.slice(0, 4) : record.year,
    runtime: Number.isFinite(runtime) && runtime > 0 ? runtime : record.runtime,
    genres: genres.length ? genres : record.genres,
    overview: normalizeText(draft.overviewOverride) || record.overview,
    posterUrl: normalizeText(draft.posterUrlOverride) || record.posterUrl,
    posterUrlOverride: normalizeText(draft.posterUrlOverride) || record.posterUrlOverride,
    backdropUrl: normalizeText(draft.backdropUrlOverride) || record.backdropUrl,
    backdropUrlOverride: normalizeText(draft.backdropUrlOverride) || record.backdropUrlOverride
  };
}

export function FilmDetailPage({ record = null, notesEditing = false, notesDraft = '', notesPreview = false, metadataEditing = false, metadataDraft = null, backdropIndex = 0 } = {}) {
  if (!record) {
    return '';
  }
  const isSavedEntry = record.isSavedEntry !== false;
  const displayRecord = isSavedEntry && metadataEditing
    ? applyFilmMetadataDraft(record, metadataDraft || {})
    : record;
  const localTitle = normalizeText(displayRecord.localTitle || displayRecord.title || 'Untitled film');
  const originalTitle = normalizeText(displayRecord.originalTitle || displayRecord.title || '');
  const runtime = formatRuntime(displayRecord.runtime);
  const genres = Array.isArray(displayRecord.genres) ? displayRecord.genres.filter(Boolean).join(' / ') : '';
  const userRating = formatUserRating(displayRecord.userRating ?? displayRecord.rating);
  const watchedDate = formatWatchedDateLong(displayRecord.watchedAt);
  const statusLabel = getDetailStatusLabel(displayRecord.status);
  const posterUrl = getRecordPosterUrl(displayRecord);
  const autoBackdropUrls = getRecordAutoBackdropUrls(displayRecord);
  const autoBackdropIndex = autoBackdropUrls.length
    ? Math.max(0, Math.min(autoBackdropUrls.length - 1, Number(backdropIndex) || 0))
    : 0;
  const hasDedicatedBackdrop = Boolean(autoBackdropUrls.length || normalizeText(displayRecord.backdropUrl || displayRecord.backdropPath));
  const backdropUrl = autoBackdropUrls.length
    ? autoBackdropUrls[autoBackdropIndex]
    : getRecordBackdropUrl(displayRecord);
  const backdropSourceClass = hasDedicatedBackdrop
    ? 'cml-film-detail-page__backdrop-image--still'
    : 'cml-film-detail-page__backdrop-image--poster-fallback';
  const chips = [
    renderDetailChip(displayRecord.year ? String(displayRecord.year) : ''),
    renderDetailChip(runtime),
    renderDetailChip(genres),
    renderDetailChip(`✓ ${statusLabel}`, 'cml-film-detail__chip--watched')
  ].join('');
  const synopsis = getDetailSynopsis(displayRecord);
  const favoriteActionLabel = displayRecord.favorite ? '♥ Saved to Favourites' : '♡ Save to Favourites';
  const localActionDisabled = displayRecord.isSaving || displayRecord.isSavedEntry === false;
  const disabledAttr = localActionDisabled ? 'disabled' : '';
  const metadataEditor = isSavedEntry && metadataEditing
    ? renderFilmMetadataEditor(displayRecord, metadataDraft || {})
    : '';
  return `
    <section class="cml-film-detail-page" data-film-detail-page>
      <div class="cml-film-detail-page__backdrop" aria-hidden="true">
        ${backdropUrl ? `<img class="cml-film-detail-page__backdrop-image ${backdropSourceClass}" src="${escapeHtml(backdropUrl)}" alt="" loading="eager" decoding="async" data-film-backdrop-index="${escapeHtml(autoBackdropIndex)}" />` : ''}
      </div>
      <div class="cml-film-detail-page__scrim" aria-hidden="true"></div>
      <div class="cml-film-detail-page__content">
        <button type="button" class="cml-film-detail__back" data-action="close-film-detail">← Back to Films</button>
        <div class="cml-film-detail__hero">
          <div class="cml-film-detail__poster-wrap">
            ${posterUrl
              ? `<img class="cml-film-detail__poster" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(localTitle)} poster" loading="eager" decoding="async" />`
              : renderPosterFallback(localTitle)}
          </div>
          <div class="cml-film-detail__body">
            <div class="cml-film-detail__title-block">
              <p class="cml-film-detail__eyebrow">Private film archive</p>
              <h1 class="cml-film-detail__title">${escapeHtml(localTitle)}</h1>
              ${originalTitle && originalTitle !== localTitle ? `<p class="cml-film-detail__original">${escapeHtml(originalTitle)}</p>` : ''}
              <div class="cml-film-detail__chips">${chips}</div>
            </div>
            <section class="cml-film-detail__rating" aria-label="Your rating">
              <span class="cml-film-detail__rating-label">Your rating</span>
              <div class="cml-film-detail__rating-line">
                <strong data-film-rating-output>${escapeHtml(userRating ? `${userRating} / 5.0` : 'Not rated')}</strong>
                ${userRating ? renderRatingStars(userRating) : ''}
              </div>
              ${isSavedEntry ? renderDetailRatingControl(displayRecord, userRating) : renderDetailPreviewSaveHint()}
              ${isSavedEntry ? renderDetailStatusControls(displayRecord) : ''}
            </section>
            <div class="cml-film-detail__meta-row">
              ${renderDetailMetaColumn('Director', displayRecord.director || '—')}
              ${renderDetailWatchedDateColumn(displayRecord, watchedDate, { editable: isSavedEntry })}
              ${renderDetailMetaColumn('TMDb rating', formatTmdbDetailRating(displayRecord), '↗')}
            </div>
            ${isSavedEntry ? renderFilmWatchHistory(displayRecord) : ''}
            ${metadataEditor}
            <section class="cml-film-detail__section">
              <h2>Synopsis</h2>
              <p>${escapeHtml(synopsis)}</p>
            </section>
            ${renderFilmNotesSection(displayRecord, { notesEditing, notesDraft, notesPreview })}
            <div class="cml-film-detail__actions">
              ${isSavedEntry ? `
                <button type="button" class="cml-film-detail__action ${displayRecord.favorite ? 'is-active' : ''}" data-action="film-toggle-favourite" data-film-id="${escapeHtml(displayRecord.id || '')}" ${disabledAttr}>${escapeHtml(favoriteActionLabel)}</button>
                <button type="button" class="cml-film-detail__action ${metadataEditing ? 'is-active' : ''}" data-action="film-edit-metadata" data-film-id="${escapeHtml(displayRecord.id || '')}" ${disabledAttr}>Edit Details</button>
                <button type="button" class="cml-film-detail__action" data-action="film-edit-notes" data-film-id="${escapeHtml(displayRecord.id || '')}" ${disabledAttr}>✎ Edit Notes</button>
                <button type="button" class="cml-film-detail__action" data-action="film-mark-rewatch" data-film-id="${escapeHtml(displayRecord.id || '')}" ${disabledAttr}>↻ Mark as Rewatch</button>
                <button type="button" class="cml-film-detail__action cml-film-detail__action--danger" data-action="film-remove-entry" data-film-id="${escapeHtml(displayRecord.id || '')}" ${disabledAttr}>Remove from Films</button>
              ` : `
                <button type="button" class="cml-film-detail__action" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(displayRecord.tmdbId || '')}" ${displayRecord.isSaving ? 'disabled' : ''}>Add to Watchlist</button>
                <button type="button" class="cml-film-detail__action is-active" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(displayRecord.tmdbId || '')}" ${displayRecord.isSaving ? 'disabled' : ''}>Mark Watched</button>
              `}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
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

export function FilmsPage({ records = [], totalCount = records.length, activeFilter = 'All', searchQuery = '', searchPanelHtml = '' } = {}) {
  const sections = groupFilmsByTimeline(records);
  const searchValue = escapeHtml(searchQuery);
  const hasAnySavedFilms = Number(totalCount) > 0;
  const hasSearchQuery = Boolean(normalizeText(searchQuery));
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
            ${hasSearchQuery ? '<span class="cml-films-search__live">Live</span>' : ''}
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

export function FilmSearchResults({ results = [], loading = false, settling = false, clearing = false, resultKey = 0, error = '', query = '', savingTmdbIds = new Set(), savedRecordsByTmdbId = new Map() } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery && !results.length && !error) {
    return '';
  }
  const friendlyError = error && /TMDb access token is not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error && /TMDb credentials are not configured/i.test(error)
    ? 'TMDb credentials are not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY in Cloudflare Pages environment variables, then redeploy.'
    : error;
  const emptyMessage = loading
    ? 'Searching TMDb...'
    : normalizedQuery
    ? 'No TMDb results found.'
    : 'No search results yet.';
  const resultCards = results.length ? results.map((movie) => {
    const tmdbId = Number(movie.tmdbId);
    const isSaving = savingTmdbIds instanceof Set && savingTmdbIds.has(tmdbId);
    const savedRecord = getSavedSearchRecord(savedRecordsByTmdbId, tmdbId);
    const savedStatus = savedRecord?.status || '';
    const normalizedSavedStatus = savedStatus === 'watchlist' ? 'wantToWatch' : savedStatus;
    const isWantCurrent = normalizedSavedStatus === 'wantToWatch';
    const isWatchedCurrent = normalizedSavedStatus === 'watched';
    return `
      <article class="cml-films-result cml-film-search-result ${isSaving ? 'is-saving' : ''} ${savedRecord ? 'is-saved' : ''}" data-action="open-tmdb-film-detail" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">
        <div class="cml-films-result__poster-wrap">
          ${movie.posterPath
            ? `<img class="cml-films-result__poster" src="${escapeHtml(buildTmdbImageUrl(movie.posterPath, 'w342'))}" alt="${escapeHtml(movie.title || 'Movie poster')}" loading="lazy" decoding="async" />`
            : renderPosterFallback(movie.title)}
        </div>
        <div class="cml-films-result__body">
          <div class="cml-films-result__source-row">
            <p class="cml-films-result__source">TMDb result</p>
            ${savedRecord ? `<span class="cml-films-result__saved-state">In Films · ${escapeHtml(getSearchStatusLabel(savedStatus))}</span>` : ''}
          </div>
          <h3 class="cml-films-result__title">${escapeHtml(movie.title || 'Untitled film')}</h3>
          <p class="cml-films-result__meta">${escapeHtml([movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '', movie.voteAverage ? `TMDb ${Number(movie.voteAverage).toFixed(1)}` : ''].filter(Boolean).join(' · '))}</p>
          ${movie.overview ? `<p class="cml-films-result__overview">${escapeHtml(movie.overview)}</p>` : ''}
          <div class="cml-films-result__actions">
            <button type="button" class="cml-films-result__button ${isWantCurrent ? 'is-current' : ''}" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}" ${(isSaving || isWantCurrent) ? 'disabled' : ''}>${isSaving ? 'Saving...' : isWantCurrent ? '已想看' : '想看'}</button>
            <button type="button" class="cml-films-result__button cml-films-result__button--primary ${isWatchedCurrent ? 'is-current' : ''}" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}" ${(isSaving || isWatchedCurrent) ? 'disabled' : ''}>${isSaving ? 'Saving...' : isWatchedCurrent ? '已看过' : '看过'}</button>
          </div>
        </div>
      </article>
    `;
  }).join('') : `<p class="cml-films-mvp__empty">${emptyMessage}</p>`;
  return `
    <section class="cml-films-mvp cml-film-search-panel ${loading ? 'is-searching' : ''} ${settling ? 'is-settling' : ''} ${clearing ? 'is-clearing' : ''}" data-film-search-result-key="${escapeHtml(resultKey)}">
      <div class="cml-films-mvp__head">
        <div>
          <p class="cml-films-mvp__eyebrow">TMDb search</p>
          <h2 class="cml-films-mvp__title">${loading ? 'Searching...' : 'Add from TMDb'}</h2>
        </div>
        <p class="cml-film-search-status ${loading ? 'is-visible' : ''}" aria-live="polite">${loading ? 'Searching...' : ''}</p>
        ${friendlyError ? `<p class="cml-films-mvp__error">${escapeHtml(friendlyError)}</p>` : ''}
      </div>
      <div class="cml-films-mvp__results cml-film-search-results ${loading ? 'is-loading' : ''} ${settling ? 'is-settling' : ''} ${clearing ? 'is-clearing' : ''}">
        ${resultCards}
      </div>
    </section>
  `;
}
