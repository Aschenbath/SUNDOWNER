function normalizeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(10, Math.round(numeric * 10) / 10));
}

export const FILM_FILTERS = ['All', 'Watched', 'Watching', 'Watchlist', 'Favorites'];

export const FILM_STATUS_LABELS = {
  watchlist: 'Want to Watch',
  wantToWatch: 'Want to Watch',
  watching: 'Watching',
  watched: 'Watched',
  paused: 'Paused',
  dropped: 'Dropped'
};

export function getFilmRatingLabel(rating) {
  const normalized = normalizeRating(rating);
  if (normalized === null) {
    return '';
  }
  if (normalized <= 2.9) {
    return 'Not recommended';
  }
  if (normalized <= 5.9) {
    return 'Mixed';
  }
  if (normalized <= 7.4) {
    return 'Good';
  }
  if (normalized <= 8.9) {
    return 'Recommended';
  }
  return 'Favorite';
}
