// 뮤직잇츠 노트 — 화면
// 서버는 노트서버.py. 편집기·마크다운 그리기는 vendor/editor.js(window.NE).
'use strict';

// ── 작은 도구 ──────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent);
const isPhone = () => matchMedia('(max-width: 640px)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const WD = '일월화수목금토';

function kbdLabel(k) {
  return k.split('+').map(p => {
    const l = p.toLowerCase();
    if (l == 'mod') return isMac ? '⌘' : 'Ctrl+';
    if (l == 'ctl') return isMac ? '⌃' : 'Ctrl+Alt+';
    if (l == 'alt') return isMac ? '⌥' : 'Alt+';
    if (l == 'shift') return isMac ? '⇧' : 'Shift+';
    return p;
  }).join('');
}
function fillKbd(root = document) { root.querySelectorAll('kbd[data-k]').forEach(k => k.textContent = kbdLabel(k.dataset.k)); }

function when(t) {
  const d = new Date(t * 1000), now = new Date();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (ymd(d) == ymd(now)) return '오늘 ' + hm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (ymd(d) == ymd(y)) return '어제 ' + hm;
  if (d.getFullYear() == now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
function whenRel(t) {
  const d = new Date(t * 1000), now = new Date(), sec = (now - d) / 1000;
  if (sec < 60) return '방금';
  if (sec < 3600) return Math.floor(sec / 60) + '분 전';
  if (ymd(d) == ymd(now)) return Math.floor(sec / 3600) + '시간 전';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (ymd(d) == ymd(y)) return '어제';
  if (d.getFullYear() == now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${String(d.getFullYear()).slice(2)}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
function whenFull(t) {
  const d = new Date(t * 1000);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${WD[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function debounce(fn, ms) {
  let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.flush = (...a) => { clearTimeout(t); return fn(...a); }; f.cancel = () => clearTimeout(t); return f;
}
// 한글 조합 중 엔터: 크롬은 조합 중 keydown 뒤에 마지막 글자가 확정되고(포커스를 옮기면 그 글자가 따라간다), 사파리는 확정 뒤에 keyCode 229 keydown 이 온다 — 확정을 기다렸다 한다
function afterIME(e, go) {
  if (e.isComposing) { e.target.addEventListener('compositionend', () => setTimeout(go), {once: true}); return; }
  if (e.keyCode == 229) { setTimeout(go); return; }
  go();
}
let toastT;
function toast(msg, ms = 2400) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, ms);
}

// 기기마다 번호 — 서버가 '같은 기기에서 연달아 고친 것'을 가려 버전 기록을 덜 남긴다
const DEVICE = (() => {
  try { let d = localStorage.getItem('notes.device'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('notes.device', d); } return d; }
  catch { return 'x'; }
})();

class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data; } }
async function api(name, {method, query, body, raw} = {}) {
  let url = '/api/' + name;
  if (query) url += '?' + new URLSearchParams(query);
  const opt = {method: method || (body !== undefined || raw ? 'POST' : 'GET'), headers: {'X-Device': DEVICE}};
  if (raw) { opt.body = raw; opt.headers['Content-Type'] = 'application/octet-stream'; }
  else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
  let r;
  try { r = await fetch(url, opt); } catch (e) { throw new ApiError('서버에 닿지 못했습니다', 0); }
  if (r.status == 401) { location.reload(); throw new ApiError('로그인이 필요합니다', 401); }
  const ct = r.headers.get('Content-Type') || '';
  const data = ct.includes('json') ? await r.json() : await r.blob();
  if (!r.ok) throw new ApiError((data && data.error) || ('오류 ' + r.status), r.status, data);
  return data;
}

// ── 개인 설정(이 기기) ──────────────────────────────────────────────────
const P = Object.assign({
  theme: 'auto', font: 'sans', fs: 16.5, width: 'mid', live: true, spell: false, typewriter: false,
  sort: 'mtime', side: true, focus: false, panel: false, tab: 'outline', reading: false, open: {}, tagOpen: {},
  lh: 'normal', sideTone: 'graphite', smartOpen: true, fmtBar: true, preview: 'mid', hideImg: false,
}, (() => { try { return JSON.parse(localStorage.getItem('notes.prefs') || '{}'); } catch { return {}; } })());
function saveP() { try { localStorage.setItem('notes.prefs', JSON.stringify(P)); } catch {} }
function applyP() {
  document.documentElement.dataset.theme = P.theme == 'auto' ? '' : P.theme;
  if (P.theme == 'auto') delete document.documentElement.dataset.theme;
  const r = document.documentElement.style;
  r.setProperty('--fs', P.fs + 'px');
  r.setProperty('--body-font', P.font == 'serif' ? 'var(--serif)' : P.font == 'mono' ? 'var(--mono)' : 'var(--note-sans)');
  r.setProperty('--doc-w', {narrow: '620px', mid: '720px', wide: '940px', full: '100%'}[P.width] || '720px');
  $('#app').classList.toggle('no-side', !P.side);
  $('#app').classList.toggle('focus', !!P.focus && !isPhone());
  r.setProperty('--line-gap', {tight: '.03em', normal: '.125em', loose: '.3em'}[P.lh] || '.125em');
  const dark = P.theme == 'dark' || (P.theme == 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const lightSide = P.sideTone == 'light' && !dark;
  $('#app').classList.toggle('side-light', lightSide);
  const bl = $('.brand-logo'); if (bl) bl.src = lightSide ? 'logo-light.png' : 'logo-dark.png';
  if (ED) { ED.setLivePreview(P.live); ED.setSpellcheck(P.spell); }
  tintTop();
}

// ── 상태 ───────────────────────────────────────────────────────────────
const S = {
  rev: -1, notes: [], by: new Map(), folders: [], tags: {}, settings: {}, trashCount: 0, claude: [],
  view: {kind: 'all'}, q: '', results: null, cur: null, calMonth: new Date(), trash: [],
};
let ED = null;

function resolveName(name) {
  name = String(name || '').split('|')[0].split('#')[0].trim();
  if (!name) return null;
  let k = name.toLowerCase().replace(/\.md$/, '');
  if (S.by.has(name)) return name;
  const hits = [];
  for (const n of S.notes) {
    const p = n.path.toLowerCase().replace(/\.md$/, '');
    if (p == k || n.title.toLowerCase() == k || p.endsWith('/' + k)) hits.push(n.path);
  }
  hits.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
  return hits[0] || null;
}
function fileUrl(u) {
  if (!u) return u;
  if (/^(https?:|data:|blob:|\/files\/)/.test(u)) return u;
  u = u.replace(/^\.?\//, '').replace(/^(\.\.\/)+/, '');
  try { u = decodeURI(u); } catch {}
  return '/files/' + u.split('/').map(encodeURIComponent).join('/');
}
const renderOpts = {resolveImage: fileUrl, noteExists: n => !!resolveName(n)};

async function loadState() {
  const st = await api('state');
  S.rev = st.rev; S.notes = st.notes; S.folders = st.folders; S.tags = st.tags; S.settings = st.settings;
  S.journals = st.journals || []; S.order = st.order || {folders: [], tags: [], locked: true}; S.ai = st.ai || {}; S.icloud = st.icloud || {}; S.me = st.me || {};
  try {
    const was = localStorage.getItem('notes.uid');
    if (S.me.id && was && was != S.me.id) Object.keys(localStorage).filter(k => /^notes\.(c:|pending)/.test(k)).forEach(k => localStorage.removeItem(k));
    if (S.me.id) localStorage.setItem('notes.uid', S.me.id);
  } catch {}
  $('#who').textContent = S.me.name && (S.me.locked || !S.me.owner) ? S.me.name : '';
  $('#bSettings').textContent = st.update && st.update.new ? '설정 · 새 판' : '설정';
  $('#bPrefs').classList.toggle('dot', !!(st.update && st.update.new));
  $('#tAiI').hidden = !(S.me && S.me.owner);
  S.trashCount = st.trash; S.claude = st.claude || [];
  S.by = new Map(S.notes.map(n => [n.path, n]));
  try { localStorage.setItem('notes.state', JSON.stringify(st)); } catch {}
  renderSide(); renderList();
  if (S.cur && !S.cur.trash) {
    const n = S.by.get(S.cur.path);
    if (!n) { if (!S.cur.dirty) closeNote(); }
    else {
      if (n.ver != S.cur.ver && !S.cur.dirty && !S.cur.saving && !pending()[S.cur.path]) await reloadCurrent();
      renderMeta();
    }
  }
}

// 다른 기기에서 바뀐 것 — 몇 초마다 판 번호만 묻고, 바뀌었으면 받는다
let polling = false;
async function poll() {
  if (polling) return; polling = true;
  try {
    const r = await api('rev');
    setOnline(true);
    await flushPending();
    if (r.rev != S.rev) await loadState();
  } catch (e) { if (e.status === 0) setOnline(false); }
  finally { polling = false; }
}
(function loop() {
  setTimeout(async () => { await poll(); loop(); }, document.hidden ? 20000 : 3500);
})();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll(); else saveNow();
});

let online = true;
function setOnline(on) {
  if (on == online) return; online = on;
  setStatus(on ? '' : '오프라인 · 이 기기에 보관 중', !on);
}

// 저장 못 한 것은 이 기기(localStorage)에 쌓아 두고, 다시 닿으면 보낸다
function pending() { try { return JSON.parse(localStorage.getItem('notes.pending') || '{}'); } catch { return {}; } }
function setPending(p) { try { localStorage.setItem('notes.pending', JSON.stringify(p)); } catch {} }
async function flushPending() {
  const p = pending();
  for (const [path, item] of Object.entries(p)) {
    try {
      const r = await api('note/save', {body: {path, text: item.text, base: item.base}});
      delete p[path]; setPending(p);
      if (S.cur && S.cur.path == path) { S.cur.ver = r.ver; S.cur.saved = item.text; setStatus('저장됨'); }
    } catch (e) {
      if (e.status == 409) {
        delete p[path]; setPending(p);
        if (S.cur && S.cur.path == path) conflict(e.data, item.text);
        else {
          const c = await api('note/create', {body: {folder: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
            title: path.split('/').pop().replace(/\.md$/, '').replace(/\u2215/g, '/') + ' (이 기기 판)', text: item.text}});
          toast('겹친 노트를 따로 남겼습니다: ' + c.path);
        }
      } else if (e.status === 0) return;
      else { delete p[path]; setPending(p); }
    }
  }
}

// ── 왼쪽: 달력·모아보기·폴더·태그 ────────────────────────────────────────
// 일기 종류(회사·블로그 …) — 달력 위에서 고른다
function journal(name) {
  const js = S.journals || [];
  return js.find(j => j['이름'] == (name || P.journal)) || js[0] || {'이름': '', '폴더': ''};
}
function dailyFolder(name) { return (journal(name)['폴더'] || '').replace(/\/$/, ''); }
function journalOf(path) {
  const n = S.by.get(path); if (!n) return null;
  return (S.journals || []).find(j => j['폴더'] == n.folder) || null;
}
function dailySet(name) {
  const f = dailyFolder(name), set = new Set();
  for (const n of S.notes) if (n.folder == f && /^\d{4}-\d{2}-\d{2}/.test(n.title)) set.add(n.title.slice(0, 10));
  return set;
}
function renderCal() {
  const m = S.calMonth, y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const js = S.journals || [];
  const sets = js.map(j => dailySet(j['이름'])), today = ymd(new Date());
  const cj = S.cur && journalOf(S.cur.path);
  const curDay = cj && cj['이름'] == journal()['이름'] ? (S.by.get(S.cur.path).title || '').slice(0, 10) : '';
  const evDays = new Set((S.events || []).map(e => e.day));
  let h = `<div class="cal-h"><b>${y}년 ${mo + 1}월</b><button data-cal="-1" title="지난달">‹</button><button data-cal="0">오늘</button><button data-cal="1" title="다음 달">›</button></div>`;
  if (js.length > 1) h += `<div class="cal-j">${js.map((j, i) => `<button data-j="${esc(j['이름'])}" class="${j['이름'] == journal()['이름'] ? 'on' : ''}"><i class="jd j${i % 5}"></i>${esc(j['이름'])}</button>`).join('')}</div>`;
  h += '<div class="cal-g">';
  h += [...WD].map(w => `<span class="w">${w}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = ymd(d);
    if (i == 35 && d.getMonth() != mo) break;
    const cls = ['cal-d', d.getMonth() != mo ? 'out' : '', k == today ? 'today' : '', k == curDay ? 'on' : '', k == S.calDay ? 'pick' : ''].join(' ');
    const dots = js.map((j, ji) => sets[ji].has(k) ? `<i class="jd j${ji % 5}"></i>` : '').join('') + (evDays.has(k) ? '<i class="jd ev"></i>' : '');
    h += `<button class="${cls}" data-day="${k}" title="${k}${js.length ? ` · 두 번 누르면 ${esc(journal()['이름'])} 일기` : ''}">${d.getDate()}<span class="dots">${dots}</span></button>`;
  }
  h += '</div>';
  if (S.icloud && S.icloud.connected) {
    const day = S.calDay || today, evs = (S.events || []).filter(e => e.day == day);
    const dd = new Date(day + 'T00:00:00');
    h += `<div class="cal-ev"><div class="cal-ev-h">${dd.getMonth() + 1}월 ${dd.getDate()}일 (${WD[dd.getDay()]}) 일정</div>`
      + (evs.length ? evs.map(e => `<div class="ev-i" title="${esc(e.cal)}${e.location ? ' · ' + esc(e.location) : ''}"><i style="background:${esc(e.color || 'var(--muted)')}"></i><span class="t">${e.allday ? '종일' : esc(e.time)}</span><span class="n">${esc(e.title)}</span></div>`).join('')
        : '<div class="ev-none">일정 없음</div>') + '</div>';
  }
  $('#cal').innerHTML = h;
}
// iCloud 일정 — 보이는 달 앞뒤로 받아 둔다
async function loadEvents() {
  if (!S.icloud || !S.icloud.connected) { S.events = []; return; }
  const m = S.calMonth, a = new Date(m.getFullYear(), m.getMonth(), 1), b = new Date(m.getFullYear(), m.getMonth() + 1, 1);
  a.setDate(a.getDate() - 7); b.setDate(b.getDate() + 7);
  try { const r = await api('calendar/events', {query: {from: ymd(a), to: ymd(b)}}); S.events = r.events; S.eventsErr = ''; }
  catch (e) { S.events = []; S.eventsErr = e.message; }
  renderCal();
}
$('#cal').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cal != null) {
    const v = +b.dataset.cal;
    if (v == 0) { S.calMonth = new Date(); S.calDay = ymd(new Date()); } else S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + v, 1);
    renderCal(); loadEvents();
  } else if (b.dataset.j) { P.journal = b.dataset.j; saveP(); renderCal(); }
  else if (b.dataset.day) {
    const day = b.dataset.day;
    if (calPicked == day) { calPicked = null; openDaily(day); return; }
    calPicked = day; S.calDay = day; renderCal();
    toast('한 번 더 누르면 노트로 이동', 1600);
  }
});
let calPicked = null;

const NI = d => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  all: NI('<path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V5A1.5 1.5 0 017 3.5z"/><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5"/>'),
  untagged: NI('<path d="M4 13.5l2.2-7A1.5 1.5 0 017.6 5.5h8.8a1.5 1.5 0 011.4 1l2.2 7V18a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>'),
  todo: NI('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>'),
  today: NI('<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5"/><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"/>'),
  pinned: NI('<path d="M14.5 4.5l5 5-3 1.5-3.5 3.5.5 4-1.5 1.5-3.5-3.5L4.5 20 4 19.5l3.5-4.5L4 11.5 5.5 10l4 .5 3.5-3.5z"/>'),
  archive: NI('<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2"/><path d="M5 9v9.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V9M10 13h4"/>'),
  trash: NI('<path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0114.5 5v2M6.5 7l.8 11.6A1.5 1.5 0 008.8 20h6.4a1.5 1.5 0 001.5-1.4L17.5 7"/>'),
  folder: NI('<path d="M3.5 7A1.5 1.5 0 015 5.5h4l2 2h8A1.5 1.5 0 0120.5 9v8.5A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z"/>'),
  tag: NI('<path d="M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15.5M4 15h15.5"/>'),
};
const VIEWS = [
  ['all', '모든 노트'], ['untagged', '태그 없음'], ['todo', '할 일'], ['today', '오늘'],
  ['pinned', '고정됨'], ['archive', '보관함'], ['trash', '휴지통'],
];
function viewCount(kind, value) {
  const live = S.notes.filter(n => !n.archived);
  const today = ymd(new Date());
  switch (kind) {
    case 'all': return live.length;
    case 'pinned': return live.filter(n => n.pinned).length;
    case 'todo': return live.filter(n => n.todo && !n.tpl).length;
    case 'today': return live.filter(n => ymd(new Date(n.mtime * 1000)) == today || ymd(new Date(n.ctime * 1000)) == today).length;
    case 'daily': return live.filter(n => n.folder == dailyFolder(value)).length;
    case 'untagged': return live.filter(n => !n.tags.length).length;
    case 'archive': return S.notes.filter(n => n.archived).length;
    case 'trash': return S.trashCount;
  }
  return '';
}
function isView(kind, value) { return S.view.kind == kind && (value === undefined || S.view.value == value); }

function folderTree() {
  const root = {name: '', path: '', kids: new Map()};
  for (const f of S.folders) {
    let node = root;
    f.split('/').forEach((part, i, arr) => {
      const p = arr.slice(0, i + 1).join('/');
      if (!node.kids.has(part)) node.kids.set(part, {name: part, path: p, kids: new Map()});
      node = node.kids.get(part);
    });
  }
  return root;
}
function tagTree() {
  const root = {kids: new Map()};
  for (const [t, c] of Object.entries(S.tags)) {
    let node = root;
    t.split('/').forEach((part, i, arr) => {
      const p = arr.slice(0, i + 1).join('/');
      if (!node.kids.has(part)) node.kids.set(part, {name: part, path: p, kids: new Map(), count: 0});
      node = node.kids.get(part);
      node.count += 0;
    });
    node.count = c;
  }
  return root;
}
let sideSig = '';
function renderSide() {
  sideSig = sideKey();
  renderCal();
  const fcount = {};
  for (const n of S.notes) if (!n.archived) {
    const parts = n.folder ? n.folder.split('/') : [];
    for (let i = 1; i <= parts.length; i++) { const p = parts.slice(0, i).join('/'); fcount[p] = (fcount[p] || 0) + 1; }
  }
  let h = '<div class="grp">';
  const row = (k, nm, cls = '', pre = '') => `<button class="nav-i${cls}${isView(k) ? ' on' : ''}" data-view="${k}">${pre}<span class="ic">${ICON[k]}</span><span class="nm">${nm}</span><span class="ct">${viewCount(k)}</span></button>`;
  const sm = P.smartOpen !== false;
  for (const [k, nm] of VIEWS) {
    if (k == 'all') h += row(k, nm, ' top', `<span class="tw${sm ? ' open' : ''}" data-smt="1">▶</span>`);
    else if (k == 'trash') h += row(k, nm, ' top', '<span class="tw none">▶</span>');
    else if (sm) h += row(k, nm, ' sub');
  }
  h += '</div>';
  if ((S.journals || []).length) h += '<div class="grp"><div class="grp-h"><span>일기</span></div>';
  (S.journals || []).forEach((j, i) => {
    h += `<button class="nav-i${isView('daily', j['이름']) ? ' on' : ''}" data-view="daily" data-value="${esc(j['이름'])}"><span class="ic"><i class="jd j${i % 5}" style="position:static;display:inline-block"></i></span><span class="nm">${esc(j['이름'])} 일기</span><span class="ct">${viewCount('daily', j['이름'])}</span></button>`;
  });
  if ((S.journals || []).length) h += '</div>';
  h += `<div class="grp"><div class="grp-h"><span>폴더</span><span class="grp-a">${ordBtns('folders')}<button class="btn" data-act="newFolder">+ 폴더</button></span></div>`;
  const ft = folderTree();
  const fr = (node, depth) => {
    let s = '';
    const kids = ordSort([...node.kids.values()], 'folders');
    for (const k of kids) {
      const open = P.open[k.path];
      s += `<button class="nav-i${isView('folder', k.path) ? ' on' : ''}" data-view="folder" data-ord="folders" data-value="${esc(k.path)}" style="padding-left:${6 + depth * 14}px">`
        + `<span class="tw${k.kids.size ? (open ? ' open' : '') : ' none'}" data-tw="${esc(k.path)}">▶</span>`
        + `<span class="ic">${ICON.folder}</span><span class="nm">${esc(k.name)}</span><span class="ct">${fcount[k.path] || ''}</span></button>`;
      if (open && k.kids.size) s += fr(k, depth + 1);
    }
    return s;
  };
  h += fr(ft, 0) || '<div class="pad" style="padding:4px 10px">폴더 없음</div>';
  h += '</div>';
  h += `<div class="grp"><div class="grp-h"><span>태그</span><span class="grp-a">${ordBtns('tags')}</span></div>`;
  const tt = tagTree();
  const tr = (node, depth) => {
    let s = '';
    const kids = ordSort([...node.kids.values()], 'tags');
    for (const k of kids) {
      const open = P.tagOpen[k.path];
      const total = Object.entries(S.tags).filter(([t]) => t == k.path || t.startsWith(k.path + '/')).reduce((a, [, c]) => a + c, 0);
      s += `<button class="nav-i${isView('tag', k.path) ? ' on' : ''}" data-view="tag" data-ord="tags" data-value="${esc(k.path)}" style="padding-left:${6 + depth * 14}px">`
        + `<span class="tw${k.kids.size ? (open ? ' open' : '') : ' none'}" data-ttw="${esc(k.path)}">▶</span>`
        + `<span class="ic">${ICON.tag}</span><span class="nm">${esc(k.name)}</span><span class="ct">${total}</span></button>`;
      if (open && k.kids.size) s += tr(k, depth + 1);
    }
    return s;
  };
  h += tr(tt, 0) || '<div class="pad" style="padding:4px 10px">태그 없음</div>';
  h += '</div>';
  $('#nav').innerHTML = h;
  $('#nav').classList.toggle('reorder', !S.order.locked);
}
const ORD_IC = on => `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="${on ? 'M8.5 11V8a3.5 3.5 0 017 0v3' : 'M8.5 11V8a3.5 3.5 0 016.6-1.6'}"/></svg>`;
function ordBtns(kind) {
  const lk = S.order.locked !== false;
  return (lk ? '' : `<button class="btn" data-ordname="${kind}">이름 순</button>`)
    + `<button class="btn ordlock${lk ? '' : ' open'}" data-ordlock="1" title="${lk ? '순서 잠김' : '순서 바꾸는 중'}" aria-label="${lk ? '순서 잠김' : '순서 바꾸는 중'}">${ORD_IC(lk)}</button>`;
}
function ordSort(list, kind) {
  const o = (S.order && S.order[kind]) || [], at = new Map(o.map((p, i) => [p, i]));
  return list.sort((a, b) => (at.has(a.path) ? at.get(a.path) : 1e9) - (at.has(b.path) ? at.get(b.path) : 1e9) || a.name.localeCompare(b.name, 'ko'));
}
function saveOrder(body) { api('order', {body}).then(r => { S.order = r.order; }).catch(e => toast(e.message)); }
const ordParent = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
let ordDrag = null, ordSwallow = false;
function ordRows(st) { return [...$('#nav').querySelectorAll(`[data-ord="${st.kind}"]`)].filter(r => ordParent(r.dataset.value) == ordParent(st.path)); }
function ordClear() { $('#nav').querySelectorAll('.drop-before, .drop-after, .dragging').forEach(r => r.classList.remove('drop-before', 'drop-after', 'dragging')); }
function ordStart(st) { st.on = true; st.b.classList.add('dragging'); try { st.b.setPointerCapture(st.id); } catch {} }
$('#nav').addEventListener('pointerdown', e => {
  if (S.order.locked !== false || e.button > 0) return;
  const b = e.target.closest('[data-ord]'); if (!b || e.target.closest('[data-tw], [data-ttw]')) return;
  const st = {b, kind: b.dataset.ord, path: b.dataset.value, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, touch: e.pointerType != 'mouse', at: null};
  ordDrag = st;
  if (st.touch) st.timer = setTimeout(() => { if (ordDrag == st) ordStart(st); }, 350);
});
$('#nav').addEventListener('touchmove', e => { if (ordDrag && ordDrag.on) e.preventDefault(); }, {passive: false});
window.addEventListener('pointermove', e => {
  const st = ordDrag; if (!st || e.pointerId != st.id) return;
  if (!st.on) {
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
    if (st.touch) { clearTimeout(st.timer); ordDrag = null; return; }
    ordStart(st);
  }
  ordClear(); st.b.classList.add('dragging'); st.at = null;
  for (const r of ordRows(st)) {
    if (r == st.b) continue;
    const rc = r.getBoundingClientRect();
    if (e.clientY >= rc.top && e.clientY < rc.bottom) { const after = e.clientY > rc.top + rc.height / 2; r.classList.add(after ? 'drop-after' : 'drop-before'); st.at = {r, after}; break; }
  }
});
const ordEnd = e => {
  const st = ordDrag; if (!st || e.pointerId != st.id) return;
  clearTimeout(st.timer); ordDrag = null;
  if (!st.on) return;
  ordClear(); ordSwallow = true; setTimeout(() => { ordSwallow = false; }, 0);
  if (e.type == 'pointercancel' || !st.at) return;
  const sib = ordRows(st).map(r => r.dataset.value).filter(p => p != st.path);
  sib.splice(sib.indexOf(st.at.r.dataset.value) + (st.at.after ? 1 : 0), 0, st.path);
  const all = (S.order[st.kind] || []).filter(p => !sib.includes(p)).concat(sib);
  S.order = {...S.order, [st.kind]: all}; renderSide(); saveOrder({[st.kind]: all});
};
window.addEventListener('pointerup', ordEnd);
window.addEventListener('pointercancel', ordEnd);
$('#nav').addEventListener('click', e => {
  if (ordSwallow) { e.stopPropagation(); e.preventDefault(); return; }
  const lk = e.target.closest('[data-ordlock]');
  if (lk) { e.stopPropagation(); S.order = {...S.order, locked: S.order.locked === false}; renderSide(); saveOrder({locked: S.order.locked}); return; }
  const nm = e.target.closest('[data-ordname]');
  if (nm) { e.stopPropagation(); const k = nm.dataset.ordname; S.order = {...S.order, [k]: []}; renderSide(); saveOrder({[k]: []}); }
}, true);
$('#nav').addEventListener('scroll', e => e.currentTarget.classList.toggle('scrolled', e.currentTarget.scrollTop > 2), {passive: true});
$('#nav').addEventListener('click', e => {
  const tw = e.target.closest('[data-tw]'), ttw = e.target.closest('[data-ttw]');
  if (e.target.closest('[data-smt]')) { e.stopPropagation(); P.smartOpen = !(P.smartOpen !== false); saveP(); renderSide(); return; }
  if (tw && !tw.classList.contains('none')) { e.stopPropagation(); P.open[tw.dataset.tw] = !P.open[tw.dataset.tw]; saveP(); renderSide(); return; }
  if (ttw && !ttw.classList.contains('none')) { e.stopPropagation(); P.tagOpen[ttw.dataset.ttw] = !P.tagOpen[ttw.dataset.ttw]; saveP(); renderSide(); return; }
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act == 'newFolder') return newFolder();
  const b = e.target.closest('[data-view]'); if (!b) return;
  setView({kind: b.dataset.view, value: b.dataset.value});
  if (isPhone()) setPane('list');
  $('#app').classList.remove('side-open');
});

function setView(v) {
  S.view = v; $('#q').value = ''; S.q = ''; S.results = null;
  renderSide(); renderList();
  $('#items').scrollTop = 0;
}

// ── 가운데: 노트 목록 ──────────────────────────────────────────────────
function viewTitle() {
  const v = S.view;
  if (v.kind == 'folder') return v.value.split('/').pop();
  if (v.kind == 'tag') return '#' + v.value;
  if (v.kind == 'daily') return v.value + ' 일기';
  return (VIEWS.find(x => x[0] == v.kind) || [, '노트'])[1];
}
function viewNotes() {
  const v = S.view, today = ymd(new Date());
  let rows = S.notes.filter(n => v.kind == 'archive' ? n.archived : !n.archived);
  switch (v.kind) {
    case 'pinned': rows = rows.filter(n => n.pinned); break;
    case 'todo': rows = rows.filter(n => n.todo && !n.tpl); break;
    case 'today': rows = rows.filter(n => ymd(new Date(n.mtime * 1000)) == today || ymd(new Date(n.ctime * 1000)) == today); break;
    case 'daily': rows = rows.filter(n => n.folder == dailyFolder(v.value)); break;
    case 'untagged': rows = rows.filter(n => !n.tags.length); break;
    case 'folder': rows = rows.filter(n => n.folder == v.value || n.folder.startsWith(v.value + '/')); break;
    case 'tag': { const t = v.value.toLowerCase(); rows = rows.filter(n => n.tags.some(x => x.toLowerCase() == t || x.toLowerCase().startsWith(t + '/'))); break; }
  }
  const key = P.sort;
  rows.sort((a, b) => (b.pinned - a.pinned) || (key == 'title' ? a.title.localeCompare(b.title, 'ko', {numeric: true})
    : key == 'ctime' ? b.ctime - a.ctime : b.mtime - a.mtime));
  if (v.kind == 'daily' && key != 'title') rows.sort((a, b) => b.title.localeCompare(a.title));
  return rows;
}
function scopeQuery() {
  const v = S.view;
  return {pinned: ' @pinned', todo: ' @todo', today: ' @today', untagged: ' @untagged', archive: ' @archived',
          daily: ` folder:${dailyFolder(v.value)}`, folder: ` folder:${v.value}`,
          tag: ` #${(v.value || '').includes(' ') ? v.value + '#' : v.value}`}[v.kind] || '';
}
function plainMd(s) {
  return s.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(^|\s)(#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> ?)/g, '$1').replace(/\*\*|==|~~|`/g, '').replace(/\s{2,}/g, ' ').trim();
}
function hiSnip(s, q) {
  let h = esc(s);
  const terms = (q.match(/"[^"]+"|\S+/g) || []).filter(t => !/^[-#@]|:/.test(t)).map(t => t.replace(/"/g, '')).filter(Boolean);
  for (const t of terms) h = h.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`);
  return h;
}
function renderList() {
  $('#listTitle').textContent = S.q ? '찾기' : viewTitle();
  const v = S.view;
  $('#listTitle').classList.toggle('has-menu', !S.q);
  $('#items').dataset.pv = P.preview;
  $('#listTools').hidden = true;

  if (v.kind == 'trash' && !S.q) return renderTrash();
  let rows, html = '';
  if (S.q) {
    rows = S.results || [];
    $('#listCount').textContent = S.results ? rows.length + '개' : '';
    html = rows.map(r => {
      const n = S.by.get(r.path) || r;
      return itemHtml(n, r.snips && r.snips.length ? r.snips.slice(0, 2).map(s => hiSnip(plainMd(s), S.q)).join(' · ') : esc(n.snippet || ''));
    }).join('');
    if (S.results && !rows.length) html = '<div class="empty-list">찾은 노트가 없습니다</div>';
  } else {
    rows = viewNotes();
    $('#listCount').textContent = rows.length + '개';
    if (rows.length) patchItems(rows.slice(0, 600).map(n => itemHtml(n, esc(n.snippet))));
    else html = '<div class="empty-list">노트가 없습니다</div>';
  }
  if (html) $('#items').innerHTML = html;
  const ec = $('#emptyCt'); if (ec) ec.textContent = viewNotes().length + ' 노트';
}
function patchItems(htmls) {
  const box = $('#items'), old = new Map();
  for (const el of box.children) if (el._h) old.set(el._h, el);
  const t = document.createElement('template');
  const nodes = htmls.map(h => {
    const el = old.get(h); if (el) { old.delete(h); return el; }
    t.innerHTML = h; const n = t.content.firstElementChild; n._h = h; return n;
  });
  const cur = box.children;
  if (cur.length == nodes.length && nodes.every((n, i) => cur[i] === n)) return;
  box.replaceChildren(...nodes);
}
const BAD_IMG = new Set();
$('#items').addEventListener('error', e => {
  if (e.target.classList?.contains('it-img')) { BAD_IMG.add(e.target.getAttribute('src')); e.target.remove(); }
}, true);
const LOCK_IC = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>';
function itemHtml(n, snip) {
  const on = S.cur && S.cur.path == n.path ? ' on' : '';
  const pin = n.pinned ? '<svg class="pin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4.5l5 5-3 1.5-3.5 3.5.5 4-1.5 1.5-3.5-3.5L4.5 20 4 19.5l3.5-4.5L4 11.5 5.5 10l4 .5 3.5-3.5z"/></svg>' : '';
  const lock = n.readonly ? `<span class="lk">${LOCK_IC}</span>` : '';
  const ms = S.multi && S.multi.has(n.path) ? ' msel' : '';
  return `<button class="it${on}${ms}" data-path="${esc(n.path)}"><div class="it-t"><span>${esc(n.title)}</span>${lock}${pin}</div>`
    + `<div class="it-s">${snip || '<span style="opacity:.6">내용 없음</span>'}</div>`
    + (n.img && !P.hideImg && !BAD_IMG.has(fileUrl(n.img)) ? `<img class="it-img" src="${esc(fileUrl(n.img))}" alt="" loading="lazy">` : '')
    + `<div class="it-m"><span>${whenRel(n.mtime)}</span></div></button>`;
}
async function renderTrash() {
  const r = await api('trash'); S.trash = r.items;
  $('#listCount').textContent = r.items.length + '개';
  $('#items').innerHTML = r.items.map(t => `<button class="it" data-trash="${esc(t.id)}"><div class="it-t"><span>${esc(t['제목'])}</span></div>`
    + `<div class="it-s">${esc(t['미리보기'] || '')}</div><div class="it-m"><span>버린 날 ${when(t['버린날'])}</span><span class="fd">${esc(t['원래'])}</span></div></button>`).join('')
    || '<div class="empty-list">휴지통이 비었습니다</div>';
}
S.multi = new Set();
function setMulti(paths) {
  S.multi = new Set(paths);
  $$('#items .it[data-path]').forEach(x => x.classList.toggle('msel', S.multi.has(x.dataset.path)));
}
$('#items').addEventListener('click', e => {
  const it = e.target.closest('.it'); if (!it) return;
  if (it.dataset.trash) return trashItem(it.dataset.trash);
  const path = it.dataset.path;
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.preventDefault();
    const all = [...$$('#items .it[data-path]')].map(x => x.dataset.path);
    const base = S.multi.size ? [...S.multi] : (S.cur ? [S.cur.path] : []);
    if (e.shiftKey && base.length) {
      const a = all.indexOf(base[base.length - 1]), b = all.indexOf(path);
      const [x, y] = a < b ? [a, b] : [b, a];
      setMulti([...new Set([...base, ...all.slice(x, y + 1)])]);
    } else {
      const next = new Set(base); next.has(path) ? next.delete(path) : next.add(path); setMulti([...next]);
    }
    return;
  }
  if (S.multi.size) setMulti([]);
  openNote(path);
});
async function mergeNotes(paths) {
  const order = [...$$('#items .it[data-path]')].map(x => x.dataset.path);
  paths = [...paths].sort((a, b) => (order.indexOf(a) + 1 || 1e9) - (order.indexOf(b) + 1 || 1e9));
  if (paths.length < 2) return;
  const names = paths.map(p => S.by.get(p)?.title || p);
  if (!(await confirmDlg(`노트 ${paths.length}개를 하나로 합칠까요?`, `'${names[0]}' 아래로 차례대로 붙입니다. 원래 노트는 휴지통으로 갑니다.`, '합치기'))) return;
  await saveNow();
  const texts = await Promise.all(paths.map(p => api('note', {query: {path: p}}).then(d => d.text)));
  const body = texts[0].replace(/\s+$/, '') + texts.slice(1).map((t, i) => `\n\n## ${names[i + 1]}\n\n${t.replace(/\s+$/, '')}`).join('') + '\n';
  const first = S.by.get(paths[0]) || {};
  const r = await api('note/create', {body: {folder: first.folder || '', title: names[0] + ' 합침', text: body}});
  if (S.cur && paths.includes(S.cur.path)) closeNote();
  for (const p of paths) await api('note/trash', {body: {path: p}});
  let path = r.path;
  try { path = (await api('note/rename', {body: {path: r.path, title: names[0]}})).path; } catch {}
  setMulti([]); await loadState(); await openNote(path);
  toast(`노트 ${paths.length}개를 합쳤습니다`);
}
function mergeDlg() {
  if (!S.cur) return;
  picker({
    placeholder: '이 노트에 합칠 노트',
    items: q => S.notes.filter(n => n.path != S.cur.path).map(n => ({n, m: q ? fuzzy(q, n.title) : {score: n.mtime / 1e10, hit: []}})).filter(x => x.m)
      .sort((a, b) => b.m.score - a.m.score).slice(0, 50),
    render: x => `<span class="nm">${hiFuzzy(x.n.title, x.m.hit)}</span><span class="sub">${esc(x.n.folder)}</span>`,
    onPick: x => mergeNotes([S.cur.path, x.n.path]),
    empty: '노트가 없습니다',
  });
}
async function setReadonly(path, on) {
  await saveNow();
  await api('note/readonly', {body: {path, on}}); await loadState();
  if (S.cur && S.cur.path == path) applyReadonly();
  toast(on ? '읽기 전용으로 바꿨습니다' : '다시 고칠 수 있습니다');
}
function applyReadonly() {
  const ro = !!(S.cur && S.by.get(S.cur.path)?.readonly);
  ED.setReadOnly(ro); $('#title').readOnly = ro;
  $('#app').classList.toggle('ro', ro); $('#tLockI').hidden = !ro;
}
$('#tLockI').onclick = () => S.cur && setReadonly(S.cur.path, false);
function viewMenu(v) {
  const L = (label, act, danger) => ({label, run: () => runLT(act, v), danger});
  if (v.kind == 'trash') return [L('휴지통 비우기', 'emptyTrash', true)];
  if (v.kind == 'folder') return [L('이 폴더에 새 노트', 'newHere'), L('하위 폴더 만들기', 'subFolder'), '-', L('폴더 이름 바꾸기', 'renameFolder'), L('폴더 지우기', 'deleteFolder', true)];
  if (v.kind == 'tag') return [L('이 태그로 새 노트', 'newHere'), '-', L('태그 이름 바꾸기', 'renameTag')];
  if (v.kind == 'daily') return [L(`오늘 ${v.value} 일기`, 'today'), ...(S.ai && S.ai.ready ? ['-', L('AI 주간 요약', 'aiWeek'), L('AI 월간 요약', 'aiMonth')] : [])];
  return [];
}
$('#listTitle').addEventListener('click', e => {
  if (S.q) return;
  const items = viewMenu(S.view);
  const ck = (on, label, run) => ({label, run, checked: on});
  if (items.length) items.push('-');
  items.push({head: '정렬'},
    ck(P.sort == 'mtime', '수정일', () => setSort('mtime')), ck(P.sort == 'ctime', '생성일', () => setSort('ctime')), ck(P.sort == 'title', '제목', () => setSort('title')),
    '-', {head: '미리 보기'},
    ck(P.preview == 'small', '작음', () => setPreview('small')), ck(P.preview == 'mid', '중간', () => setPreview('mid')), ck(P.preview == 'large', '큼', () => setPreview('large')),
    '-', ck(!!P.hideImg, '첨부 사진 숨기기', () => { P.hideImg = !P.hideImg; saveP(); renderList(); }));
  const r = e.currentTarget.getBoundingClientRect();
  ctxMenu(r.left, r.bottom + 6, items);
});
$('#listNew').addEventListener('click', () => newNote());
function setSort(k) { P.sort = k; saveP(); const so = $('#sort'); if (so) so.value = k; renderList(); }
function setPreview(k) { P.preview = k; saveP(); renderList(); }
function showFind(on) {
  $('#searchRow').classList.toggle('open', on);
  $('#listFind').classList.toggle('on', on);
  if (on) $('#q').focus();
}
$('#listFind').addEventListener('click', () => {
  const open = $('#searchRow').classList.contains('open');
  if (open) { $('#q').value = ''; doSearch(); showFind(false); } else showFind(true);
});
$('#q').addEventListener('blur', () => { if (!$('#q').value.trim()) setTimeout(() => { if (document.activeElement != $('#q') && !$('#q').value.trim()) showFind(false); }, 150); });
$('#nav').addEventListener('contextmenu', e => {
  const b = e.target.closest('.nav-i[data-view]'); if (!b) return;
  const v = {kind: b.dataset.view, value: b.dataset.value};
  const items = viewMenu(v); if (!items.length) return;
  e.preventDefault();
  ctxMenu(e.clientX, e.clientY, items.map(it => it == '-' ? it : {...it, run: async () => { if (!isView(v.kind, v.value)) setView(v); await it.run(); }}));
});
async function runLT(act, v) {
  switch (act) {
    case 'emptyTrash':
      if (await confirmDlg('휴지통을 비울까요?', `${S.trashCount}개를 영구히 지웁니다. 되살릴 수 없습니다(날마다 받는 백업에는 남아 있습니다).`, '비우기', true)) {
        await api('trash/purge', {body: {}}); await loadState(); renderList(); toast('휴지통을 비웠습니다');
      } break;
    case 'newHere': newNote(); break;
    case 'today': openDaily(ymd(new Date()), v.value); break;
    case 'aiWeek': aiJournal('week', v.value); break;
    case 'aiMonth': aiJournal('month', v.value); break;
    case 'subFolder': newFolder(v.value + '/'); break;
    case 'renameFolder': {
      const nn = await promptDlg('폴더 이름 바꾸기', '새 경로', v.value); if (!nn || nn == v.value) return;
      const r = await api('folder/rename', {body: {path: v.value, newPath: nn}}); await loadState(); setView({kind: 'folder', value: r.path});
      if (S.cur) S.cur.path = S.cur.path.startsWith(v.value + '/') ? r.path + S.cur.path.slice(v.value.length) : S.cur.path;
      break;
    }
    case 'deleteFolder':
      if (await confirmDlg('폴더를 지울까요?', `'${v.value}' 안의 노트는 모두 휴지통으로 갑니다.`, '지우기', true)) {
        await api('folder/delete', {body: {path: v.value}}); await loadState(); setView({kind: 'all'});
      } break;
    case 'renameTag': {
      const nn = await promptDlg('태그 이름 바꾸기', '모든 노트의 #' + v.value + ' 를 바꿉니다 (하위 태그도 같이)', v.value); if (!nn || nn == v.value) return;
      await saveNow();
      const r = await api('tag/rename', {body: {old: v.value, new: nn.replace(/^#/, '')}}); await loadState();
      setView({kind: 'tag', value: nn.replace(/^#/, '')}); toast(`노트 ${r.count}개에서 바꿨습니다`);
      if (S.cur) reloadCurrent();
      break;
    }
  }
}

const doSearch = debounce(async () => {
  const q = $('#q').value.trim(); S.q = q;
  if (!q) { S.results = null; renderList(); return; }
  try {
    const r = await api('search', {query: {q: q + scopeQuery(), archived: S.view.kind == 'archive' ? 1 : 0}});
    if ($('#q').value.trim() == q) { S.results = r.results; renderList(); }
  } catch (e) {
    // 오프라인: 이 기기에 있는 목록에서 제목·미리보기만 찾는다
    const low = q.toLowerCase();
    S.results = viewNotes().filter(n => n.title.toLowerCase().includes(low) || (n.snippet || '').toLowerCase().includes(low))
      .map(n => ({path: n.path, snips: []}));
    renderList();
  }
}, 220);
$('#q').addEventListener('input', doSearch);
$('#q').addEventListener('keydown', e => {
  if (e.key == 'Enter') afterIME(e, async () => { await doSearch.flush(); const f = $('#items .it'); if (f) f.click(); });
  if (e.key == 'Escape') { $('#q').value = ''; doSearch(); showFind(false); $('#q').blur(); }
});
$('#sort').value = P.sort;
$('#sort').addEventListener('change', () => { P.sort = $('#sort').value; saveP(); renderList(); });

// ── 오른쪽: 편집기 ─────────────────────────────────────────────────────
function setStatus(s, warn) {
  const el = $('#status'), quiet = !warn && /^(저장 중…|저장됨|고치는 중…)$/.test(s || '');
  el.textContent = quiet ? '' : s || ''; el.classList.toggle('warn', !!warn);
}

function makeEditor() {
  ED = NE.createEditor($('#editor'), {
    placeholder: '',
    livePreview: P.live, spellcheck: P.spell,
    resolveImage: fileUrl,
    getNotes: () => S.notes.filter(n => !S.cur || n.path != S.cur.path).map(n => ({title: n.title, folder: n.folder})),
    getTags: () => Object.keys(S.tags).sort(),
    onChange: onEdit,
    onCursor: () => { if (P.typewriter) typewriter(); },
    onOpenLink: (t, e) => openByName(t, e),
    onOpenTag: tag => { setView({kind: 'tag', value: tag}); if (isPhone()) setPane('list'); },
    onFiles: (files) => uploadFiles(files),
    noteExists: n => !!resolveName(n),
    renderEmbed: (target, el) => fillEmbed(target, el),
  });
}
function typewriter() {
  const v = ED.view, head = v.state.selection.main.head;
  const c = v.coordsAtPos(head); if (!c) return;
  const sc = $('#edScroll'), r = sc.getBoundingClientRect();
  const want = r.top + r.height * 0.45;
  sc.scrollTop += c.top - want;
}

const embedCache = new Map();
async function fillEmbed(target, el) {
  const [name, head] = target.split('#');
  const path = resolveName(name);
  if (!path) { el.textContent = '↳ ' + target + ' (아직 없는 노트)'; return; }
  try {
    let text = embedCache.get(path);
    if (text == null) { text = (await api('note', {query: {path}})).text; embedCache.set(path, text); setTimeout(() => embedCache.delete(path), 15000); }
    if (head) {
      const lines = text.split('\n'); const i = lines.findIndex(l => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim() == head.trim());
      if (i >= 0) { const lv = lines[i].match(/^#+/)[0].length; let j = i + 1; while (j < lines.length && !(new RegExp(`^#{1,${lv}}\\s`).test(lines[j]))) j++; text = lines.slice(i, j).join('\n'); }
    }
    el.innerHTML = `<div class="embed-t" data-target="${esc(path)}">${esc(S.by.get(path)?.title || name)}</div>` + NE.render(text.slice(0, 4000), renderOpts);
  } catch { el.textContent = '↳ ' + target; }
}

const saveSoon = debounce(() => saveNow(), 700);
function onEdit(text) {
  if (!S.cur || S.cur.loading) return;
  if (text == S.cur.saved) { S.cur.dirty = false; return; }
  S.cur.dirty = true; setStatus('고치는 중…'); saveSoon(); liveMeta(text);
}
async function saveNow() {
  saveSoon.cancel();
  await renameFromTitle();
  if (!S.cur || !S.cur.dirty || S.cur.trash) return;
  if (S.cur.saving) { S.cur.again = true; return; }
  const cur = S.cur, text = ED.value;
  cur.saving = true; setStatus('저장 중…');
  try {
    const r = await api('note/save', {body: {path: cur.path, text, base: cur.ver}});
    cur.ver = r.ver; cur.saved = text; cur.dirty = ED.value != text;
    const n = r.meta; S.by.set(n.path, n); const i = S.notes.findIndex(x => x.path == n.path); if (i >= 0) S.notes[i] = n; else S.notes.unshift(n);
    S.rev = r.rev; setStatus(cur.dirty ? '고치는 중…' : '저장됨'); setOnline(true);
    const p = pending(); if (p[cur.path]) { delete p[cur.path]; setPending(p); }
    renderListSoon(); renderMeta();
  } catch (e) {
    if (e.status == 409) { cur.saving = false; return conflict(e.data, text); }
    if (e.status === 0) {
      const p = pending(); p[cur.path] = {text, base: cur.ver, t: Date.now()}; setPending(p);
      setOnline(false); cur.saved = text; cur.dirty = false;
    } else { setStatus('저장 실패: ' + e.message, true); }
  } finally {
    cur.saving = false;
    if (cur.again) { cur.again = false; if (cur.dirty) saveNow(); }
  }
}
function sideKey() { return JSON.stringify([Object.keys(S.tags || {}).sort(), S.folders, S.notes.length, S.journals, S.order]); }
const renderListSoon = debounce(() => {
  renderList();
  const k = sideKey(); if (k != sideSig) { sideSig = k; renderSide(); }
}, 400);
window.addEventListener('beforeunload', e => {
  if (S.cur && (S.cur.dirty || S.cur.saving)) {
    const p = pending(); p[S.cur.path] = {text: ED.value, base: S.cur.ver, t: Date.now()}; setPending(p);
  }
});

async function conflict(data, mine) {
  const r = await choiceDlg('다른 기기에서 먼저 고쳤어요',
    `<div class="preview reader" style="max-height:30vh">${NE.render(data.text, renderOpts)}</div>`,
    [['theirs', '저쪽 것 받기'], ['both', '둘 다 두기'], ['mine', '내 것으로 덮기', 'primary']]);
  const cur = S.cur;
  if (r == 'mine') {
    const s = await api('note/save', {body: {path: cur.path, text: mine, force: true}});
    cur.ver = s.ver; cur.saved = mine; cur.dirty = ED.value != mine; setStatus('저장됨');
  } else if (r == 'theirs' || r == 'both') {
    if (r == 'both') {
      const folder = cur.path.includes('/') ? cur.path.slice(0, cur.path.lastIndexOf('/')) : '';
      const c = await api('note/create', {body: {folder, title: S.by.get(cur.path)?.title + ' (이 기기 판)', text: mine}});
      toast('내 내용은 새 노트로 남겼습니다: ' + c.path.split('/').pop().replace(/\.md$/, '').replace(/\u2215/g, '/'));
    }
    cur.ver = data.ver; cur.saved = data.text; cur.dirty = false;
    cur.loading = true; ED.reset(data.text); cur.loading = false; setStatus('받음');
  } else { cur.dirty = true; setStatus('겹쳐서 저장 안 됨', true); }
  loadState();
}

async function reloadCurrent() {
  if (!S.cur) return;
  try {
    const d = await api('note', {query: {path: S.cur.path}});
    if (S.cur.dirty) return;
    const head = ED.view.state.selection.main.head;
    S.cur.loading = true; ED.reset(d.text, head); S.cur.loading = false;
    S.cur.ver = d.ver; S.cur.saved = d.text; S.cur.outline = d.outline;
    renderMeta(); if (P.reading) renderReader(); renderPanel(); setStatus('다른 기기에서 받음');
  } catch {}
}

async function openNote(path, opts = {}) {
  if (!path) return;
  if (S.cur && S.cur.path == path && !S.cur.trash) { if (isPhone()) setPane('main'); if (opts.line) ED.gotoLine(opts.line); return; }
  await saveNow();
  let d;
  const p = pending()[path];
  try { d = await api('note', {query: {path}}); }
  catch (e) {
    if (e.status === 0) {
      const c = cacheGet(path);
      if (!c && !p) return toast('오프라인이라 이 노트를 열 수 없습니다');
      d = c || {path, text: p.text, ver: p.base, outline: []};
    } else { toast(e.message); return; }
  }
  if (p) d.text = p.text;
  cachePut(d);
  S.cur = {path: d.path, ver: d.ver, saved: d.text, dirty: !!p, outline: d.outline, loading: true};
  $('#mainEmpty').hidden = true;
  ED.reset(d.text, 0);
  S.cur.loading = false;
  $('#title').value = (S.by.get(d.path) || d.meta || {}).title || d.path.split('/').pop().replace(/\.md$/, '').replace(/\u2215/g, '/');
  S.cur.title = $('#title').value;
  applyReadonly();
  renderMeta(); renderTools(); setStatus(p ? '오프라인에서 고친 것' : '');
  if (P.reading) renderReader();
  $('#edScroll').scrollTop = 0;
  // 뒤로가기가 앱 밖으로 나가지 않게 — PC 는 노트를 열 때마다 기록을 남겨 '직전 노트'로 돌아간다.
  // 폰은 칸 넘기기(setPane)가 기록을 맡으니 덮어쓰기만 한다. 뒤로가기로 연 것(fromPop)·처음 연 것(first)도 덮어쓰기.
  const want = '#/' + encodeURIComponent(d.path);
  if (location.hash != want) {
    if (!isPhone() && !opts.fromPop && !opts.first) history.pushState({note: d.path}, '', want);
    else history.replaceState(isPhone() ? history.state : {note: d.path}, '', want);
  }
  $$('#items .it.on').forEach(x => x.classList.remove('on'));
  const it = $(`#items .it[data-path="${CSS.escape(d.path)}"]`); if (it) it.classList.add('on');
  renderCal(); renderPanel();
  if (isPhone()) setPane('main', opts.fromPop);
  if (opts.focusTitle) { $('#title').focus(); $('#title').select(); }
  else if (opts.line) ED.gotoLine(opts.line);
  else if (opts.focusEnd) { ED.gotoPos(d.text.length); }
}
function cacheGet(path) { try { return JSON.parse(localStorage.getItem('notes.c:' + path)); } catch { return null; } }
function cachePut(d) {
  try { localStorage.setItem('notes.c:' + d.path, JSON.stringify({path: d.path, text: d.text, ver: d.ver, outline: d.outline})); } catch {}
}
function closeNote() {
  S.cur = null; $('#mainEmpty').hidden = false; $('#title').value = ''; $('#meta').innerHTML = ''; $('#crumb').textContent = '';
  setStatus(''); history.replaceState(isPhone() ? history.state : null, '', '#'); renderPanel(); document.title = '뮤직잇츠 노트';
}

async function openByName(target, e) {
  const [name, head] = String(target).split('#');
  let path = resolveName(name);
  if (!path) {
    // 옵시디언처럼: 아직 없는 노트를 누르면 만든다
    if (!(await confirmDlg(`'${name}' 노트가 아직 없습니다`, '새로 만들까요?', '만들기'))) return;
    await saveNow();
    const r = await api('note/create', {body: {folder: S.settings['새노트폴더'] || '', title: name, text: ''}});
    await loadState(); path = r.path;
  }
  let line;
  if (head) {
    try {
      const d = await api('note', {query: {path}});
      const h = d.outline.find(o => o[2].trim() == head.replace(/^\^/, '').trim()); if (h) line = h[0];
    } catch {}
  }
  openNote(path, {line});
}

function liveMeta(text) {
  const chars = text.replace(/\s/g, '').length;
  const el = $('#meta .chars'); if (el) el.textContent = `${chars.toLocaleString()}자`;
}
function renderMeta() {
  if (!S.cur) return;
  const n = S.by.get(S.cur.path);
  const folder = S.cur.path.includes('/') ? S.cur.path.slice(0, S.cur.path.lastIndexOf('/')) : '';
  $('#crumb').innerHTML = (folder ? esc(folder) + ' / ' : '') + `<b>${esc(n ? n.title : S.cur.path)}</b>`;
  document.title = n ? n.title : '뮤직잇츠 노트';
  if (!n) { $('#meta').innerHTML = ''; return; }
  const chars = (ED ? ED.value : '').replace(/\s/g, '').length;
  $('#meta').innerHTML = `<span>${whenFull(n.mtime)}</span><span class="chars">${chars.toLocaleString()}자</span>`
    + (n.todo || n.done ? `<span>할 일 ${n.done}/${n.todo + n.done}</span>` : '')
    + n.tags.slice(0, 8).map(t => `<span class="tg" data-tag="${esc(t)}">#${esc(t)}</span>`).join('');
  renderTools();
}
$('#meta').addEventListener('click', e => { const t = e.target.closest('[data-tag]'); if (t) { setView({kind: 'tag', value: t.dataset.tag}); if (isPhone()) setPane('list'); } });

function renderTools() {
  const n = S.cur && S.by.get(S.cur.path);
  $('#tAI').hidden = !(S.ai && S.ai.ready);
  $('#tPin').classList.toggle('on', !!(n && n.pinned)); $('#tPin').textContent = n && n.pinned ? '고정됨' : '고정';
  $('#tArchive').classList.toggle('on', !!(n && n.archived)); $('#tArchive').textContent = n && n.archived ? '보관됨' : '보관';
  $('#tRead').classList.toggle('on', P.reading);
  $('#tRead').firstChild.textContent = P.reading ? '편집' : '읽기';
  $('#tPanel').classList.toggle('on', P.panel && !$('#panel').hidden);
  $('#tFocus').classList.toggle('on', $('#app').classList.contains('focus'));
  $('#tReadI').classList.toggle('on', P.reading);
  $('#tPanelI').classList.toggle('on', P.panel && !$('#panel').hidden);
}

// 제목 = 파일 이름. 칸을 떠나거나 엔터를 치면 이름을 바꾼다(다른 노트의 [[링크]] 도 같이)
async function renameFromTitle() {
  if (!S.cur || S.cur.trash) return;
  const t = $('#title').value.trim();
  if (!t || t == S.cur.title) return;
  const old = S.cur.path;
  S.cur.title = t;
  try {
    if (S.cur.dirty) {
      const text = ED.value;
      const r0 = await api('note/save', {body: {path: old, text, base: S.cur.ver}});
      S.cur.ver = r0.ver; S.cur.saved = text; S.cur.dirty = false;
    }
    const r = await api('note/rename', {body: {path: old, title: t}});
    S.cur.path = r.path;
    history.replaceState(isPhone() ? history.state : null, '', '#/' + encodeURIComponent(r.path));
    if (r.linksUpdated) toast(`다른 노트 ${r.linksUpdated}개의 링크도 고쳤습니다`);
    await loadState(); const n = S.by.get(r.path); if (n) S.cur.ver = n.ver;
    $('#title').value = n ? n.title : t; S.cur.title = $('#title').value;
    renderMeta();
    const hits = n && !journalOf(n.path) ? foldersForTitle(S.cur.title, n.folder) : [];
    if (hits.length == 1) await fileInto(n.path, hits[0]);
    else if (hits.length > 1) picker({
      placeholder: '어디로 넣을까요?',
      items: q => [...hits.filter(f => !q || f.toLowerCase().includes(q.toLowerCase())).map(f => ({f})), {f: null}],
      render: x => `<span class="nm">${x.f ? esc(x.f) : '옮기지 않기'}</span>`,
      onPick: x => x.f && fileInto(n.path, x.f),
    });
  } catch (e) { toast(e.message); $('#title').value = S.cur.title = (S.by.get(old) || {}).title || t; }
}
async function fileInto(path, to) {
  const m = await api('note/move', {body: {path, folder: to}});
  if (S.cur && S.cur.path == path) { S.cur.path = m.path; history.replaceState(isPhone() ? history.state : null, '', '#/' + encodeURIComponent(m.path)); }
  await loadState(); const n2 = S.by.get(m.path); if (n2 && S.cur && S.cur.path == m.path) S.cur.ver = n2.ver;
  renderMeta(); toast(`'${to.split('/').pop()}' 폴더로 옮겼습니다`);
}
function foldersForTitle(title, cur) {
  const low = title.toLowerCase(), st = S.settings || {};
  if (/^블로그 (초안|규칙)(\/|$)/.test(cur || '')) return [];
  const skip = [st['첨부폴더'] || '첨부', st['템플릿폴더'] || '템플릿', '블로그 초안', '블로그 규칙', ...(S.journals || []).flatMap(j => { const f = (j['폴더'] || '').replace(/\/$/, ''); return [f, f.split('/')[0]]; })];
  const hits = (S.folders || []).filter(f => {
    if (skip.some(x => x && (f == x || f.startsWith(x + '/')))) return false;
    const nm = f.split('/').pop();
    return nm.length >= 2 && low.includes(nm.toLowerCase());
  });
  if (hits.some(f => cur == f || (cur || '').startsWith(f + '/'))) return [];
  return hits.sort((a, b) => b.split('/').pop().length - a.split('/').pop().length);
}
$('#title').addEventListener('keydown', e => {
  if (e.key == 'Enter' || (e.key == 'ArrowDown' && !e.isComposing)) {
    if (!e.isComposing) e.preventDefault();
    afterIME(e, () => { renameFromTitle(); ED.gotoPos(0); });
  }
});
$('#title').addEventListener('blur', () => renameFromTitle());

// ── 새 노트·일기 ───────────────────────────────────────────────────────
async function newNote(title, text) {
  await saveNow();
  const v = S.view;
  let folder = S.settings['새노트폴더'] || '';
  let body = text || '';
  if (v.kind == 'folder') folder = v.value;
  if (v.kind == 'daily') folder = dailyFolder(v.value);
  if (v.kind == 'tag' && !text) body = '\n\n#' + v.value + (v.value.includes(' ') ? '#' : '');
  const r = await api('note/create', {body: {folder, title: title || '제목 없음', text: body}});
  await loadState();
  if (v.kind == 'pinned') await api('note/pin', {body: {path: r.path, on: true}});
  if (['archive', 'trash'].includes(v.kind)) setView({kind: 'all'});
  await openNote(r.path, {focusTitle: !title});
  if (title) ED.gotoPos(0);
}
async function openDaily(day, jname) {
  if (!(S.journals || []).length) return;
  await saveNow();
  const j = journal(jname)['이름'];
  if (jname && jname != P.journal) { P.journal = jname; saveP(); }
  S.calDay = day;
  const r = await api('daily', {body: {date: day, journal: j}});
  if (r.created) await loadState();
  const d = new Date(day + 'T00:00:00'), was = S.calMonth.getMonth() + '/' + S.calMonth.getFullYear();
  S.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  if (was != S.calMonth.getMonth() + '/' + S.calMonth.getFullYear()) loadEvents();
  await openNote(r.path, {focusEnd: r.created});
  if (r.created) {
    const t = ED.value, i = t.indexOf('- ');
    if (i >= 0) ED.gotoPos(t.indexOf('\n', i) >= 0 ? t.indexOf('\n', i) : i + 2);
  }
}
async function newFolder(prefix = '') {
  const name = await promptDlg('새 폴더', '폴더 이름 (하위 폴더는 / 로)', prefix);
  if (!name || name == prefix) return;
  const r = await api('folder/create', {body: {path: name}});
  await loadState(); setView({kind: 'folder', value: r.path});
}

$('#bNew').onclick = () => newNote();
$('#eNew').onclick = () => newNote();
$('#fabNew').onclick = () => newNote();
$('#eToday').onclick = () => openDaily(ymd(new Date()));
$('#eOpen').onclick = () => switcher();

// ── 편집 단추 ──────────────────────────────────────────────────────────
$('#fmt').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
const fmtMenus = (keep) => document.querySelectorAll('#fmt .fmenu').forEach(m => { if (m.id != keep) m.hidden = true; });
document.addEventListener('mousedown', e => { if (!e.target.closest('#fmt')) fmtMenus(); });
$('#fmt').addEventListener('click', e => {
  const mb = e.target.closest('button[data-menu]');
  if (mb) { const m = $('#' + mb.dataset.menu); fmtMenus(m.id); m.hidden = !m.hidden; return; }
  const b = e.target.closest('button[data-c]'); if (!b || !S.cur) return;
  fmtMenus();
  if (b.dataset.c == 'kbd') return document.activeElement.blur();
  if (P.reading) setReading(false);
  const c = b.dataset.c, v = ED.view;
  if (/^h\d$/.test(c)) return NE.cmd.heading(v, +c[1]);
  if (c == 'image') return $('#fileIn').click();
  if (c == 'template') return templateDlg();
  if (c.startsWith('callout-')) return NE.cmd.callout(v, c.slice(8));
  if (c == 'date') return NE.cmd.insert(v, todayText());
  if (c == 'fromSel') return noteFromSelection();
  if (c == 'table' && NE.cmd.inTable(v)) { const r = b.getBoundingClientRect(); return tableMenu(r.left, r.top - 8, true); }
  if (NE.cmd[c]) NE.cmd[c](v);
});
function todayText() { const d = new Date(); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${WD[d.getDay()]})`; }
async function noteFromSelection() {
  const v = ED.view, r = v.state.selection.main;
  const text = v.state.sliceDoc(r.from, r.to);
  if (!text.trim()) return toast('새 노트로 만들 글을 먼저 고르세요');
  const lines = text.replace(/^\s+/, '').split('\n');
  const title = lines[0].replace(/^\s*(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*)/, '').replace(/[*_=~`]/g, '').trim().slice(0, 80) || '제목 없음';
  const body = lines.slice(1).join('\n').replace(/^\n+/, '');
  await saveNow();
  const folder = S.by.get(S.cur.path)?.folder || '';
  const res = await api('note/create', {body: {folder, title, text: body}});
  await loadState();
  const made = S.by.get(res.path)?.title || title;
  v.dispatch({changes: {from: r.from, to: r.to, insert: `[[${made}]]`}, selection: {anchor: r.from + made.length + 4}, userEvent: 'input'});
  toast(`'${made}' 노트를 만들고 링크로 바꿨습니다`);
}
function tableMenu(x, y, above) {
  const v = ED.view, op = (label, o, a) => ({label, run: () => NE.cmd.tableOp(v, o, a)});
  const items = [op('아래에 행 추가', 'addRow', true), op('위에 행 추가', 'addRow', false), op('오른쪽에 열 추가', 'addCol', true), op('왼쪽에 열 추가', 'addCol', false),
    '-', op('행을 위로', 'moveRow', -1), op('행을 아래로', 'moveRow', 1), op('열을 왼쪽으로', 'moveCol', -1), op('열을 오른쪽으로', 'moveCol', 1),
    '-', op('열 맞춤 바꾸기 (왼쪽 · 가운데 · 오른쪽)', 'align'),
    '-', {...op('행 지우기', 'delRow'), danger: true}, {...op('열 지우기', 'delCol'), danger: true}];
  ctxMenu(x, y, items);
  if (above) { const m = document.querySelector('.ctx'); if (m) m.style.top = Math.max(8, y - m.offsetHeight) + 'px'; }
}
$('#editor').addEventListener('contextmenu', e => {
  if (!ED || !S.cur) return;
  const pos = ED.view.posAtCoords({x: e.clientX, y: e.clientY}); if (pos == null) return;
  const sel = ED.view.state.selection.main;
  if (sel.empty || pos < sel.from || pos > sel.to) ED.view.dispatch({selection: {anchor: pos}});
  if (NE.cmd.inTable(ED.view)) { e.preventDefault(); return tableMenu(e.clientX, e.clientY); }
  const s2 = ED.view.state.selection.main;
  if (s2.empty || S.by.get(S.cur.path)?.readonly) return;
  e.preventDefault();
  const v = ED.view, txt = v.state.sliceDoc(s2.from, s2.to);
  let wf = s2.from, wt = s2.to;
  if (v.state.sliceDoc(wf - 1, wf) == '<' && v.state.sliceDoc(wt, wt + 1) == '>') { wf--; wt++; }
  const bare = txt.replace(/^<(.*)>$/s, '$1');
  const q = bare.replace(/\s+/g, ' ').trim(), short = q.length > 18 ? q.slice(0, 17) + '…' : q, enc = encodeURIComponent(q);
  const web = url => window.open(url, '_blank', 'noopener');
  ctxMenu(e.clientX, e.clientY, [
    {label: `'${short}' Google에서 검색`, run: () => web('https://www.google.com/search?q=' + enc)},
    {label: '네이버에서 검색', run: () => web('https://search.naver.com/search.naver?query=' + enc)},
    {label: '유튜브에서 검색', run: () => web('https://www.youtube.com/results?search_query=' + enc)},
    {label: 'Claude에게 묻기', run: () => askClaude(q)},
    {label: '노트에서 찾기', run: () => { focusSearch(); $('#q').value = q; doSearch(); }},
    '-',
    {label: '노트 링크로 만들기', run: () => v.dispatch({changes: {from: wf, to: wt, insert: `[[${q.replace(/[\[\]]/g, '')}]]`}})},
    {label: '검색 링크 걸기', run: () => v.dispatch({changes: {from: wf, to: wt, insert: `[${bare.replace(/[\[\]]/g, '')}](https://www.google.com/search?q=${enc})`}})},
    {label: '선택한 글로 새 노트', run: () => noteFromSelection()},
    '-',
    {label: '잘라내기', run: async () => { await copyText(txt, '글을'); v.dispatch({changes: {from: s2.from, to: s2.to, insert: ''}}); }},
    {label: '복사', run: () => copyText(txt, '글을')},
    '-',
    {label: '굵게', run: () => NE.cmd.bold(v)}, {label: '형광펜', run: () => NE.cmd.highlight(v)},
    {label: '링크', run: () => NE.cmd.link(v)}, {label: '각주', run: () => NE.cmd.footnote(v)},
  ]);
});
$('#fileIn').addEventListener('change', e => { uploadFiles([...e.target.files]); e.target.value = ''; });
async function uploadFiles(files) {
  if (!S.cur) return;
  for (const f of files) {
    setStatus('사진 올리는 중…');
    try {
      const r = await api('upload', {query: {name: f.name || 'image.png'}, raw: f});
      const isImg = /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|heic|avif)$/i.test(r.path);
      NE.cmd.insert(ED.view, (isImg ? `![[${r.path}]]` : `[${f.name}](${encodeURI(r.path)})`) + '\n');
    } catch (e) { toast('올리지 못했습니다: ' + e.message); }
  }
  setStatus('');
}

// ── 노트 도구 ──────────────────────────────────────────────────────────
$('#tPin').onclick = async () => { if (!S.cur) return; const n = S.by.get(S.cur.path); await api('note/pin', {body: {path: S.cur.path, on: !n.pinned}}); await loadState(); };
$('#tArchive').onclick = async () => {
  if (!S.cur) return; const n = S.by.get(S.cur.path);
  await api('note/archive', {body: {path: S.cur.path, on: !n.archived}}); await loadState();
  toast(n.archived ? '보관함에서 꺼냈습니다' : '보관함으로 옮겼습니다');
};
$('#tTrash').onclick = async () => {
  if (!S.cur) return; await saveNow();
  const t = S.by.get(S.cur.path)?.title;
  await api('note/trash', {body: {path: S.cur.path}}); closeNote(); await loadState();
  toast(`'${t}' 를 휴지통으로 보냈습니다`); if (isPhone()) setPane('list');
};
$('#tMove').onclick = () => S.cur && moveDlg();
$('#tReadI').onclick = () => $('#tRead').click();
function applyFmtBar() { $('#app').classList.toggle('no-fmt', !P.fmtBar); $('#tFmtI').classList.toggle('on', !!P.fmtBar); }
$('#tFmtI').onclick = () => { P.fmtBar = !P.fmtBar; saveP(); applyFmtBar(); };
applyFmtBar();
$('#tPanelI').onclick = () => $('#tPanel').click();
$('#tMore').onclick = e => {
  if (!S.cur) return;
  const n = S.by.get(S.cur.path) || {};
  const r = e.currentTarget.getBoundingClientRect();
  const items = [
    {label: n.pinned ? '고정 풀기' : '맨 위에 고정', run: () => $('#tPin').click()},
    {label: '새 창에서 열기', run: () => window.open('/#/' + encodeURIComponent(S.cur.path), '_blank', 'noopener')},
    {label: '노트 링크 복사', run: () => copyText('[[' + n.title + ']]', '링크를')},
    {label: n.readonly ? '읽기 전용 풀기' : '읽기 전용으로 만들기', run: () => setReadonly(S.cur.path, !n.readonly)},
    {label: '다른 노트와 합치기…', run: () => mergeDlg()},
    {label: '옮기기…', run: () => $('#tMove').click()},
    {label: '내보내기…', run: () => $('#tExport').click()},
    '-',
    {label: n.archived ? '보관함에서 꺼내기' : '보관', run: () => $('#tArchive').click()},
  ];
  items.push({label: P.reading ? '편집으로 돌아가기' : '읽기 모드', run: () => $('#tRead').click()});
  items.push({label: '모든 머리글 접기', run: () => NE.cmd.foldAll(ED.view)}, {label: '모든 머리글 펼치기', run: () => NE.cmd.unfoldAll(ED.view)});
  if (!isPhone()) items.push('-', ...layoutItems());
  items.push('-', {label: '휴지통으로', danger: true, run: () => $('#tTrash').click()});
  ctxMenu(r.right - 200, r.bottom + 6, items);
};

// ── 목록 우클릭 메뉴 ───────────────────────────────────────────────────
function closeCtx() { document.querySelector('.ctx')?.remove(); }
function ctxMenu(x, y, items) {
  closeCtx();
  const m = document.createElement('div');
  m.className = 'ctx'; m.setAttribute('role', 'menu');
  const hasCk = items.some(it => it && it.checked != null);
  m.classList.toggle('has-ck', hasCk);
  m.innerHTML = items.map((it, i) => it == '-' ? '<div class="ctx-sep"></div>' : it.head ? `<div class="ctx-h">${esc(it.head)}</div>`
    : `<button role="menuitem" data-i="${i}"${it.danger ? ' class="danger"' : ''}>${hasCk ? `<span class="ck">${it.checked ? '✓' : ''}</span>` : ''}${esc(it.label)}${it.key ? `<kbd class="ctx-k">${esc(kbdLabel(it.key))}</kbd>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  m.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    closeCtx();
    Promise.resolve(items[+b.dataset.i].run()).catch(err => toast(err.message || String(err)));
  });
  m.querySelector('button')?.focus();
}
document.addEventListener('mousedown', e => { if (!e.target.closest('.ctx')) closeCtx(); }, true);
document.addEventListener('keydown', e => { if (e.key == 'Escape') closeCtx(); });
window.addEventListener('blur', closeCtx);
$('#items').addEventListener('scroll', closeCtx);
async function copyText(t, what) {
  try { await navigator.clipboard.writeText(t); toast(what + ' 복사했습니다'); }
  catch { toast('복사하지 못했습니다'); }
}
async function trashNote(path) {
  const n = S.by.get(path); if (!n) return;
  if (S.cur && S.cur.path == path) { await saveNow(); closeNote(); }
  await api('note/trash', {body: {path}}); await loadState();
  toast(`'${n.title}' 를 휴지통으로 보냈습니다`);
}
$('#items').addEventListener('contextmenu', e => {
  const it = e.target.closest('.it[data-path]'); if (!it) return;
  e.preventDefault();
  const path = it.dataset.path, n = S.by.get(path); if (!n) return;
  if (S.multi.size > 1 && S.multi.has(path)) {
    const sel = [...S.multi];
    return ctxMenu(e.clientX, e.clientY, [
      {label: `노트 ${sel.length}개 합치기`, run: () => mergeNotes(sel)},
      '-',
      {label: `${sel.length}개 휴지통으로`, danger: true, run: async () => { for (const p of sel) await trashNote(p); setMulti([]); }},
    ]);
  }
  const enc = encodeURIComponent(path);
  const openIt = async () => { if (!S.cur || S.cur.path != path) await openNote(path); };
  ctxMenu(e.clientX, e.clientY, [
    {label: n.pinned ? '고정 풀기' : '맨 위에 고정', run: async () => { await api('note/pin', {body: {path, on: !n.pinned}}); await loadState(); }},
    {label: '노트 링크 복사', run: () => copyText('[[' + n.title + ']]', '링크를')},
    {label: '주소 복사', run: () => copyText(location.origin + '/#/' + enc, '주소를')},
    {label: '내용 복사', run: async () => { const d = await api('note', {query: {path}}); await copyText(d.text, '내용을'); }},
    '-',
    {label: '새 창에서 열기', run: () => window.open('/#/' + enc, '_blank', 'noopener')},
    {label: '복제', run: async () => {
      const d = await api('note', {query: {path}});
      const r = await api('note/create', {body: {folder: n.folder, title: n.title + ' 사본', text: d.text}});
      await loadState(); openNote(r.path);
    }},
    {label: n.readonly ? '읽기 전용 풀기' : '읽기 전용으로 만들기', run: () => setReadonly(path, !n.readonly)},
    {label: '옮기기…', run: async () => { await openIt(); moveDlg(); }},
    {label: '내보내기…', run: async () => { await openIt(); exportDlg(); }},
    '-',
    {label: n.archived ? '보관함에서 꺼내기' : '보관', run: async () => { await api('note/archive', {body: {path, on: !n.archived}}); await loadState(); }},
    {label: '휴지통으로', danger: true, run: () => trashNote(path)},
  ]);
});
$('#items').addEventListener('keydown', e => {
  const it = e.target.closest && e.target.closest('.it[data-path]');
  if (it && (e.metaKey || e.ctrlKey) && (e.key == 'Backspace' || e.key == 'Delete')) { e.preventDefault(); trashNote(it.dataset.path); }
});
$('#tAI').onclick = () => S.cur && aiSummary();

// ── AI (Claude API · 누를 때만) ─────────────────────────────────────────
async function aiWait(job, d) {
  for (let i = 0; i < 400; i++) {
    await sleep(i < 5 ? 800 : 1500);
    if (d && !d.el.isConnected) return null;
    const r = await api('ai/job', {query: {id: job}});
    if (r.state == 'done') return r.result;
    if (r.state == 'error') throw new Error(r.error);
  }
  throw new Error('너무 오래 걸립니다');
}
async function aiSummary() {
  await saveNow();
  const path = S.cur.path;
  const d = dialog({title: 'AI 요약 · ' + esc(S.by.get(path)?.title || ''), cls: 'wide', body: '<div class="pad">Claude 가 읽는 중…</div>'});
  try {
    const {job} = await api('ai/summarize', {body: {path}});
    const r = await aiWait(job, d); if (!r) return;
    d.body.innerHTML = `<div class="preview reader ai-out">${NE.render(r.text, renderOpts)}</div>
      <div class="dlg-f" style="padding:12px 0 0;border:0"><button class="btn" data-a="copy">복사</button><button class="btn primary" data-a="put">노트 끝에 넣기</button></div>`;
    d.body.onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a == 'copy') { await navigator.clipboard.writeText(r.text); toast('복사했습니다'); }
      if (a == 'put') {
        if (!S.cur || S.cur.path != path) await openNote(path);
        if (P.reading) setReading(false);
        ED.gotoPos(ED.value.length); NE.cmd.insert(ED.view, (ED.value.endsWith('\n') ? '\n' : '\n\n') + r.text + '\n');
        d.close(); toast('넣었습니다');
      }
    };
  } catch (e) { d.body.innerHTML = `<div class="pad" style="color:var(--accent2)">${esc(e.message)}</div>`; }
}
const AI_KINDS = {summary: '이 노트 요약', todos: '할 일만 뽑기', blog: '블로그 글감 뽑기', draft: '블로그 초안', related: '관련 노트 찾기'};
function closeAi() { document.querySelector('.aipop')?.remove(); }
function aiMenu() {
  closeAi(); closeCtx();
  if (!S.cur) return;
  const b = $('#tAiI').getBoundingClientRect();
  if (!(S.ai && S.ai.ready)) return ctxMenu(b.left, b.bottom + 6, [
    {label: '블로그 초안 · claude.ai', run: () => draftByConnector()},
    {label: 'API 키 넣기', run: () => settingsDlg('link')}]);
  const m = document.createElement('div'); m.className = 'aipop';
  const IC = {summary: '<path d="M5 6.5h14M5 12h14M5 17.5h9"/>', todos: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>',
    blog: '<path d="M14.5 4.5l5 5-10 10H4.5v-5z"/>', draft: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>', related: '<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.2-1.2"/>'};
  m.innerHTML = Object.entries(AI_KINDS).map(([k, l]) => `<button data-k="${k}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>${l}</button>`).join('')
    + '<div class="ctx-sep"></div><form class="aiask"><input type="text" placeholder="이 노트에 물어보기" autocomplete="off"></form>';
  document.body.appendChild(m);
  m.style.top = (b.bottom + 6) + 'px';
  m.style.left = Math.max(8, Math.min(b.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
  m.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    closeAi();
    if (k == 'draft') return ctxMenu(b.left, b.bottom + 6, [
      {label: 'API로 바로 쓰기', run: () => draftByApi()},
      {label: 'claude.ai에서 쓰기', run: () => draftByConnector()}]);
    aiRun(k);
  });
  m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const q = m.querySelector('input').value.trim(); if (!q) return; closeAi(); aiRun('ask', q); });
}
document.addEventListener('mousedown', e => { if (!e.target.closest('.aipop, #tAiI')) closeAi(); }, true);
document.addEventListener('keydown', e => { if (e.key == 'Escape') { closeAi(); document.querySelector('.aicard')?.remove(); } });
async function aiRun(kind, question = '') {
  await saveNow();
  const path = S.cur.path;
  document.querySelector('.aicard')?.remove();
  const c = document.createElement('div'); c.className = 'aicard';
  const head = kind == 'ask' ? esc(question) : AI_KINDS[kind];
  c.innerHTML = `<div class="aic-h"><span class="aic-t">${$('#tAiI svg').outerHTML}${head}</span><button class="ibtn" data-a="x" aria-label="닫기">✕</button></div><div class="aic-b"><span class="aic-wait">Claude 가 읽는 중…</span></div>`;
  document.body.appendChild(c);
  c.addEventListener('click', e => { if (e.target.closest('[data-a="x"]')) c.remove(); });
  try {
    const {job} = await api('ai/note', {body: {path, kind, question}});
    const r = await aiWait(job); if (!c.isConnected) return;
    const body = c.querySelector('.aic-b');
    if (kind == 'related') {
      body.innerHTML = r.related.length ? r.related.map(x => `<button class="aic-rel" data-open="${esc(x.path)}"><b>${esc(x.title)}</b><span>${esc(x.why)}</span></button>`).join('') : '<span class="aic-wait">관련 노트 없음</span>';
      body.onclick = e => { const o = e.target.closest('[data-open]'); if (o) { c.remove(); openNote(o.dataset.open); } };
      return;
    }
    body.innerHTML = `<div class="aic-text reader">${NE.render(r.text, renderOpts)}</div><div class="aic-f"><button class="btn sm primary" data-a="put">노트에 넣기</button><button class="btn sm" data-a="copy">복사</button></div>`;
    body.onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a == 'copy') return copyText(r.text, '결과를');
      if (a == 'put') {
        if (!S.cur || S.cur.path != path) await openNote(path);
        if (S.by.get(path)?.readonly) return toast('읽기 전용 노트입니다');
        if (P.reading) setReading(false);
        const label = kind == 'ask' ? question : AI_KINDS[kind];
        const block = `> [!note] Claude · ${label}\n` + r.text.split('\n').map(l => '> ' + l).join('\n');
        ED.gotoPos(ED.value.length); NE.cmd.insert(ED.view, (ED.value.endsWith('\n') ? '\n' : '\n\n') + block + '\n');
        c.remove(); toast('넣었습니다');
      }
    };
  } catch (e) { if (c.isConnected) c.querySelector('.aic-b').innerHTML = `<span class="aic-wait" style="color:var(--accent2)">${esc(e.message)}</span>`; }
}
$('#tAiI').onclick = () => document.querySelector('.aipop') ? closeAi() : aiMenu();
async function draftByApi() {
  await saveNow();
  const path = S.cur.path, title = S.by.get(path)?.title || '';
  toast(`'${title}' 초안 쓰는 중`, 600000);
  try {
    const {job} = await api('ai/draft', {body: {path}});
    const r = await aiWait(job);
    await loadState(); await openNote(r.path);
    toast(r.refs && r.refs.length ? `블로그 초안 폴더에 저장 · 참고 ${r.refs.length}편` : '블로그 초안 폴더에 저장');
  } catch (e) { toast(e.message, 5000); }
}
async function draftByConnector() {
  await saveNow();
  const path = S.cur.path, title = S.by.get(path)?.title || '';
  const q = `뮤직잇츠 노트 커넥터의 get_blog_rules 로 블로그 규칙을 읽고, 노트 "${path}"를 읽어서 그 규칙대로 블로그 초안을 써 줘. `
    + `같은 종류 직전 발행본은 blog_records 로 읽어 줘. 다 쓰면 create_note 로 "블로그 초안" 폴더에 "초안 · ${title}" 노트로 저장해 줘.`;
  try { await navigator.clipboard.writeText(q); } catch {}
  window.open('https://claude.ai/new?q=' + encodeURIComponent(q), '_blank', 'noopener');
  toast('claude.ai 에 요청을 넣었습니다 · 복사도 해 두었습니다', 4000);
}
async function aiJournal(kind, jname) {
  await saveNow();
  const label = kind == 'month' ? '월간' : '주간';
  toast(`${jname} 일기 ${label} 회고를 쓰는 중… (몇십 초)`, 60000);
  try {
    const {job} = await api('ai/journal', {body: {kind, journal: jname, date: S.calDay || ymd(new Date())}});
    const r = await aiWait(job);
    await loadState(); toast(`${label} 회고를 만들었습니다`); openNote(r.path);
  } catch (e) { toast(e.message, 5000); }
}
$('#tExport').onclick = () => S.cur && exportDlg();
$('#tRead').onclick = () => setReading(!P.reading);
$('#tPanel').onclick = () => togglePanel();
$('#tFocus').onclick = () => { P.focus = !$('#app').classList.contains('focus'); saveP(); applyP(); renderTools(); };
const LAYOUTS = [[1, '편집기만 표시'], [2, '노트 및 편집기 표시'], [3, '태그, 노트 및 편집기 표시']];
function layoutNow() { return P.focus ? 1 : P.side ? 3 : 2; }
function setLayout(n) { P.focus = n == 1; if (n != 1) P.side = n == 3; saveP(); applyP(); renderTools(); }
function layoutItems() { return LAYOUTS.map(([n, l]) => ({label: l, key: 'ctl+' + n, checked: layoutNow() == n, run: () => setLayout(n)})); }
$('#tLayoutI').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); ctxMenu(r.left, r.bottom + 6, layoutItems()); };

function setReading(on) {
  P.reading = on; saveP();
  $('#reader').hidden = !on; $('#editor').hidden = on; $('#fmt').hidden = on;
  if (on) renderReader(); else ED.focus();
  renderTools();
}
function fmLines(text) { const m = /^---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(\n|$)/.exec(text); return m ? m[0].split('\n').length - 1 : 0; }
function renderReader() {
  if (!S.cur) return;
  $('#reader').innerHTML = NE.render(ED.value, renderOpts);
  $('#reader').querySelectorAll('.embed').forEach(el => fillEmbed(el.dataset.target, el));
}
$('#reader').addEventListener('click', e => {
  const a = e.target.closest('a.wikilink, .embed-t'); if (a) { e.preventDefault(); return openByName(a.dataset.target); }
  const t = e.target.closest('a.tag'); if (t) { e.preventDefault(); setView({kind: 'tag', value: t.dataset.tag}); if (isPhone()) setPane('list'); return; }
  const box = e.target.closest('.task');
  if (box && box.dataset.line >= 0) {
    const lines = ED.value.split('\n'), i = +box.dataset.line + fmLines(ED.value);
    if (lines[i] != null) {
      lines[i] = lines[i].replace(/\[( |x|X)\]/, m => m == '[ ]' ? '[x]' : '[ ]');
      const pos = ED.view.state.doc.line(i + 1);
      ED.view.dispatch({changes: {from: pos.from, to: pos.to, insert: lines[i]}});
      renderReader();
    }
  }
});

document.addEventListener('pointerdown', e => {
  const z = e.target.closest('#nav') ? 'side' : e.target.closest('.side') ? 'side-head' : e.target.closest('.list') ? 'list' : e.target.closest('.main, .panel') ? 'main' : null;
  if (z) $('#app').dataset.fz = z;
  if (!isPhone() && !$('#panel').hidden && !e.target.closest('#panel, #tPanelI, .ctx, .scrim')) togglePanel(false);
}, true);

// ── 오른쪽 판 ──────────────────────────────────────────────────────────
function togglePanel(force) {
  const show = force != null ? force : (isPhone() ? true : $('#panel').hidden);
  P.panel = show; saveP();
  $('#panel').hidden = !show;
  if (isPhone() && show) setPane('panel');
  renderPanel(); renderTools();
}
$$('#panel .tab').forEach(b => b.onclick = () => { P.tab = b.dataset.tab; saveP(); renderPanel(); });
async function renderPanel() {
  if ($('#panel').hidden) return;
  if (!['info', 'outline', 'links', 'history'].includes(P.tab)) P.tab = 'info';
  $$('#panel .tab').forEach(b => b.classList.toggle('on', b.dataset.tab == P.tab));
  $('#panelTitle').textContent = {info: '통계', outline: '목차', links: '역방향 링크', history: '기록'}[P.tab];
  const body = $('#panelBody');
  if (!S.cur) { body.innerHTML = '<div class="pad">노트 없음</div>'; return; }
  const path = S.cur.path, n = S.by.get(path) || {};
  if (P.tab == 'outline') {
    const ol = S.cur.outline || [];
    body.innerHTML = ol.length ? ol.map(([ln, lv, t]) => `<button class="ol-i" data-line="${ln}" style="padding-left:${8 + (lv - 1) * 14}px">${esc(t)}</button>`).join('')
      : '<div class="pad">목차 없음</div>';
  } else if (P.tab == 'links') {
    body.innerHTML = '<div class="pad">찾는 중…</div>';
    const b = await api('backlinks', {query: {path}}).catch(() => null);
    if (!b || !S.cur || S.cur.path != path) return;
    const out = n.links || [];
    let h = `<div class="bl-h">이 노트를 가리키는 노트 ${b.linked.length}</div>`;
    h += b.linked.map(x => `<div class="bl-i"><div class="t" data-open="${esc(x.path)}"><span>${esc(x.title)}</span></div>`
      + x.lines.map(([ln, s]) => `<div class="l" data-open="${esc(x.path)}" data-line="${ln}">${esc(s)}</div>`).join('') + '</div>').join('')
      || '<div class="pad" style="padding:4px">없음</div>';
    h += `<div class="bl-h">이 노트가 가리키는 노트 ${new Set(out).size}</div>`;
    h += [...new Set(out)].map(l => { const p = resolveName(l); return `<div class="bl-i"><div class="t" data-name="${esc(l)}"><span>${esc(l)}</span>${p ? '' : '<span class="muted" style="flex:none;font-weight:400;font-size:12px">없는 노트</span>'}</div></div>`; }).join('')
      || '<div class="pad" style="padding:4px">없음</div>';
    h += `<div class="bl-h">이름만 나오는 노트 ${b.unlinked.length}</div>`;
    h += b.unlinked.map(x => `<div class="bl-i"><div class="t" data-open="${esc(x.path)}"><span>${esc(x.title)}</span><button class="btn sm" data-linkit="${esc(x.path)}" data-line="${x.lines[0][0]}">링크 걸기</button></div>`
      + x.lines.map(([ln, s]) => `<div class="l" data-open="${esc(x.path)}" data-line="${ln}">${esc(s)}</div>`).join('') + '</div>').join('')
      || '<div class="pad" style="padding:4px">없음</div>';
    body.innerHTML = h;
  } else if (P.tab == 'info') {
    const text = ED.value, chars = text.replace(/\s/g, '').length, words = (text.match(/\S+/g) || []).length;
    const paras = text.split('\n').filter(s => s.trim()).length, rsec = Math.round(chars / 500 * 60);
    const rt = rsec < 60 ? Math.max(1, rsec) + '초' : Math.round(rsec / 60) + '분';
    const card = (v, l, ic, wide) => `<div class="sc${wide ? ' wide' : ''}"><b>${esc(String(v))}</b><span>${l}</span><i>${ic}</i></div>`;
    body.innerHTML = '<div class="stats">'
      + card(words.toLocaleString(), '단어', '≡') + card(text.length.toLocaleString(), '문자', 'Aa')
      + card(paras.toLocaleString(), '단락', '¶') + card(rt, '읽는 시간', '◷')
      + (n.mtime ? card(whenFull(n.mtime), '수정됨', '✎', 1) : '') + (n.ctime ? card(whenFull(n.ctime), '생성됨', '＋', 1) : '')
      + (n.todo || n.done ? card(`${n.done} / ${n.todo + n.done}`, '끝낸 할 일', '☑', 1) : '')
      + '</div>'
      + `<div class="st-foot">${(n.tags || []).map(t => `<span class="tg">#${esc(t)}</span>`).join('')}<span class="st-path">${esc(path)}</span></div>`;
  } else if (P.tab == 'history') {
    body.innerHTML = '<div class="pad">불러오는 중…</div>';
    const r = await api('history', {query: {path}}).catch(() => ({items: []}));
    if (!S.cur || S.cur.path != path) return;
    body.innerHTML = r.items.length ? ''
      + r.items.map(x => `<div class="hs-i" data-hid="${x.id}"><span class="w">${whenFull(x.time)}</span><span class="s">${(x.size / 1024).toFixed(1)}KB</span></div>`).join('')
      : '<div class="pad">기록 없음</div>';
  }
}
$('#panelBody').addEventListener('click', async e => {
  const li = e.target.closest('[data-linkit]');
  if (li) { e.stopPropagation(); return linkMention(li.dataset.linkit, +li.dataset.line); }
  const ol = e.target.closest('.ol-i'); if (ol) { if (P.reading) setReading(false); ED.gotoLine(+ol.dataset.line); if (isPhone()) setPane('main'); return; }
  const o = e.target.closest('[data-open]'); if (o) return openNote(o.dataset.open, {line: o.dataset.line ? +o.dataset.line : undefined});
  const nm = e.target.closest('[data-name]'); if (nm) return openByName(nm.dataset.name);
  const h = e.target.closest('[data-hid]'); if (h) return historyDlg(h.dataset.hid);
});
async function linkMention(path, line) {
  const title = S.by.get(S.cur.path).title;
  const d = await api('note', {query: {path}});
  const lines = d.text.split('\n'); const i = line - 1;
  const idx = lines[i].toLowerCase().indexOf(title.toLowerCase()); if (idx < 0) return;
  const found = lines[i].substr(idx, title.length);
  lines[i] = lines[i].slice(0, idx) + (found == title ? `[[${title}]]` : `[[${title}|${found}]]`) + lines[i].slice(idx + title.length);
  await api('note/save', {body: {path, text: lines.join('\n'), base: d.ver}});
  toast('링크를 걸었습니다'); await loadState(); renderPanel();
}

// ── 창(대화상자) ───────────────────────────────────────────────────────
function dialog({title, body, foot, cls = '', onClose, full}) {
  const s = document.createElement('div'); s.className = 'scrim' + (full ? ' full' : '');
  s.innerHTML = `<div class="dlg ${cls}${full ? ' full' : ''}" role="dialog">${title != null ? `<div class="dlg-h"><h3>${title}</h3><button class="btn sm" data-x>닫기</button></div>` : ''}<div class="dlg-b">${body || ''}</div>${foot ? `<div class="dlg-f">${foot}</div>` : ''}</div>`;
  document.body.appendChild(s);
  const close = v => { if (!s.isConnected) return; s.remove(); document.removeEventListener('keydown', k, true); onClose && onClose(v); };
  const k = e => { if (e.key == 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', k, true);
  s.addEventListener('mousedown', e => { if (e.target == s) close(); });
  s.querySelector('[data-x]')?.addEventListener('click', () => close());
  fillKbd(s);
  return {el: s, dlg: s.querySelector('.dlg'), body: s.querySelector('.dlg-b'), close};
}
function confirmDlg(title, msg, ok = '확인', danger) {
  return new Promise(res => {
    const d = dialog({title: esc(title), body: `<p style="margin:0">${esc(msg)}</p>`,
      foot: `<button class="btn" data-no>취소</button><button class="btn ${danger ? 'primary' : 'primary'}" data-ok>${esc(ok)}</button>`, onClose: () => res(false)});
    d.el.querySelector('[data-no]').onclick = () => d.close();
    d.el.querySelector('[data-ok]').onclick = () => { res(true); d.close(); };
    d.el.querySelector('[data-ok]').focus();
  });
}
function choiceDlg(title, html, choices) {
  return new Promise(res => {
    const d = dialog({title: esc(title), body: html, cls: 'wide',
      foot: choices.map(([v, l, c]) => `<button class="btn ${c || ''}" data-v="${v}">${esc(l)}</button>`).join(''), onClose: () => res(null)});
    d.el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { res(b.dataset.v); d.close(b.dataset.v); });
  });
}
function promptDlg(title, label, value = '') {
  return new Promise(res => {
    const d = dialog({title: esc(title), body: `<div class="field" style="margin:0"><label>${esc(label)}</label><input type="text" id="pIn" value="${esc(value)}"></div>`,
      foot: '<button class="btn" data-no>취소</button><button class="btn primary" data-ok>확인</button>', onClose: () => res(null)});
    const inp = d.el.querySelector('#pIn'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
    const ok = () => { res(inp.value.trim()); d.close(inp.value.trim()); };
    inp.addEventListener('keydown', e => { if (e.key == 'Enter') afterIME(e, ok); });
    d.el.querySelector('[data-no]').onclick = () => d.close();
    d.el.querySelector('[data-ok]').onclick = ok;
  });
}

// 고르는 창: 빠른 열기·명령·옮기기·템플릿이 같이 쓴다
function picker({placeholder, items, render, onPick, empty, extra}) {
  const d = dialog({body: `<input class="pal-in" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"><div class="pal-l"></div>`});
  d.body.style.padding = '0'; d.body.style.display = 'flex'; d.body.style.flexDirection = 'column'; d.body.style.overflow = 'hidden';
  const inp = d.el.querySelector('.pal-in'), list = d.el.querySelector('.pal-l');
  let shown = [], sel = 0;
  const draw = () => {
    const q = inp.value.trim();
    shown = items(q);
    if (extra) { const x = extra(q); if (x) shown.push(x); }
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((it, i) => `<button class="pal-i${i == sel ? ' on' : ''}" data-i="${i}">${render(it, q)}</button>`).join('')
      || `<div class="pad" style="text-align:center">${empty || '없음'}</div>`;
    fillKbd(list);
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({block: 'nearest'});
  };
  inp.addEventListener('input', () => { sel = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if (e.key == 'Enter') { if (!e.isComposing) e.preventDefault(); afterIME(e, () => { if (shown[sel] && inp.isConnected) { d.close(); onPick(shown[sel], e); } }); return; }
    if (e.isComposing) return;
    if (e.key == 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
    else if (e.key == 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
  });
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { d.close(); onPick(shown[+b.dataset.i], e); } });
  draw(); inp.focus();
  return d;
}
function fuzzy(q, s) {
  // 글자가 순서대로 다 들어 있으면 맞다. 붙어 있을수록, 앞에 있을수록 점수가 높다.
  q = q.toLowerCase(); const low = s.toLowerCase();
  if (!q) return {score: 0, hit: []};
  const i = low.indexOf(q);
  if (i >= 0) return {score: 1000 - i - s.length * .1, hit: [...Array(q.length)].map((_, k) => i + k)};
  let j = 0, score = 0, last = -2; const hit = [];
  for (let k = 0; k < low.length && j < q.length; k++) if (low[k] == q[j]) { hit.push(k); score += last == k - 1 ? 5 : 1; last = k; j++; }
  return j == q.length ? {score: score - s.length * .1, hit} : null;
}
function hiFuzzy(s, hit) { return [...s].map((c, i) => hit.includes(i) ? `<mark>${esc(c)}</mark>` : esc(c)).join(''); }

function switcher() {
  picker({
    placeholder: '노트 이름',
    items: q => {
      const rows = S.notes.map(n => ({n, m: q ? fuzzy(q, n.title) : {score: n.mtime / 1e10, hit: []}})).filter(x => x.m);
      rows.sort((a, b) => b.m.score - a.m.score); return rows.slice(0, 50);
    },
    render: x => x.make ? `<span class="nm">새 노트 만들기: <b>${esc(x.make)}</b></span><kbd>Enter</kbd>`
      : `<span class="nm">${hiFuzzy(x.n.title, x.m.hit)}</span><span class="sub">${esc(x.n.folder)}</span>`,
    extra: q => q && !S.notes.some(n => n.title.toLowerCase() == q.toLowerCase()) ? {make: q} : null,
    onPick: x => x.make ? newNote(x.make) : openNote(x.n.path),
    empty: '노트가 없습니다',
  });
}
function palette() {
  const cmds = COMMANDS().filter(c => !c.when || c.when());
  picker({
    placeholder: '명령 찾기',
    items: q => cmds.map(c => ({c, m: q ? fuzzy(q, c.name) : {score: 0, hit: []}})).filter(x => x.m).sort((a, b) => b.m.score - a.m.score),
    render: x => `<span class="nm">${hiFuzzy(x.c.name, x.m.hit)}</span>${x.c.key ? `<kbd data-k="${x.c.key}"></kbd>` : ''}`,
    onPick: x => x.c.run(),
  });
}
function moveDlg() {
  const all = ['', ...S.folders];
  picker({
    placeholder: '옮길 폴더',
    items: q => all.map(f => ({f, m: q ? fuzzy(q, f || '맨 위') : {score: 0, hit: []}})).filter(x => x.m).sort((a, b) => b.m.score - a.m.score),
    render: x => x.make ? `<span class="nm">새 폴더 만들어 옮기기: <b>${esc(x.f)}</b></span>`
      : `<span class="nm">${x.f ? hiFuzzy(x.f, x.m.hit) : '맨 위 (폴더 없음)'}</span>`,
    extra: q => q && !S.folders.includes(q.replace(/^\/|\/$/g, '')) ? {f: q.replace(/^\/|\/$/g, ''), m: {hit: []}, make: true} : null,
    onPick: async x => {
      await saveNow();
      const r = await api('note/move', {body: {path: S.cur.path, folder: x.f}});
      S.cur.path = r.path; await loadState(); renderMeta(); toast((x.f || '맨 위') + ' 로 옮겼습니다');
    },
  });
}
async function templateDlg() {
  const r = await api('templates');
  if (!r.items.length) return toast(`'${S.settings['템플릿폴더'] || '템플릿'}' 폴더에 노트를 만들면 템플릿으로 쓸 수 있습니다`, 3600);
  picker({
    placeholder: '넣을 템플릿',
    items: q => r.items.map(p => ({p, t: p.split('/').pop().replace(/\.md$/, '')})).map(x => ({...x, m: q ? fuzzy(q, x.t) : {hit: [], score: 0}})).filter(x => x.m),
    render: x => `<span class="nm">${hiFuzzy(x.t, x.m.hit)}</span>`,
    onPick: async x => {
      const t = await api('template/apply', {body: {path: x.p, title: S.by.get(S.cur.path)?.title || ''}});
      if (P.reading) setReading(false);
      NE.cmd.insert(ED.view, t.text);
    },
  });
}
function exportDlg() {
  const n = S.by.get(S.cur.path);
  const d = dialog({title: '내보내기', body: `<p style="margin-top:0">'${esc(n.title)}'</p><div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-e="md">마크다운 (.md)</button><button class="btn" data-e="html">웹 문서 (.html)</button>
    <button class="btn" data-e="pdf">PDF로 인쇄</button><button class="btn" data-e="copy">본문 복사</button><button class="btn" data-e="copyhtml">서식째 복사</button></div>`});
  d.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    const text = ED.value, name = n.title;
    const dl = (blob, fn) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    if (b.dataset.e == 'md') dl(new Blob([text], {type: 'text/markdown'}), name + '.md');
    if (b.dataset.e == 'html') {
      const css = await fetch('app.css').then(r => r.text());
      const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><style>${css}body{overflow:auto}.doc{padding:40px 24px}</style></head><body><div class="doc"><h1 class="title">${esc(name)}</h1><article class="reader">${NE.render(text, {...renderOpts, resolveImage: u => location.origin + fileUrl(u)})}</article></div></body></html>`;
      dl(new Blob([html], {type: 'text/html'}), name + '.html');
    }
    if (b.dataset.e == 'pdf') { d.close(); const was = P.reading; setReading(true); setTimeout(() => { window.print(); if (!was) setReading(false); }, 200); }
    if (b.dataset.e == 'copy') { await navigator.clipboard.writeText(text); toast('복사했습니다'); }
    if (b.dataset.e == 'copyhtml') {
      const html = NE.render(text, {...renderOpts, resolveImage: u => location.origin + fileUrl(u)});
      try { await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'}), 'text/plain': new Blob([text], {type: 'text/plain'})})]); toast('서식째 복사했습니다'); }
      catch { await navigator.clipboard.writeText(text); toast('본문만 복사했습니다'); }
    }
  });
}
async function historyDlg(id) {
  const path = S.cur.path;
  const r = await api('history/get', {query: {path, id}});
  const t = id.replace(/(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)/, '$1. $2. $3. $4:$5');
  const v = await choiceDlg('기록 · ' + t, `<div class="preview reader">${NE.render(r.text, renderOpts)}</div>`,
    [['copy', '내용 복사'], ['restore', '이 판으로 되돌리기', 'primary']]);
  if (v == 'copy') { await navigator.clipboard.writeText(r.text); toast('복사했습니다'); }
  if (v == 'restore') {
    await saveNow();
    const s = await api('history/restore', {body: {path, id}});
    S.cur.loading = true; ED.reset(s.text); S.cur.loading = false; S.cur.ver = s.ver; S.cur.saved = s.text; S.cur.dirty = false;
    toast('되돌렸습니다'); await loadState(); renderPanel();
  }
}
async function trashItem(id) {
  const t = S.trash.find(x => x.id == id); if (!t) return;
  const r = await api('trash/get', {query: {id}});
  const v = await choiceDlg(t['제목'], `<p class="muted" style="margin-top:0">${esc(t['원래'])} · 버린 날 ${whenFull(t['버린날'])}</p><div class="preview reader">${NE.render(r.text, renderOpts)}</div>`,
    [['purge', '영구 삭제'], ['restore', '되살리기', 'primary']]);
  if (v == 'restore') { const s = await api('trash/restore', {body: {id}}); await loadState(); renderList(); toast('되살렸습니다'); openNote(s.path); }
  if (v == 'purge' && await confirmDlg('영구 삭제', '되살릴 수 없습니다.', '지우기', true)) { await api('trash/purge', {body: {id}}); await loadState(); renderList(); }
}

// ── 그래프 ─────────────────────────────────────────────────────────────
async function graphDlg() {
  const g = await api('graph');
  const d = dialog({title: '그래프', full: true, body: `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <div class="seg" id="gMode"><button data-m="all" class="on">전체</button><button data-m="local">지금 노트 주변</button></div>
      <div class="seg" id="gMiss"><button data-x="0" class="on">있는 노트만</button><button data-x="1">없는 노트도</button></div>
      <span class="muted" id="gCount" style="font-size:12.5px"></span></div><div class="graph-wrap"><canvas></canvas><div class="graph-tip" hidden></div></div>`});
  d.body.style.display = 'flex'; d.body.style.flexDirection = 'column'; d.body.style.flex = '1'; d.body.style.minHeight = '0';
  const wrap = d.el.querySelector('.graph-wrap'), cv = wrap.querySelector('canvas'), tip = wrap.querySelector('.graph-tip');
  const ctx = cv.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const col = {fg: cs.getPropertyValue('--fg2').trim(), muted: cs.getPropertyValue('--mark').trim(), line: cs.getPropertyValue('--line').trim(), acc: cs.getPropertyValue('--accent').trim()};
  let mode = 'all', showMissing = false, nodes = [], edges = [], cam = {x: 0, y: 0, k: 1}, hover = null, drag = null, raf;
  const curPath = S.cur && S.cur.path;
  function build() {
    let keep = new Set(g.nodes.map((n, i) => i).filter(i => showMissing || !g.nodes[i].missing));
    if (mode == 'local' && curPath) {
      const ci = g.nodes.findIndex(n => n.id == curPath), near = new Set([ci]);
      for (let step = 0; step < 2; step++) for (const [a, b] of g.edges) { if (near.has(a)) near.add(b); if (near.has(b)) near.add(a); }
      keep = new Set([...keep].filter(i => near.has(i)));
    }
    const map = new Map(); nodes = [];
    for (const i of keep) { map.set(i, nodes.length); const a = Math.random() * 6.28, r = 50 + Math.random() * 300;
      nodes.push({...g.nodes[i], x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, deg: 0}); }
    edges = g.edges.filter(([a, b]) => map.has(a) && map.has(b)).map(([a, b]) => [map.get(a), map.get(b)]);
    for (const [a, b] of edges) { nodes[a].deg++; nodes[b].deg++; }
    d.el.querySelector('#gCount').textContent = `노트 ${nodes.length} · 연결 ${edges.length}`;
    cam = {x: 0, y: 0, k: 1}; alpha = 1;
  }
  let alpha = 1;
  function tick() {
    const n = nodes.length; if (!n) return;
    const rep = 900, spring = .02, len = 70;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + .01;
      if (d2 > 250000) continue; const f = rep / d2 * alpha, dd = Math.sqrt(d2);
      dx /= dd; dy /= dd; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const [i, j] of edges) {
      const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, dd = Math.sqrt(dx * dx + dy * dy) || 1, f = (dd - len) * spring * alpha;
      a.vx += dx / dd * f; a.vy += dy / dd * f; b.vx -= dx / dd * f; b.vy -= dy / dd * f;
    }
    for (const p of nodes) { if (p === drag?.node) continue; p.vx -= p.x * .004 * alpha; p.vy -= p.y * .004 * alpha; p.vx *= .82; p.vy *= .82; p.x += p.vx; p.y += p.vy; }
    alpha = Math.max(alpha * .985, .02);
  }
  function draw() {
    const dpr = devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
    if (cv.width != W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2 + cam.x, H / 2 + cam.y); ctx.scale(cam.k, cam.k);
    const nb = new Set(); if (hover) for (const [a, b] of edges) { if (nodes[a] == hover) nb.add(nodes[b]); if (nodes[b] == hover) nb.add(nodes[a]); }
    ctx.lineWidth = 1 / cam.k;
    for (const [a, b] of edges) {
      const on = hover && (nodes[a] == hover || nodes[b] == hover);
      ctx.strokeStyle = on ? col.acc : col.line; ctx.globalAlpha = hover && !on ? .35 : 1;
      ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke();
    }
    for (const p of nodes) {
      const r = 3 + Math.sqrt(p.deg) * 1.8, me = p.id && p.id == curPath;
      ctx.globalAlpha = hover && p != hover && !nb.has(p) ? .3 : 1;
      ctx.fillStyle = me || p == hover ? col.acc : p.missing ? col.muted : col.fg;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.29); ctx.fill();
      if (cam.k > .8 || p == hover || me || nb.has(p) || p.deg > 4) {
        ctx.fillStyle = col.fg; ctx.font = `${11 / Math.max(cam.k, .7)}px Pretendard, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(p.title.length > 18 ? p.title.slice(0, 17) + '…' : p.title, p.x, p.y + r + 12 / Math.max(cam.k, .7));
      }
    }
    ctx.globalAlpha = 1;
  }
  function loop() { if (!d.el.isConnected) return; if (alpha > .021 || drag) tick(); draw(); raf = requestAnimationFrame(loop); }
  const toWorld = (ex, ey) => { const r = cv.getBoundingClientRect(); return {x: (ex - r.left - r.width / 2 - cam.x) / cam.k, y: (ey - r.top - r.height / 2 - cam.y) / cam.k}; };
  const hit = (ex, ey) => { const w = toWorld(ex, ey); let best = null, bd = 1e9;
    for (const p of nodes) { const dd = (p.x - w.x) ** 2 + (p.y - w.y) ** 2, r = 6 + Math.sqrt(p.deg) * 2; if (dd < r * r * 2 && dd < bd) { bd = dd; best = p; } } return best; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const p = hit(e.clientX, e.clientY); drag = {node: p, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false}; cv.classList.add('drag'); });
  cv.addEventListener('pointermove', e => {
    if (drag) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
      if (drag.node) { const w = toWorld(e.clientX, e.clientY); drag.node.x = w.x; drag.node.y = w.y; alpha = Math.max(alpha, .3); }
      else { cam.x = drag.cx + e.clientX - drag.sx; cam.y = drag.cy + e.clientY - drag.sy; }
      return;
    }
    hover = hit(e.clientX, e.clientY);
    if (hover) { const r = wrap.getBoundingClientRect(); tip.hidden = false; tip.textContent = hover.title + (hover.missing ? ' (없는 노트)' : ''); tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; }
    else tip.hidden = true;
  });
  cv.addEventListener('pointerup', e => {
    const dd = drag; drag = null; cv.classList.remove('drag');
    if (dd && !dd.moved && dd.node) { d.close(); dd.node.missing ? openByName(dd.node.title) : openNote(dd.node.id); }
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); const k = Math.exp(-e.deltaY * .0015); cam.k = Math.min(4, Math.max(.15, cam.k * k)); }, {passive: false});
  d.el.querySelector('#gMode').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; d.el.querySelectorAll('#gMode button').forEach(x => x.classList.toggle('on', x == b)); build(); };
  d.el.querySelector('#gMiss').onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return; showMissing = b.dataset.x == '1'; d.el.querySelectorAll('#gMiss button').forEach(x => x.classList.toggle('on', x == b)); build(); };
  build(); for (let i = 0; i < 120; i++) tick(); loop();
}

