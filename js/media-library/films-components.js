import { FILM_FILTERS } from './films-data.js?v=7';

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
  return normalizeFilmNoteForSave(value);
}

function normalizeFilmNoteDraftForEdit(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n');
}

function normalizeFilmNoteForSave(value) {
  return normalizeFilmNoteDraftForEdit(value)
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
    return '-';
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
  if (value === null || value === undefined || value === '') {
    return null;
  }
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
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:') || normalized.startsWith('/file/')) {
    return normalized;
  }
  return `https://image.tmdb.org/t/p/${size}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function normalizeImagePathList(values = []) {
  const paths = [];
  (Array.isArray(values) ? values : [])
    .map(normalizeText)
    .filter(Boolean)
    .forEach((path) => {
      if (!paths.includes(path)) {
        paths.push(path);
      }
    });
  return paths.slice(0, 20);
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
  return record.posterUrlOverride
    || record.posterUrl
    || buildTmdbImageUrl(record.posterPathOverride || record.posterPath, 'w342')
    || '';
}

function getRecordBackdropUrl(record = {}) {
  return record.backdropUrlOverride
    || record.backdropUrl
    || buildTmdbImageUrl(record.backdropPathOverride || record.backdropPath, 'w1280')
    || getRecordPosterUrl(record);
}

function getRecordAutoBackdropUrls(record = {}) {
  if (normalizeText(record.backdropUrlOverride) || normalizeText(record.backdropPathOverride)) {
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

function renderFilmCardInfoItem(label, value, key = '') {
  if (!normalizeText(value)) {
    return '';
  }
  const normalizedLabel = normalizeText(label);
  const labelKey = (normalizeText(key) || normalizedLabel || 'meta').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `
    <div class="cml-film-card__info-item cml-film-card__info-item--${escapeHtml(labelKey)}">
      ${normalizedLabel ? `<span class="cml-film-card__info-label">${escapeHtml(normalizedLabel)}</span>` : ''}
      <strong class="cml-film-card__info-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function formatFilmCardMetaLine(parts = []) {
  const values = [];
  parts
    .flatMap((part) => String(part ?? '').split(/\s*(?:\/|\|)\s*/))
    .map(normalizeText)
    .filter(Boolean)
    .forEach((part) => {
      if (!values.includes(part)) {
        values.push(part);
      }
    });
  return values.join(' \u00b7 ');
}

function formatUserRating5(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0.5 && numeric <= 5
    ? numeric.toFixed(1)
    : '';
}

function formatTmdbRating10(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 10
    ? numeric.toFixed(1)
    : '';
}

function getTmdbRatingLabel(value) {
  const formatted = formatTmdbRating10(value);
  return formatted ? `${formatted} / 10` : '';
}

function getRatingStarFill(value, index) {
  const rating = normalizeUserRatingValue(value);
  if (rating === null) {
    return 0;
  }
  const visualRating = Math.min(5, Math.max(0.5, Math.round(rating * 2) / 2));
  if (visualRating >= index) {
    return 100;
  }
  if (visualRating >= index - 0.5) {
    return 50;
  }
  return 0;
}

function renderRatingStar(fill = 0) {
  return `
    <span class="cml-film-star" style="--film-star-fill: ${escapeHtml(Math.max(0, Math.min(100, Number(fill) || 0)))}%;">
      <svg class="cml-film-star__base" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.8l2.74 5.72 6.31.85-4.61 4.37 1.15 6.25L12 16.95 6.41 19.99l1.15-6.25-4.61-4.37 6.31-.85L12 2.8z"></path>
      </svg>
      <span class="cml-film-star__fill" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 2.8l2.74 5.72 6.31.85-4.61 4.37 1.15 6.25L12 16.95 6.41 19.99l1.15-6.25-4.61-4.37 6.31-.85L12 2.8z"></path>
        </svg>
      </span>
    </span>
  `;
}

function getSearchStatusLabel(status = '') {
  const labels = {
    watchlist: 'Want',
    wantToWatch: 'Want',
    watched: 'Watched'
  };
  return labels[status] || 'Saved';
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
  return normalizeText(record.overview || '');
}

function renderDetailMetaColumn(label, value, icon = '', { editable = false, field = '', filmId = '' } = {}) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return '';
  }
  const editAttrs = editable && field
    ? ` data-action="film-edit-metadata" data-film-id="${escapeHtml(filmId)}" data-film-metadata-focus-field="${escapeHtml(field)}" role="button" aria-label="Edit ${escapeHtml(label)}"`
    : '';
  return `
    <div class="cml-film-detail__meta-item ${editable && field ? 'is-editable' : ''}"${editAttrs}>
      <span class="cml-film-detail__meta-label">${escapeHtml(label)}</span>
      <strong class="cml-film-detail__meta-value">${icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ''}${escapeHtml(normalizedValue)}</strong>
    </div>
  `;
}

function renderDetailRatingControl(record = {}, userRating = '') {
  const hasRating = Boolean(normalizeText(userRating));
  const rating = normalizeUserRatingValue(userRating);
  const value = rating === null ? '' : rating.toFixed(1);
  const label = rating === null ? 'Rate this film' : `${rating.toFixed(1)} out of 5`;
  return `
    <div class="cml-film-rating-control ${hasRating ? 'has-rating' : 'is-unset'}" data-film-rating-shell>
      <div
        class="cml-film-rating-control__stars"
        data-action="set-film-rating"
        data-film-rating-control
        data-film-id="${escapeHtml(record.id || '')}"
        data-tmdb-id="${escapeHtml(record.tmdbId || '')}"
        data-current-rating="${escapeHtml(value)}"
        role="slider"
        tabindex="${record.isSaving ? '-1' : '0'}"
        aria-label="${escapeHtml(label)}"
        aria-valuemin="0"
        aria-valuemax="5"
        aria-valuenow="${escapeHtml(value || '0')}"
        aria-valuetext="${escapeHtml(label)}"
        ${record.isSaving ? 'aria-disabled="true"' : ''}
      >
        ${[1, 2, 3, 4, 5].map((index) => renderRatingStar(getRatingStarFill(rating, index))).join('')}
      </div>
      <span class="cml-film-rating-control__value" data-film-rating-output>${escapeHtml(hasRating ? value : 'Rate this film')}</span>
      <span class="cml-film-rating-control__status ${record.ratingSyncError ? 'is-visible is-error' : ''}" data-film-rating-status>
        ${record.ratingSyncError
          ? `Unsynced <button type="button" data-action="film-retry-rating" data-film-id="${escapeHtml(record.id || '')}">Retry</button>`
          : ''}
      </span>
      <button
        type="button"
        class="cml-film-detail__rating-clear"
        data-action="clear-film-rating"
        data-tmdb-id="${escapeHtml(record.tmdbId || '')}"
        data-film-id="${escapeHtml(record.id || '')}"
        ${(!userRating || record.isSaving) ? 'hidden disabled' : ''}
      >Remove rating</button>
    </div>
  `;
}

function renderDetailPreviewSaveHint() {
  return `
    <p class="cml-film-detail__save-hint">Save this film to your diary before rating, dating, or writing private notes.</p>
  `;
}

function getFilmWatchEvents(record = {}) {
  return (Array.isArray(record.watchEvents) ? record.watchEvents : [])
    .map((event, index) => {
      const watchedAt = normalizeText(typeof event === 'string' ? event : event?.watchedAt || event?.date);
      const id = normalizeText(typeof event === 'object' ? event?.id || event?.watchEventId : '')
        || (watchedAt ? `watch-${String(watchedAt).replace(/[^0-9a-z]/gi, '')}-${index}` : '');
      const rating = Number(typeof event === 'object' ? event?.rating : null);
      const note = normalizeText(typeof event === 'object' ? event?.note : '');
      return {
        id,
        watchedAt,
        rating: Number.isFinite(rating) ? rating : null,
        note
      };
    })
    .filter((event) => event.watchedAt)
    .sort((left, right) => String(right.watchedAt || '').localeCompare(String(left.watchedAt || '')));
}

