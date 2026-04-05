import { createTimelineLabel, mockMediaItems, navigationModel, storageSummary } from './data.js';
import {
  EmptyState,
  MediaTimelineSection,
  PreviewModal,
  SearchSummary,
  Sidebar,
  TopSearchBar,
  YearScroller
} from './components.js';

const state = {
  primaryFilter: 'Photos',
  secondaryFilter: '',
  searchQuery: '',
  selectedIds: new Set(),
  favoriteIds: new Set(mockMediaItems.filter((item) => item.favorite).map((item) => item.id)),
  previewId: null,
  loadedCount: 24,
  isCreateMenuOpen: false,
  activeYear: null,
  lastToast: '',
  focusedTileId: null
};

const refs = {
  root: null,
  scrollRegion: null,
  sectionAnchors: []
};

let mounted = false;

function shouldMount(pathname = window.location.pathname) {
  if (pathname.startsWith('/login') || pathname.startsWith('/browse')) {
    return false;
  }
  return pathname === '/' || pathname.startsWith('/dashboard');
}

function ensureRoot() {
  let root = document.getElementById('codex-media-library-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'codex-media-library-root';
    document.body.appendChild(root);
  }
  refs.root = root;
  return root;
}

function escapeSelector(value) {
  return String(value).replace(/([ #;?%&,.+*~\':"!^$\[\]()=>|/@])/g, '\\$1');
}

function getFilteredItems() {
  const now = new Date();
  const query = state.searchQuery.trim().toLowerCase();

  return mockMediaItems.filter((item) => {
    if (state.primaryFilter === 'Updates') {
      const diffDays = Math.floor((now.getTime() - new Date(item.takenAt).getTime()) / 86400000);
      if (diffDays > 45) {
        return false;
      }
    }

    if (state.primaryFilter === 'Collections') {
      const isCollectionItem = state.favoriteIds.has(item.id) || item.personLabels.length > 0 || /travel|festival|night/i.test(item.tags.join(' '));
      if (!isCollectionItem) {
        return false;
      }
    }

    switch (state.secondaryFilter) {
      case 'Documents':
        if (!(item.album === 'Documents' || item.tags.includes('scan') || item.tags.includes('archive') || item.tags.includes('invoice'))) {
          return false;
        }
        break;
      case 'Screenshots and recordings':
        if (item.album !== 'Screenshots and recordings') {
          return false;
        }
        break;
      case 'Favourites':
        if (!state.favoriteIds.has(item.id)) {
          return false;
        }
        break;
      case 'People and pets':
        if (!item.personLabels.length) {
          return false;
        }
        break;
      case 'Places':
        if (!item.location) {
          return false;
        }
        break;
      case 'Albums':
      default:
        break;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      item.type,
      item.album,
      item.location,
      item.year,
      item.monthLabel,
      item.day,
      ...item.tags,
      ...item.personLabels
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });
}

function buildSections(items) {
  const renderedItems = items.slice(0, state.loadedCount);
  const groups = [];

  renderedItems.forEach((item) => {
    const label = createTimelineLabel(item.takenAt);
    const key = `${item.year}-${label}`;
    const existing = groups[groups.length - 1];
    if (!existing || existing.key !== key) {
      groups.push({
        key,
        label,
        year: item.year,
        anchorId: `timeline-${item.year}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        items: [item]
      });
    } else {
      existing.items.push(item);
    }
  });

  return groups;
}

function getViewModel() {
  const filteredItems = getFilteredItems();
  const sections = buildSections(filteredItems);
  const years = [...new Set(filteredItems.map((item) => item.year))];
  const previewItems = filteredItems;
  const previewIndex = previewItems.findIndex((item) => item.id === state.previewId);
  const previewItem = previewIndex >= 0 ? previewItems[previewIndex] : null;

  if (!state.activeYear && years.length) {
    state.activeYear = years[0];
  }

  return {
    filteredItems,
    sections,
    years,
    previewItems,
    previewIndex,
    previewItem
  };
}

function render() {
  if (!refs.root) {
    return;
  }

  const previousScrollTop = refs.scrollRegion ? refs.scrollRegion.scrollTop : 0;
  const shouldFocusSearch = state.shouldFocusSearch;
  const viewModel = getViewModel();

  refs.root.innerHTML = `
    <div class="cml-app-shell">
      ${Sidebar({ navigationModel, state, storageSummary })}
      <div class="cml-main-shell">
        ${TopSearchBar({ state })}
        <div class="cml-main-content-shell">
          <main class="cml-main-content" tabindex="-1">
            <div class="cml-main-content__inner">
              ${SearchSummary({ query: state.searchQuery.trim(), resultCount: viewModel.filteredItems.length })}
              ${viewModel.sections.length
                ? viewModel.sections.map((section) => MediaTimelineSection({ section, state })).join('')
                : EmptyState({ query: state.searchQuery.trim() })}
            </div>
          </main>
          ${YearScroller({ years: viewModel.years, activeYear: state.activeYear })}
        </div>
      </div>
      ${PreviewModal({
        item: viewModel.previewItem,
        selected: viewModel.previewItem ? state.selectedIds.has(viewModel.previewItem.id) : false,
        favorited: viewModel.previewItem ? state.favoriteIds.has(viewModel.previewItem.id) : false,
        currentIndex: Math.max(viewModel.previewIndex, 0),
        totalCount: viewModel.previewItems.length
      })}
    </div>
  `;

  refs.scrollRegion = refs.root.querySelector('.cml-main-content');
  refs.sectionAnchors = [...refs.root.querySelectorAll('.cml-timeline-section')];

  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTop = previousScrollTop;
    refs.scrollRegion.onscroll = handleScroll;
  }

  const searchInput = refs.root.querySelector('.cml-topbar__search-input');
  if (searchInput instanceof HTMLInputElement && document.activeElement === searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }
}

function mount() {
  ensureRoot();
  document.body.classList.add('codex-media-library-active');
  render();

  if (!mounted && refs.root) {
    refs.root.addEventListener('click', handleClick);
    refs.root.addEventListener('input', handleInput);
    refs.root.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    mounted = true;
  }
}

function unmount() {
  document.body.classList.remove('codex-media-library-active');
  if (refs.root) {
    refs.root.remove();
    refs.root = null;
  }
  refs.scrollRegion = null;
  refs.sectionAnchors = [];
}

function syncMount() {
  if (shouldMount()) {
    mount();
  } else {
    unmount();
  }
}

function resetLoadedCount() {
  state.loadedCount = 24;
}

function openPreview(itemId) {
  state.previewId = itemId;
  render();
}

function closePreview() {
  state.previewId = null;
  render();
}

function movePreview(direction) {
  const items = getFilteredItems();
  if (!items.length || !state.previewId) {
    return;
  }
  const currentIndex = items.findIndex((item) => item.id === state.previewId);
  if (currentIndex < 0) {
    return;
  }
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
  state.previewId = items[nextIndex].id;
  render();
}

function toggleSelect(itemId) {
  if (state.selectedIds.has(itemId)) {
    state.selectedIds.delete(itemId);
  } else {
    state.selectedIds.add(itemId);
  }
  render();
}

function toggleFavorite(itemId) {
  if (state.favoriteIds.has(itemId)) {
    state.favoriteIds.delete(itemId);
  } else {
    state.favoriteIds.add(itemId);
  }
  render();
}

function showMockToast(message) {
  state.lastToast = message;
}

function scrollToYear(year) {
  if (!refs.scrollRegion) {
    return;
  }
  const target = refs.root.querySelector(`#${escapeSelector(`timeline-${year}-${String(year) === String(state.activeYear) ? '' : ''}`)}`);
  const section = refs.sectionAnchors.find((item) => item.getAttribute('data-year') === String(year));
  if (section) {
    refs.scrollRegion.scrollTo({ top: section.offsetTop - 12, behavior: 'smooth' });
  }
}

function updateActiveYear() {
  if (!refs.scrollRegion || !refs.sectionAnchors.length) {
    return;
  }
  const scrollTop = refs.scrollRegion.scrollTop;
  let active = refs.sectionAnchors[0].getAttribute('data-year');
  refs.sectionAnchors.forEach((section) => {
    if (section.offsetTop - 40 <= scrollTop) {
      active = section.getAttribute('data-year');
    }
  });
  if (active && active !== state.activeYear) {
    state.activeYear = active;
    render();
  }
}

function handleScroll() {
  if (!refs.scrollRegion) {
    return;
  }
  const filteredItems = getFilteredItems();
  const nearBottom = refs.scrollRegion.scrollTop + refs.scrollRegion.clientHeight >= refs.scrollRegion.scrollHeight - 720;
  if (nearBottom && state.loadedCount < filteredItems.length) {
    state.loadedCount = Math.min(filteredItems.length, state.loadedCount + 18);
    render();
    return;
  }
  updateActiveYear();
}

function handleClick(event) {
  const actionTarget = event.target instanceof Element ? event.target.closest('[data-action], [data-primary], [data-secondary], [data-year]') : null;
  const tileTarget = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;

  if (actionTarget instanceof HTMLElement) {
    if (actionTarget.dataset.primary) {
      state.primaryFilter = actionTarget.dataset.primary;
      state.secondaryFilter = '';
      state.searchQuery = '';
      state.selectedIds.clear();
      state.isCreateMenuOpen = false;
      resetLoadedCount();
      render();
      return;
    }

    if (actionTarget.dataset.secondary) {
      state.secondaryFilter = actionTarget.dataset.secondary === state.secondaryFilter ? '' : actionTarget.dataset.secondary;
      state.selectedIds.clear();
      state.isCreateMenuOpen = false;
      resetLoadedCount();
      render();
      return;
    }

    if (actionTarget.dataset.year) {
      state.activeYear = actionTarget.dataset.year;
      scrollToYear(actionTarget.dataset.year);
      render();
      return;
    }

    switch (actionTarget.dataset.action) {
      case 'toggle-create-menu':
        state.isCreateMenuOpen = !state.isCreateMenuOpen;
        render();
        return;
      case 'mock-upload':
      case 'mock-album':
      case 'mock-collection':
      case 'upgrade':
      case 'help':
      case 'settings':
      case 'apps':
      case 'account':
        state.isCreateMenuOpen = false;
        showMockToast(actionTarget.dataset.action);
        render();
        return;
      case 'toggle-select':
        if (actionTarget.dataset.id) {
          toggleSelect(actionTarget.dataset.id);
        }
        return;
      case 'toggle-favorite':
        if (actionTarget.dataset.id) {
          toggleFavorite(actionTarget.dataset.id);
        }
        return;
      case 'open-preview':
        if (actionTarget.dataset.id) {
          openPreview(actionTarget.dataset.id);
        }
        return;
      case 'close-preview':
        closePreview();
        return;
      case 'preview-next':
        movePreview(1);
        return;
      case 'preview-previous':
        movePreview(-1);
        return;
      default:
        break;
    }
  }

  if (tileTarget instanceof HTMLElement && !(event.target instanceof HTMLElement && event.target.closest('button'))) {
    const itemId = tileTarget.getAttribute('data-tile-id');
    if (itemId) {
      openPreview(itemId);
    }
  }
}

function handleInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains('cml-topbar__search-input')) {
    return;
  }
  state.searchQuery = input.value;
  state.selectedIds.clear();
  state.isCreateMenuOpen = false;
  resetLoadedCount();
  render();
}

function handleFocusIn(event) {
  const tile = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;
  if (tile instanceof HTMLElement) {
    state.focusedTileId = tile.getAttribute('data-tile-id');
  }
}

function moveFocus(delta) {
  const tiles = [...(refs.root ? refs.root.querySelectorAll('.cml-media-tile') : [])];
  if (!tiles.length) {
    return;
  }
  const currentIndex = tiles.findIndex((tile) => tile.getAttribute('data-tile-id') === state.focusedTileId);
  const nextIndex = currentIndex < 0 ? 0 : Math.max(0, Math.min(tiles.length - 1, currentIndex + delta));
  const nextTile = tiles[nextIndex];
  if (nextTile instanceof HTMLElement) {
    state.focusedTileId = nextTile.getAttribute('data-tile-id');
    nextTile.focus();
  }
}

function handleKeyDown(event) {
  if (!document.body.classList.contains('codex-media-library-active')) {
    return;
  }

  if (state.previewId) {
    if (event.key === 'Escape') {
      closePreview();
    } else if (event.key === 'ArrowRight') {
      movePreview(1);
    } else if (event.key === 'ArrowLeft') {
      movePreview(-1);
    }
    return;
  }

  if (!state.focusedTileId) {
    return;
  }

  const columns = refs.scrollRegion ? Math.max(2, Math.floor(refs.scrollRegion.clientWidth / 220)) : 4;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    moveFocus(1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    moveFocus(-1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFocus(columns);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocus(-columns);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    openPreview(state.focusedTileId);
  } else if (event.key === ' ') {
    event.preventDefault();
    toggleSelect(state.focusedTileId);
  }
}

function patchHistory() {
  const { pushState, replaceState } = window.history;
  window.history.pushState = function patchedPushState(...args) {
    const result = pushState.apply(this, args);
    queueMicrotask(syncMount);
    return result;
  };
  window.history.replaceState = function patchedReplaceState(...args) {
    const result = replaceState.apply(this, args);
    queueMicrotask(syncMount);
    return result;
  };
  window.addEventListener('popstate', syncMount);
}

function boot() {
  patchHistory();
  syncMount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}