// ── 설정 ───────────────────────────────────────────────────────────────
let prefsData = null, prefsLoading = null;
function loadPrefsData() {
  const own = S.me && S.me.owner;
  prefsLoading = Promise.all([
    api('backups').catch(() => ({items: []})), api('templates').catch(() => ({items: []})),
    api('icloud/status').catch(() => ({connected: false})), api('ai/status').catch(() => ({ready: false})),
    own ? api('update/status').catch(() => ({enabled: false})) : {enabled: false},
    own ? api('accounts').catch(() => ({items: [], max: 10})) : null,
  ]).then(r => (prefsData = r)).finally(() => { prefsLoading = null; });
  return prefsLoading;
}
async function settingsDlg(tab = 'view', fresh = false) {
  const st = S.settings;
  const got = !fresh && prefsData ? prefsData : await (prefsLoading || loadPrefsData());
  const [bk, tp, ic, ai, up, acc] = got;
  const seg = (key, opts) => `<div class="seg" data-pref="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(P[key]) == String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const mcp = location.origin + '/mcp';
  const cals = ic.calendars || [];
  const jrow = (j, i) => `<div class="jrow" data-i="${i}">
      <div class="field"><label>이름</label><input type="text" data-j="이름" value="${esc(j['이름'])}"></div>
      <div class="field"><label>폴더</label><input type="text" data-j="폴더" value="${esc(j['폴더'])}"></div>
      <div class="field"><label>템플릿</label><select data-j="템플릿"><option value="">기본 틀</option>${tp.items.map(p => `<option value="${esc(p)}"${p == j['템플릿'] ? ' selected' : ''}>${esc(p)}</option>`).join('')}${j['템플릿'] && !tp.items.includes(j['템플릿']) ? `<option value="${esc(j['템플릿'])}" selected>${esc(j['템플릿'])} (아직 없음 → 기본 틀)</option>` : ''}</select></div>
      ${cals.length ? `<div class="field"><label>짝지을 iCloud 캘린더 (안 고르면 전부)</label><div class="chips">${cals.map(c => `<button class="chip${(j['캘린더'] || []).includes(c.name) ? ' on' : ''}" data-cal="${esc(c.name)}"><i style="background:${esc(c.color || 'var(--muted)')}"></i>${esc(c.name)}</button>`).join('')}</div></div>` : ''}
      <button class="btn sm danger" data-jdel>이 일기 종류 빼기</button></div>`;
const PREF_IC = {"view": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0\"/><circle cx=\"16\" cy=\"7\" r=\"2\"/><circle cx=\"10\" cy=\"12\" r=\"2\"/><circle cx=\"18\" cy=\"17\" r=\"2\"/></svg>", "type": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3.5 18.5L8.5 5.5l5 13M5.4 13.8h6.2\"/><path d=\"M14.5 18.5l3.5-9 3.5 9M15.6 15.6h4.8\"/></svg>", "theme": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 3.5h5v15a2.5 2.5 0 01-5 0z\"/><path d=\"M10 7.5l4.3-2.5 2.5 4.3L10 13\"/><path d=\"M10 14.5l6.5-3.8 2.6 4.4-8.6 5\"/><circle cx=\"7.5\" cy=\"17.5\" r=\".7\" fill=\"currentColor\"/></svg>", "notes": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 4.5h10.5L19 8v11.5H5z\"/><path d=\"M8.5 10h7M8.5 13.5h7M8.5 17h4\"/></svg>", "link": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.2 1.2\"/><path d=\"M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.2-1.2\"/></svg>", "backup": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 18.5a4.5 4.5 0 01-.6-9 6 6 0 0111.4 1.5 3.8 3.8 0 01-.8 7.5\"/><path d=\"M9.5 14l2.5-2.5 2.5 2.5M12 11.5v7\"/></svg>", "accounts": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8.5\" r=\"3.5\"/><path d=\"M5 19.5c1.2-3.5 4-5 7-5s5.8 1.5 7 5\"/></svg>"};

  const tabs = [['view', '일반'], ['type', '타이포그래피'], ['theme', '테마'], ['notes', '노트·일기'], ['link', '연결'], ['backup', up.enabled ? '동기화·백업' : '백업·로그인'], ...(S.me && S.me.owner ? [['accounts', '계정']] : [])];
  const chk = (key, label) => `<label class="pchk"><input type="checkbox" data-chk="${key}"${P[key] ? ' checked' : ''}><span>${label}</span></label>`;
  const sel = (key, opts) => `<select class="psel" data-sel="${key}">${opts.map(([v, l]) => `<option value="${v}"${String(P[key]) == String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const THEMES = [['graphite', '레드 그래파이트', 'light', 'graphite'], ['light', '라이트', 'light', 'light'], ['dark', '다크 그래파이트', 'dark', 'graphite'], ['auto', '자동', 'auto', 'graphite']];
  const curTheme = P.theme == 'dark' ? 'dark' : P.theme == 'auto' ? 'auto' : P.sideTone == 'light' ? 'light' : 'graphite';
  const body = `<div class="settabs ptabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k == tab ? 'on' : ''}">${PREF_IC[k] || ''}<span>${l}</span></button>`).join('')}</div>
  <div class="set-pane prow" data-pane="view"${tab == 'view' ? '' : ' hidden'}>
    <div class="set-row"><span>편집기</span><div class="pcol">${chk('live', '마크다운 기호 숨기기')}${chk('spell', '맞춤법 검사')}${chk('typewriter', '타자기 모드')}</div></div>
    <hr class="psep">
    <div class="set-row"><span>보기 방식</span><select class="psel" data-layout>${LAYOUTS.map(([n, l]) => `<option value="${n}"${layoutNow() == n ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="set-row"><span>정렬</span>${sel('sort', [['mtime', '고친 순'], ['ctime', '만든 순'], ['title', '이름 순']])}</div>
  </div>
  <div class="set-pane prow" data-pane="type"${tab == 'type' ? '' : ' hidden'}>
    <div class="set-row"><span>글꼴</span>${sel('font', [['sans', 'Avenir Next · 산돌고딕'], ['serif', '명조'], ['mono', '고정폭']])}</div>
    <div class="set-row"><span>글자 크기</span><div class="pstep" id="fsSeg"><button data-d="-1" aria-label="작게">−</button><b>${P.fs}</b><button data-d="1" aria-label="크게">+</button></div></div>
    <div class="set-row"><span>줄 간격</span>${sel('lh', [['tight', '좁게'], ['normal', '보통'], ['loose', '넓게']])}</div>
    <div class="set-row"><span>줄 너비</span>${sel('width', [['narrow', '좁게'], ['mid', '보통'], ['wide', '넓게'], ['full', '꽉 차게']])}</div>
  </div>
  <div class="set-pane" data-pane="theme"${tab == 'theme' ? '' : ' hidden'}>
    <div class="pthemes">${THEMES.map(([k, l]) => `<button class="pth pth-${k}${curTheme == k ? ' on' : ''}" data-theme-pick="${k}">
      <span class="pth-side"></span><span class="pth-body"><b>${l}</b><span>마음을 <b>담아</b> 쓰는 <em>노트</em> 한 장</span></span></button>`).join('')}</div>
  </div>
  <div class="set-pane" data-pane="notes"${tab == 'notes' ? '' : ' hidden'}>
    <div class="set-sec"><h4>일기 종류</h4><div id="jlist">${(S.journals || []).map(jrow).join('')}</div>
      <button class="btn" id="jadd">+ 일기 종류 더하기</button></div>
    <div class="set-sec"><h4>폴더</h4>
    <div class="field"><label>템플릿 폴더</label><input type="text" data-s="템플릿폴더" value="${esc(st['템플릿폴더'])}"></div>
    <div class="field"><label>사진 넣을 폴더</label><input type="text" data-s="첨부폴더" value="${esc(st['첨부폴더'])}"></div>
    <div class="field"><label>새 노트 폴더</label><input type="text" placeholder="맨 위" data-s="새노트폴더" value="${esc(st['새노트폴더'])}"></div></div>
    <button class="btn primary" id="saveS">노트·일기 설정 저장</button>
  </div>
  <div class="set-pane" data-pane="link"${tab == 'link' ? '' : ' hidden'}>
    <div class="set-sec"><h4>Claude 커넥터</h4>
      <div class="set-row"><span>커넥터 주소</span><div style="display:flex;gap:6px;align-items:center;min-width:0"><code style="font-size:12.5px;word-break:break-all">${esc(mcp)}</code><button class="btn sm" id="cpMcp">복사</button></div></div>
      <div class="set-row"><span>연결된 곳</span><div style="display:flex;gap:8px;align-items:center"><span>${S.claude.length ? S.claude.map(c => esc(c['이름'])).join(', ') : '없음'}</span>${S.claude.length ? '<button class="btn sm danger" id="cutClaude">연결 끊기</button>' : ''}</div></div></div>
    ${S.me && S.me.owner ? `<div class="set-sec"><h4>Claude API</h4>
      ${ai.ready ? `<div class="set-row"><span>API 키</span><div style="display:flex;gap:8px;align-items:center"><span>${esc(ai.keyHint)}</span><button class="btn sm danger" id="aiDel">키 지우기</button></div></div>
        <div class="set-row"><span>모델</span><div class="seg" id="aiModel">${(ai.models || []).map(m => `<button data-m="${esc(m.id)}" class="${m.id == ai.model ? 'on' : ''}">${esc(m.name)}</button>`).join('')}</div></div>
        <div class="set-row"><span>이번 달 사용</span><span>${ai.usage ? `${ai.usage.requests}번 · 입력 ${ai.usage.input.toLocaleString()} · 출력 ${ai.usage.output.toLocaleString()} 토큰 · 약 $${ai.usage.cost.toFixed(2)}` : '없음'}</span></div>`
      : (ai.sdk === false ? '<p class="muted" style="margin:0">서버에 anthropic 패키지가 없습니다</p>'
        : `<div class="field"><label>API 키</label><input type="password" id="aiKey" placeholder="sk-ant-…" autocomplete="off"></div><button class="btn primary" id="aiSave">키 저장</button>`)}
    </div>` : ''}
    <div class="set-sec"><h4>iCloud 캘린더</h4>
      ${ic.connected ? `<div class="set-row"><span>계정</span><div style="display:flex;gap:8px;align-items:center"><span>${esc(ic.account)}</span><button class="btn sm danger" id="icDel">연결 끊기</button></div></div>
        <div class="set-row"><span>캘린더 ${cals.length}개</span><div class="chips">${cals.map(c => `<span class="chip on" style="cursor:default"><i style="background:${esc(c.color || 'var(--muted)')}"></i>${esc(c.name)}</span>`).join('')}</div></div>
        ${ic.error ? `<p class="muted" style="color:var(--accent2)">${esc(ic.error)}</p>` : ''}`
      : `<div class="field"><label>애플 ID</label><input type="text" id="icId" autocomplete="off"></div>
        <div class="field"><label>앱 전용 암호</label><input type="password" id="icPw" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="off"></div>
        <button class="btn primary" id="icSave">연결</button>`}
    </div>
  </div>
  <div class="set-pane" data-pane="backup"${tab == 'backup' ? '' : ' hidden'}>
    ${up.enabled ? `<div class="set-sec"><h4>프로그램 업데이트</h4>
      <div class="set-row"><span>지금 판</span><span>${esc((up.current.sha || '').slice(0, 7))} · ${up.current.date ? esc(up.current.date.slice(0, 10)) : ''}</span></div>
      <div class="set-row"><span>GitHub 최신</span><span>${up.latest ? `${esc(up.latest.sha.slice(0, 7))} · ${esc(up.latest.date.slice(0, 10))} · ${esc(up.latest.message)}` : (up.error ? `<span style="color:var(--accent2)">${esc(up.error)}</span>` : '확인 전')}</span></div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${up.new ? '<button class="btn primary" id="upGo">업데이트</button>' : '<span class="muted" style="align-self:center">최신입니다</span>'}<button class="btn" id="upChk">다시 확인</button></div></div>` : ''}
    <div class="set-sec"><h4>백업 (나스)</h4>
    <table class="tbl"><tr><th>파일</th><th class="num">크기</th><th></th></tr>${bk.items.slice(0, 6).map(b => `<tr><td>${esc(b.name)}</td><td class="num">${(b.size / 1048576).toFixed(1)}MB</td><td class="num"><button class="btn sm" data-bk="${esc(b.name)}">내려받기</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">아직 없음</td></tr>'}</table>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="bkNow">지금 백업</button><button class="btn" id="bkAll">전체 내려받기 (.zip)</button></div></div>
    <div class="set-sec"><h4>로그인 · ${esc((S.me && S.me.name) || '')} (${esc((S.me && S.me.id) || '')})</h4>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="lo1">이 기기 로그아웃</button><button class="btn danger" id="loAll">모든 기기 로그아웃</button><button class="btn" id="myPw">비밀번호 바꾸기</button></div></div>
  </div>
  ${acc ? `<div class="set-pane" data-pane="accounts"${tab == 'accounts' ? '' : ' hidden'}>
    <div class="set-sec"><h4>계정 ${acc.items.length} / ${acc.max}</h4>
    <table class="tbl"><tr><th>아이디</th><th>이름</th><th class="num">노트</th><th>마지막 로그인</th><th></th></tr>
    ${acc.items.map(a => `<tr><td>${esc(a.id)}${a['주인'] ? ' <span class="muted">(주인)</span>' : ''}</td><td>${esc(a['이름'])}</td><td class="num">${a.notes ?? ''}</td>
      <td>${a.last ? when(a.last) : '<span class="muted">없음</span>'}</td>
      <td class="num" style="white-space:nowrap"><button class="btn sm" data-acc-rn="${esc(a.id)}">이름</button>${a['주인'] ? '' : ` <button class="btn sm" data-acc-pw="${esc(a.id)}">비밀번호</button> <button class="btn sm danger" data-acc-del="${esc(a.id)}">지우기</button>`}</td></tr>`).join('')}</table>
    ${acc.items.length < acc.max ? `<div class="jrow" style="margin-top:14px;grid-template-columns:1fr 1fr 1fr">
      <div class="field"><label>새 아이디</label><input type="text" id="naId" autocomplete="off" autocapitalize="off"></div>
      <div class="field"><label>이름</label><input type="text" id="naName" autocomplete="off"></div>
      <div class="field"><label>처음 비밀번호</label><input type="password" placeholder="6자 이상" id="naPw" autocomplete="new-password"></div>
      <button class="btn primary" id="naMake">계정 만들기</button></div>` : '<p class="muted">계정이 가득 찼습니다</p>'}
    </div></div>` : ''}`;
  const d = dialog({title: '환경설정', body, cls: 'wide prefs', onClose: () => { if (!prefsLoading) loadPrefsData(); }});
  const reopen = t => { d.close(); settingsDlg(t, true); };
  d.el.addEventListener('change', e => {
    const c = e.target.closest('[data-chk]');
    if (c) { P[c.dataset.chk] = c.checked; saveP(); applyP(); if (c.dataset.chk == 'typewriter' && ED && ED.setTypewriter) ED.setTypewriter(P.typewriter); return; }
    const lo = e.target.closest('[data-layout]'); if (lo) { setLayout(+lo.value); return; }
    const sl = e.target.closest('[data-sel]');
    if (sl) { P[sl.dataset.sel] = sl.value; saveP(); applyP(); if (sl.dataset.sel == 'sort') { const so = $('#sort'); if (so) so.value = P.sort; renderList(); } }
  });
  d.el.addEventListener('click', async e => {
    const tb = e.target.closest('.settabs [data-tab]');
    if (tb) { d.el.querySelectorAll('.settabs button').forEach(x => x.classList.toggle('on', x == tb)); d.el.querySelectorAll('.set-pane').forEach(p => p.hidden = p.dataset.pane != tb.dataset.tab); return; }
    const th = e.target.closest('[data-theme-pick]');
    if (th) {
      const t = THEMES.find(x => x[0] == th.dataset.themePick);
      P.theme = t[2]; P.sideTone = t[3]; saveP(); applyP();
      d.el.querySelectorAll('.pth').forEach(x => x.classList.toggle('on', x == th)); return;
    }
    const sb = e.target.closest('[data-pref] button');
    if (sb) {
      const key = sb.parentElement.dataset.pref; let v = sb.dataset.v; if (v == 'true') v = true; else if (v == 'false') v = false;
      P[key] = v; saveP(); applyP(); sb.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x == sb)); return;
    }
    const fs = e.target.closest('#fsSeg [data-d]');
    if (fs) { P.fs = Math.min(24, Math.max(13, P.fs + (+fs.dataset.d) * .5)); saveP(); applyP(); fs.parentElement.querySelector('b').textContent = P.fs; return; }
    const chip = e.target.closest('.jrow .chip'); if (chip) { chip.classList.toggle('on'); return; }
    if (e.target.closest('[data-jdel]')) { e.target.closest('.jrow').remove(); return; }
    const am = e.target.closest('#aiModel [data-m]');
    if (am) { await api('ai/settings', {body: {model: am.dataset.m}}); d.el.querySelectorAll('#aiModel button').forEach(x => x.classList.toggle('on', x == am)); toast('모델을 바꿨습니다'); return; }
    const id = e.target.id;
    if (id == 'jadd') {
      const i = d.el.querySelectorAll('.jrow').length;
      d.el.querySelector('#jlist').insertAdjacentHTML('beforeend', jrow({'이름': '', '폴더': '', '템플릿': '', '캘린더': []}, i));
      d.el.querySelector('#jlist .jrow:last-child input').focus();
    }
    if (id == 'saveS') {
      const vals = {}; d.el.querySelectorAll('[data-s]').forEach(i => vals[i.dataset.s] = i.value);
      vals['일기종류'] = [...d.el.querySelectorAll('.jrow')].map(r => {
        const g = k => r.querySelector(`[data-j="${k}"]`).value.trim();
        const name = g('이름');
        return {'이름': name, '폴더': g('폴더') || ('일기/' + name), '템플릿': g('템플릿'), '캘린더': [...r.querySelectorAll('.chip.on')].map(c => c.dataset.cal)};
      }).filter(j => j['이름']);
      try { const r = await api('settings', {body: vals}); S.settings = r.settings; S.journals = r.journals; toast('저장했습니다'); await loadState(); reopen('notes'); }
      catch (err) { toast(err.message); }
    }
    if (id == 'cpMcp') { await navigator.clipboard.writeText(mcp); toast('복사했습니다'); }
    if (id == 'cutClaude' && await confirmDlg('Claude 연결을 끊을까요?', '다시 쓰려면 claude.ai 에서 커넥터를 다시 연결해야 합니다.', '끊기', true)) { await api('claude/disconnect', {body: {}}); S.claude = []; reopen('link'); toast('끊었습니다'); }
    if (id == 'aiSave') {
      const key = d.el.querySelector('#aiKey').value.trim(); if (!key) return;
      e.target.disabled = true; e.target.textContent = '확인 중…';
      try { await api('ai/key', {body: {key}}); await loadState(); toast('키를 저장했습니다'); reopen('link'); }
      catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = '키 저장'; }
    }
    if (id == 'aiDel' && await confirmDlg('API 키를 지울까요?', '앱 안 AI 요약 단추가 사라집니다.', '지우기', true)) { await api('ai/key', {body: {key: ''}}); await loadState(); reopen('link'); }
    if (id == 'icSave') {
      const appleId = d.el.querySelector('#icId').value.trim(), pw = d.el.querySelector('#icPw').value.trim();
      if (!appleId || !pw) return toast('애플 ID 와 앱 전용 암호를 넣어 주세요');
      e.target.disabled = true; e.target.textContent = '연결 중…';
      try { const r = await api('icloud/connect', {body: {appleId, password: pw}}); toast(`캘린더 ${r.calendars.length}개를 찾았습니다`); await loadState(); loadEvents(); reopen('link'); }
      catch (err) { toast(err.message, 4000); e.target.disabled = false; e.target.textContent = '연결'; }
    }
    if (id == 'icDel' && await confirmDlg('iCloud 연결을 끊을까요?', '저장해 둔 앱 전용 암호를 지웁니다.', '끊기', true)) { await api('icloud/disconnect', {body: {}}); await loadState(); S.events = []; renderCal(); reopen('link'); }
    if (id == 'bkNow') { e.target.disabled = true; e.target.textContent = '백업 중…'; const r = await api('backup/now', {body: {}}); toast(`${r.name} (${r.count}개 파일)`); reopen('backup'); }
    if (id == 'bkAll') toast('게스트판에서는 내려받을 수 없어요');
    if (id == 'upChk') { await api('update/status', {query: {check: 1}}).catch(err => toast(err.message)); reopen('backup'); }
    if (id == 'upGo') {
      await saveNow();
      e.target.disabled = true; e.target.textContent = '받는 중…';
      try {
        const r = await api('update/apply', {body: {}});
        if (r.same) { toast('이미 최신입니다'); reopen('backup'); return; }
        e.target.textContent = '다시 켜는 중…';
        // 서버가 새 코드로 다시 뜰 때까지 기다렸다가 새로 고친다
        await sleep(4000);
        for (let i = 0; i < 60; i++) { await sleep(2000); try { const x = await fetch('/api/rev'); if (x.ok) { location.reload(); return; } } catch {} }
        toast('다시 켜지지 않았습니다. Portainer 에서 notes 확인', 6000);
      } catch (err) { toast(err.message, 5000); e.target.disabled = false; e.target.textContent = '업데이트 (10초 재시작)'; }
    }
    if (e.target.dataset.bk) location.href = '/api/backup/get?name=' + encodeURIComponent(e.target.dataset.bk);
    if (id == 'lo1') { await api('logout', {body: {}}); location.reload(); }
    if (id == 'myPw') {
      const old = await promptDlg('비밀번호 바꾸기', '지금 비밀번호', ''); if (!old) return;
      const nw = await promptDlg('비밀번호 바꾸기', '새 비밀번호 (6자 이상)', ''); if (!nw) return;
      try { await api('me/password', {body: {old, new: nw}}); toast('바꿨습니다'); } catch (err) { toast(err.message); }
    }
    if (id == 'naMake') {
      const body = {id: d.el.querySelector('#naId').value.trim(), name: d.el.querySelector('#naName').value.trim(), password: d.el.querySelector('#naPw').value};
      try { const r = await api('accounts/create', {body}); toast(`'${r.id}' 계정을 만들었습니다`); reopen('accounts'); } catch (err) { toast(err.message); }
    }
    const ar = e.target.dataset.accRn, ap = e.target.dataset.accPw, ad = e.target.dataset.accDel;
    if (ar) { const nm = await promptDlg('이름 바꾸기', ar + ' 의 보이는 이름', ''); if (nm) { await api('accounts/rename', {body: {id: ar, name: nm}}); reopen('accounts'); } }
    if (ap) { const pw = await promptDlg('비밀번호 새로 정하기', ap + ' 의 새 비밀번호', ''); if (pw) { try { await api('accounts/password', {body: {id: ap, password: pw}}); toast('바꿨습니다'); } catch (err) { toast(err.message); } } }
    if (ad && await confirmDlg(`'${ad}' 계정을 지울까요?`, '노트는 바로 지우지 않고 나스의 사용자/.지운계정 폴더로 옮겨 둡니다. 그 사람은 더 이상 들어올 수 없습니다.', '지우기', true)) {
      await api('accounts/delete', {body: {id: ad}}); toast('지웠습니다'); reopen('accounts');
    }
    if (id == 'loAll' && await confirmDlg('모든 기기에서 로그아웃', '회사·집·맥 전부 다시 비밀번호를 물어봅니다.', '로그아웃', true)) { await api('logout/all', {body: {}}); location.reload(); }
  });
}

// ── 가져오기 ───────────────────────────────────────────────────────────
function importDlg() {
  const d = dialog({title: '가져오기', cls: 'wide', body: `
    <div class="drop" id="drop">끌어 놓거나 눌러서 고르기<br><span style="font-size:12px">.bear2bk · .zip · .md · .txt</span></div>
    <input type="file" id="impIn" multiple accept=".bear2bk,.zip,.md,.markdown,.txt,.textbundle" hidden>
    <div class="field" style="margin-top:14px"><label>넣을 폴더</label><input type="text" id="impFolder" value="가져옴"></div>
    <div id="impLog" style="font-size:13px"></div>`});
  const drop = d.el.querySelector('#drop'), inp = d.el.querySelector('#impIn'), log = d.el.querySelector('#impLog');
  const run = async files => {
    for (const f of files) {
      const row = document.createElement('div'); row.textContent = f.name + ' · 들여오는 중…'; log.appendChild(row);
      try {
        const r = await api('import', {query: {name: f.name, folder: d.el.querySelector('#impFolder').value}, raw: f});
        row.textContent = `${f.name} · 노트 ${r.notes}개 · 첨부 ${r.files}개` + (r.skipped.length ? ` · 휴지통이라 건너뜀 ${r.skipped.length}개` : '');
      } catch (e) { row.textContent = f.name + ' · 실패: ' + e.message; }
    }
    await loadState();
  };
  drop.onclick = () => inp.click();
  inp.onchange = () => run([...inp.files]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); run([...e.dataTransfer.files]); };
}

// ── 도움말 ─────────────────────────────────────────────────────────────
function helpDlg() {
  const K = k => `<kbd data-k="${k}"></kbd>`;
  const faq = [
    ['처음에 무엇부터?', `<b>새 노트</b>로 쓰기 시작하면 됩니다. 제목 칸이 파일 이름이고, 본문은 마크다운입니다. 쓰는 동안 자동으로 저장되고, 다른 기기는 몇 초 안에 받아 갑니다.<br>
      <b>오늘 일기</b>(${K('alt+D')} 또는 달력의 날짜)는 달력 위에서 고른 종류(회사·블로그)의 폴더에 날짜 이름으로 만들어집니다.`],
    ['회사 일기 · 블로그 일기', `· 달력 위 <b>회사 | 블로그</b> 로 고른 뒤 날짜를 누르면 그 종류의 일기가 열립니다. 날짜 밑 점 색이 종류입니다(빨강 회사, 파랑 블로그, 회색 iCloud 일정).<br>
      · 왼쪽 '일기' 묶음에서 종류별로 모아 봅니다. 종류 더하기·빼기·폴더·틀은 설정 → 노트·일기.<br>
      · 틀은 템플릿 폴더의 노트를 고르면 됩니다(없으면 기본 틀). 틀 안의 <code>{{일정}}</code> 자리에는 iCloud 일정이 들어갑니다.`],
    ['iCloud 캘린더 붙이기', `1. <b>account.apple.com</b> → 로그인 및 보안 → <b>앱 전용 암호</b> → 이름 '노트' 로 만들기(애플 비밀번호 자체는 넣지 않습니다).<br>
      2. 설정 → 연결 → iCloud 캘린더에 애플 ID 와 그 암호를 넣고 [연결].<br>
      3. 설정 → 노트·일기에서 일기 종류마다 짝지을 캘린더를 고르면(예: 회사 일기 ↔ '회사' 캘린더) 그 일정만 일기에 들어갑니다.<br>
      달력 아래에 고른 날의 일정이 보입니다(읽기만, 5분마다 새로 받음). 끊으려면 설정의 [연결 끊기] 또는 애플 쪽에서 그 앱 전용 암호를 지우면 됩니다.`],
    ['앱 안 AI 요약 (Max 월 API 크레딧)', `· Max 요금제에는 매달 API 크레딧이 들어옵니다(Max 5x $100, Max 20x $200, 다음 달로 안 넘어감).<br>
      · claude.ai → 설정 → 결제 → <b>API 크레딧</b>에서 Console 조직을 연결 → platform.claude.com 에서 API 키를 만들어 설정 → 연결 → Claude API 에 넣습니다.<br>
      · 그러면 노트 위 <b>AI 요약</b>, 일기 목록 위 <b>AI 주간 요약 · AI 월간 요약</b> 단추가 생깁니다. 누를 때만 돌고, 이번 달 쓴 양은 설정에 나옵니다.<br>
      · 회고는 '일기/회사/회고' 처럼 그 종류 폴더 아래에 새 노트로 남습니다.`],
    ['베어처럼 쓰는 법', `· <code>* </code> <code>- </code> 를 치면 바로 글머리, <kbd>Tab</kbd> · <kbd>⇧Tab</kbd> 으로 단계 조절, 빈 항목에서 엔터는 한 단계씩 빠져나오기, <kbd>⇧⏎</kbd> 는 항목 안 줄바꿈.<br>
      · 번호는 <code>1.</code> 과 <code>0)</code> 둘 다. 하위 항목은 베어 파일처럼 윗 항목 글 시작 칸에 맞춰 띄어 씁니다.<br>
      · <code># </code> 는 숨고 쓰는 줄 왼쪽에 H1 이 보입니다. <code>~밑줄~</code>(<kbd>⌘U</kbd>)도 베어와 같습니다.<br>
      · 서식 단추는 화면 아래 가운데 막대에 있습니다.<br>
      · <code>#태그</code>, <code>#상위/하위</code>, 빈칸 있는 태그는 <code>#여러 단어#</code><br>
      · 커서가 없는 줄은 기호가 숨고 모양만 남습니다(바로 보기). 설정에서 끌 수 있습니다.<br>
      · <b>고정</b>은 목록 맨 위, <b>보관</b>은 목록·태그에서 빼 두기, <b>휴지통</b>은 되살릴 수 있습니다.<br>
      · 할 일 <code>- [ ]</code> 이 남은 노트는 왼쪽 '할 일'에 모입니다.<br>
      · <code>==형광펜==</code> · <code>~~취소선~~</code> · 사진은 붙여 넣거나 끌어 놓기.`],
    ['옵시디언처럼 쓰는 법', `· <code>[[노트 이름]]</code> 으로 잇기. <code>[[</code> 만 쳐도 목록이 뜹니다. <code>[[노트#제목]]</code>, <code>[[노트|보일 말]]</code>도 됩니다.<br>
      · <code>![[노트]]</code> 는 그 노트를 끼워 넣어 보여 줍니다.<br>
      · <b>정보 → 백링크</b>: 이 노트를 가리키는 노트, 이름만 나오는 노트(누르면 링크 걸기).<br>
      · 노트 이름을 바꾸면 다른 노트의 링크도 같이 고칩니다.<br>
      · <b>그래프</b>, <b>폴더</b>, <b>템플릿</b>(템플릿 폴더의 노트, <code>{{date}}</code> <code>{{time}}</code> <code>{{title}}</code> <code>{{요일}}</code>), 콜아웃 <code>&gt; [!note] 제목</code>.<br>
      · 보관함 폴더는 그냥 .md 파일이라 옵시디언으로 그대로 열립니다.`],
    ['단축키', `<table>
      <tr><td>${K('alt+N')}</td><td>새 노트</td></tr><tr><td>${K('alt+D')}</td><td>오늘 일기</td></tr>
      <tr><td>${K('mod+O')}</td><td>빠른 열기 (없으면 만들기)</td></tr><tr><td>${K('mod+P')}</td><td>명령 찾기</td></tr>
      <tr><td>${K('mod+shift+F')}</td><td>모든 노트에서 찾기</td></tr><tr><td>${K('mod+F')}</td><td>이 노트에서 찾기·바꾸기</td></tr>
      <tr><td>${K('mod+E')}</td><td>읽기 ↔ 편집</td></tr><tr><td>${K('mod+\\')}</td><td>집중 모드</td></tr><tr><td>${K('ctl+1')} ${K('ctl+2')} ${K('ctl+3')}</td><td>편집기만 · 노트 및 편집기 · 태그까지 모두</td></tr>
      <tr><td>${K('mod+B')} ${K('mod+I')}</td><td>굵게 · 기울임</td></tr><tr><td>${K('mod+shift+H')}</td><td>형광펜</td></tr>
      <tr><td>${K('mod+shift+X')}</td><td>취소선</td></tr><tr><td>${K('mod+K')}</td><td>링크</td></tr>
      <tr><td>${K('mod+U')}</td><td>밑줄</td></tr><tr><td>Tab · ⇧Tab</td><td>들여쓰기 · 내어쓰기</td></tr>
      <tr><td>${K('mod+Enter')}</td><td>할 일 칸 만들기·체크</td></tr><tr><td>${K('mod+1')}~${K('mod+6')}</td><td>제목 1~6</td></tr>
      <tr><td>링크 위 ${K('mod+')}누르기</td><td>쓰는 줄에서도 링크 열기</td></tr></table>`],
    ['찾기 검색어', `<table>
      <tr><td>낱말 낱말</td><td>둘 다 들어 있는 노트</td></tr><tr><td>"붙은 말"</td><td>그대로 붙어 있는 것</td></tr>
      <tr><td>-낱말</td><td>빼기</td></tr><tr><td>#태그</td><td>태그(하위 포함)</td></tr><tr><td>folder:폴더</td><td>폴더 안</td></tr>
      <tr><td>@todo / @done</td><td>할 일 남음 / 끝낸 할 일</td></tr><tr><td>@today @yesterday @last7days</td><td>기간</td></tr>
      <tr><td>@date(2026-10)</td><td>그 달(또는 날)</td></tr><tr><td>@pinned @untagged @tagged @images</td><td>고정 · 태그 없음 · 태그 있음 · 사진 있음</td></tr>
      <tr><td>@archived</td><td>보관함까지</td></tr></table>왼쪽에서 고른 곳(폴더·태그) 안에서 찾습니다.`],
    ['Claude 에게 요약·일기 맡기기', `1. 설정 → Claude 연결의 <b>커넥터 주소</b>를 복사합니다.<br>
      2. claude.ai → 설정 → 커넥터 → <b>사용자 지정 커넥터 추가</b> → 이름 '노트', 주소 붙여 넣기.<br>
      3. [연결]을 누르면 노트 로그인 창이 뜹니다 → 비밀번호 → <b>허락</b>.<br>
      그 뒤로는 어느 대화에서든 "이번 주 일기 요약해줘", "10월 일기로 회고 써줘", "오늘 일기에 이거 덧붙여줘", "#블로그 노트에서 글감 뽑아줘" 처럼 말하면 됩니다.
      Claude 가 고친 것도 버전 기록에 남습니다. 끊으려면 설정의 [연결 끊기].`],
    ['여러 기기에서 같이 쓸 때', `· 몇 초마다 다른 기기의 변경을 받아 옵니다. 같은 노트를 두 곳에서 동시에 고치면 '먼저 고쳤어요' 창이 떠서 고를 수 있습니다(둘 다 두기도 됨).<br>
      · 인터넷이 끊겨도 계속 쓸 수 있습니다. 이 기기에 보관했다가 다시 닿으면 보냅니다.<br>
      · 주소창의 <b>앱 설치</b>(크롬·엣지) 또는 사파리 <b>파일 → Dock에 추가</b>로 앱처럼 띄울 수 있습니다. 아이폰은 공유 → 홈 화면에 추가.`],
    ['기록·백업·되살리기', `· <b>정보 → 기록</b>: 고치기 전 내용이 노트마다 200판까지 남습니다(같은 기기에서 연달아 고치면 10분에 한 번).<br>
      · <b>휴지통</b>: 비우기 전까지 되살릴 수 있습니다.<br>
      · <b>백업</b>: 나스가 날마다 새벽 4시에 전체를 zip 으로 남깁니다. 14일은 날마다, 그 뒤로는 달마다 한 장씩 12달.`],
    ['프로그램 업데이트', `· 새 판이 나오면 왼쪽 아래 단추가 <b>설정 · 새 판</b> 으로 바뀝니다. 설정 → 백업·업데이트 → <b>[업데이트]</b> 를 누르면 10초 동안 다시 켜집니다(회사·집 어디서든).<br>
      · 안 눌러도 새벽 3~5시에 알아서 받습니다. 쓰던 노트는 화면이 다시 붙으면 이어서 저장되니 잃지 않습니다.<br>
      · 주인 계정에만 보입니다. 나스 Portainer 스택으로 띄웠을 때만 켜집니다.`],
    ['베어·옵시디언에서 옮겨 오기', `· <b>베어</b>: 설정 → 일반 → <b>노트 백업</b>으로 만든 .bear2bk 를 [가져오기]에 끌어 놓습니다. 태그·고정·보관·만든 날·사진이 그대로 옵니다(휴지통 노트는 건너뜀).<br>
      · <b>옵시디언</b>: 보관함 폴더를 zip 으로 묶어 끌어 놓거나, 나스의 보관함 폴더에 그대로 복사해 넣어도 됩니다(몇 초 안에 목록에 뜹니다).`],
  ];
  dialog({title: '도움말', cls: 'wide', body: '<p class="pad" style="margin:0 0 8px"><a class="btn" href="guide.html" target="_blank" rel="noopener">설명서 전체 보기</a></p><div class="faq">' + faq.map(([q, a], i) => `<details${i == 0 ? ' open' : ''}><summary>${q}</summary><div>${a}</div></details>`).join('') + '</div>'});
}

// ── 명령·단축키 ────────────────────────────────────────────────────────
const hasNote = () => !!S.cur;
const COMMANDS = () => [
  {name: '새 노트', key: 'alt+N', run: () => newNote()},
  {name: '오늘 일기 (달력에서 고른 종류)', key: 'alt+D', run: () => openDaily(ymd(new Date()))},
  ...(S.journals || []).map(j => ({name: `오늘 ${j['이름']} 일기`, run: () => openDaily(ymd(new Date()), j['이름'])})),
  {name: '어제 일기', run: () => { const d = new Date(); d.setDate(d.getDate() - 1); openDaily(ymd(d)); }},
  {name: '내일 일기', run: () => { const d = new Date(); d.setDate(d.getDate() + 1); openDaily(ymd(d)); }},
  {name: '빠른 열기', key: 'mod+O', run: () => switcher()},
  {name: '오늘 날짜 넣기', when: () => S.cur, run: () => NE.cmd.insert(ED.view, todayText())},
  {name: '각주 넣기', when: () => S.cur, run: () => NE.cmd.footnote(ED.view)},
  {name: '선택한 글로 새 노트', when: () => S.cur, run: () => noteFromSelection()},
  {name: '다른 노트와 합치기', when: () => S.cur, run: () => mergeDlg()},
  {name: '읽기 전용 켜기·끄기', when: () => S.cur, run: () => setReadonly(S.cur.path, !S.by.get(S.cur.path)?.readonly)},
  {name: '모든 노트에서 찾기', key: 'mod+shift+F', run: () => focusSearch()},
  {name: '읽기 ↔ 편집', key: 'mod+E', when: hasNote, run: () => setReading(!P.reading)},
  {name: '집중 모드', key: 'mod+\\', run: () => $('#tFocus').click()},
  ...LAYOUTS.map(([n, l]) => ({name: l, key: 'ctl+' + n, when: () => !isPhone(), run: () => setLayout(n)})),
  {name: '고정 / 고정 풀기', when: hasNote, run: () => $('#tPin').click()},
  {name: '보관 / 꺼내기', when: hasNote, run: () => $('#tArchive').click()},
  {name: '다른 폴더로 옮기기', when: hasNote, run: () => moveDlg()},
  {name: '휴지통으로', when: hasNote, run: () => $('#tTrash').click()},
  {name: '템플릿 넣기', when: hasNote, run: () => templateDlg()},
  {name: '내보내기', when: hasNote, run: () => exportDlg()},
  {name: '개요 보기', when: hasNote, run: () => { P.tab = 'outline'; togglePanel(true); }},
  {name: '백링크 보기', when: hasNote, run: () => { P.tab = 'links'; togglePanel(true); }},
  {name: '기록 보기', when: hasNote, run: () => { P.tab = 'history'; togglePanel(true); }},
  {name: '그래프', run: () => graphDlg()},
  {name: 'AI 요약 (이 노트)', when: () => hasNote() && S.ai && S.ai.ready, run: () => aiSummary()},
  {name: 'AI 주간 회고 (지금 일기 종류)', when: () => S.ai && S.ai.ready && S.journals.length, run: () => aiJournal('week', journal()['이름'])},
  {name: 'AI 월간 회고 (지금 일기 종류)', when: () => S.ai && S.ai.ready && S.journals.length, run: () => aiJournal('month', journal()['이름'])},
  {name: '새 폴더', run: () => newFolder()},
  {name: '가져오기 (베어·옵시디언)', run: () => importDlg()},
  {name: '설정', run: () => settingsDlg()},
  {name: '도움말', run: () => helpDlg()},
  {name: '앱으로 설치', run: () => installDlg()},
  {name: '밝게 / 어둡게 바꾸기', run: () => { P.theme = (P.theme == 'dark' || (P.theme == 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)) ? 'light' : 'dark'; saveP(); applyP(); }},
  {name: '왼쪽 모아보기 보이기 / 숨기기', run: () => { P.side = !P.side; saveP(); applyP(); }},
];
function askClaude(q) {
  const w = 460, h = Math.min(820, screen.availHeight - 80);
  const left = Math.max(0, Math.min(screenX + outerWidth - w - 20, screen.availWidth - w)), top = screenY + 40;
  window.open('https://claude.ai/new?q=' + encodeURIComponent(q + '\n\n이게 뭔지 짧게 알려 줘'), 'claude-ask', `popup,width=${w},height=${h},left=${left},top=${top}`);
}
function focusSearch() { if (isPhone()) setPane('list'); setView({kind: 'all'}); showFind(true); }

document.addEventListener('keydown', e => {
  if (document.querySelector('.scrim')) return;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const k = e.code;
  if (e.altKey && !mod && k == 'KeyN') { e.preventDefault(); newNote(); }
  else if (e.altKey && !mod && k == 'KeyD') { e.preventDefault(); openDaily(ymd(new Date())); }
  else if (mod && !e.shiftKey && k == 'KeyO') { e.preventDefault(); switcher(); }
  else if (mod && !e.shiftKey && k == 'KeyP') { e.preventDefault(); palette(); }
  else if (mod && e.shiftKey && k == 'KeyF') { e.preventDefault(); focusSearch(); }
  else if (mod && !e.shiftKey && k == 'KeyE' && S.cur) { e.preventDefault(); setReading(!P.reading); }
  else if (mod && k == 'Backslash') { e.preventDefault(); $('#tFocus').click(); }
  else if (mod && k == 'KeyS') { e.preventDefault(); saveNow(); }
  else if (/^Digit[123]$/.test(k) && !e.shiftKey && (isMac ? e.ctrlKey && !e.metaKey && !e.altKey : e.ctrlKey && e.altKey) && !isPhone()) { e.preventDefault(); setLayout(+k.slice(5)); }
});

// ── 폰: 칸 넘기기 (뒤로 가기 몸짓도 받는다) ───────────────────────────────
const PANE_ORDER = ['side', 'list', 'main', 'panel'];
function tintTop() {
  if (!matchMedia('(pointer: coarse)').matches || !isPhone()) return;
  const el = $('#app > .' + $('#app').dataset.pane); if (!el) return;
  const c = getComputedStyle(el).backgroundColor;
  document.documentElement.style.backgroundColor = c;
  $('meta[name="theme-color"]').setAttribute('content', c);
}
let paneWant = null;
function setPane(p, fromPop) {
  const app = $('#app'), cur = app.dataset.pane;
  if (cur == p) return;
  const back = PANE_ORDER.indexOf(p) < PANE_ORDER.indexOf(cur), st = history.state || {};
  if (!fromPop && back && st.pushed) { paneWant = p; history.back(); return; }
  app.dataset.pane = p;
  if (p == 'panel') { $('#panel').hidden = false; renderPanel(); }
  if (!fromPop && !back) history.pushState({...st, pane: p, pushed: true}, '', location.hash);
  else if (!st.pushed) history.replaceState({...st, pane: p}, '', location.hash);
  tintTop();
}
window.addEventListener('popstate', () => {
  if (isPhone()) {
    saveNow();
    const want = paneWant || (history.state && history.state.pane), i = PANE_ORDER.indexOf($('#app').dataset.pane);
    paneWant = null;
    setPane(want || PANE_ORDER[Math.max(0, i - 1)], true);
    return;
  }
  // PC: 주소의 노트로 돌아간다(뒤로·앞으로 모두)
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (h && S.by.has(h) && (!S.cur || S.cur.path != h)) openNote(h, {fromPop: true});
});
$$('[data-pane-go]').forEach(b => b.onclick = () => { saveNow(); setPane(b.dataset.paneGo); });
$('#list').addEventListener('click', e => {
  if (isPhone() && $('#app').dataset.pane == 'side') { e.preventDefault(); e.stopPropagation(); setPane('list'); }
}, true);
$('#app').addEventListener('click', e => { if (e.target.id == 'app' && $('#app').dataset.pane == 'panel') setPane('main'); });
{
  let sx = 0, sy = 0;
  $('#side').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive: true});
  $('#side').addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (isPhone() && dx < -60 && Math.abs(dy) < Math.abs(dx) * .6) setPane('list');
  }, {passive: true});
}
if (window.visualViewport) {
  const kb = () => { const v = visualViewport; document.documentElement.style.setProperty('--kb', Math.max(0, innerHeight - v.height - v.offsetTop) + 'px'); };
  visualViewport.addEventListener('resize', kb); visualViewport.addEventListener('scroll', kb);
}
if (isPhone()) {
  const st = history.state || {}, p = $('#app').dataset.pane;
  if (st.pushed) history.replaceState({...st, pane: p}, '', location.hash);
  else { history.replaceState({...st, pane: 'side'}, '', location.hash); history.pushState({...st, pane: p, pushed: true}, '', location.hash); }
  tintTop();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(tintTop, 50));