function renderFilmMyFilmSection(record = {}, { userRating = '', disabledAttr = '' } = {}) {
  const events = getFilmWatchEvents(record);
  const countLabel = events.length === 1 ? '1 watch' : `${events.length} watches`;
  const latestDate = events[0]?.watchedAt || '';
  const filmId = escapeHtml(record.id || '');
  const syncLabel = record.filmSyncError
    ? '<span class="cml-film-rating-control__status is-visible is-error">Unsynced</span>'
    : '';
  return `
    <section class="cml-film-detail__section cml-film-detail__my-film" aria-label="My film">
      <div class="cml-film-detail__section-head">
        <div>
          <h2>My film</h2>
        </div>
        ${syncLabel}
      </div>
      <div class="cml-film-detail__my-film-strip">
        <div class="cml-film-detail__signal-value cml-film-detail__signal-value--rating">
          ${renderDetailRatingControl(record, userRating)}
        </div>
        <div class="cml-film-detail__my-film-actions">
          <button
            type="button"
            class="cml-film-detail__signal-favourite ${record.favorite ? 'is-active' : ''}"
            data-action="film-toggle-favourite"
            data-film-id="${escapeHtml(record.id || '')}"
            aria-pressed="${record.favorite ? 'true' : 'false'}"
            aria-label="${record.favorite ? 'Remove favourite' : 'Save to favourites'}"
            ${disabledAttr}
          ><span aria-hidden="true">&#9829;</span>${record.favorite ? 'Favourited' : 'Add favourite'}</button>
        </div>
        <div class="cml-film-detail__my-film-status">
          ${events.length
            ? `<div class="cml-film-detail__watch-inline">
                <strong>${events.length > 1 ? `Latest ${formatWatchedDateLong(latestDate)}` : `Watched ${formatWatchedDateLong(latestDate)}`}</strong>
                ${events.length > 1 ? `<span>${escapeHtml(countLabel)}</span>` : ''}
              </div>`
            : ''}
          <div class="cml-film-detail__watch-actions">
            ${events.length
              ? `<button type="button" class="cml-film-detail__watch-primary" data-action="film-mark-rewatch" data-film-id="${filmId}" ${disabledAttr}>+ Rewatch</button>
                 <button type="button" class="cml-film-detail__watch-secondary" data-action="film-move-to-want" data-film-id="${filmId}" ${disabledAttr}>Move to Want</button>`
              : `<button type="button" class="cml-film-detail__watch-primary" data-action="film-mark-watched" data-film-id="${filmId}" ${disabledAttr}>Mark watched</button>`}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderFilmWatchHistory(record = {}) {
  const events = getFilmWatchEvents(record);
  const countLabel = events.length === 1 ? '1 watch' : `${events.length} watches`;
  const filmId = escapeHtml(record.id || '');
  if (events.length <= 1) {
    return '';
  }
  return `
    <section class="cml-film-detail__section cml-film-detail__watch-history" aria-label="Watch history">
      <div class="cml-film-detail__watch-history-head">
        <div>
          <h2>Watch history</h2>
        </div>
        <span>${escapeHtml(countLabel)}</span>
      </div>
      <div class="cml-film-detail__watch-events">
        ${events.slice(0, 8).map((event, index) => `
          <article class="cml-film-detail__watch-event ${index === 0 ? 'is-latest' : ''}" data-film-watch-event-rating="${escapeHtml(event.rating ?? '')}" data-film-watch-event-note="${escapeHtml(event.note || '')}">
            <span class="cml-film-detail__watch-event-node" aria-hidden="true"></span>
            <div class="cml-film-detail__watch-event-card">
              <div class="cml-film-detail__watch-event-topline">
                <button
                  type="button"
                  class="cml-film-detail__watch-event-delete"
                  data-action="film-delete-watch-event"
                  data-film-id="${filmId}"
                  data-film-watch-event-id="${escapeHtml(event.id)}"
                  data-film-watch-event="${escapeHtml(event.watchedAt)}"
                  aria-label="Remove watch date ${escapeHtml(formatWatchedDateLong(event.watchedAt))}"
                >Remove</button>
              </div>
              <label class="cml-film-detail__watch-event-date">
                <strong>${formatWatchedDateLong(event.watchedAt)}</strong>
                <input
                  type="date"
                  class="cml-film-detail__watch-event-input"
                  data-film-watch-event-input
                  data-film-id="${filmId}"
                  data-film-watch-event-id="${escapeHtml(event.id)}"
                  data-film-watch-event="${escapeHtml(event.watchedAt)}"
                  value="${escapeHtml(event.watchedAt)}"
                  aria-label="Edit watch date ${escapeHtml(formatWatchedDateLong(event.watchedAt))}"
                />
              </label>
              ${event.rating || event.note ? `
                <div class="cml-film-detail__watch-event-private">
                  ${event.rating ? `<span>${escapeHtml(Number(event.rating).toFixed(1))} / 5</span>` : ''}
                  ${event.note ? `<span>${escapeHtml(event.note)}</span>` : ''}
                </div>
              ` : ''}
            </div>
          </article>
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

export function renderMarkdownBlocks(source = '') {
  const text = normalizeMultilineText(source);
  if (!text) {
    return '<p class="cml-film-detail__notes-empty">Write a note...</p>';
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

function getFilmNoteSourceBlockRange(lines = [], activeLineIndex = 0) {
  let fenceStart = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!String(lines[index] ?? '').startsWith('```')) {
      continue;
    }
    if (fenceStart < 0) {
      fenceStart = index;
      continue;
    }
    if (activeLineIndex >= fenceStart && activeLineIndex <= index) {
      return { start: fenceStart, end: index };
    }
    fenceStart = -1;
  }
  if (fenceStart >= 0 && activeLineIndex >= fenceStart) {
    return { start: fenceStart, end: lines.length - 1 };
  }
  return null;
}

