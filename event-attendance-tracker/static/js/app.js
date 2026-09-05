'use strict';

/* No UI framework or external CDN: a small state object + explicit render functions.
   All attendance writes go to Flask/SQLite. localStorage holds only the event choice. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  scan: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M2 12h20M8 7v2m8-2v2M8 15v2m8-2v2"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  'user-check':
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-10 2 2 4-4"/><circle cx="9" cy="7" r="4"/>',
  ticket:
    '<path d="M4 4h16a1 1 0 0 1 1 1v4a3 3 0 0 0 0 6v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a3 3 0 0 0 0-6V5a1 1 0 0 1 1-1Z"/><path d="M14 4v2m0 3v2m0 3v2m0 3v1"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  'upload-cloud':
    '<path d="M7 16a4 4 0 0 1-.8-7.9 6 6 0 0 1 11.6 0A4 4 0 0 1 17 16M12 21V11m-4 4 4-4 4 4"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18M7 14l4-4 4 2 5-7m-4 0h4v4"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="M3 2v4M1 4h4m15 14v4m-2-2h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  alert:
    '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  shield: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/>',
  'shield-check': '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone:
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
  school: '<path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c3 3 9 3 12 0v-6m4-2v7"/>',
  branch:
    '<path d="M6 6v12m0-6h8a4 4 0 0 0 4-4V6"/><circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="4" r="2"/>',
  id: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M4.5 17v-1a3.5 3.5 0 0 1 7 0v1M15 8h4m-4 4h4m-4 4h2"/>',
  edit: '<path d="m16 3 5 5M4 15l11-11a3.5 3.5 0 0 1 5 5L9 20l-6 1 1-6ZM14 21h7"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  undo: '<path d="M3 10h12a6 6 0 0 1 0 12M3 10l5-5m-5 5 5 5"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
};
function icon(name, extraClass = '') {
  return `<svg class="icon ${extraClass}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
}
function mountIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}

const state = {
  events: [],
  eventId: null,
  page: 'overview',
  summary: null,
  breakdown: 'year',
  list: { q: '', status: 'all', year: '', branch: '', sort: 'name', page: 1, page_size: 10 },
  pagination: { page: 1, pages: 1, total: 0 },
  checkinQuery: '',
  selected: null,
  editingId: null,
  formEventId: null,
  importFile: null,
  importValid: false,
  importEventId: null,
  summarySequence: 0,
  listSequence: 0,
  checkinSequence: 0,
  detailSequence: 0,
  importSequence: 0,
  initialized: false,
  confirmation: null,
};
const number = (value) => Number(value || 0).toLocaleString('en-IN');
const yearName = (value) =>
  ({
    1: '1st year',
    2: '2nd year',
    3: '3rd year',
    4: '4th year',
    5: '5th year',
    PG: 'Postgraduate',
    Other: 'Other',
  })[value] || 'Not specified';
const currentEvent = () => state.events.find((event) => event.id === state.eventId);
const baseURL = (eventId = state.eventId) => `/api/events/${eventId}`;
const participantURL = (id, eventId = state.eventId) => `${baseURL(eventId)}/participants/${id}`;
function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
function avatar(person) {
  return `<span class="avatar avatar-${Number(person.id) % 5}" aria-hidden="true">${escapeHTML(initials(person.name))}</span>`;
}
function statusBadge(present) {
  return `<span class="status-badge ${present ? 'status-present' : 'status-absent'}">${icon(present ? 'check' : 'clock')}${present ? 'Present' : 'Not marked'}</span>`;
}
function timeString(value, full = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(
    'en-IN',
    full ? { dateStyle: 'medium', timeStyle: 'short' } : { hour: 'numeric', minute: '2-digit' },
  ).format(date);
}
function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(value),
  );
}
function eventDate(value) {
  if (!value) return 'Choose a date';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function debounce(callback, wait = 230) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}
function loading(text = 'Loading your guest list…') {
  return `<div class="loading-state"><span class="spinner" aria-hidden="true"></span>${escapeHTML(text)}</div>`;
}
function emptyState(title, description, iconName = 'users', action = '', classes = '') {
  return `<div class="empty-state ${classes}"><span class="empty-icon">${icon(iconName)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p>${action}</div>`;
}
function setConnection(online) {
  $('#connection-badge').classList.toggle('offline', !online);
  $('#connection-text').textContent = online ? 'SQLite connected' : 'Connection interrupted';
}
async function api(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const headers = {
    Accept: 'application/json',
    'X-Requested-With': 'Gather',
    ...(options.headers || {}),
  };
  if (options.body && !(options.body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    const payload = await response
      .json()
      .catch(() => ({
        error: 'The server returned an unreadable response. Please restart it and try again.',
      }));
    if (!response.ok) {
      if (response.status >= 500) setConnection(false);
      const error = new Error(payload.error || 'This request could not be completed.');
      error.data = payload;
      error.status = response.status;
      throw error;
    }
    setConnection(true);
    return payload;
  } catch (error) {
    if (!error.status) {
      setConnection(false);
      error.message =
        error.name === 'AbortError'
          ? 'The server took too long to respond. Check that it is running, then try again.'
          : 'Could not reach the server. Make sure Gather is running, then try again.';
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function errorHTML(error) {
  const details = error.data?.errors || [];
  return `<strong>${escapeHTML(error.message)}</strong>${details.length ? `<ul>${details.map((item) => `<li>${escapeHTML(typeof item === 'string' ? item : `Row ${item.row}: ${item.message}`)}</li>`).join('')}</ul>` : ''}`;
}
function showFormError(id, error) {
  const el = $(id);
  el.innerHTML = errorHTML(error);
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest' });
}
function showGlobalError(error) {
  $('#global-error-text').textContent = error.message;
  $('#global-error').hidden = false;
}
function toast(message, error = false) {
  const el = document.createElement('div');
  el.className = `toast${error ? ' toast-error' : ''}`;
  el.innerHTML = `${icon(error ? 'alert' : 'check-circle')}<span>${escapeHTML(message)}</span><button type="button" class="toast-dismiss" aria-label="Dismiss notification">${icon('x')}</button>`;
  $('#toast-region').append(el);
  $('.toast-dismiss', el).addEventListener('click', () => el.remove());
  setTimeout(() => el.remove(), error ? 8000 : 5000);
}
function showDialog(id) {
  const dialog = $(`#${id}`);
  if (!dialog.open) dialog.showModal();
}
function closeDialog(id) {
  const dialog = $(`#${id}`);
  if (!dialog || dialog.dataset.busy === 'true') return;
  dialog.close();
}
function setBusy(button, busy, label = 'Saving…') {
  const dialog = button.closest('dialog');
  if (busy) {
    button.dataset.previousHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapeHTML(label)}`;
    if (dialog) {
      dialog.dataset.busy = 'true';
      $$('[data-close]', dialog).forEach((el) => {
        el.disabled = true;
      });
    }
  } else {
    if (button.dataset.previousHTML) button.innerHTML = button.dataset.previousHTML;
    button.disabled = false;
    if (dialog) {
      delete dialog.dataset.busy;
      $$('[data-close]', dialog).forEach((el) => {
        el.disabled = false;
      });
    }
  }
}

/* Routing and the shared event selector. */
const PAGE_CONTENT = {
  overview: {
    breadcrumb: 'Overview',
    eyebrow: 'A LITTLE ORGANIZATION. A GREAT EVENT.',
    title: 'Your event, at a glance',
    description: 'Every registration. Every arrival. All in one happy place.',
  },
  participants: {
    breadcrumb: 'Participants',
    eyebrow: 'GOOD PEOPLE MAKE GREAT EVENTS.',
    title: 'Everyone on the list',
    description: 'Your guest list, without the guesswork. Find, organize, and welcome.',
  },
  checkin: {
    breadcrumb: 'Check-in desk',
    eyebrow: 'A FRIENDLY FACE AT THE FRONT DOOR.',
    title: 'Let’s get everyone in',
    description: 'Find their name. Check their card. Let the good moments begin.',
  },
};
function renderPage() {
  const content = PAGE_CONTENT[state.page];
  $('#breadcrumb-current').textContent = content.breadcrumb;
  $('#page-eyebrow').textContent = content.eyebrow;
  $('#page-title').innerHTML = `${content.title}<span class="accent-dot">.</span>`;
  $('#page-description').textContent = content.description;
  document.title = `${content.breadcrumb} · Gather`;
  $$('[data-nav]').forEach((el) => {
    const active = el.dataset.nav === state.page;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  $$('.page-view').forEach((el) => {
    el.hidden = el.id !== `page-${state.page}` || !state.eventId;
  });
  $('#no-event').hidden = Boolean(state.eventId) || !state.initialized;
  if (!state.eventId && state.initialized) {
    $('#heading-actions').innerHTML =
      `<button class="btn btn-primary" type="button" data-action="new-event">${icon('plus')}Create an event</button>`;
  } else if (state.page === 'overview') {
    $('#heading-actions').innerHTML =
      `<button class="btn btn-secondary" type="button" data-action="import">${icon('upload')}Import CSV</button><a class="btn btn-primary" href="#checkin">${icon('scan')}Check in student</a>`;
  } else if (state.page === 'participants') {
    $('#heading-actions').innerHTML =
      `<button class="btn btn-secondary" type="button" data-action="import">${icon('upload')}Import CSV</button><button class="btn btn-primary" type="button" data-action="add-participant">${icon('plus')}Add participant</button>`;
  } else {
    $('#heading-actions').innerHTML =
      `<a class="btn btn-secondary" href="#participants">${icon('users')}View participants</a><button class="btn btn-primary" type="button" data-action="add-participant">${icon('plus')}Add participant</button>`;
  }
}
function route() {
  const requested = location.hash.slice(1);
  state.page = Object.hasOwn(PAGE_CONTENT, requested) ? requested : 'overview';
  renderPage();
  if (state.initialized && state.eventId) {
    if (state.page === 'participants') loadParticipants();
    if (state.page === 'checkin') {
      loadCheckin();
      $('#checkin-search').focus({ preventScroll: true });
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function navigate(page) {
  if (location.hash === `#${page}`) route();
  else location.hash = page;
}
function renderEventSelector() {
  const select = $('#event-select');
  select.innerHTML = state.events.length
    ? state.events
        .map((event) => `<option value="${event.id}">${escapeHTML(event.name)}</option>`)
        .join('')
    : '<option value="">No events yet</option>';
  select.disabled = !state.events.length;
  if (state.eventId) select.value = String(state.eventId);
  const event = currentEvent();
  $('#event-date').textContent = event ? eventDate(event.event_date) : 'Your next event awaits';
  $('#event-venue').textContent =
    event?.venue || (event ? 'Venue not specified' : 'Create an event to begin');
  $('#demo-badge').hidden = !event?.is_demo;
}
function resetFilters() {
  state.list = { ...state.list, q: '', status: 'all', year: '', branch: '', sort: 'name', page: 1 };
  syncFilterControls();
}
function syncFilterControls() {
  $('#participant-search').value = state.list.q;
  $('#filter-status').value = state.list.status;
  $('#filter-year').value = state.list.year;
  $('#filter-branch').value = state.list.branch;
  $('#sort-order').value = state.list.sort;
  $('#page-size').value = String(state.list.page_size);
  $('.clear-filters').hidden = !(
    state.list.q ||
    state.list.status !== 'all' ||
    state.list.year ||
    state.list.branch
  );
}
async function selectEvent(eventId) {
  state.eventId = eventId;
  state.summary = null;
  state.selected = null;
  state.summarySequence++;
  state.listSequence++;
  state.checkinSequence++;
  state.detailSequence++;
  state.checkinQuery = '';
  $('#checkin-search').value = '';
  resetFilters();
  try {
    localStorage.setItem('gather.selectedEvent', String(eventId));
  } catch (_error) {
    /* Storage may be disabled; attendance still works. */
  }
  renderEventSelector();
  renderPage();
  $('#global-error').hidden = true;
  if (!eventId) return;
  ['#stat-total', '#stat-present', '#stat-absent', '#stat-percentage'].forEach((id) => {
    $(id).textContent = '—';
  });
  $('#participant-table').innerHTML = loading();
  $('#checkin-results').innerHTML = loading('Getting the check-in desk ready…');
  await refreshCurrent();
}
async function bootstrap() {
  try {
    const data = await api('/api/events');
    state.events = data.events;
    let remembered = state.eventId;
    if (!remembered) {
      try {
        remembered = Number(localStorage.getItem('gather.selectedEvent'));
      } catch (_error) {
        /* Optional preference. */
      }
    }
    const event = state.events.find((item) => item.id === remembered) || state.events[0];
    state.initialized = true;
    await selectEvent(event?.id || null);
    if (!event) $('#last-updated').textContent = 'Ready for your first event.';
  } catch (error) {
    showGlobalError(error);
  }
}
async function refreshCurrent({ quiet = false } = {}) {
  if (!state.eventId) return;
  const sequence = ++state.summarySequence;
  const eventId = state.eventId;
  try {
    const data = await api(`${baseURL(eventId)}/summary`);
    if (sequence !== state.summarySequence || eventId !== state.eventId) return;
    state.summary = data;
    $('#global-error').hidden = true;
    renderSummary();
    if (state.page === 'participants') await loadParticipants({ quiet });
    if (state.page === 'checkin') await loadCheckin({ quiet });
  } catch (error) {
    if (eventId === state.eventId) showGlobalError(error);
  }
}

/* Dashboard: every statistic comes from an event-scoped database query. */
function renderSummary() {
  const s = state.summary;
  if (!s) return;
  $('#nav-count').textContent = number(s.total);
  $('#stat-total').textContent = number(s.total);
  $('#stat-present').textContent = number(s.present);
  $('#stat-absent').textContent = number(s.absent);
  $('#stat-percentage').innerHTML = `${s.percentage}<span class="percent-sign">%</span>`;
  $('#donut-percentage').innerHTML = `${s.percentage}<span>%</span>`;
  $('#attendance-donut').style.setProperty('--percentage', s.percentage);
  $('#attendance-donut').setAttribute(
    'aria-label',
    `${s.percentage}% attendance: ${s.present} present, ${s.absent} not marked, ${s.total} registered.`,
  );
  $('#legend-present').textContent = number(s.present);
  $('#legend-absent').textContent = number(s.absent);
  $('#legend-total').textContent = number(s.total);
  $('#arrival-note-text').textContent = s.total
    ? s.absent
      ? `${number(s.present)} students welcomed. ${number(s.absent)} more moments to come.`
      : 'A full house! Every registered student is here.'
    : 'Your first registration is the start of something good.';
  $('#desk-present').textContent = number(s.present);
  $('#desk-total').textContent = number(s.total);
  $('#desk-rate').textContent = `${s.percentage}% attendance`;
  $('#desk-progress-bar').style.width = `${s.percentage}%`;
  $('#last-updated').textContent = `Last synced ${timeString(s.updated_at)}`;
  renderBreakdown();
  renderRecent(s.recent);
  updateFilterOptions();
}
function renderBreakdown() {
  const groups = state.summary?.[`by_${state.breakdown}`] || [];
  $$('[data-breakdown]').forEach((button) => {
    const selected = button.dataset.breakdown === state.breakdown;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (!groups.length) {
    $('#breakdown-chart').innerHTML = emptyState(
      'A blank canvas, for now',
      'Add registrations to see attendance by year and branch.',
      'chart',
    );
    return;
  }
  const colors = ['#b4a1d2', '#dfb397', '#a9c2a0', '#dac487', '#9fbace', '#d5a9ba'];
  $('#breakdown-chart').innerHTML = groups
    .map((group, index) => {
      const label =
        state.breakdown === 'year' ? yearName(group.label) : group.label || 'Not specified';
      return `<div class="breakdown-item" style="--bar-color:${colors[index % colors.length]}"><div class="bar-label"><span><i class="year-dot" aria-hidden="true"></i>${escapeHTML(label)}</span><strong>${number(group.present)} <span>/ ${number(group.total)}</span></strong></div><div class="progress-track" role="meter" aria-label="${escapeHTML(label)} attendance" aria-valuemin="0" aria-valuemax="${group.total}" aria-valuenow="${group.present}" aria-valuetext="${group.present} of ${group.total} present (${group.percentage}%)"><span style="width:${group.percentage}%"></span></div></div>`;
    })
    .join('');
}
function renderRecent(people) {
  if (!people.length) {
    $('#recent-checkins').innerHTML = emptyState(
      'The welcome starts with you',
      'No check-ins yet. Head to the check-in desk when the first student arrives.',
      'scan',
      '<a href="#checkin" class="btn btn-secondary btn-small">Open check-in desk</a>',
      'table-empty',
    );
    $('#desk-recent').innerHTML =
      '<p class="muted">No arrivals yet. Yours could be the first welcome.</p>';
    return;
  }
  $('#recent-checkins').innerHTML =
    `<table><thead><tr><th scope="col">Student</th><th scope="col">College ID</th><th scope="col">Branch</th><th scope="col">Checked in</th><th scope="col">Status</th></tr></thead><tbody>${people.map((person) => `<tr><td><button type="button" class="student-cell row-open" data-detail="${person.id}" aria-label="View ${escapeHTML(person.name)}">${avatar(person)}<span><span class="student-name">${escapeHTML(person.name)}</span><span class="student-email">${escapeHTML(person.email)}</span></span></button></td><td><span class="id-tag">${escapeHTML(person.college_id)}</span></td><td class="branch-cell">${escapeHTML(person.branch || 'Not specified')}</td><td><time datetime="${escapeHTML(person.checked_in_at)}" title="${escapeHTML(timeString(person.checked_in_at, true))}">${timeString(person.checked_in_at)}</time></td><td>${statusBadge(true)}</td></tr>`).join('')}</tbody></table>`;
  $('#desk-recent').innerHTML = people
    .slice(0, 3)
    .map(
      (person) =>
        `<button type="button" class="mini-recent-row" data-detail="${person.id}">${avatar(person)}<span><strong>${escapeHTML(person.name)}</strong><small>${escapeHTML(relativeTime(person.checked_in_at))}</small></span>${icon('check')}</button>`,
    )
    .join('');
}
function updateFilterOptions() {
  for (const field of ['year', 'branch']) {
    const select = $(`#filter-${field}`);
    const options = state.summary?.[`by_${field}`] || [];
    select.innerHTML =
      `<option value="">All ${field === 'year' ? 'years' : 'branches'}</option>` +
      options
        .map(
          (group) =>
            `<option value="${escapeHTML(group.label || '__unspecified__')}">${escapeHTML(field === 'year' ? yearName(group.label) : group.label || 'Not specified')}</option>`,
        )
        .join('');
    if (
      state.list[field] &&
      !options.some((group) => (group.label || '__unspecified__') === state.list[field])
    )
      state.list[field] = '';
  }
  syncFilterControls();
}

/* Searchable directory and its event-scoped filters. */
async function loadParticipants({ quiet = false } = {}) {
  if (!state.eventId) return;
  const sequence = ++state.listSequence;
  const eventId = state.eventId;
  if (!quiet) $('#participant-table').setAttribute('aria-busy', 'true');
  syncFilterControls();
  try {
    const data = await api(`${baseURL(eventId)}/participants?${new URLSearchParams(state.list)}`);
    if (sequence !== state.listSequence || eventId !== state.eventId) return;
    state.pagination = data.pagination;
    state.list.page = data.pagination.page;
    renderParticipants(data.participants, data.pagination);
  } catch (error) {
    if (sequence === state.listSequence && eventId === state.eventId) {
      showGlobalError(error);
      if (!quiet)
        $('#participant-table').innerHTML = emptyState(
          'Couldn’t load participants',
          'Check the server connection, then use “Try again” above.',
          'alert',
          '',
          'table-empty',
        );
    }
  } finally {
    if (sequence === state.listSequence) $('#participant-table').removeAttribute('aria-busy');
  }
}
function renderParticipants(people, pagination) {
  $('#directory-count').textContent =
    `${number(pagination.total)} participant${pagination.total === 1 ? '' : 's'}`;
  if (!people.length) {
    const filtered =
      state.list.q || state.list.status !== 'all' || state.list.year || state.list.branch;
    $('#participant-table').innerHTML = filtered
      ? emptyState(
          'No matching participants',
          'Try a different name, email, College ID or phone number, or clear the filters.',
          'search',
          '<button class="btn btn-secondary btn-small" type="button" data-action="clear-filters">Clear search & filters</button>',
          'table-empty',
        )
      : emptyState(
          'A great event starts with a guest list',
          'Add a participant or import a CSV to get your event ready.',
          'users',
          `<button class="btn btn-primary btn-small" type="button" data-action="add-participant">${icon('plus')}Add the first participant</button>`,
          'table-empty',
        );
  } else {
    $('#participant-table').innerHTML =
      `<table><thead><tr><th scope="col">Name & email</th><th scope="col">College ID</th><th scope="col">Year</th><th scope="col">Branch</th><th scope="col">Attendance</th><th scope="col">Action</th></tr></thead><tbody>${people.map((person) => `<tr><td><button type="button" class="student-cell row-open" data-detail="${person.id}" aria-label="View ${escapeHTML(person.name)}">${avatar(person)}<span><span class="student-name">${escapeHTML(person.name)}</span><span class="student-email">${escapeHTML(person.email)}</span></span></button></td><td><span class="id-tag">${escapeHTML(person.college_id)}</span></td><td>${yearName(person.year)}</td><td class="branch-cell">${escapeHTML(person.branch || 'Not specified')}</td><td>${statusBadge(person.present)}</td><td><button type="button" class="table-action" data-detail="${person.id}" aria-label="${person.present ? 'View' : 'Verify'} ${escapeHTML(person.name)}">${person.present ? 'View details' : 'Verify & check in'}${icon('arrow-up-right')}</button></td></tr>`).join('')}</tbody></table>`;
  }
  const start = pagination.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const end = Math.min(pagination.page * pagination.page_size, pagination.total);
  $('#page-range').textContent = `${number(start)}–${number(end)} of ${number(pagination.total)}`;
  $('#page-indicator').textContent = `${pagination.page} / ${pagination.pages}`;
  $('#previous-page').disabled = pagination.page <= 1;
  $('#next-page').disabled = pagination.page >= pagination.pages;
}

/* Entrance flow. A search never changes attendance or silently selects a match. */
async function loadCheckin({ quiet = false } = {}) {
  const q = state.checkinQuery.trim();
  const sequence = ++state.checkinSequence;
  const eventId = state.eventId;
  if (!q) {
    $('#checkin-results').innerHTML = emptyState(
      'Ready for the next student',
      'Start typing above to find their registration. A little ID check, and they’re in.',
      'id',
      '',
      'checkin-idle',
    );
    return;
  }
  if (!eventId) return;
  if (!quiet) $('#checkin-results').innerHTML = loading('Finding your student…');
  try {
    const data = await api(
      `${baseURL(eventId)}/participants?${new URLSearchParams({ q, page_size: 20 })}`,
    );
    if (sequence !== state.checkinSequence || eventId !== state.eventId) return;
    if (!data.participants.length) {
      $('#checkin-results').innerHTML = emptyState(
        'Student not found',
        'No registered student matches this search in the selected event. Check the spelling or College ID, or add a registration if permitted.',
        'search',
        `<button type="button" class="btn btn-secondary" data-action="add-participant">${icon('plus')}Add a registration</button>`,
        'checkin-idle',
      );
      return;
    }
    $('#checkin-results').innerHTML =
      `<div class="checkin-results-head"><strong>${number(data.pagination.total)} matching student${data.pagination.total === 1 ? '' : 's'}</strong><span>Match the card before checking in</span></div><div class="result-grid">${data.participants.map((person) => `<article class="result-card"><div class="result-card-top">${avatar(person)}${statusBadge(person.present)}</div><h3>${escapeHTML(person.name)}</h3><p class="result-email">${escapeHTML(person.email)}</p><div class="result-meta"><span class="id-tag">${escapeHTML(person.college_id)}</span><span>${yearName(person.year)}</span></div><button type="button" class="btn ${person.present ? 'btn-secondary' : 'btn-primary'}" data-detail="${person.id}">${icon(person.present ? 'user-check' : 'id')}${person.present ? 'Already here · View details' : 'Verify student & check in'}</button></article>`).join('')}</div>${data.pagination.total > 20 ? '<p class="checkin-more">Showing the first 20 matches. Use a more specific name, full email, or College ID to narrow your search.</p>' : ''}`;
  } catch (error) {
    if (sequence === state.checkinSequence && eventId === state.eventId) {
      $('#checkin-results').innerHTML = emptyState(
        'Search is unavailable',
        'Check that the server is running, then try again. Your saved attendance is still in the database.',
        'alert',
        '<button type="button" class="btn btn-secondary btn-small" data-action="retry-checkin">Try again</button>',
        'checkin-idle',
      );
      showGlobalError(error);
    }
  }
}
async function openDetail(id) {
  const eventId = state.eventId;
  const sequence = ++state.detailSequence;
  state.selected = null;
  $('#detail-content').innerHTML =
    `<h2 id="detail-title" class="sr-only">Participant details</h2>${loading('Opening the registration…')}`;
  showDialog('detail-dialog');
  try {
    const data = await api(participantURL(id, eventId));
    if (sequence !== state.detailSequence || !$('#detail-dialog').open || eventId !== state.eventId)
      return;
    state.selected = data.participant;
    renderDetail();
  } catch (error) {
    if (sequence === state.detailSequence && $('#detail-dialog').open)
      $('#detail-content').innerHTML =
        `<div class="detail-body"><h2 id="detail-title">Unable to open student</h2><div class="form-error">${errorHTML(error)}</div></div>`;
  }
}
function renderDetail() {
  const person = state.selected;
  if (!person) return;
  const fact = (name, label, value, full = false) =>
    `<div${full ? ' class="full-width"' : ''}><dt>${icon(name)}${label}</dt><dd>${escapeHTML(value || 'Not specified')}</dd></div>`;
  $('#detail-content').innerHTML =
    `<div class="detail-profile">${avatar(person)}<h2 id="detail-title">${escapeHTML(person.name)}</h2><p>${escapeHTML(currentEvent()?.name || '')}</p>${statusBadge(person.present)}</div><div class="detail-body"><div class="college-card"><span><small>COLLEGE ID · MATCH THE PHYSICAL CARD</small><strong>${escapeHTML(person.college_id)}</strong></span>${icon('id')}</div><dl class="detail-facts">${fact('mail', 'Email address', person.email, true)}${fact('phone', 'Phone number', person.phone, true)}${fact('school', 'Year', yearName(person.year))}${fact('branch', 'Branch', person.branch)}</dl>${person.present ? `<div class="detail-verification detail-arrived">${icon('check-circle')}<span><strong>They’re here. Let the good moments begin.</strong><br>Checked in ${escapeHTML(timeString(person.checked_in_at, true))}. Attendance is saved.</span></div><button type="button" class="btn btn-secondary detail-primary" data-action="undo-attendance">${icon('undo')}Undo check-in</button>` : `<div class="detail-verification">${icon('shield')}<span><strong>One quick check before the welcome.</strong><br>Match this registration’s name and College ID with the student’s physical College ID card.</span></div><button type="button" class="btn btn-primary detail-primary" data-action="mark-present">${icon('user-check')}Mark as present</button>`}<div class="detail-secondary"><button type="button" class="text-button" data-action="edit-participant">${icon('edit')}Edit details</button><button type="button" class="text-button danger-text" data-action="delete-participant">${icon('trash')}Delete registration</button></div><div id="detail-error" class="form-error" role="alert" hidden></div></div>`;
}
async function markPresent(button) {
  if (!state.selected || button.disabled) return;
  const person = { ...state.selected };
  setBusy(button, true, 'Saving attendance…');
  try {
    const data = await api(`${participantURL(person.id, person.event_id)}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ present: true }),
    });
    state.selected = data.participant;
    renderDetail();
    toast(
      data.changed
        ? `${person.name} is checked in. Welcome!`
        : `${person.name} is already marked present.`,
    );
    await refreshCurrent({ quiet: true });
  } catch (error) {
    showFormError('#detail-error', error);
  } finally {
    setBusy(button, false);
    delete $('#detail-dialog').dataset.busy;
    $$('[data-close]', $('#detail-dialog')).forEach((el) => {
      el.disabled = false;
    });
  }
}
function openConfirmation(title, description, label, action) {
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  $('#confirm-action').textContent = label;
  $('#confirm-error').hidden = true;
  state.confirmation = action;
  showDialog('confirm-dialog');
}
function undoAttendance() {
  if (!state.selected) return;
  const person = { ...state.selected };
  openConfirmation(
    'Undo this check-in?',
    `${person.name} will return to “Not marked” for this event. Their registration will stay on the list.`,
    'Undo check-in',
    async () => {
      const data = await api(`${participantURL(person.id, person.event_id)}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ present: false }),
      });
      state.selected = data.participant;
      renderDetail();
      toast(`Check-in undone for ${person.name}.`);
      await refreshCurrent({ quiet: true });
    },
  );
}
function deleteParticipant() {
  if (!state.selected) return;
  const person = { ...state.selected };
  openConfirmation(
    'Delete this registration?',
    `${person.name} and their attendance record will be permanently removed from this event. Other events are not affected. This cannot be undone.`,
    'Delete registration',
    async () => {
      await api(participantURL(person.id, person.event_id), { method: 'DELETE' });
      $('#detail-dialog').close();
      state.selected = null;
      toast('Registration deleted from this event.');
      await refreshCurrent({ quiet: true });
    },
  );
}

/* Forms: server validation is authoritative, including duplicates and types. */
function requireEvent() {
  if (state.eventId) return true;
  toast('Create an event first, then add your participants.');
  openEventForm();
  return false;
}
function openParticipantForm(person = null) {
  if (!requireEvent()) return;
  const form = $('#participant-form');
  form.reset();
  state.editingId = person?.id || null;
  state.formEventId = state.eventId;
  $('#participant-form-error').hidden = true;
  $('#participant-dialog-title').textContent = person
    ? 'Edit participant details'
    : 'Add a participant';
  $('#save-participant').innerHTML =
    `${icon(person ? 'check' : 'plus')}${person ? 'Save changes' : 'Add participant'}`;
  if (person)
    ['name', 'college_id', 'email', 'phone', 'year', 'branch'].forEach((field) => {
      form.elements[field].value = person[field] || '';
    });
  if ($('#detail-dialog').open) $('#detail-dialog').close();
  showDialog('participant-dialog');
  form.elements.name.focus();
}
async function saveParticipant(event) {
  event.preventDefault();
  const button = $('#save-participant');
  if (button.disabled) return;
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const editingId = state.editingId;
  const eventId = state.formEventId;
  $('#participant-form-error').hidden = true;
  setBusy(button, true);
  try {
    const result = await api(
      editingId ? participantURL(editingId, eventId) : `${baseURL(eventId)}/participants`,
      { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(data) },
    );
    $('#participant-dialog').close();
    toast(
      editingId
        ? 'Participant details updated.'
        : `${result.participant.name} is on the guest list.`,
    );
    await refreshCurrent({ quiet: true });
    await openDetail(result.participant.id);
  } catch (error) {
    showFormError('#participant-form-error', error);
  } finally {
    setBusy(button, false);
  }
}
function openEventForm() {
  $('#event-form').reset();
  $('#event-form').elements.event_date.value = localToday();
  $('#event-form-error').hidden = true;
  showDialog('event-dialog');
  $('#event-form').elements.name.focus();
}
async function saveEvent(event) {
  event.preventDefault();
  const button = $('#save-event');
  if (button.disabled) return;
  $('#event-form-error').hidden = true;
  setBusy(button, true, 'Creating event…');
  try {
    const result = await api('/api/events', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    state.events.unshift(result.event);
    $('#event-dialog').close();
    await selectEvent(result.event.id);
    toast('Your event is ready. Let’s build the guest list.');
    navigate('participants');
  } catch (error) {
    showFormError('#event-form-error', error);
  } finally {
    setBusy(button, false);
  }
}

/* Two-stage CSV import. A preview never writes; final import validates again. */
function openImport() {
  if (!requireEvent()) return;
  state.importFile = null;
  state.importValid = false;
  state.importEventId = state.eventId;
  state.importSequence++;
  $('#csv-file').value = '';
  $('#csv-file-label').innerHTML = 'Click to upload <span>or drag and drop</span>';
  $('#import-feedback').innerHTML = '';
  $('#confirm-import').disabled = true;
  $('#confirm-import').innerHTML = `${icon('upload')}Import participants`;
  showDialog('import-dialog');
}
function importFeedback(data) {
  const valid = data.valid;
  state.importValid = valid;
  $('#confirm-import').disabled = !valid;
  $('#confirm-import').innerHTML =
    `${icon('upload')}Import ${valid ? `${number(data.valid_count)} ` : ''}participant${data.valid_count === 1 ? '' : 's'}`;
  let html = `<div class="import-status ${valid ? '' : 'invalid'}"><strong>${icon(valid ? 'check-circle' : 'alert')}${valid ? `${number(data.valid_count)} participants ready to import` : `${number(data.error_count)} ${data.error_count === 1 ? 'row needs' : 'rows need'} attention`}</strong><p>${valid ? 'No duplicates or invalid fields. All participants will start as not marked.' : 'Nothing has been imported. Fix every error in the CSV and upload the corrected file.'}</p>${!valid ? `<ul class="import-errors">${data.errors.map((error) => `<li><b>Row ${error.row}:</b> ${escapeHTML(error.message)}</li>`).join('')}</ul>${data.error_count > 50 ? '<p>Showing the first 50 errors. Correct these and preview again.</p>' : ''}` : ''}</div>`;
  if (valid && data.preview.length)
    html += `<div class="preview-table"><table><thead><tr><th scope="col">Name</th><th scope="col">College ID</th><th scope="col">Email</th></tr></thead><tbody>${data.preview.map((person) => `<tr><td>${escapeHTML(person.name)}</td><td>${escapeHTML(person.college_id)}</td><td>${escapeHTML(person.email)}</td></tr>`).join('')}</tbody></table></div><p class="preview-caption">Previewing ${data.preview.length} of ${number(data.row_count)} rows. Optional fields are imported too.</p>`;
  if (data.ignored_columns?.length)
    html += `<p class="preview-caption">Ignored columns: ${data.ignored_columns.map(escapeHTML).join(', ')}. Attendance cannot be imported.</p>`;
  $('#import-feedback').innerHTML = html;
}
async function previewFile(file) {
  const sequence = ++state.importSequence;
  state.importFile = file || null;
  state.importValid = false;
  $('#confirm-import').disabled = true;
  if (!file) {
    $('#import-feedback').innerHTML = '';
    return;
  }
  $('#csv-file-label').textContent = file.name;
  if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2 * 1024 * 1024) {
    $('#import-feedback').innerHTML =
      '<div class="form-error">Choose a CSV UTF-8 file smaller than 2 MB. Excel workbooks (.xlsx) must be saved as CSV first.</div>';
    return;
  }
  $('#import-feedback').innerHTML = loading('Checking the rows, one by one…');
  const data = new FormData();
  data.append('file', file);
  try {
    const result = await api(`${baseURL(state.importEventId)}/import/preview`, {
      method: 'POST',
      body: data,
    });
    if (sequence === state.importSequence && $('#import-dialog').open) importFeedback(result);
  } catch (error) {
    if (sequence === state.importSequence)
      $('#import-feedback').innerHTML = `<div class="form-error">${errorHTML(error)}</div>`;
  }
}
async function confirmImport() {
  const button = $('#confirm-import');
  if (button.disabled || !state.importFile || !state.importValid) return;
  const data = new FormData();
  data.append('file', state.importFile);
  const eventId = state.importEventId;
  setBusy(button, true, 'Importing participants…');
  $('#csv-file').disabled = true;
  try {
    const result = await api(`${baseURL(eventId)}/import`, { method: 'POST', body: data });
    $('#import-dialog').close();
    state.importFile = null;
    state.importValid = false;
    toast(`${number(result.imported)} participants added. Your guest list is growing!`);
    resetFilters();
    await refreshCurrent({ quiet: true });
    navigate('participants');
  } catch (error) {
    state.importValid = false;
    if (error.data?.errors && error.data?.row_count) importFeedback(error.data);
    else
      $('#import-feedback').innerHTML =
        `<div class="form-error">${errorHTML(error)}<p>Choose the file again to refresh the preview before retrying.</p></div>`;
  } finally {
    setBusy(button, false);
    button.disabled = !state.importValid;
    $('#csv-file').disabled = false;
    // Permit selecting the same corrected filename on the next attempt.
    $('#csv-file').value = '';
  }
}
async function exportCSV(button) {
  if (!requireEvent() || button.disabled) return;
  const params = new URLSearchParams({
    q: state.list.q,
    status: state.list.status,
    year: state.list.year,
    branch: state.list.branch,
    sort: state.list.sort,
  });
  setBusy(button, true, 'Exporting…');
  try {
    const response = await fetch(`${baseURL()}/export?${params}`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Could not export the report.');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-${state.eventId}-attendance.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Attendance report downloaded with your current filters.');
  } catch (error) {
    toast(error.message || 'The report could not be downloaded.', true);
  } finally {
    setBusy(button, false);
  }
}

/* Event binding, with delegation for rendered tables/cards. */
function bindEvents() {
  window.addEventListener('hashchange', route);
  $('#event-select').addEventListener('change', (event) => selectEvent(Number(event.target.value)));
  $('#participant-form').addEventListener('submit', saveParticipant);
  $('#event-form').addEventListener('submit', saveEvent);
  $('#csv-file').addEventListener('change', (event) => previewFile(event.target.files[0]));
  $('#confirm-import').addEventListener('click', confirmImport);
  $('#confirm-action').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!state.confirmation || button.disabled) return;
    setBusy(button, true, 'Saving…');
    try {
      await state.confirmation();
      $('#confirm-dialog').close();
    } catch (error) {
      showFormError('#confirm-error', error);
    } finally {
      setBusy(button, false);
    }
  });
  const searchDirectory = debounce(() => {
    if (state.eventId) loadParticipants();
  });
  $('#participant-search').addEventListener('input', (event) => {
    state.list.q = event.target.value;
    state.list.page = 1;
    state.listSequence++; // Invalidate an older response immediately, not after debounce.
    searchDirectory();
  });
  const searchCheckin = debounce(() => loadCheckin());
  $('#checkin-search').addEventListener('input', (event) => {
    state.checkinQuery = event.target.value;
    state.checkinSequence++;
    searchCheckin();
  });
  [
    ['#filter-status', 'status'],
    ['#filter-year', 'year'],
    ['#filter-branch', 'branch'],
    ['#sort-order', 'sort'],
    ['#page-size', 'page_size'],
  ].forEach(([selector, field]) => {
    $(selector).addEventListener('change', (event) => {
      state.list[field] = field === 'page_size' ? Number(event.target.value) : event.target.value;
      state.list.page = 1;
      loadParticipants();
    });
  });
  $('#previous-page').addEventListener('click', () => {
    if (state.list.page > 1) {
      state.list.page--;
      loadParticipants();
    }
  });
  $('#next-page').addEventListener('click', () => {
    if (state.list.page < state.pagination.pages) {
      state.list.page++;
      loadParticipants();
    }
  });
  $$('[data-breakdown]').forEach((button) =>
    button.addEventListener('click', () => {
      state.breakdown = button.dataset.breakdown;
      renderBreakdown();
    }),
  );
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('cancel', (event) => {
      if (dialog.dataset.busy === 'true') event.preventDefault();
    });
    dialog.addEventListener('click', (event) => {
      // A click within the dialog's scrollbar must not close it.
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          closeDialog(dialog.id);
      }
    });
  });
  $('#detail-dialog').addEventListener('close', () => {
    state.detailSequence++;
  });
  $('#import-dialog').addEventListener('close', () => {
    state.importSequence++;
  });
  const zone = $('#drop-zone');
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('dragover');
    if ($('#import-dialog').dataset.busy === 'true') return;
    if (event.dataTransfer.files.length !== 1) {
      $('#import-feedback').innerHTML =
        '<div class="form-error">Please choose one CSV file at a time.</div>';
      return;
    }
    previewFile(event.dataTransfer.files[0]);
  });
  ['dragover', 'drop'].forEach((name) =>
    document.addEventListener(name, (event) => {
      if ([...(event.dataTransfer?.types || [])].includes('Files')) event.preventDefault();
    }),
  );
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]');
    if (close) {
      closeDialog(close.dataset.close);
      return;
    }
    const detail = event.target.closest('[data-detail]');
    if (detail) {
      openDetail(Number(detail.dataset.detail));
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const actions = {
      'new-event': openEventForm,
      'add-participant': () => openParticipantForm(),
      'edit-participant': () => openParticipantForm(state.selected),
      import: openImport,
      help: () => showDialog('help-dialog'),
      'mark-present': () => markPresent(button),
      'undo-attendance': undoAttendance,
      'delete-participant': deleteParticipant,
      retry: bootstrap,
      'retry-checkin': () => loadCheckin(),
      export: () => exportCSV(button),
      'clear-filters': () => {
        resetFilters();
        loadParticipants();
      },
      'view-present': () => {
        resetFilters();
        state.list.status = 'present';
        syncFilterControls();
        navigate('participants');
      },
    };
    actions[button.dataset.action]?.();
  });
  document.addEventListener('keydown', (event) => {
    if ($('dialog[open]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      navigate('checkin');
      $('#checkin-search').focus();
    } else if (
      event.key === '/' &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
    ) {
      event.preventDefault();
      if (state.page === 'participants') $('#participant-search').focus();
      else {
        navigate('checkin');
        $('#checkin-search').focus();
      }
    }
  });
  const maybeRefresh = () => {
    if (state.initialized && state.eventId && !document.hidden && !$('dialog[open]'))
      refreshCurrent({ quiet: true });
  };
  setInterval(maybeRefresh, 30000);
  document.addEventListener('visibilitychange', maybeRefresh);
  window.addEventListener('online', maybeRefresh);
  window.addEventListener('offline', () => setConnection(false));
  $('.large-search kbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘ K'
    : 'Ctrl K';
}

mountIcons();
bindEvents();
route();
bootstrap();