$('#bSideT').onclick = () => $('#app').classList.toggle('side-open');
document.addEventListener('mousedown', e => {
  if ($('#app').classList.contains('side-open') && !e.target.closest('.side') && !e.target.closest('#bSideT')) $('#app').classList.remove('side-open');
});

// ── 칸 너비 끌어서 조절 ────────────────────────────────────────────────
const PANE_W = {side: {v: '--side-w', min: 180, max: 420, def: 236}, list: {v: '--list-w', min: 220, max: 600, def: 300}};
function loadPaneW() {
  for (const [k, c] of Object.entries(PANE_W)) {
    let w = null; try { w = +localStorage.getItem('notes.w.' + k); } catch {}
    if (w >= c.min && w <= c.max) $('#app').style.setProperty(c.v, w + 'px');
  }
}
for (const [k, c] of Object.entries(PANE_W)) {
  const host = $('#' + k), r = document.createElement('div');
  r.className = 'resizer'; r.setAttribute('aria-hidden', 'true'); host.appendChild(r);
  r.addEventListener('mousedown', e => {
    if (e.button != 0) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = host.getBoundingClientRect().width;
    r.classList.add('on'); document.body.classList.add('resizing');
    const move = ev => {
      ev.preventDefault();
      const w = Math.round(Math.min(c.max, Math.max(c.min, w0 + ev.clientX - x0)));
      $('#app').style.setProperty(c.v, w + 'px');
    };
    const up = () => {
      document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true);
      r.classList.remove('on'); document.body.classList.remove('resizing');
      try { localStorage.setItem('notes.w.' + k, Math.round(host.getBoundingClientRect().width)); } catch {}
    };
    document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
  });
  r.addEventListener('dblclick', () => {
    $('#app').style.removeProperty(c.v);
    try { localStorage.removeItem('notes.w.' + k); } catch {}
  });
}
loadPaneW();