function getFilmNoteSourceDescriptor(source = '', { sourceBlock = false } = {}) {
  const line = String(source ?? '');
  if (sourceBlock || line.startsWith('```')) {
    return { kind: 'code', tag: 'div' };
  }
  const heading = line.match(/^(#{1,3})\s+/);
  if (heading) {
    return { kind: `heading-${heading[1].length}`, tag: `h${heading[1].length + 2}` };
  }
  if (!line) {
    return { kind: 'blank', tag: 'div' };
  }
  if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
    return { kind: 'list', tag: 'div' };
  }
  if (/^>\s?/.test(line)) {
    return { kind: 'quote', tag: 'blockquote' };
  }
  return { kind: 'paragraph', tag: 'p' };
}

function renderFilmNoteEditorLine(line = '', index = 0, activeLineIndex = 0, { sourcePreview = false, sourceBlock = false } = {}) {
  const lineIndex = Math.max(0, Number(index) || 0);
  const normalizedActiveLineIndex = Math.max(0, Number(activeLineIndex) || 0);
  const active = lineIndex === normalizedActiveLineIndex;
  const source = String(line ?? '');
  const { kind: lineKind, tag } = getFilmNoteSourceDescriptor(source, { sourceBlock });
  const debugAttrs = `data-film-notes-active-line-index="${escapeHtml(normalizedActiveLineIndex)}" data-film-notes-line-kind="${escapeHtml(lineKind)}" data-film-notes-raw-source="${escapeHtml(source)}"`;
  if (active) {
    const placeholder = lineIndex === 0 && !source ? 'Write a note...' : '';
    return `
      <${tag}
        class="cml-film-notes-editor__line cml-film-notes-editor__line--source cml-film-notes-editor__line--source--${escapeHtml(lineKind)} is-active"
        data-film-notes-line
        data-film-notes-line-index="${escapeHtml(lineIndex)}"
        data-film-notes-source-line
        data-film-notes-line-mode="source"
        data-film-notes-node-type="${escapeHtml(tag)}"
        ${debugAttrs}
        ${placeholder ? `data-placeholder="${escapeHtml(placeholder)}"` : ''}
        aria-label="Edit note line ${escapeHtml(lineIndex + 1)}"
      >${escapeHtml(source)}</${tag}>
    `;
  }
  if (sourcePreview) {
    return `
      <div
        class="cml-film-notes-editor__line cml-film-notes-editor__line--rendered cml-film-notes-editor__line--source-preview"
        data-action="film-edit-notes-line"
        data-film-notes-line
        data-film-notes-line-index="${escapeHtml(lineIndex)}"
        data-film-notes-line-mode="rendered-source-preview"
        data-film-notes-node-type="div"
        ${debugAttrs}
        contenteditable="false"
      ><code>${source ? escapeHtml(source) : '&nbsp;'}</code></div>
    `;
  }
  const rendered = normalizeText(source)
    ? renderMarkdownBlocks(source)
    : '<span class="cml-film-notes-editor__blank-line">&nbsp;</span>';
  return `
    <div
      class="cml-film-notes-editor__line cml-film-notes-editor__line--rendered"
      data-action="film-edit-notes-line"
      data-film-notes-line
      data-film-notes-line-index="${escapeHtml(lineIndex)}"
      data-film-notes-line-mode="rendered"
      data-film-notes-node-type="div"
      ${debugAttrs}
      contenteditable="false"
    >${rendered}</div>
  `;
}

function renderFilmNotesSyncStatus(record = {}, notesSyncError = false) {
  if (!notesSyncError) {
    return '';
  }
  return `
    <div class="cml-film-notes-editor__sync is-error">
      <span>Unsynced</span>
      <button type="button" data-action="film-retry-notes" data-film-id="${escapeHtml(record.id || '')}">Retry</button>
    </div>
  `;
}

function renderFilmNotesSection(record = {}, { notesEditing = false, notesDraft = '', notesActiveLine = 0, notesSyncError = false, editable = false } = {}) {
  const savedNote = getSavedFilmNote(record);
  const draft = notesEditing ? normalizeFilmNoteDraftForEdit(notesDraft) : savedNote;
  const syncStatus = renderFilmNotesSyncStatus(record, notesSyncError);
  const notesHead = `
    <div class="cml-film-detail__section-head">
      <div>
        <h2>Private notes</h2>
      </div>
      ${syncStatus}
    </div>
  `;
  if (!notesEditing) {
    const readableClass = editable ? ' cml-film-detail__section--notes-readable' : '';
    const editAttrs = editable
      ? ` data-action="film-edit-notes" data-film-id="${escapeHtml(record.id || '')}" role="button" tabindex="0" aria-label="Edit notes"`
      : '';
    return `
      <section class="cml-film-detail__section cml-film-detail__section--notes${readableClass}"${editAttrs}>
        ${notesHead}
        <div class="cml-film-detail__markdown">${renderMarkdownBlocks(savedNote)}</div>
      </section>
    `;
  }
  const lines = draft === '' ? [''] : draft.split('\n');
  const activeLineIndex = Math.max(0, Math.min(lines.length - 1, Number(notesActiveLine) || 0));
  const sourceBlockRange = getFilmNoteSourceBlockRange(lines, activeLineIndex);
  return `
    <section class="cml-film-detail__section cml-film-detail__section--notes cml-film-detail__section--notes-editing cml-film-notes-editor is-editing">
      ${notesHead}
      <div class="cml-film-notes-editor__surface cml-film-detail__markdown" data-film-notes-surface data-film-notes-draft role="textbox" aria-multiline="true" aria-label="Edit notes" contenteditable="true" spellcheck="true">
        ${lines.map((line, index) => renderFilmNoteEditorLine(line, index, activeLineIndex, {
          sourcePreview: Boolean(sourceBlockRange && index >= sourceBlockRange.start && index <= sourceBlockRange.end && index !== activeLineIndex),
          sourceBlock: Boolean(sourceBlockRange && index >= sourceBlockRange.start && index <= sourceBlockRange.end)
        })).join('')}
      </div>
    </section>
  `;
}

function renderFilmMetadataInput({ label, field, value = '', placeholder = '', type = 'text', multiline = false, required = false } = {}) {
  const control = multiline
    ? `<textarea class="cml-film-metadata-editor__textarea" data-film-metadata-field="${escapeHtml(field)}" rows="4" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>`
    : `<input class="cml-film-metadata-editor__input" data-film-metadata-field="${escapeHtml(field)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} />`;
  return `
    <label class="cml-film-metadata-editor__field">
      ${label ? `<span>${escapeHtml(label)}</span>` : ''}
      ${control}
    </label>
  `;
}

const FOCUSED_METADATA_FIELDS = {
  titleOverride: {
    title: 'Edit title',
    label: 'Title',
    placeholder(record = {}) {
      return record.localTitle || record.title || '';
    }
  },
  originalTitleOverride: {
    title: 'Edit original title',
    label: 'Original title',
    placeholder(record = {}) {
      return record.originalTitle || '';
    }
  },
  directorOverride: {
    title: 'Edit director',
    label: 'Director',
    placeholder(record = {}) {
      return record.director || '';
    }
  },
  releaseDateOverride: {
    title: 'Edit release date',
    label: 'Release date',
    type: 'date',
    placeholder(record = {}) {
      return String(record.releaseDate || '').slice(0, 10);
    }
  },
  runtimeOverride: {
    title: 'Edit runtime',
    label: 'Runtime',
    type: 'number',
    placeholder(record = {}) {
      return record.runtime ? `${record.runtime}` : 'Minutes';
    }
  },
  genresOverride: {
    title: 'Edit genres',
    label: 'Genres',
    placeholder(record = {}) {
      return Array.isArray(record.genres) ? record.genres.filter(Boolean).join(', ') : '';
    }
  },
  countryOverride: {
    title: 'Edit country',
    label: 'Country',
    placeholder(record = {}) {
      return record.country || '';
    }
  },
  languageOverride: {
    title: 'Edit language',
    label: 'Language',
    placeholder(record = {}) {
      return record.language || '';
    }
  },
  overviewOverride: {
    title: 'Edit overview',
    label: 'Overview',
    multiline: true,
    placeholder(record = {}) {
      return record.overview || '';
    }
  }
};

function renderFilmMetadataShortcut(label, field, filmId) {
  return `
    <button type="button" class="cml-film-metadata-shortcuts__item" data-action="film-edit-metadata" data-film-id="${escapeHtml(filmId)}" data-film-metadata-focus-field="${escapeHtml(field)}">
      ${escapeHtml(label)}
    </button>
  `;
}

function renderFilmMetadataFieldPicker(record = {}) {
  const filmId = record.id || '';
  return `
    <section class="cml-film-detail__section cml-film-metadata-editor cml-film-metadata-editor--popover cml-film-metadata-shortcuts" data-film-metadata-popover>
      <div class="cml-film-detail__section-head">
        <div>
          <h2>Edit details</h2>
        </div>
        <span class="cml-film-save-status" data-film-save-status="metadata"></span>
      </div>
      <div class="cml-film-metadata-shortcuts__grid">
        <div class="cml-film-metadata-shortcuts__group">
          <p>Identity</p>
          ${renderFilmMetadataShortcut('Title', 'titleOverride', filmId)}
          ${renderFilmMetadataShortcut('Original title', 'originalTitleOverride', filmId)}
          ${renderFilmMetadataShortcut('Director', 'directorOverride', filmId)}
        </div>
        <div class="cml-film-metadata-shortcuts__group">
          <p>Release</p>
          ${renderFilmMetadataShortcut('Date', 'releaseDateOverride', filmId)}
          ${renderFilmMetadataShortcut('Runtime', 'runtimeOverride', filmId)}
          ${renderFilmMetadataShortcut('Genres', 'genresOverride', filmId)}
          ${renderFilmMetadataShortcut('Country', 'countryOverride', filmId)}
          ${renderFilmMetadataShortcut('Language', 'languageOverride', filmId)}
        </div>
        <div class="cml-film-metadata-shortcuts__group">
          <p>Writing</p>
          ${renderFilmMetadataShortcut('Overview', 'overviewOverride', filmId)}
        </div>
        <div class="cml-film-metadata-shortcuts__group">
          <p>Images</p>
          <button type="button" class="cml-film-metadata-shortcuts__item" data-action="film-change-poster" data-film-id="${escapeHtml(filmId)}">Change poster</button>
          <button type="button" class="cml-film-metadata-shortcuts__item" data-action="film-change-backdrop" data-film-id="${escapeHtml(filmId)}">Change backdrop</button>
          ${record.tmdbId ? '<button type="button" class="cml-film-metadata-shortcuts__item cml-film-metadata-shortcuts__item--secondary" data-action="film-refresh-tmdb" data-film-id="' + escapeHtml(filmId) + '">Refresh details</button>' : ''}
        </div>
        <div class="cml-film-metadata-shortcuts__group cml-film-metadata-shortcuts__group--danger">
          <p>Manage</p>
          <button type="button" class="cml-film-metadata-shortcuts__item cml-film-metadata-shortcuts__item--danger" data-action="film-remove-entry" data-film-id="${escapeHtml(filmId)}">Remove from library</button>
        </div>
      </div>
    </section>
  `;
}

function renderFocusedFilmMetadataEditor(record = {}, draft = {}, focusedField = '', { embedded = false } = {}) {
  const config = FOCUSED_METADATA_FIELDS[focusedField];
  if (!config) {
    return '';
  }
  const isEmbeddedOverview = embedded && focusedField === 'overviewOverride';
  if (isEmbeddedOverview) {
    return `
      <div class="cml-film-detail__synopsis-editor is-editing">
        <textarea class="cml-film-metadata-editor__textarea cml-film-detail__synopsis-textarea" data-film-metadata-field="overviewOverride" rows="10" placeholder="${escapeHtml(typeof config.placeholder === 'function' ? config.placeholder(record) : '')}">${escapeHtml(draft[focusedField] || '')}</textarea>
      </div>
    `;
  }
  const tag = embedded ? 'div' : 'section';
  const className = [
    embedded ? '' : 'cml-film-detail__section',
    'cml-film-metadata-editor',
    'cml-film-metadata-editor--focused',
    embedded ? '' : 'cml-film-metadata-editor--popover',
    embedded ? 'cml-film-metadata-editor--inline' : ''
  ].filter(Boolean).join(' ');
  return `
    <${tag} class="${className}" data-film-metadata-popover data-film-metadata-focus-field="${escapeHtml(focusedField)}">
      <div class="cml-film-detail__section-head">
        <div>
          <h2>${escapeHtml(config.title)}</h2>
        </div>
        <span class="cml-film-save-status" data-film-save-status="metadata"></span>
      </div>
      ${renderFilmMetadataInput({
        label: config.label,
        field: focusedField,
        value: draft[focusedField] || '',
        placeholder: typeof config.placeholder === 'function' ? config.placeholder(record) : '',
        type: config.type || 'text',
        multiline: Boolean(config.multiline)
      })}
    </${tag}>
  `;
}

function renderFilmMetadataEditor(record = {}, draft = {}, { focusField = '' } = {}) {
  const genres = Array.isArray(record.genres) ? record.genres.filter(Boolean).join(', ') : '';
  const isManualDraft = record.manualDraft === true;
  const focusedField = !isManualDraft && FOCUSED_METADATA_FIELDS[focusField] ? focusField : '';
  if (!isManualDraft && !focusedField) {
    return renderFilmMetadataFieldPicker(record);
  }
  if (focusedField) {
    return renderFocusedFilmMetadataEditor(record, draft, focusedField);
  }
  return `
    <section class="cml-film-detail__section cml-film-metadata-editor ${isManualDraft ? 'is-manual-draft' : ''}">
      <div class="cml-film-detail__section-head">
        <div>
          <h2>${isManualDraft ? 'Custom entry' : 'Edit details'}</h2>
        </div>
        <span class="cml-film-save-status" data-film-save-status="metadata"></span>
      </div>
      <div class="cml-film-metadata-editor__grid">
        ${renderFilmMetadataInput({ label: 'Title', field: 'titleOverride', value: draft.titleOverride || '', placeholder: isManualDraft ? 'Film title' : record.localTitle || record.title || '', required: isManualDraft })}
        ${renderFilmMetadataInput({ label: 'Original title', field: 'originalTitleOverride', value: draft.originalTitleOverride || '', placeholder: record.originalTitle || '' })}
        ${renderFilmMetadataInput({ label: 'Director', field: 'directorOverride', value: draft.directorOverride || '', placeholder: record.director || '' })}
        ${renderFilmMetadataInput({ label: 'Release date', field: 'releaseDateOverride', type: 'date', value: String(draft.releaseDateOverride || '').slice(0, 10), placeholder: String(record.releaseDate || '').slice(0, 10) })}
        ${renderFilmMetadataInput({ label: 'Runtime', field: 'runtimeOverride', type: 'number', value: draft.runtimeOverride || '', placeholder: record.runtime ? `${record.runtime}` : 'Minutes' })}
        ${renderFilmMetadataInput({ label: 'Genres', field: 'genresOverride', value: draft.genresOverride || '', placeholder: genres })}
        ${renderFilmMetadataInput({ label: 'Country', field: 'countryOverride', value: draft.countryOverride || '', placeholder: record.country || '' })}
        ${renderFilmMetadataInput({ label: 'Language', field: 'languageOverride', value: draft.languageOverride || '', placeholder: record.language || '' })}
      </div>
      ${renderFilmMetadataInput({ label: 'Overview', field: 'overviewOverride', value: draft.overviewOverride || '', placeholder: record.overview || '', multiline: true })}
      <div class="cml-film-metadata-editor__grid">
        ${renderFilmMetadataInput({ label: 'Poster URL', field: 'posterUrlOverride', value: draft.posterUrlOverride || '', placeholder: 'https://... or /file/...' })}
        ${renderFilmMetadataInput({ label: 'Backdrop URL', field: 'backdropUrlOverride', value: draft.backdropUrlOverride || '', placeholder: 'https://... or /file/...' })}
      </div>
      <p class="cml-film-metadata-editor__hint">${isManualDraft ? 'Auto-saved after title.' : 'Auto-saved. Blank fields use existing details.'}</p>
    </section>
  `;
}

function renderFilmPosterTool(record = {}, { disabledAttr = '' } = {}) {
  const filmId = escapeHtml(record.id || '');
  return `
    <button type="button" class="cml-film-detail__poster-tool" data-action="film-change-poster" data-film-id="${filmId}" ${disabledAttr}>Poster</button>
  `;
}

function renderFilmDetailImageTools(record = {}, { disabledAttr = '' } = {}) {
  const filmId = escapeHtml(record.id || '');
  return `
    <div class="cml-film-detail__image-tools" aria-label="Image tools" data-film-detail-tools>
      <button type="button" class="cml-film-detail__image-hotspot" data-action="film-change-backdrop" data-film-id="${filmId}" aria-label="Change backdrop" ${disabledAttr}>Backdrop</button>
    </div>
  `;
}

function renderFilmSynopsisInline(record = {}, { synopsis = '', editor = '', editable = false } = {}) {
  const filmId = escapeHtml(record.id || '');
  const editAttrs = editable && !editor
    ? ` data-action="film-edit-metadata" data-film-id="${filmId}" data-film-metadata-focus-field="overviewOverride" role="button" tabindex="0" aria-label="Edit overview"`
    : '';
  const stateClass = editor ? 'is-editing' : editable ? 'is-editable' : '';
  return `
    <div class="cml-film-detail__synopsis-inline ${stateClass}"${editAttrs}>
      ${editor || (synopsis
        ? `<p>${escapeHtml(synopsis)}</p>`
        : '<p class="cml-film-detail__empty-text">Add overview</p>')}
    </div>
  `;
}

function renderFilmImagePicker(record = {}, { mode = '', draft = '', frameDraft = null } = {}) {
  const pickerMode = mode === 'backdrop' ? 'backdrop' : mode === 'poster' ? 'poster' : '';
  if (!pickerMode) {
    return '';
  }
  const isBackdrop = pickerMode === 'backdrop';
  const paths = normalizeImagePathList(isBackdrop
    ? [...(Array.isArray(record.backdropPaths) ? record.backdropPaths : []), record.backdropPath]
    : [...(Array.isArray(record.posterPaths) ? record.posterPaths : []), record.posterPath]
  );
  const pathOverrideField = isBackdrop ? 'backdropPathOverride' : 'posterPathOverride';
  const urlOverrideField = isBackdrop ? 'backdropUrlOverride' : 'posterUrlOverride';
  const currentPathOverride = normalizeText(record[pathOverrideField] || '');
  const currentUrlOverride = normalizeText(record[urlOverrideField] || '');
  const draftValue = normalizeText(draft || currentUrlOverride);
  const selectedTmdbPath = currentPathOverride || normalizeText(isBackdrop ? record.backdropPath : record.posterPath);
  const selectedTmdbUrl = buildTmdbImageUrl(selectedTmdbPath, isBackdrop ? 'w1280' : 'w500');
  const previewUrl = draftValue || currentUrlOverride || selectedTmdbUrl || (isBackdrop ? getRecordBackdropUrl(record) : getRecordPosterUrl(record));
  const previewLabel = draftValue || currentUrlOverride
    ? 'Custom URL'
    : currentPathOverride
    ? 'Selected image'
    : 'Catalog image';
  const size = isBackdrop ? 'w780' : 'w342';
  const title = isBackdrop ? 'Change backdrop' : 'Change poster';
  const backdropFrame = getBackdropFrame(record, frameDraft);
  const backdropFrameStyle = renderBackdropFrameStyle(backdropFrame);
  return `
    <section class="cml-film-detail__section cml-film-image-picker cml-film-image-picker--${escapeHtml(pickerMode)}" data-film-image-picker="${escapeHtml(pickerMode)}">
      <div class="cml-film-image-picker__head">
        <div>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <button type="button" class="cml-film-image-picker__close" data-action="film-close-image-picker" aria-label="Close image picker">x</button>
      </div>
      ${previewUrl ? `
        <div class="cml-film-image-picker__preview ${isBackdrop ? 'is-backdrop' : 'is-poster'}">
          <img src="${escapeHtml(previewUrl)}" alt="" loading="eager" decoding="async" ${isBackdrop ? `style="${backdropFrameStyle}"` : ''} />
          <span>${escapeHtml(previewLabel)}</span>
          ${isBackdrop && selectedTmdbPath && !draftValue && !currentUrlOverride ? `
            <button type="button" class="cml-film-image-picker__pin" data-action="film-pin-backdrop" data-film-image-mode="backdrop" data-film-image-path="${escapeHtml(selectedTmdbPath)}" ${currentPathOverride ? 'disabled' : ''}>${currentPathOverride ? 'Pinned' : 'Pin backdrop'}</button>
          ` : ''}
        </div>
      ` : ''}
      ${isBackdrop && previewUrl ? renderBackdropFrameControls(record, frameDraft) : ''}
      ${paths.length ? `
        <div class="cml-film-image-picker__grid ${isBackdrop ? 'is-backdrop' : 'is-poster'}">
          ${paths.slice(0, 12).map((path) => {
            const url = buildTmdbImageUrl(path, size);
            const normalizedPath = normalizeText(path);
            const isActive = !currentUrlOverride && normalizedPath === normalizeText(selectedTmdbPath);
            return `
              <button type="button" class="cml-film-image-picker__choice ${isActive ? 'is-active' : ''}" data-action="film-pick-image" data-film-image-mode="${escapeHtml(pickerMode)}" data-film-image-path="${escapeHtml(path)}" aria-label="Use this ${escapeHtml(pickerMode)}">
                <img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />
                ${isActive ? '<span>Selected</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      ` : `<p class="cml-film-image-picker__empty">No catalog images yet. Paste an image URL or refresh details.</p>`}
      <form class="cml-film-image-picker__url" data-form="film-image-picker-url">
        <input type="url" data-film-image-picker-url value="${escapeHtml(draftValue)}" placeholder="https://... or /file/..." />
        <button type="button" class="cml-film-image-picker__button cml-film-image-picker__button--ghost" data-action="film-clear-image-override" data-film-image-mode="${escapeHtml(pickerMode)}" ${(currentPathOverride || currentUrlOverride) ? '' : 'disabled'}>Use catalog image</button>
      </form>
    </section>
  `;
}

function normalizeBackdropPosition(value, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeBackdropZoom(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0.5, Math.min(1.8, Math.round(numeric * 100) / 100));
}

function normalizeBackdropOpacity(value, fallback = 0.92) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0.18, Math.min(0.92, Math.round(numeric * 100) / 100));
}

const FILM_BACKDROP_DEFAULT_FRAME = Object.freeze({ x: 50, y: 50, zoom: 0.5, opacity: 0.92 });
const FILM_BACKDROP_LEGACY_DEFAULT_FRAME = Object.freeze({ x: 50, y: 50, zoom: 1.02, opacity: 0.66 });

function normalizeBackdropFrameValues(source = {}) {
  const normalized = {
    x: normalizeBackdropPosition(source.x, 50),
    y: normalizeBackdropPosition(source.y, 50),
    zoom: normalizeBackdropZoom(source.zoom, 0.5),
    opacity: normalizeBackdropOpacity(source.opacity, 0.92)
  };
  const isLegacyDefault = normalized.x === FILM_BACKDROP_LEGACY_DEFAULT_FRAME.x
    && normalized.y === FILM_BACKDROP_LEGACY_DEFAULT_FRAME.y
    && normalized.zoom === FILM_BACKDROP_LEGACY_DEFAULT_FRAME.zoom
    && normalized.opacity === FILM_BACKDROP_LEGACY_DEFAULT_FRAME.opacity;
  return isLegacyDefault ? { ...FILM_BACKDROP_DEFAULT_FRAME } : normalized;
}

function getBackdropFrame(record = {}, draft = null) {
  const source = draft && typeof draft === 'object' ? { ...record, ...draft } : record;
  return normalizeBackdropFrameValues({
    x: normalizeBackdropPosition(source.backdropPositionXOverride, 50),
    y: normalizeBackdropPosition(source.backdropPositionYOverride, 50),
    zoom: normalizeBackdropZoom(source.backdropZoomOverride, 0.5),
    opacity: normalizeBackdropOpacity(source.backdropOpacityOverride, 0.92)
  });
}

function renderBackdropFrameStyle(frame = {}) {
  const { x, y, zoom, opacity } = normalizeBackdropFrameValues(frame);
  return `--film-backdrop-position-x: ${escapeHtml(x)}%; --film-backdrop-position-y: ${escapeHtml(y)}%; --film-backdrop-scale: ${escapeHtml(zoom)}; --film-backdrop-opacity: ${escapeHtml(opacity)};`;
}

function renderFrameRangeFill(value = 0, min = 0, max = 100) {
  const numeric = Number(value);
  const lower = Number(min);
  const upper = Number(max);
  if (!Number.isFinite(numeric) || !Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
    return '0';
  }
  return String(Math.max(0, Math.min(100, ((numeric - lower) / (upper - lower)) * 100)));
}

function renderBackdropFrameControls(record = {}, frameDraft = null) {
  const frame = getBackdropFrame(record, frameDraft);
  return `
    <details class="cml-film-image-picker__frame" data-film-backdrop-frame>
      <summary class="cml-film-image-picker__frame-summary">Reposition</summary>
      <div class="cml-film-image-picker__frame-body">
        <div class="cml-film-image-picker__frame-head">
          <h3>Frame</h3>
        </div>
        <button type="button" class="cml-film-image-picker__button cml-film-image-picker__button--quiet" data-action="film-reset-backdrop-frame">Reset frame</button>
        <label class="cml-film-image-picker__range">
          <span>Zoom</span>
          <input type="range" min="0.5" max="1.8" step="0.01" value="${escapeHtml(frame.zoom)}" data-film-backdrop-frame-field="zoom" style="--film-frame-range-fill: ${escapeHtml(renderFrameRangeFill(frame.zoom, 0.5, 1.8))}%;" />
          <output>${escapeHtml(frame.zoom.toFixed(2))}x</output>
        </label>
        <label class="cml-film-image-picker__range">
          <span>Horizontal</span>
          <input type="range" min="0" max="100" step="1" value="${escapeHtml(frame.x)}" data-film-backdrop-frame-field="x" style="--film-frame-range-fill: ${escapeHtml(renderFrameRangeFill(frame.x, 0, 100))}%;" />
          <output>${escapeHtml(frame.x)}%</output>
        </label>
        <label class="cml-film-image-picker__range">
          <span>Vertical</span>
          <input type="range" min="0" max="100" step="1" value="${escapeHtml(frame.y)}" data-film-backdrop-frame-field="y" style="--film-frame-range-fill: ${escapeHtml(renderFrameRangeFill(frame.y, 0, 100))}%;" />
          <output>${escapeHtml(frame.y)}%</output>
        </label>
        <label class="cml-film-image-picker__range">
          <span>Dim</span>
          <input type="range" min="0.18" max="0.92" step="0.01" value="${escapeHtml(frame.opacity)}" data-film-backdrop-frame-field="opacity" style="--film-frame-range-fill: ${escapeHtml(renderFrameRangeFill(frame.opacity, 0.18, 0.92))}%;" />
          <output>${escapeHtml(String(Math.round(frame.opacity * 100)))}%</output>
        </label>
      </div>
    </details>
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
  const posterPathOverride = normalizeText(draft.posterPathOverride);
  const backdropPathOverride = normalizeText(draft.backdropPathOverride);
  const posterUrlOverride = normalizeText(draft.posterUrlOverride);
  const backdropUrlOverride = normalizeText(draft.backdropUrlOverride);
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
    country: normalizeText(draft.countryOverride) || record.country,
    language: normalizeText(draft.languageOverride) || record.language,
    overview: normalizeText(draft.overviewOverride) || record.overview,
    posterPath: posterPathOverride || record.posterPath,
    posterPathOverride: posterPathOverride || record.posterPathOverride,
    posterUrl: posterUrlOverride || record.posterUrl,
    posterUrlOverride: posterUrlOverride || record.posterUrlOverride,
    backdropPath: backdropPathOverride || record.backdropPath,
    backdropPathOverride: backdropPathOverride || record.backdropPathOverride,
    backdropUrl: backdropUrlOverride || record.backdropUrl,
    backdropUrlOverride: backdropUrlOverride || record.backdropUrlOverride
  };
}

export function FilmDetailPage({ record = null, notesEditing = false, notesDraft = '', notesActiveLine = 0, notesSyncError = false, metadataEditing = false, metadataDraft = null, metadataFocusField = '', imagePickerMode = '', imagePickerDraft = '', imagePickerFrameDraft = null, backdropIndex = 0, saveStatus = null } = {}) {
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
  const userRating = formatUserRating5(displayRecord.userRating);
  const posterUrl = getRecordPosterUrl(displayRecord);
  const autoBackdropUrls = getRecordAutoBackdropUrls(displayRecord);
  const autoBackdropIndex = autoBackdropUrls.length
    ? Math.max(0, Math.min(autoBackdropUrls.length - 1, Number(backdropIndex) || 0))
    : 0;
  const backdropUrl = autoBackdropUrls.length
    ? autoBackdropUrls[autoBackdropIndex]
    : getRecordBackdropUrl(displayRecord);
  const backdropFrame = getBackdropFrame(displayRecord);
  const backdropFrameStyle = renderBackdropFrameStyle(backdropFrame);
  const canEditLocalMetadata = isSavedEntry && !displayRecord.manualDraft;
  const releaseMeta = displayRecord.releaseDate
    ? formatWatchedDateLong(displayRecord.releaseDate)
    : (displayRecord.year ? String(displayRecord.year) : '');
  const synopsis = getDetailSynopsis(displayRecord);
  const titleEditAttrs = canEditLocalMetadata
    ? ` data-action="film-edit-metadata" data-film-id="${escapeHtml(displayRecord.id || '')}" data-film-metadata-focus-field="titleOverride" role="button" tabindex="0" aria-label="Edit title"`
    : '';
  const originalEditAttrs = canEditLocalMetadata
    ? ` data-action="film-edit-metadata" data-film-id="${escapeHtml(displayRecord.id || '')}" data-film-metadata-focus-field="originalTitleOverride" role="button" tabindex="0" aria-label="Edit original title"`
    : '';
  const localActionDisabled = displayRecord.isSaving || displayRecord.isSavedEntry === false || displayRecord.manualDraft === true;
  const disabledAttr = localActionDisabled ? 'disabled' : '';
  const controlRecord = localActionDisabled
    ? { ...displayRecord, isSaving: true }
    : displayRecord;
  const metadataEditor = isSavedEntry && metadataEditing
    ? renderFilmMetadataEditor(displayRecord, metadataDraft || {}, { focusField: metadataFocusField })
    : '';
  const synopsisMetadataEditor = canEditLocalMetadata && metadataEditing && metadataFocusField === 'overviewOverride'
    ? renderFocusedFilmMetadataEditor(displayRecord, metadataDraft || {}, 'overviewOverride', { embedded: true })
    : '';
  const imagePicker = isSavedEntry
    ? renderFilmImagePicker(displayRecord, { mode: imagePickerMode, draft: imagePickerDraft, frameDraft: imagePickerFrameDraft })
    : '';
  const detailSynopsis = !displayRecord.manualDraft
    ? renderFilmSynopsisInline(displayRecord, { synopsis, editor: synopsisMetadataEditor, editable: canEditLocalMetadata && !localActionDisabled })
    : '';
  const detailActions = isSavedEntry
    ? ''
    : `
      <button type="button" class="cml-film-detail__action" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(displayRecord.tmdbId || '')}" ${displayRecord.isSaving ? 'disabled' : ''}>Save as Want</button>
      <button type="button" class="cml-film-detail__action is-active" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(displayRecord.tmdbId || '')}" ${displayRecord.isSaving ? 'disabled' : ''}>Mark Watched</button>
    `;
  const metaColumns = [
    renderDetailMetaColumn('Director', displayRecord.director || '', '', { editable: canEditLocalMetadata, field: 'directorOverride', filmId: displayRecord.id || '' }),
    renderDetailMetaColumn('Release', releaseMeta || '', '', { editable: canEditLocalMetadata, field: 'releaseDateOverride', filmId: displayRecord.id || '' }),
    renderDetailMetaColumn('Runtime', runtime || '', '', { editable: canEditLocalMetadata, field: 'runtimeOverride', filmId: displayRecord.id || '' })
  ].filter(Boolean).join('');
  const detailSaveStatus = saveStatus?.label && saveStatus.state === 'error'
    ? `<span class="cml-film-save-status is-visible is-${escapeHtml(saveStatus.state || 'saved')}" data-film-save-status="detail">${escapeHtml(saveStatus.label)}</span>`
    : '<span class="cml-film-save-status" data-film-save-status="detail"></span>';
  const manageButton = canEditLocalMetadata
    ? `<button type="button" class="cml-film-detail__manage" data-action="film-edit-metadata" data-film-id="${escapeHtml(displayRecord.id || '')}" aria-label="Manage film">...</button>`
    : '';
  return `
    <section class="cml-film-detail-page" data-film-detail-page>
      <div class="cml-film-detail-page__backdrop" aria-hidden="true">
        ${backdropUrl ? `<img class="cml-film-detail-page__backdrop-image" src="${escapeHtml(backdropUrl)}" alt="" loading="eager" decoding="async" data-film-backdrop-index="${escapeHtml(autoBackdropIndex)}" style="${backdropFrameStyle}" />` : ''}
      </div>
      <div class="cml-film-detail-page__scrim" aria-hidden="true"></div>
      <div class="cml-film-detail-page__content">
        <div class="cml-film-detail__topline">
          <button type="button" class="cml-film-detail__back" data-action="close-film-detail">Back to Films</button>
          <div class="cml-film-detail__topline-actions">
            ${detailSaveStatus}
            ${manageButton}
          </div>
        </div>
        <div class="cml-film-detail__hero">
          <div class="cml-film-detail__poster-wrap">
            ${posterUrl
              ? `<img class="cml-film-detail__poster" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(localTitle)} poster" loading="eager" decoding="async" />`
              : renderPosterFallback(localTitle)}
          </div>
          <div class="cml-film-detail__body">
            <div class="cml-film-detail__title-block">
              <h1 class="cml-film-detail__title ${canEditLocalMetadata ? 'is-editable' : ''}"${titleEditAttrs}>${escapeHtml(localTitle)}</h1>
              ${originalTitle && originalTitle !== localTitle ? `<p class="cml-film-detail__original ${canEditLocalMetadata ? 'is-editable' : ''}"${originalEditAttrs}>${escapeHtml(originalTitle)}</p>` : ''}
            </div>
            ${metaColumns ? `<div class="cml-film-detail__meta-row">${metaColumns}</div>` : ''}
            ${detailSynopsis}
            ${isSavedEntry ? '' : renderDetailPreviewSaveHint()}
            ${detailActions ? `<div class="cml-film-detail__actions">${detailActions}</div>` : ''}
            <div class="cml-film-detail__diary-flow">
              ${isSavedEntry ? renderFilmMyFilmSection(controlRecord, { userRating, disabledAttr }) : ''}
              ${renderFilmNotesSection(displayRecord, { notesEditing, notesDraft, notesActiveLine, notesSyncError, editable: isSavedEntry && !displayRecord.manualDraft && !displayRecord.isSaving })}
            </div>
          </div>
        </div>
        <div class="cml-film-detail__lower">
          ${isSavedEntry ? renderFilmWatchHistory(displayRecord) : ''}
        </div>
        <div class="cml-film-detail__overlay-layer" data-film-detail-overlays>
          ${metadataEditor}
          ${imagePicker}
        </div>
      </div>
    </section>
  `;
}

export function FilmCard(record = {}) {
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const originalTitle = normalizeText(record.originalTitle || record.title || '');
  const directorLine = normalizeText(record.director || '');
  const runtime = formatRuntime(record.runtime);
  const watchedDate = record.status === 'watched' ? formatWatchedDate(record.watchedAt) : '';
  const ratingValue = formatUserRating5(record.userRating);
  const ratingBadge = ratingValue
    ? `<div class="cml-film-card__rating" aria-label="My rating ${escapeHtml(ratingValue)} out of 5">
        <span class="cml-film-card__rating-star" aria-hidden="true">${renderRatingStar(100)}</span>
        <span class="cml-film-card__rating-value">${escapeHtml(ratingValue)}</span>
      </div>`
    : '';
  const releaseLine = formatFilmCardMetaLine([record.year ? String(record.year) : '', runtime]);
  const infoItems = [
    renderFilmCardInfoItem('', releaseLine, 'release'),
    renderFilmCardInfoItem('', watchedDate, 'watched')
  ].filter(Boolean).join('');
  return `
    <article class="cml-film-card" data-film-id="${escapeHtml(record.id || '')}" data-action="open-film-detail" tabindex="0" role="button" aria-label="Open ${escapeHtml(localTitle)} details">
      <div class="cml-film-card__poster-panel">
        <img class="cml-film-card__poster" src="${escapeHtml(getRecordPosterUrl(record))}" alt="${escapeHtml(localTitle)}" loading="lazy" decoding="async" />
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
                <strong class="cml-film-card__director-value">${escapeHtml(directorLine)}</strong>
              </div>
            ` : ''}
            ${ratingBadge}
          </div>
        </footer>
      </div>
    </article>
  `;
}

