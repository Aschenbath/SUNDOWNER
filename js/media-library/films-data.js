function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(10, Math.round(numeric * 10) / 10));
}

function encodeSvg(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPoster(title, palette = ['#1f2937', '#374151', '#d1d5db', '#f9fafb']) {
  const [bg, panel, accent, text] = palette;
  const lines = normalizeText(title).split(' ').filter(Boolean);
  const lineOne = lines.slice(0, 2).join(' ') || 'Film';
  const lineTwo = lines.slice(2, 5).join(' ');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1080" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="poster-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="${panel}" />
        </linearGradient>
      </defs>
      <rect width="720" height="1080" fill="url(#poster-bg)" rx="40" />
      <rect x="72" y="88" width="576" height="904" rx="32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="3" />
      <circle cx="560" cy="220" r="92" fill="${accent}" opacity="0.18" />
      <circle cx="196" cy="820" r="124" fill="${accent}" opacity="0.12" />
      <path d="M118 760 C214 612 356 584 458 664 C538 726 582 814 612 914 L118 914 Z" fill="rgba(255,255,255,0.08)" />
      <text x="112" y="176" fill="${accent}" font-size="26" font-family="Georgia, 'Times New Roman', serif" letter-spacing="8">SUNDOWNER</text>
      <text x="112" y="764" fill="${text}" font-size="54" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${lineOne}</text>
      ${lineTwo ? `<text x="112" y="828" fill="${text}" font-size="44" font-weight="500" font-family="Segoe UI, Arial, sans-serif">${lineTwo}</text>` : ''}
      <text x="112" y="920" fill="rgba(255,255,255,0.62)" font-size="24" font-family="Segoe UI, Arial, sans-serif">private film diary</text>
    </svg>
  `;
  return encodeSvg(svg);
}

export const FILM_FILTERS = ['All', 'Watched', 'Watching', 'Watchlist', 'Favorites'];

export const FILM_STATUS_LABELS = {
  watchlist: '想看',
  watching: '在看',
  watched: '看过'
};

export function getFilmRatingLabel(rating) {
  const normalized = normalizeRating(rating);
  if (normalized === null) {
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

export const mockFilmRecords = [
  {
    id: 'film-001',
    title: 'In the Mood for Love',
    localTitle: '花样年华',
    year: 2000,
    status: 'watched',
    favorite: true,
    rating: 9.4,
    note: '雨夜、走廊、克制感。',
    watchedAt: '2026-04-28',
    addedAt: '2026-04-10',
    posterUrl: createPoster('In the Mood for Love', ['#2b1f25', '#6b2737', '#e7b66a', '#fff3dc'])
  },
  {
    id: 'film-002',
    title: 'Chungking Express',
    localTitle: '重庆森林',
    year: 1994,
    status: 'watched',
    favorite: true,
    rating: 8.8,
    note: '速度感和孤独感都很轻盈。',
    watchedAt: '2026-04-12',
    addedAt: '2026-04-02',
    posterUrl: createPoster('Chungking Express', ['#132238', '#1d4f7a', '#f6cf57', '#f9fafb'])
  },
  {
    id: 'film-003',
    title: 'Perfect Days',
    localTitle: '完美的日子',
    year: 2023,
    status: 'watched',
    favorite: false,
    rating: 8.1,
    note: '安静得刚刚好。',
    watchedAt: '2026-03-18',
    addedAt: '2026-03-12',
    posterUrl: createPoster('Perfect Days', ['#1d2c26', '#436850', '#d8c7a2', '#f7f5ef'])
  },
  {
    id: 'film-004',
    title: 'All About Lily Chou-Chou',
    localTitle: '关于莉莉周的一切',
    year: 2001,
    status: 'watching',
    favorite: false,
    rating: 7.6,
    note: '先记下氛围，准备二刷。',
    watchedAt: '',
    addedAt: '2026-04-30',
    posterUrl: createPoster('All About Lily Chou Chou', ['#203248', '#6389a0', '#d8ecef', '#f8fbff'])
  },
  {
    id: 'film-005',
    title: 'Fallen Angels',
    localTitle: '堕落天使',
    year: 1995,
    status: 'watchlist',
    favorite: false,
    rating: null,
    note: '想在一个很晚的晚上看。',
    watchedAt: '',
    addedAt: '2026-05-01',
    posterUrl: createPoster('Fallen Angels', ['#121418', '#314025', '#c8ff66', '#eef2f7'])
  },
  {
    id: 'film-006',
    title: 'Drive My Car',
    localTitle: '驾驶我的车',
    year: 2021,
    status: 'watchlist',
    favorite: true,
    rating: null,
    note: '留给一个长一点的晚上。',
    watchedAt: '',
    addedAt: '2026-04-22',
    posterUrl: createPoster('Drive My Car', ['#24161c', '#8e3f44', '#f3d0b1', '#fff8ef'])
  },
  {
    id: 'film-007',
    title: 'After Yang',
    localTitle: '杨之后',
    year: 2021,
    status: 'watched',
    favorite: false,
    rating: 7.2,
    note: '像一段被温柔保存的记忆。',
    watchedAt: '2026-02-06',
    addedAt: '2026-01-28',
    posterUrl: createPoster('After Yang', ['#1c2430', '#5f7a8d', '#c4d6d9', '#f5f7fa'])
  },
  {
    id: 'film-008',
    title: 'Yi Yi',
    localTitle: '一一',
    year: 2000,
    status: 'watchlist',
    favorite: false,
    rating: null,
    note: '一直想补。',
    watchedAt: '',
    addedAt: '2026-04-16',
    posterUrl: createPoster('Yi Yi', ['#1f2230', '#424b67', '#d7dce8', '#f8fafc'])
  }
];
