// ═══════════════════════════════════════════════════════════
// 뜨온 — App Logic
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  const State = {
    view: 'home',
    studentName: localStorage.getItem('tt_studentName') || '',
    level: parseInt(localStorage.getItem('tt_level') || '3', 10),
    fnFilter: '전체',
    title: '',
    sentences: [],
    currentTemplate: null,
    currentStoryId: null,
    tts: {
      rate: parseFloat(localStorage.getItem('tt_ttsRate') || '0.9'),
      voiceURI: localStorage.getItem('tt_voiceURI') || '',
    },
  };

  // ── Storage helpers ──────────────────────────────────────
  const LS = {
    stories() { try { return JSON.parse(localStorage.getItem('tt_stories')) || []; } catch { return []; } },
    saveStories(arr) { localStorage.setItem('tt_stories', JSON.stringify(arr)); },
  };

  // ── DOM helpers ──────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const h = (tag, attrs, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(c));
    }
    return el;
  };

  function mount(parent, ...kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      parent.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const day = 86400000;
    const diff = Math.floor((now - d) / day);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff < 7) return diff + '일 전';
    return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ── Action sheet ─────────────────────────────────────────
  function openSheet(title, items) {
    const host = $('#sheet'); host.hidden = false;
    host.innerHTML = '';
    const sheet = h('div', { class: 'sheet', onclick: (e) => e.stopPropagation() },
      h('div', { class: 'sheet-grab' }),
      title ? h('div', { class: 'sheet-title' }, title) : null,
      ...items.map((it) =>
        h('button', { class: 'sheet-item' + (it.danger ? ' danger' : ''), onclick: () => { closeSheet(); it.onClick && it.onClick(); } },
          it.icon ? h('span', { class: 'si-ico', style: { background: it.iconBg || 'var(--pri-soft)', color: it.iconColor || 'var(--pri-d)' } }, it.icon) : null,
          h('div', null, h('div', { style: { fontWeight: 700, fontSize: '14px' } }, it.label), it.sub ? h('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '2px' } }, it.sub) : null)
        )
      )
    );
    host.appendChild(sheet);
    host.onclick = closeSheet;
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }

  // ── TTS ──────────────────────────────────────────────────
  const TTS = {
    available: 'speechSynthesis' in window,
    voices: [],
    init() {
      if (!this.available) return;
      const load = () => { this.voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ko')); };
      load();
      speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', load);
    },
    pickVoice() {
      if (!this.voices.length) return null;
      if (State.tts.voiceURI) {
        const found = this.voices.find((v) => v.voiceURI === State.tts.voiceURI);
        if (found) return found;
      }
      return this.voices[0];
    },
    speak(text, opts = {}) {
      if (!this.available || !text) return Promise.resolve();
      return new Promise((resolve) => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        u.rate = State.tts.rate;
        const v = this.pickVoice();
        if (v) u.voice = v;
        u.onend = resolve;
        u.onerror = resolve;
        if (opts.onStart) u.onstart = opts.onStart;
        speechSynthesis.speak(u);
      });
    },
    stop() { if (this.available) speechSynthesis.cancel(); },
  };

  // ── SVG icon set ────────────────────────────────────────
  const I = {
    back: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M5 5h11l3 3v11H5zM9 5v5h7V5M9 19v-5h7v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M4 12v7h16v-7M12 3v13M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8c1.5 1 1.5 7 0 8M18 6c3 2 3 10 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10v6M12 7v.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 16V5a1 1 0 0 1 1-1h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  // ── Renderers ────────────────────────────────────────────
  function setView(name, opts) {
    State.view = name;
    $$('#tabbar .tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    // editor tab maps to "templates" highlight when no story yet (so the + makes sense)
    if (name === 'editor' && !State.sentences.length) {
      $$('#tabbar .tab').forEach((b) => b.classList.toggle('active', b.dataset.view === 'editor'));
    }
    const render = VIEWS[name];
    if (render) render(opts || {});
    window.scrollTo({ top: 0 });
  }

  const VIEWS = {};

  // ── HOME view ────────────────────────────────────────────
  VIEWS.home = function () {
    const view = $('#view');
    const stories = LS.stories();
    const recent = stories.slice().reverse().slice(0, 5);

    // Stats
    const total = stories.length;
    const types = { desc: 0, persp: 0, coach: 0, affirm: 0 };
    stories.forEach((s) => s.sentences.forEach((x) => { if (types[x.type] !== undefined) types[x.type]++; }));
    const totalSent = Object.values(types).reduce((a, b) => a + b, 0);

    const quick = TEMPLATES.filter((t) => ['wait-turn', 'ask-help', 'transition', 'attention-seeking'].includes(t.id));

    view.innerHTML = '';
    mount(view,
      // brand header
      h('header', { class: 'appbar' },
        h('div', { class: 'brand' },
          h('span', { class: 'brand-mark' }),
          h('span', { class: 'brand-name' }, '뜨', h('em', null, '온')),
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'appbar-back', 'aria-label': '설정', onclick: () => setView('more') },
          el(I.settings),
        ),
      ),

      // hero
      h('section', { class: 'hero' },
        h('h3', null, '오늘 함께 읽을 이야기를 만들어요.'),
        h('p', null, 'Carol Gray Social Stories™ 10.4 기준으로 자동 안내합니다.'),
        h('button', { class: 'hero-cta', onclick: () => setView('templates') },
          '새 이야기 만들기 ',
          el(I.arrow),
        ),
      ),

      // stats
      h('div', { class: 'stat-card' },
        h('div', { class: 'stat-cell' }, h('div', { class: 'stat-num' }, String(total)), h('div', { class: 'stat-lbl' }, '저장된 이야기')),
        h('div', { class: 'stat-cell' }, h('div', { class: 'stat-num' }, String(totalSent)), h('div', { class: 'stat-lbl' }, '전체 문장')),
        h('div', { class: 'stat-cell' }, h('div', { class: 'stat-num' }, String(types.coach)), h('div', { class: 'stat-lbl' }, '코칭문')),
      ),

      // recent stories
      recent.length ?
        h('div', null,
          h('div', { class: 'section-head' },
            h('h2', null, '최근 이야기'),
            h('button', { class: 'more', onclick: () => setView('library') }, '전체 보기 ›'),
          ),
          h('div', { class: 'h-scroll' },
            ...recent.map((s) =>
              h('button', { class: 'recent-card', onclick: () => loadStory(s.id) },
                h('div', { class: 'rc-title' }, s.title),
                h('div', { class: 'rc-snip' }, (s.sentences[0] && s.sentences[0].text) || '(빈 이야기)'),
                h('div', { class: 'rc-meta' },
                  h('span', null, formatDate(s.date)),
                  h('span', { class: 'dot' }),
                  h('span', null, s.sentences.length + '문장'),
                ),
              )
            ),
          ),
        ) : null,

      // quick templates
      h('div', { class: 'section-head' },
        h('h2', null, '자주 쓰는 템플릿'),
        h('button', { class: 'more', onclick: () => setView('templates') }, '전체 보기 ›'),
      ),
      h('div', { class: 'quick-grid' },
        ...quick.map((t) =>
          h('button', { class: 'quick-card', onclick: () => { State.currentTemplate = t; pickTemplate(t.id); } },
            h('div', { class: 'qc-ico' }, t.icon),
            h('div', { class: 'qc-name' }, t.name),
            h('div', { class: 'qc-desc' }, t.desc),
          )
        ),
      ),

      h('div', { style: { height: '24px' } }),
    );
  };

  // helper — parse svg string into a node
  function el(svgStr) {
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    span.innerHTML = svgStr;
    return span;
  }

  // ── TEMPLATES view ───────────────────────────────────────
  VIEWS.templates = function () {
    const view = $('#view');
    const filtered = State.fnFilter === '전체'
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.fn.includes(State.fnFilter));

    view.innerHTML = '';
    mount(view,
      h('header', { class: 'appbar' },
        h('div', null,
          h('div', { class: 'appbar-title' }, '템플릿 선택'),
          h('div', { class: 'appbar-sub' }, '14개 상황 + 빈 양식'),
        ),
      ),

      h('div', { class: 'tmpl-tools' },
        h('div', { class: 'field' },
          h('label', null, '학생 이름 (이야기 속 주인공)'),
          h('input', {
            class: 'input', type: 'text', placeholder: '예: 민준이, ○○',
            value: State.studentName,
            oninput: (e) => { State.studentName = e.target.value; localStorage.setItem('tt_studentName', e.target.value); },
          }),
        ),
        h('div', { class: 'field' },
          h('label', null, '수준 선택'),
          h('div', { class: 'seg' },
            ...[1, 2, 3].map((lv) =>
              h('button', {
                class: State.level === lv ? 'on' : '',
                onclick: () => { State.level = lv; localStorage.setItem('tt_level', String(lv)); VIEWS.templates(); },
              },
                lv === 1 ? '🖼 그림중심' : lv === 2 ? '📝 짧은문장' : '📖 완전문장'
              )
            ),
          ),
          h('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)', padding: '4px 2px 0', lineHeight: 1.5 } },
            State.level === 1 ? '무발화·초기 학습자용. 한 문장에 한 그림.' :
            State.level === 2 ? '2~3어절 단위 짧은 문장.' :
            '일반 수준 — 자연스러운 완성형 문장.'
          ),
        ),
      ),

      h('div', { class: 'filter-row' },
        ...FUNCTIONS.map((f) =>
          h('button', {
            class: 'chip' + (State.fnFilter === f ? ' on' : ''),
            onclick: () => { State.fnFilter = f; VIEWS.templates(); },
          }, f)
        ),
      ),

      h('div', { class: 'tmpl-list' },
        ...filtered.map((t) =>
          h('button', { class: 'tmpl-row', onclick: () => pickTemplate(t.id) },
            h('div', { class: 't-ico' }, t.icon),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { class: 't-name' }, t.name),
              h('div', { class: 't-desc' }, t.desc),
              t.fn !== '-' ? h('div', { class: 't-fn' }, t.fn) : null,
            ),
            h('div', { class: 't-arrow' }, el(I.arrow)),
          )
        ),
      ),

      h('div', { style: { height: '24px' } }),
    );
  };

  function pickTemplate(id) {
    const tmpl = TEMPLATES.find((t) => t.id === id);
    if (!tmpl) return;
    State.currentTemplate = tmpl;
    State.currentStoryId = null;
    const name = (State.studentName || '○○').trim();
    let gen;
    if (State.level < 3 && LEVEL_DATA[id] && LEVEL_DATA[id][State.level]) {
      gen = LEVEL_DATA[id][State.level](name);
    } else {
      gen = tmpl.gen(name);
    }
    State.sentences = gen.map((s, i) => ({ ...s, id: Date.now() + i, imgData: null }));
    const lvName = { 1: ' (그림중심)', 2: ' (짧은문장)', 3: '' }[State.level];
    State.title = tmpl.name + lvName;
    setView('editor');
  }

  // ── EDITOR view ──────────────────────────────────────────
  VIEWS.editor = function () {
    const view = $('#view');

    if (!State.sentences.length) {
      // No story in progress — go to templates
      view.innerHTML = '';
      mount(view,
        h('header', { class: 'appbar' },
          h('div', null, h('div', { class: 'appbar-title' }, '새 이야기')),
        ),
        h('div', { class: 'saved-empty', style: { padding: '40px 24px' } },
          h('div', { class: 'ico' }, '📖'),
          h('p', null, '아직 시작한 이야기가 없어요.'),
          h('div', { style: { marginTop: '18px', display: 'flex', gap: '8px', justifyContent: 'center' } },
            h('button', { class: 'btn btn-pri', onclick: () => setView('templates') }, '템플릿에서 시작하기'),
          ),
        ),
      );
      return;
    }

    const counts = countTypes();
    const total = State.sentences.length;
    const descPersp = counts.desc + counts.persp + counts.affirm;
    const coaching = counts.coach;
    const ratio = coaching > 0 ? descPersp / coaching : Infinity;
    const ratioOk = coaching === 0 || ratio >= 2;

    view.innerHTML = '';
    mount(view,
      h('header', { class: 'appbar' },
        h('button', { class: 'appbar-back', onclick: () => setView('home') }, el(I.back)),
        h('div', null,
          h('div', { class: 'appbar-title' }, '이야기 편집'),
          h('div', { class: 'appbar-sub' }, total + '문장 · Lv ' + State.level),
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'appbar-action', onclick: saveStory },
          el(I.save), ' 저장'
        ),
      ),

      h('div', { class: 'editor-meta' },
        h('div', { class: 'field' },
          h('input', {
            class: 'input', type: 'text', placeholder: '이야기 제목',
            value: State.title,
            oninput: (e) => { State.title = e.target.value; },
          }),
        ),
      ),

      h('div', { class: 'legend' },
        h('span', { class: 'badge b-desc' }, '설명'),
        h('span', { class: 'badge b-persp' }, '조망'),
        h('span', { class: 'badge b-coach' }, '코칭'),
        h('span', { class: 'badge b-affirm' }, '긍정확인'),
      ),

      h('div', { class: 'sent-list' },
        ...State.sentences.map((s, i) => renderSentence(s, i)),
      ),

      h('div', { class: 'add-row' },
        h('button', { class: 'chip', onclick: () => addSentence('desc') }, '+ 설명문'),
        h('button', { class: 'chip', onclick: () => addSentence('persp') }, '+ 조망문'),
        h('button', { class: 'chip', onclick: () => addSentence('coach') }, '+ 코칭문'),
        h('button', { class: 'chip', onclick: () => addSentence('affirm') }, '+ 긍정확인'),
      ),

      // Ratio card
      h('div', { class: 'ratio-card' },
        h('h4', null, '문장 유형 비율'),
        renderRatioBar(counts, total),
        h('div', { class: 'ratio-text' },
          '설명+조망+긍정 : 코칭 = ' + descPersp + ' : ' + coaching + ' ',
          h('span', { class: ratioOk ? 'ratio-ok' : 'ratio-bad' },
            ratioOk ? '✓ 기준 충족 (≥ 2:1)' : '✗ 코칭문 비율 초과'
          ),
        ),
      ),

      // sticky action bar
      h('div', { class: 'editor-actions' },
        h('button', { onclick: () => setView('check') },
          el(I.check), '10.4 체크'),
        h('button', { onclick: () => setView('preview') },
          el(I.eye), '미리보기'),
        h('button', { onclick: () => playAll() },
          el(I.speaker), '읽어주기'),
      ),

      h('div', { style: { height: '24px' } }),
    );
  };

  function renderSentence(s, i) {
    const t = TYPES[s.type];
    return h('div', { class: 'sent is-' + s.type, 'data-idx': String(i) },
      h('div', { class: 'sent-head' },
        h('span', { class: 'sent-num' }, String(i + 1)),
        h('select', {
          class: 'sent-type-pick badge ' + t.cls,
          onchange: (e) => { State.sentences[i].type = e.target.value; VIEWS.editor(); },
        },
          ...Object.entries(TYPES).map(([k, v]) =>
            h('option', { value: k, selected: k === s.type ? true : false }, v.label)
          )
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'icon-btn', 'aria-label': 'TTS 듣기', onclick: () => TTS.speak(State.sentences[i].text) },
          el(I.speaker)),
        h('button', { class: 'icon-btn' + (s.imgData ? ' active' : ''), 'aria-label': '이미지', onclick: () => pickImage(i) },
          el(I.camera)),
        h('button', { class: 'icon-btn danger', 'aria-label': '삭제', onclick: () => deleteSentence(i) },
          el(I.trash)),
      ),
      h('textarea', {
        rows: '2',
        placeholder: '문장을 입력하세요…',
        oninput: (e) => { State.sentences[i].text = e.target.value; autoResize(e.target); },
        onfocus: (e) => autoResize(e.target),
      }, s.text),
      s.imgData ?
        h('div', { class: 'sent-img' },
          h('img', { src: s.imgData, alt: '' }),
          h('button', { class: 'sent-img-rm', 'aria-label': '이미지 제거', onclick: () => { State.sentences[i].imgData = null; VIEWS.editor(); } }, '×'),
        ) :
        s.img ? // Level 1 placeholder
          h('button', { class: 'sent-img-empty', onclick: () => pickImage(i) },
            el(I.camera), '여기에 그림/사진을 추가해주세요'
          ) :
          null
    );
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }

  function addSentence(type) {
    State.sentences.push({ type, text: '', id: Date.now(), imgData: null });
    VIEWS.editor();
    requestAnimationFrame(() => {
      const list = $('.sent-list');
      const last = list && list.lastElementChild;
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ta = last.querySelector('textarea'); if (ta) ta.focus();
      }
    });
  }

  function deleteSentence(i) {
    if (!confirm('이 문장을 삭제할까요?')) return;
    State.sentences.splice(i, 1);
    VIEWS.editor();
  }

  function countTypes() {
    const c = { desc: 0, persp: 0, coach: 0, affirm: 0 };
    State.sentences.forEach((s) => { if (c[s.type] !== undefined) c[s.type]++; });
    return c;
  }

  function renderRatioBar(counts, total) {
    const bar = h('div', { class: 'ratio-bar' });
    if (total === 0) { bar.append(h('div', { class: 'ratio-seg', style: { width: '100%', background: 'var(--bg-elev)', color: 'var(--ink-3)' } }, '비어 있음')); return bar; }
    const labels = { desc: '설명', persp: '조망', coach: '코칭', affirm: '긍정' };
    Object.entries(counts).forEach(([k, v]) => {
      if (!v) return;
      const pct = (v / total) * 100;
      bar.append(h('div', { class: 'ratio-seg', style: { width: pct + '%', background: TYPES[k].color } }, v));
    });
    return bar;
  }

  // ── Image picker ────────────────────────────────────────
  function pickImage(idx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Downscale before storing
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const max = 1280;
          let w = img.width, hh = img.height;
          if (Math.max(w, hh) > max) {
            const scale = max / Math.max(w, hh);
            w = Math.round(w * scale); hh = Math.round(hh * scale);
          }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = hh;
          cv.getContext('2d').drawImage(img, 0, 0, w, hh);
          State.sentences[idx].imgData = cv.toDataURL('image/jpeg', 0.82);
          VIEWS.editor();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // ── 10.4 CHECK view ─────────────────────────────────────
  VIEWS.check = function () {
    const view = $('#view');
    const counts = countTypes();
    const total = State.sentences.length;
    const allText = State.sentences.map((s) => s.text).join(' ');
    const descPersp = counts.desc + counts.persp + counts.affirm;
    const coaching = counts.coach;
    const ratio = coaching > 0 ? descPersp / coaching : Infinity;

    const criteria = [
      { name: '1. 목표 — 정보 공유', desc: '명령이 아닌 정보 제공 톤', state: 'info', note: '자동 판단 불가 — "정보 제공" 톤인지 직접 확인하세요.' },
      { name: '2. 설명문:코칭문 비율 ≥ 2:1', state: ratio >= 2 ? 'pass' : 'fail', note: '현재 ' + (ratio === Infinity ? '코칭문 0개' : ratio.toFixed(1) + ':1') + ' (' + descPersp + ':' + coaching + ')' },
      { name: '3. 인칭 일관 사용', state: 'info', note: '1인칭 또는 3인칭 일관성을 직접 확인하세요.' },
      { name: '4. 긍정적 언어', state: !/하지 마|하면 안|해서는 안/.test(allText) ? 'pass' : 'fail', note: /하지 마|하면 안|해서는 안/.test(allText) ? '부정적 표현이 발견됨 — "~할 수 있다"로 수정' : '부정적 표현 없음' },
      { name: '5. 코칭문 — "~할 수 있다" 표현', state: State.sentences.filter((s) => s.type === 'coach').every((s) => /볼 수 있|할 수 있|시도|수도 있/.test(s.text) || s.text === '') ? 'pass' : 'fail', note: State.sentences.filter((s) => s.type === 'coach').some((s) => /해야|하세요|하십시오/.test(s.text)) ? '명령형/의무형 표현 있음' : '제안형으로 작성됨' },
      { name: '6. 정확한 정보', state: 'info', note: '사실에 기반한 정보인지 확인하세요.' },
      { name: '7. 문장 수 적절성', state: (State.level === 1 ? (total >= 3 && total <= 5) : State.level === 2 ? (total >= 4 && total <= 8) : (total >= 5 && total <= 15)) ? 'pass' : 'fail',
        note: '현재 ' + total + '문장 (Level ' + State.level + ') — 권장: ' + (State.level === 1 ? '3~5' : State.level === 2 ? '4~8' : '5~15') + '문장' },
      { name: '8. 제목', state: State.title.trim() ? 'pass' : 'fail', note: State.title.trim() ? '"' + State.title + '"' : '제목을 입력하세요.' },
      { name: '9. 조망문 포함', state: counts.persp >= 1 ? 'pass' : 'fail', note: '조망문 ' + counts.persp + '개' + (counts.persp === 0 ? ' — 타인의 감정/생각 문장을 추가하세요.' : '') },
      { name: '10. 학습자 강점/안전 확인', state: counts.affirm >= 1 ? 'pass' : 'fail', note: '긍정확인문 ' + counts.affirm + '개' + (counts.affirm === 0 ? ' — 안심시키는 문장을 추가하세요.' : '') },
    ];
    const passCount = criteria.filter((c) => c.state === 'pass' || c.state === 'info').length;

    view.innerHTML = '';
    mount(view,
      h('header', { class: 'appbar' },
        h('button', { class: 'appbar-back', onclick: () => setView('editor') }, el(I.back)),
        h('div', null,
          h('div', { class: 'appbar-title' }, '10.4 기준 점검'),
          h('div', { class: 'appbar-sub' }, 'Carol Gray (2023)'),
        ),
      ),

      h('div', { class: 'crit-summary' },
        passCount + ' / ' + criteria.length + ' 항목 충족',
        h('div', { style: { fontWeight: 500, fontSize: '12px', marginTop: '4px', opacity: .8 } },
          passCount === criteria.length ? '모든 기준 충족 ✓' :
          passCount >= 7 ? '거의 완성 — 아래 항목 확인' :
          '수정이 필요합니다'
        ),
      ),

      h('div', { style: { height: '12px' } }),

      h('div', { class: 'crit-list' },
        ...criteria.map((c) =>
          h('div', { class: 'crit-row crit-' + c.state },
            h('div', { class: 'crit-mark' }, c.state === 'pass' ? '✓' : c.state === 'fail' ? '×' : 'ⓘ'),
            h('div', { style: { flex: 1 } },
              h('div', { class: 'crit-name' }, c.name),
              h('div', { class: 'crit-note' }, c.note),
            ),
          )
        ),
      ),

      h('div', { style: { padding: '20px 18px 0', display: 'flex', gap: '8px' } },
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => setView('editor') }, '편집으로'),
        h('button', { class: 'btn btn-pri btn-block', onclick: () => setView('preview') }, '미리보기'),
      ),
      h('div', { style: { height: '24px' } }),
    );
  };

  // ── PREVIEW view ────────────────────────────────────────
  let playingIdx = -1;
  VIEWS.preview = function () {
    const view = $('#view');
    const filled = State.sentences.filter((s) => s.text.trim() || s.imgData);

    view.innerHTML = '';
    mount(view,
      h('header', { class: 'appbar' },
        h('button', { class: 'appbar-back', onclick: () => { TTS.stop(); playingIdx = -1; setView('editor'); } }, el(I.back)),
        h('div', null,
          h('div', { class: 'appbar-title' }, '미리보기'),
          h('div', { class: 'appbar-sub' }, filled.length + '문장'),
        ),
        h('div', { class: 'spacer' }),
        h('button', { class: 'appbar-action ghost', onclick: () => openShareSheet() },
          el(I.share), ' 공유'),
      ),

      h('div', { class: 'preview-actions' },
        h('button', { class: 'btn btn-pri', id: 'btn-play-all', onclick: () => playAll() },
          el(I.play), '전체 읽어주기'),
        h('button', { class: 'btn btn-ghost', onclick: () => window.print() },
          '🖨 인쇄'),
        h('button', { class: 'btn btn-ghost', onclick: () => saveStory() },
          el(I.save)),
      ),

      h('div', { class: 'preview' },
        h('div', { class: 'preview-title' }, State.title.trim() || '사회적 이야기'),
        ...filled.map((s, i) => h('div', null,
          h('div', { class: 'preview-sent', 'data-idx': String(i), onclick: () => speakOne(i, s.text) }, s.text),
          s.imgData ? h('div', { class: 'preview-img' }, h('img', { src: s.imgData, alt: '' })) : null,
        )),
        h('div', { class: 'preview-meta' },
          'Carol Gray Social Stories™ 10.4 기준 · 작성일 ' + new Date().toLocaleDateString('ko-KR')
        ),
      ),
      h('div', { style: { height: '24px' } }),
    );
  };

  function speakOne(i, text) {
    TTS.stop();
    const all = $$('.preview-sent');
    all.forEach((n) => n.classList.remove('playing'));
    const node = all[i]; if (node) node.classList.add('playing');
    TTS.speak(text).then(() => { if (node) node.classList.remove('playing'); });
  }

  async function playAll() {
    const filled = State.sentences.filter((s) => s.text.trim());
    if (!filled.length) { toast('읽을 문장이 없어요.'); return; }
    if (State.view !== 'preview') setView('preview');
    await new Promise((r) => requestAnimationFrame(r));
    TTS.stop();
    const all = $$('.preview-sent');
    for (let i = 0; i < filled.length; i++) {
      all.forEach((n) => n.classList.remove('playing'));
      if (all[i]) all[i].classList.add('playing');
      if (all[i]) all[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
      await TTS.speak(filled[i].text);
    }
    all.forEach((n) => n.classList.remove('playing'));
  }

  function openShareSheet() {
    openSheet('공유 / 내보내기', [
      { icon: '📄', label: '텍스트 파일로', onClick: exportText },
      { icon: '🖨', label: '인쇄 / PDF 저장', onClick: () => window.print() },
      { icon: '📋', label: '클립보드에 복사', onClick: copyToClipboard },
      navigator.share ? { icon: '↗', label: '다른 앱으로 공유', onClick: nativeShare } : null,
    ].filter(Boolean));
  }

  function buildText() {
    const filled = State.sentences.filter((s) => s.text.trim());
    return [
      State.title.trim() || '사회적 이야기',
      '═'.repeat(20), '',
      ...filled.map((s) => s.text),
      '',
      '─'.repeat(20),
      '작성일 ' + new Date().toLocaleDateString('ko-KR'),
      '뜨온 · Carol Gray Social Stories™ 10.4',
    ].join('\n');
  }
  function exportText() {
    const blob = new Blob([buildText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '사회적이야기_' + (State.title.trim() || 'untitled') + '_' + new Date().toISOString().split('T')[0] + '.txt';
    a.click();
  }
  function copyToClipboard() {
    navigator.clipboard.writeText(buildText()).then(() => toast('복사되었습니다')).catch(() => toast('복사 실패'));
  }
  function nativeShare() {
    navigator.share({ title: State.title || '사회적 이야기', text: buildText() }).catch(() => {});
  }

  // ── LIBRARY view ────────────────────────────────────────
  VIEWS.library = function () {
    const view = $('#view');
    const stories = LS.stories().slice().reverse();

    view.innerHTML = '';
    mount(view,
      h('header', { class: 'appbar' },
        h('div', null,
          h('div', { class: 'appbar-title' }, '보관함'),
          h('div', { class: 'appbar-sub' }, stories.length + '개의 이야기'),
        ),
        h('div', { class: 'spacer' }),
        stories.length ? h('button', { class: 'appbar-back', onclick: openLibraryMenu, 'aria-label': '더보기' },
          el(I.settings)
        ) : null,
      ),

      stories.length ?
        h('div', { class: 'saved-list' },
          ...stories.map((s) => {
            const tmpl = TEMPLATES.find((t) => t.id === s.template);
            return h('div', { class: 'saved-card' },
              h('div', { class: 'sc-ico' }, tmpl ? tmpl.icon : '📖'),
              h('button', { class: 'sc-body', style: { background: 'none', textAlign: 'left' }, onclick: () => loadStory(s.id) },
                h('div', { class: 'sc-title' }, s.title),
                h('div', { class: 'sc-meta' }, formatDate(s.date) + ' · ' + s.sentences.length + '문장'),
              ),
              h('div', { class: 'sc-actions' },
                h('button', { class: 'icon-btn', 'aria-label': '복제', onclick: () => duplicateStory(s.id) }, el(I.copy)),
                h('button', { class: 'icon-btn danger', 'aria-label': '삭제', onclick: () => deleteStory(s.id) }, el(I.trash)),
              ),
            );
          }),
        ) :
        h('div', { class: 'saved-empty' },
          h('div', { class: 'ico' }, '📚'),
          h('p', null, '아직 저장된 이야기가 없어요.'),
          h('div', { style: { marginTop: '16px' } },
            h('button', { class: 'btn btn-pri', onclick: () => setView('templates') }, '첫 이야기 만들기'),
          ),
        ),

      h('div', { style: { height: '24px' } }),
    );
  };

  function openLibraryMenu() {
    openSheet('보관함 관리', [
      { icon: '⬇', label: 'JSON으로 백업', sub: '모든 이야기를 파일로 내보내기', onClick: exportAll },
      { icon: '⬆', label: 'JSON 복원', sub: '백업한 파일에서 불러오기', onClick: importAll },
    ]);
  }
  function exportAll() {
    const data = { app: '뜨온', version: 1, exportedAt: new Date().toISOString(), stories: LS.stories() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tt-on-backup_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
  }
  function importAll() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data.stories)) {
            if (confirm(data.stories.length + '개 이야기를 복원합니다. 기존 데이터를 덮어쓸까요?')) {
              LS.saveStories(data.stories);
              toast('복원 완료');
              VIEWS.library();
            }
          } else { toast('잘못된 파일 형식'); }
        } catch { toast('파일을 읽을 수 없어요'); }
      };
      reader.readAsText(e.target.files[0]);
    };
    input.click();
  }

  function saveStory() {
    if (!State.title.trim()) { toast('제목을 입력하세요'); return; }
    const stories = LS.stories();
    const payload = {
      id: State.currentStoryId || Date.now(),
      title: State.title.trim(),
      sentences: JSON.parse(JSON.stringify(State.sentences)),
      template: State.currentTemplate ? State.currentTemplate.id : null,
      level: State.level,
      date: new Date().toISOString(),
    };
    if (State.currentStoryId) {
      const idx = stories.findIndex((s) => s.id === State.currentStoryId);
      if (idx >= 0) stories[idx] = payload; else stories.push(payload);
    } else {
      stories.push(payload);
      State.currentStoryId = payload.id;
    }
    LS.saveStories(stories);
    toast('저장되었습니다');
  }

  function loadStory(id) {
    const story = LS.stories().find((s) => s.id === id);
    if (!story) return;
    State.sentences = JSON.parse(JSON.stringify(story.sentences));
    State.title = story.title;
    State.currentStoryId = story.id;
    State.currentTemplate = story.template ? TEMPLATES.find((t) => t.id === story.template) : null;
    if (story.level) State.level = story.level;
    setView('editor');
  }

  function duplicateStory(id) {
    const stories = LS.stories();
    const orig = stories.find((s) => s.id === id);
    if (!orig) return;
    stories.push({ ...JSON.parse(JSON.stringify(orig)), id: Date.now(), title: orig.title + ' (복사)', date: new Date().toISOString() });
    LS.saveStories(stories);
    VIEWS.library();
    toast('복제되었습니다');
  }
  function deleteStory(id) {
    if (!confirm('이 이야기를 삭제할까요?')) return;
    LS.saveStories(LS.stories().filter((s) => s.id !== id));
    VIEWS.library();
  }

  // ── MORE view ───────────────────────────────────────────
  VIEWS.more = function () {
    const view = $('#view');
    const voiceCount = TTS.voices.length;

    view.innerHTML = '';
    mount(view,
      h('header', { class: 'appbar' },
        h('div', null, h('div', { class: 'appbar-title' }, '설정 · 더보기')),
      ),

      h('div', { class: 'about-card' },
        h('div', { class: 'ab-mark' }, h('span', { class: 'brand-mark', style: { width: '52px', height: '52px', borderRadius: '14px' } })),
        h('h4', null, '뜨온'),
        h('p', null, '특수교사를 위한 사회적 이야기 작성 도구. 따뜻한(따끈한) 온기와 함께 학생을 안내합니다.'),
        h('div', { class: 'ab-ver' }, 'v1.0 · Carol Gray Social Stories™ 10.4'),
      ),

      h('div', { class: 'section-head' }, h('h2', null, '음성 읽어주기 (TTS)')),
      h('div', { class: 'more-list' },
        h('div', { class: 'more-row' },
          h('div', { class: 'm-ico' }, el(I.speaker)),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name' }, '읽기 속도'),
            h('div', { class: 'm-desc' }, '현재: ' + State.tts.rate.toFixed(1) + 'x'),
          ),
        ),
        h('div', { style: { padding: '0 16px' } },
          h('input', {
            type: 'range', min: '0.6', max: '1.3', step: '0.1', value: String(State.tts.rate),
            style: { width: '100%' },
            oninput: (e) => {
              State.tts.rate = parseFloat(e.target.value);
              localStorage.setItem('tt_ttsRate', String(State.tts.rate));
              VIEWS.more();
            },
          }),
        ),
        voiceCount ?
          h('div', { class: 'more-row' },
            h('div', { class: 'm-ico' }, '🎙'),
            h('div', { class: 'm-body' },
              h('div', { class: 'm-name' }, '한국어 음성'),
              h('div', { class: 'm-desc' }, voiceCount + '개 사용 가능'),
            ),
            h('select', {
              class: 'select',
              style: { width: 'auto', maxWidth: '140px', padding: '8px 10px', fontSize: '12px' },
              onchange: (e) => { State.tts.voiceURI = e.target.value; localStorage.setItem('tt_voiceURI', e.target.value); },
            },
              ...TTS.voices.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === State.tts.voiceURI ? true : false }, v.name))
            ),
          ) :
          h('div', { class: 'more-row' },
            h('div', { class: 'm-ico' }, '⚠'),
            h('div', { class: 'm-body' },
              h('div', { class: 'm-name' }, '한국어 음성 없음'),
              h('div', { class: 'm-desc' }, '기기 설정에서 한국어 TTS를 추가하세요.'),
            ),
          ),
        h('div', { class: 'more-row' },
          h('div', { class: 'm-ico' }, '🔊'),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name' }, '음성 미리듣기'),
            h('div', { class: 'm-desc' }, '현재 설정으로 짧은 문장을 들어봅니다.'),
          ),
          h('button', { class: 'btn btn-soft btn-sm', onclick: () => TTS.speak('안녕하세요. 뜨온입니다.') }, '듣기'),
        ),
      ),

      h('div', { class: 'section-head' }, h('h2', null, '데이터')),
      h('div', { class: 'more-list' },
        h('button', { class: 'more-row', onclick: exportAll },
          h('div', { class: 'm-ico' }, '⬇'),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name' }, '백업 (JSON 내보내기)'),
            h('div', { class: 'm-desc' }, '모든 이야기와 이미지를 한 파일로 저장'),
          ),
        ),
        h('button', { class: 'more-row', onclick: importAll },
          h('div', { class: 'm-ico' }, '⬆'),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name' }, '복원 (JSON 가져오기)'),
            h('div', { class: 'm-desc' }, '백업한 파일에서 이야기 불러오기'),
          ),
        ),
        h('button', { class: 'more-row', onclick: () => {
          if (confirm('모든 이야기를 삭제할까요? 되돌릴 수 없습니다.')) {
            localStorage.removeItem('tt_stories'); toast('초기화 완료');
          }
        } },
          h('div', { class: 'm-ico', style: { background: '#fdecea', color: 'var(--danger)' } }, el(I.trash)),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name', style: { color: 'var(--danger)' } }, '모든 데이터 삭제'),
            h('div', { class: 'm-desc' }, '되돌릴 수 없는 작업입니다.'),
          ),
        ),
      ),

      h('div', { class: 'section-head' }, h('h2', null, '정보')),
      h('div', { class: 'more-list' },
        h('div', { class: 'more-row' },
          h('div', { class: 'm-ico' }, el(I.info)),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name' }, '오프라인 사용'),
            h('div', { class: 'm-desc' }, '한 번 열어두면 인터넷 없이도 사용 가능합니다.'),
          ),
        ),
        h('div', { class: 'more-row' },
          h('div', { class: 'm-ico' }, '📖'),
          h('div', { class: 'm-body' },
            h('div', { class: 'm-name' }, 'Social Stories™ 10.4'),
            h('div', { class: 'm-desc' }, 'Carol Gray (2023) 기준에 따라 작성.'),
          ),
        ),
      ),

      h('div', { style: { height: '24px' } }),
    );
  };

  // ── Tab bar wiring ──────────────────────────────────────
  function wireTabbar() {
    $$('#tabbar .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        if (v === 'editor' && !State.sentences.length) {
          setView('templates');
        } else {
          setView(v);
        }
      });
    });
  }

  // ── INIT ────────────────────────────────────────────────
  function init() {
    TTS.init();
    wireTabbar();
    setView('home');
    // resize on first paint of editor textareas
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'TEXTAREA') autoResize(e.target);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