// ── 앱으로 설치 ────────────────────────────────────────────────────────
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { installEvt = null; toast('앱으로 설치했습니다'); });
function deviceInfo() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const os = ios ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'win' : /Macintosh/.test(ua) ? 'mac' : 'other';
  const br = /Whale\//.test(ua) ? '웨일' : /Edg\//.test(ua) ? '엣지' : /(Chrome|CriOS)\//.test(ua) ? '크롬' : /Safari\//.test(ua) ? '사파리' : '브라우저';
  const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return {os, br, app};
}
const INSTALL_STEPS = {
  'mac-사파리': ['메뉴 막대 <b>파일</b> → <b>Dock에 추가…</b>', '<b>추가</b>를 누르면 Dock 에 노트 아이콘이 생깁니다'],
  'mac': ['주소창 오른쪽 끝의 <b>앱 설치</b> 아이콘(모니터에 ↓)', '<b>설치</b> → Dock 에 아이콘이 생깁니다', '아이콘이 없으면 브라우저 메뉴(⋮)에서 <b>앱 설치</b>'],
  'win': ['주소창 오른쪽 끝의 <b>앱 설치</b> 아이콘', '<b>설치</b> → 시작 메뉴에 \'뮤직잇츠 노트\'가 생깁니다', '그 아이콘을 우클릭 → <b>작업 표시줄에 고정</b>'],
  'ios': ['사파리 아래 <b>공유</b> 단추(□↑)', '<b>홈 화면에 추가</b> → <b>추가</b>'],
  'android': ['크롬 오른쪽 위 <b>⋮</b>', '<b>앱 설치</b>(또는 홈 화면에 추가) → <b>설치</b>'],
};
const OS_NAME = {mac: '맥', win: '윈도우', ios: '아이폰·아이패드', android: '안드로이드', other: '이 기기'};
function stepsFor(os, br) { return INSTALL_STEPS[os + '-' + br] || INSTALL_STEPS[os] || INSTALL_STEPS.mac; }
function stepList(list) { return '<ol class="ins-steps">' + list.map(x => `<li>${x}</li>`).join('') + '</ol>'; }
function installDlg() {
  const dv = deviceInfo();
  const here = OS_NAME[dv.os] + (dv.os == 'mac' || dv.os == 'win' ? ' · ' + dv.br : '');
  const others = ['mac', 'win', 'ios', 'android'].filter(o => o != dv.os);
  const insecure = location.protocol == 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const body = `
    <div class="ins-top">
      <img class="ins-icon" src="/icon-maskable-512.png?v=2" alt="">
      <div><div class="ins-name">뮤직잇츠 노트</div></div>
    </div>
    ${insecure ? `<div class="ins-warn">이 주소(http)에서는 브라우저가 설치를 막습니다.<a class="btn primary" href="https://notes.musicits.com/" target="_blank" rel="noopener">notes.musicits.com 에서 설치</a></div>` : ''}
    ${dv.app ? '<div class="ins-done">지금 앱으로 쓰고 있습니다</div>' : insecure ? '' : installEvt
      ? `<button class="btn primary ins-go" id="insGo">이 기기에 설치</button><div class="ins-here">${esc(here)}</div>`
      : `<div class="ins-card"><div class="ins-h">${esc(here)}</div>${stepList(stepsFor(dv.os, dv.br))}</div>`}
    <details class="ins-more"><summary>다른 기기</summary>
      ${others.map(o => `<div class="ins-card"><div class="ins-h">${OS_NAME[o]}</div>${stepList(stepsFor(o, o == 'mac' ? '크롬' : ''))}</div>`).join('')}
    </details>
    <div class="ins-addr"><span>주소</span><code>notes.musicits.com</code></div>`;
  const d = dialog({title: '앱으로 설치', body, cls: 'ins'});
  const go = d.el.querySelector('#insGo');
  if (go) go.onclick = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    if (r && r.outcome == 'accepted') { installEvt = null; d.close(); }
  };
}
$('#bBrand').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  ctxMenu(r.left, r.bottom + 6, [
    {label: '앱으로 설치…', run: () => installDlg()},
    {label: '가져오기…', run: () => importDlg()},
    {label: '그래프', run: () => graphDlg()},
    '-',
    {label: '도움말', run: () => helpDlg()},
    {label: '환경설정…', run: () => settingsDlg()},
    '-',
    {label: '로그아웃', run: async () => { if (await confirmDlg('로그아웃', '이 기기에서 로그아웃합니다.', '로그아웃')) { await api('logout', {body: {}}); location.reload(); } }},
  ]);
};
$('#bPrefs').onclick = () => settingsDlg();
$('#bSync').onclick = () => settingsDlg('backup');