export function FilmPosterCard(record = {}) {
  const localTitle = normalizeText(record.localTitle || record.title || 'Untitled film');
  const posterUrl = getRecordPosterUrl(record);
  return `
    <article class="cml-film-poster-card" data-film-id="${escapeHtml(record.id || '')}" data-action="open-film-detail" tabindex="0" role="button" aria-label="Open ${escapeHtml(localTitle)} details">
      <div class="cml-film-poster-card__frame">
        ${posterUrl
          ? `<img class="cml-film-poster-card__image" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(localTitle)} poster" loading="lazy" decoding="async" />`
          : renderPosterFallback(localTitle)}
      </div>
    </article>
  `;
}

export function FilmTimelineSection(section = {}, { viewMode = 'ticket' } = {}) {
  const isPosterView = viewMode === 'poster';
  const items = Array.isArray(section.items) ? section.items : [];
  return `
    <section class="cml-films-section" data-film-section="${escapeHtml(section.id || '')}">
      <div class="cml-films-section__header">
        <div>
          <h2 class="cml-films-section__title">${escapeHtml(section.label || '')}</h2>
          <p class="cml-films-section__meta">${escapeHtml(String(section.items?.length || 0))} film${(section.items?.length || 0) === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div class="${isPosterView ? 'cml-films-poster-grid' : 'cml-films-grid'}">
        ${items.map((record) => isPosterView ? FilmPosterCard(record) : FilmCard(record)).join('')}
      </div>
    </section>
  `;
}

export function FilmsPage({ records = [], totalCount = records.length, activeFilter = 'All', viewMode = 'ticket', libraryQuery = '', searchPanelHtml = '' } = {}) {
  const sections = groupFilmsByTimeline(records);
  const librarySearchValue = escapeHtml(libraryQuery);
  const hasAnySavedFilms = Number(totalCount) > 0;
  const hasLibraryQuery = Boolean(normalizeText(libraryQuery));
  const activeViewMode = viewMode === 'poster' ? 'poster' : 'ticket';
  const emptyCopy = hasLibraryQuery
    ? 'No saved match yet. Search results and a custom entry option appear above when available.'
    : 'Search your diary first. New films can be added from the same search flow.';
  return `
    <section class="cml-films-page">
      <header class="cml-films-page__hero">
        <div class="cml-films-page__hero-copy">
          <p class="cml-films-page__eyebrow">Archive</p>
          <h1 class="cml-films-page__title">Films</h1>
          <p class="cml-films-page__subtitle">Your private film diary.</p>
        </div>
        <label class="cml-films-library-search cml-films-library-search--primary" aria-label="Search saved films">
          <span class="cml-films-library-search__icon" aria-hidden="true"></span>
          <input type="search" data-film-library-search-input value="${librarySearchValue}" placeholder="Search by title..." />
          ${hasLibraryQuery ? '<button type="button" data-action="clear-film-library-search" aria-label="Clear saved films search">x</button>' : ''}
        </label>
      </header>
      ${searchPanelHtml}
      <div class="cml-films-filters" role="tablist" aria-label="Film filters">
        ${FILM_FILTERS.map((filter) => `
          <button type="button" class="cml-films-filters__chip ${filter === activeFilter ? 'is-active' : ''}" data-action="filter-films" data-film-filter="${escapeHtml(filter)}" aria-pressed="${filter === activeFilter ? 'true' : 'false'}">
            ${escapeHtml(filter)}
          </button>
        `).join('')}
        <div class="cml-films-view-toggle" aria-label="Film view">
          <button type="button" class="cml-films-view-toggle__button ${activeViewMode === 'ticket' ? 'is-active' : ''}" data-action="set-film-view-mode" data-film-view-mode="ticket" aria-pressed="${activeViewMode === 'ticket' ? 'true' : 'false'}">Ticket</button>
          <button type="button" class="cml-films-view-toggle__button ${activeViewMode === 'poster' ? 'is-active' : ''}" data-action="set-film-view-mode" data-film-view-mode="poster" aria-pressed="${activeViewMode === 'poster' ? 'true' : 'false'}">Poster</button>
        </div>
      </div>
      <div class="cml-films-page__content">
        ${sections.length
          ? sections.map((section) => FilmTimelineSection(section, { viewMode: activeViewMode })).join('')
          : `
            <section class="cml-films-empty" data-has-saved-films="${hasAnySavedFilms ? 'true' : 'false'}">
              <p class="cml-films-empty__eyebrow">Search to add a film</p>
              <h2 class="cml-films-empty__title">${hasLibraryQuery ? 'No saved films found.' : 'No saved films yet.'}</h2>
              <p class="cml-films-empty__copy">${escapeHtml(emptyCopy)}</p>
            </section>
          `}
      </div>
    </section>
  `;
}

export function FilmSearchResults({ results = [], loading = false, loadingMore = false, settling = false, clearing = false, resultKey = 0, error = '', query = '', page = 0, totalPages = 0, totalResults = 0, savingTmdbIds = new Set(), savedRecordsByTmdbId = new Map(), newResultStartIndex = 0 } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery && !results.length && !error) {
    return '';
  }
  const friendlyError = error && /TMDb|TMDB|credentials|access token|API key/i.test(error)
    ? 'Movie search is unavailable. Try again later.'
    : error;
  const emptyMessage = loading
    ? 'Searching...'
    : normalizedQuery
    ? 'No matches found.'
    : 'No search results yet.';
  const hasMoreResults = normalizedQuery && Number(totalPages) > Number(page || 0);
  const customCard = normalizedQuery ? `
    <article class="cml-films-result cml-film-search-result cml-film-search-result--custom is-new" data-action="add-manual-film" data-film-manual-title="${escapeHtml(normalizedQuery)}" tabindex="0" role="button" aria-label="Create custom film ${escapeHtml(normalizedQuery)}">
      <div class="cml-films-result__poster-wrap cml-films-result__poster-wrap--custom">
        ${renderPosterFallback(normalizedQuery)}
      </div>
      <div class="cml-films-result__body">
        <div class="cml-films-result__source-row">
          <p class="cml-films-result__source">Custom entry</p>
        </div>
        <h3 class="cml-films-result__title">${escapeHtml(normalizedQuery)}</h3>
        <p class="cml-films-result__meta">Create a custom entry if the right match is missing.</p>
        <div class="cml-films-result__actions">
          <button type="button" class="cml-films-result__button cml-films-result__button--primary" data-action="add-manual-film" data-film-manual-title="${escapeHtml(normalizedQuery)}">Add custom</button>
        </div>
      </div>
    </article>
  ` : '';
  const tmdbCardItems = results.length ? results.map((movie, index) => {
    const tmdbId = Number(movie.tmdbId);
    const isSaving = savingTmdbIds instanceof Set && savingTmdbIds.has(tmdbId);
    const savedRecord = getSavedSearchRecord(savedRecordsByTmdbId, tmdbId);
    const savedStatus = savedRecord?.status || '';
    const normalizedSavedStatus = savedStatus === 'watchlist' ? 'wantToWatch' : savedStatus;
    const isWantCurrent = normalizedSavedStatus === 'wantToWatch';
    const isWatchedCurrent = normalizedSavedStatus === 'watched';
    const isNew = index >= Math.max(0, Number(newResultStartIndex) || 0);
    const savedRating = savedRecord ? formatUserRating5(savedRecord.userRating) : '';
    const metaLine = [
      movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '',
      savedRating ? `My rating ${savedRating}` : (Array.isArray(movie.genres) ? movie.genres.slice(0, 2).join(' / ') : '')
    ].filter(Boolean).join(' - ');
    return `
      <article class="cml-films-result cml-film-search-result ${isNew ? 'is-new' : ''} ${isSaving ? 'is-saving' : ''} ${savedRecord ? 'is-saved' : ''}" data-action="open-tmdb-film-detail" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}">
        <div class="cml-films-result__poster-wrap">
          ${movie.posterPath
            ? `<img class="cml-films-result__poster" src="${escapeHtml(buildTmdbImageUrl(movie.posterPath, 'w342'))}" alt="${escapeHtml(movie.title || 'Movie poster')}" loading="lazy" decoding="async" />`
            : renderPosterFallback(movie.title)}
        </div>
        <div class="cml-films-result__body">
          <div class="cml-films-result__source-row">
            <p class="cml-films-result__source">Search result</p>
            ${savedRecord ? `<span class="cml-films-result__saved-state">Saved &middot; ${escapeHtml(getSearchStatusLabel(savedStatus))}</span>` : ''}
          </div>
          <h3 class="cml-films-result__title">${escapeHtml(movie.title || 'Untitled film')}</h3>
          <p class="cml-films-result__meta">${escapeHtml(metaLine)}</p>
          ${movie.overview ? `<p class="cml-films-result__overview">${escapeHtml(movie.overview)}</p>` : ''}
          <div class="cml-films-result__actions">
            <button type="button" class="cml-films-result__button ${isWantCurrent ? 'is-current' : ''}" data-action="save-film-status" data-watch-status="wantToWatch" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}" ${(isSaving || isWantCurrent) ? 'disabled' : ''}>${isSaving ? 'Adding...' : isWantCurrent ? 'Saved' : 'Want'}</button>
            <button type="button" class="cml-films-result__button cml-films-result__button--primary ${isWatchedCurrent ? 'is-current' : ''}" data-action="save-film-status" data-watch-status="watched" data-tmdb-id="${escapeHtml(movie.tmdbId || '')}" ${(isSaving || isWatchedCurrent) ? 'disabled' : ''}>${isSaving ? 'Adding...' : isWatchedCurrent ? 'Saved' : 'Watched'}</button>
          </div>
        </div>
      </article>
    `;
  }) : [];
  const resultCardItems = customCard
    ? [
      ...tmdbCardItems.slice(0, 3),
      customCard,
      ...tmdbCardItems.slice(3)
    ]
    : tmdbCardItems;
  const resultCards = resultCardItems.length
    ? resultCardItems.join('')
    : `<p class="cml-films-mvp__empty">${emptyMessage}</p>`;
  return `
    <section class="cml-films-mvp cml-film-search-panel ${loading ? 'is-searching' : ''} ${loadingMore ? 'is-loading-more' : ''} ${settling ? 'is-settling' : ''} ${clearing ? 'is-clearing' : ''}" data-film-search-result-key="${escapeHtml(resultKey)}">
      <div class="cml-films-mvp__head">
        <div>
          <p class="cml-films-mvp__eyebrow">Search to add</p>
          <h2 class="cml-films-mvp__title">${loading ? 'Searching...' : 'Add film'}</h2>
        </div>
        <p class="cml-film-search-status ${loading ? 'is-visible' : ''}" aria-live="polite">${loading ? 'Searching...' : ''}</p>
        ${friendlyError ? `<p class="cml-films-mvp__error">${escapeHtml(friendlyError)}</p>` : ''}
      </div>
      <div class="cml-films-mvp__results cml-film-search-results ${loading && !loadingMore ? 'is-loading' : ''} ${settling ? 'is-settling' : ''} ${clearing ? 'is-clearing' : ''}">
        ${resultCards}
      </div>
      ${hasMoreResults ? `
        <div class="cml-films-mvp__load-more">
          <button type="button" class="cml-films-mvp__load-more-button" data-action="load-more-film-search-results" ${(loading || loadingMore) ? 'disabled' : ''}>${loadingMore ? 'Loading...' : 'Load more'}</button>
          <span>${escapeHtml(String(results.length))}${Number(totalResults) ? ` / ${escapeHtml(String(totalResults))}` : ''}</span>
        </div>
      ` : ''}
    </section>
  `;
}