$('#bGraph').onclick = () => graphDlg();
$('#bImport').onclick = () => importDlg();
$('#bSettings').onclick = () => settingsDlg();
$('#bHelp').onclick = () => helpDlg();

// ── 시작 ───────────────────────────────────────────────────────────────
(async function start() {
  fillKbd();
  makeEditor();
  applyP();
  setReading(false);
  if (P.panel && !isPhone()) { $('#panel').hidden = false; }
  try { await loadState(); }
  catch (e) {
    const c = (() => { try { return JSON.parse(localStorage.getItem('notes.state')); } catch { return null; } })();
    if (!c) { toast('서버에 닿지 못했습니다'); return; }
    S.rev = c.rev; S.notes = c.notes; S.folders = c.folders; S.tags = c.tags; S.settings = c.settings; S.order = c.order || {folders: [], tags: [], locked: true}; S.by = new Map(S.notes.map(n => [n.path, n]));
    renderSide(); renderList(); setOnline(false);
  }
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (h && S.by.has(h)) openNote(h, {first: true});
  else if (!isPhone() && S.notes.length) { const first = viewNotes()[0]; if (first) openNote(first.path, {first: true}); }
  renderTools(); renderPanel(); loadEvents();
  setTimeout(() => { if (!prefsData && !prefsLoading) loadPrefsData(); }, 800);
  if ('serviceWorker' in navigator) void 0;
})();
