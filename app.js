// Shared interactions for every page. Plain script, no dependencies.
(function () {
  'use strict';

  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- Preloader (home page, once per session) ----------
  function initLoader() {
    const loader = document.getElementById('loader');
    if (!loader) return;
    if (root.classList.contains('skip-loader') || reduceMotion) {
      loader.remove();
      return;
    }
    document.body.classList.add('loading');
    const pct = document.getElementById('loader-pct');
    const start = performance.now();
    const MIN = 900;
    const MAX = 2600;
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (pct) pct.textContent = '100%';
      loader.classList.add('done');
      document.body.classList.remove('loading');
      try { sessionStorage.setItem('loaded', '1'); } catch (e) {}
      setTimeout(() => loader.remove(), 1000);
    };
    const tick = (now) => {
      const t = now - start;
      // Ease toward 90% while waiting; jump to 100% once loaded and the minimum time passed
      const shown = loaded && t > MIN ? 100 : Math.min(90, Math.round(90 * (1 - Math.exp(-t / 900))));
      if (pct) pct.textContent = shown + '%';
      if (shown >= 100 || t > MAX) {
        setTimeout(finish, 250);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- Motion toggle (pauses 3D + marquees, remembered) ----------
  function initMotionToggle() {
    const btn = document.querySelector('.motion-toggle');
    if (!btn) return;
    const sync = () => {
      const off = root.classList.contains('motion-off');
      btn.setAttribute('aria-pressed', String(!off));
      btn.setAttribute('aria-label', off ? 'Resume animations' : 'Pause animations');
    };
    sync();
    btn.addEventListener('click', () => {
      const off = !root.classList.contains('motion-off');
      root.classList.toggle('motion-off', off);
      try { localStorage.setItem('motion', off ? 'off' : 'on'); } catch (e) {}
      sync();
      window.dispatchEvent(new CustomEvent('motionchange', { detail: { off } }));
    });
  }

  // ---------- Selected works: scroll-driven on desktop, tabs on mobile ----------
  function initWorks() {
    const pin = document.querySelector('.works-pin');
    if (!pin) return;
    const thumbs = Array.from(pin.querySelectorAll('.w-thumb'));
    const infos = Array.from(pin.querySelectorAll('.w-info'));
    const bars = Array.from(pin.querySelectorAll('.works-progress span'));
    const n = thumbs.length;
    let current = 0;
    const desktop = () => window.innerWidth > 960;

    const setActive = (i) => {
      if (i === current) return;
      current = i;
      thumbs.forEach((t, k) => {
        t.classList.toggle('active', k === i);
        t.setAttribute('aria-selected', String(k === i));
      });
      infos.forEach((el, k) => el.classList.toggle('active', k === i));
      bars.forEach((b, k) => b.classList.toggle('on', k === i));
      window.dispatchEvent(new CustomEvent('workchange', { detail: i }));
    };
    window.__activeWork = () => current;

    const onScroll = () => {
      if (!desktop()) return;
      const r = pin.getBoundingClientRect();
      const total = pin.offsetHeight - window.innerHeight;
      const p = Math.min(Math.max(-r.top / Math.max(total, 1), 0), 0.9999);
      setActive(Math.floor(p * n));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    thumbs.forEach((t, i) => t.addEventListener('click', () => {
      if (desktop()) {
        const total = pin.offsetHeight - window.innerHeight;
        const top = pin.getBoundingClientRect().top + window.scrollY + total * ((i + 0.5) / n);
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      } else {
        setActive(i);
      }
    }));

    // Arrow keys move between tabs
    pin.querySelector('.works-thumbs').addEventListener('keydown', (e) => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      const next = (current + dir + n) % n;
      thumbs[next].focus();
      thumbs[next].click();
    });
  }

  // ---------- Header: scrolled state, hide on scroll down ----------
  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 20);
      const menuOpen = document.querySelector('.nav.open');
      header.classList.toggle('hidden', !menuOpen && y > lastY && y > 200);
      lastY = Math.max(y, 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Mobile menu ----------
  function initMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if (!toggle || !nav) return;
    const icon = toggle.querySelector('i');
    const setOpen = (open) => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (icon) icon.className = open ? 'ti ti-x' : 'ti ti-menu-2';
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!nav.classList.contains('open'));
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) setOpen(false);
    });
  }

  // ---------- Active nav link ----------
  function initActiveNav() {
    let page = window.location.pathname.split('/').pop() || 'index.html';
    if (!page.includes('.')) page += '.html';
    document.querySelectorAll('.nav-link').forEach((link) => {
      const active = link.getAttribute('href') === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  // ---------- Scroll reveal ----------
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  }

  // ---------- 3D tilt ----------
  function initTilt() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll('.tilt').forEach((el) => {
      const max = parseFloat(el.dataset.tilt || '8');
      if (!el.querySelector('.tilt-glare')) {
        const glare = document.createElement('span');
        glare.className = 'tilt-glare';
        glare.setAttribute('aria-hidden', 'true');
        el.appendChild(glare);
      }
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg)`;
          el.style.setProperty('--mx', `${px * 100}%`);
          el.style.setProperty('--my', `${py * 100}%`);
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });
  }

  // ---------- Count-up numbers ----------
  function initCounters() {
    const els = document.querySelectorAll('[data-count]');
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      if (reduceMotion || isNaN(target)) {
        el.textContent = target + suffix;
        return;
      }
      const start = performance.now();
      const dur = 1600;
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) {
      els.forEach(run);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }

  // ---------- Typing role rotator ----------
  function initRoles() {
    const el = document.querySelector('.role-rotator .typed');
    if (!el) return;
    let roles;
    try {
      roles = JSON.parse(el.dataset.roles || '[]');
    } catch (e) {
      roles = [];
    }
    if (!roles.length) return;
    if (reduceMotion) {
      el.textContent = roles[0];
      return;
    }
    let i = 0;
    let n = 0;
    let deleting = false;
    const tick = () => {
      const word = roles[i];
      n += deleting ? -1 : 1;
      el.textContent = word.slice(0, n);
      let delay = deleting ? 35 : 70;
      if (!deleting && n === word.length) {
        deleting = true;
        delay = 1800;
      } else if (deleting && n === 0) {
        deleting = false;
        i = (i + 1) % roles.length;
        delay = 350;
      }
      setTimeout(tick, delay);
    };
    tick();
  }

  // ---------- Filters (projects / publications) ----------
  function initFilters() {
    document.querySelectorAll('[data-filter-group]').forEach((group) => {
      const target = document.querySelector(group.dataset.filterGroup);
      if (!target) return;
      const items = target.querySelectorAll('[data-tags]');
      const empty = document.querySelector(group.dataset.empty || '');
      const buttons = group.querySelectorAll('.filter-btn');

      buttons.forEach((btn) => {
        const f = btn.dataset.filter;
        const count = f === 'all'
          ? items.length
          : Array.from(items).filter((it) => it.dataset.tags.split(' ').includes(f)).length;
        const badge = document.createElement('span');
        badge.className = 'count';
        badge.textContent = count;
        btn.appendChild(badge);

        btn.addEventListener('click', () => {
          buttons.forEach((b) => {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-pressed', String(b === btn));
          });
          let shown = 0;
          items.forEach((it) => {
            const match = f === 'all' || it.dataset.tags.split(' ').includes(f);
            it.classList.toggle('hide', !match);
            if (match) {
              shown++;
              it.classList.add('in');
            }
          });
          if (empty) empty.classList.toggle('show', shown === 0);
        });
      });
    });
  }

  // ---------- Copy to clipboard ----------
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
          toast('Copied to clipboard');
        } catch (err) {
          toast(text);
        }
      });
    });
  }

  // ---------- "Ask Manova" chat: custom UI over the Career-takAI Space API ----------
  function initChatbot() {
    const fab = document.getElementById('chat-fab');
    const panel = document.getElementById('chat-panel');
    if (!fab || !panel) return;

    const SPACE = 'MANO066/Career-takAI';
    const API = 'https://mano066-career-takai.hf.space/gradio_api/call/respond';
    const EMAIL = 'manomathew1943@gmail.com';
    const STORE = 'chat-history';
    const MAX_KEEP = 24;
    const WAKING = ['SLEEPING', 'APP_STARTING', 'BUILDING', 'RUNNING_BUILDING', 'RUNNING_APP_STARTING'];
    const SUGGESTIONS = [
      ['Experience', 'What is your work experience?'],
      ['Skills', 'What are your main technical skills?'],
      ['Projects', 'Tell me about your best projects.'],
      ['Research', 'What research have you published?'],
      ['Contact', 'How can I contact you about an opportunity?'],
    ];

    // Local answers for when the live assistant can't respond
    const ANSWERS = [
      { k: ['experience', 'work', 'job', 'company', 'iei', 'role', 'career', 'background'],
        a: "I'm an **AI Engineer at IEI Integration Corp** (New Taipei, Jul 2024 – present), integrating vision-language models into embedded detection pipelines and optimising them with ONNX, OpenVINO and INT8/FP16 (−60% memory).\n\nBefore that: AI Engineer at the Intelligent Recognition Industry Service Centre (2023–24) and Research Fellow at Vel Tech R&D Institute (2017–21). [Full profile](profile.html)" },
      { k: ['skill', 'stack', 'tech', 'tool', 'framework', 'llm', 'vision', 'yolo', 'onnx', 'openvino', 'python'],
        a: '- **LLMs & agents:** OpenAI SDK, LangChain, CrewAI, AutoGen, MCP\n- **Computer vision:** YOLO, OpenCV, PyTorch, defect detection\n- **Multimodal:** vision-language models, generative AI\n- **Edge:** ONNX, OpenVINO, INT8/FP16 quantisation, pruning' },
      { k: ['project', 'built', 'portfolio', 'aiei', 'surveillance', 'itrash', 'mura', 'grinding'],
        a: '- **AIEI** — multi-modal visual surveillance with VLMs at IEI\n- **V-line mura** — TFT-LCD defect detection, 99.5% mAP\n- **iTrash** — recycling detection, +50% accuracy\n- **Grinding wheel QC** — 2023 AI+ Rising Talent winner\n\n[All projects](projects.html)' },
      { k: ['research', 'paper', 'publication', 'ieee', 'journal', 'conference', 'publish'],
        a: '**12 publications** (6 journal, 6 conference), including IEEE Sensors Journal 2025 (drone PM2.5 detection) and IEEE Access 2024 (TFT-LCD mura detection, 99.5% mAP). [Full list](publications.html)' },
      { k: ['education', 'degree', 'study', 'university', 'master', 'msc', 'thesis'],
        a: '**M.Sc. Aeronautical & Electronic Engineering**, specialist in AI — National Formosa University, Taiwan (2021–23). Thesis on multi-spectral air-quality prediction; overall prize in the 5G AI Competition.' },
      { k: ['contact', 'email', 'hire', 'reach', 'phone', 'call', 'opportunit', 'available', 'cv', 'resume'],
        a: 'Email **' + EMAIL + '**, call +886 958 334 626, or connect on [LinkedIn](https://www.linkedin.com/in/manova-m-509145157/). You can also [download my CV](profile.html?cv).' },
    ];
    const localAnswer = (text) => {
      const t = text.toLowerCase();
      let best = null;
      let score = 0;
      ANSWERS.forEach((item) => {
        const s = item.k.filter((k) => t.includes(k)).length;
        if (s > score) { score = s; best = item; }
      });
      return best ? best.a : "I don't have a quick answer for that — please email **" + EMAIL + "** and I'll reply personally.";
    };

    // ---- Minimal, safe Markdown → HTML (input is escaped first) ----
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const inline = (s) => {
      const keep = [];
      const hold = (html) => '\u0000' + (keep.push(html) - 1) + '\u0000';
      s = s.replace(/`([^`]+)`/g, (_, c) => hold('<code>' + c + '</code>'));
      s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+|[\w-]+\.html(?:[?#][^\s)]*)?)\)/g, (_, t, u) => {
        const ext = /^https?:/.test(u);
        return hold('<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>');
      });
      s = s.replace(/https?:\/\/[^\s<)\u0000]+/g, (u) => hold('<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, '') + '</a>'));
      s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+\w/g, (m) => hold('<a href="mailto:' + m + '">' + m + '</a>'));
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
      return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
    };
    const md = (src) => {
      const lines = esc(String(src || '')).replace(/\r/g, '').split('\n');
      const out = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (/^\s*\|.*\|\s*$/.test(line)) {
          const rows = [];
          while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
          const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
          const body = rows.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
          if (body.length) {
            const [head, ...rest] = body;
            const heads = cells(head);
            if (heads.length > 2 && rest.length) {
              // Wide tables don't fit a chat bubble: show each row as a labelled card
              out.push('<div class="cm-cards">' + rest.map((r) => {
                const cs = cells(r);
                return '<div class="cm-card"><div class="cm-card-title">' + (cs[0] || '') + '</div>' +
                  cs.slice(1).map((c, j) => (c ? '<div class="cm-card-row"><span>' + (heads[j + 1] || '') + '</span>' + c + '</div>' : '')).join('') + '</div>';
              }).join('') + '</div>');
            } else {
              out.push('<div class="cm-table"><table><thead><tr>' + heads.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
                rest.map((r) => '<tr>' + cells(r).map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
            }
          }
          continue;
        }
        const li = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
        if (li) {
          const ordered = /\d/.test(li[1]);
          const items = [];
          while (i < lines.length) {
            const m = lines[i].match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
            if (!m) break;
            items.push('<li>' + inline(m[2]) + '</li>');
            i++;
          }
          out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'));
          continue;
        }
        const h = line.match(/^#{1,4}\s+(.*)$/);
        if (h) { out.push('<p><strong>' + inline(h[1]) + '</strong></p>'); i++; continue; }
        if (!line.trim()) { i++; continue; }
        const para = [];
        while (i < lines.length && lines[i].trim() && !/^\s*(\||[-*•]\s|\d+[.)]\s|#)/.test(lines[i])) para.push(inline(lines[i++]));
        if (para.length) out.push('<p>' + para.join('<br>') + '</p>');
        else i++;
      }
      return out.join('');
    };

    // ---- UI ----
    panel.innerHTML =
      '<div class="cm-head">' +
        '<div class="cm-who"><span class="cm-avatar"><img src="assets/profile.webp" alt="" width="40" height="40"></span>' +
        '<div><div class="cm-name">Ask Manova</div><div class="cm-status" data-state="checking"><span class="cm-dot"></span><span class="cm-status-text">Connecting…</span></div></div></div>' +
        '<div class="cm-actions"><button class="cm-icon" type="button" data-act="reset" aria-label="Start a new chat" title="New chat"><i class="ti ti-refresh"></i></button>' +
        '<button class="cm-icon" type="button" data-act="close" aria-label="Close chat" title="Close"><i class="ti ti-x"></i></button></div>' +
      '</div>' +
      '<div class="cm-log" role="log" aria-live="polite" aria-label="Conversation"></div>' +
      '<div class="cm-suggest" aria-label="Suggested questions"></div>' +
      '<form class="cm-form" autocomplete="off">' +
        '<textarea class="cm-input" rows="1" maxlength="500" placeholder="Ask about my experience, skills, research…" aria-label="Your message"></textarea>' +
        '<button class="cm-send" type="submit" aria-label="Send message" disabled><i class="ti ti-arrow-up"></i></button>' +
      '</form>' +
      '<div class="cm-foot">AI answers from my CV · may be imperfect · <a href="mailto:' + EMAIL + '">email me</a></div>';

    const log = panel.querySelector('.cm-log');
    const suggest = panel.querySelector('.cm-suggest');
    const form = panel.querySelector('.cm-form');
    const input = panel.querySelector('.cm-input');
    const send = panel.querySelector('.cm-send');
    const statusEl = panel.querySelector('.cm-status');
    const statusText = panel.querySelector('.cm-status-text');

    let history = [];
    try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch (e) { history = []; }
    let mode = 'checking'; // online | waking | offline | checking
    let busy = false;
    let isOpen = false;
    let statusChecked = false;

    const save = () => {
      try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_KEEP))); } catch (e) {}
    };
    const setMode = (m) => {
      mode = m;
      statusEl.dataset.state = m;
      statusText.textContent = {
        online: 'Online · AI assistant',
        waking: 'Waking up · first reply may take ~30s',
        offline: 'Quick-answer mode',
        checking: 'Connecting…',
      }[m];
    };
    const scroll = () => { log.scrollTop = log.scrollHeight; };

    const bubble = (role, content, opts = {}) => {
      const row = document.createElement('div');
      row.className = 'cm-row ' + (role === 'user' ? 'me' : 'bot');
      const msg = document.createElement('div');
      msg.className = 'cm-msg';
      if (role === 'user') msg.textContent = content;
      else msg.innerHTML = md(content);
      if (opts.local) {
        const tag = document.createElement('span');
        tag.className = 'cm-tag';
        tag.textContent = 'Quick answer';
        msg.prepend(tag);
      }
      row.appendChild(msg);
      log.appendChild(row);
      scroll();
      return row;
    };
    const typing = () => {
      const row = document.createElement('div');
      row.className = 'cm-row bot';
      row.innerHTML = '<div class="cm-msg cm-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></div>';
      log.appendChild(row);
      scroll();
      return row;
    };
    const renderSuggestions = () => {
      suggest.innerHTML = SUGGESTIONS.map(([label, q]) => '<button type="button" class="cm-chip" data-q="' + esc(q) + '">' + label + '</button>').join('');
    };
    const renderAll = () => {
      log.innerHTML = '';
      bubble('assistant', "Hi, I'm **Manova's AI assistant**. Ask me anything about my experience, projects, research or how to get in touch.");
      history.forEach((m) => bubble(m.role, m.content, { local: m.local }));
    };

    // Ask the Hub for the Space's state (CORS-enabled, cheap)
    const checkStatus = () => {
      if (statusChecked) return;
      statusChecked = true;
      const ctrl = 'AbortController' in window ? new AbortController() : null;
      const timer = ctrl && setTimeout(() => ctrl.abort(), 6000);
      fetch('https://huggingface.co/api/spaces/' + SPACE, ctrl ? { signal: ctrl.signal } : undefined)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const stage = d && d.runtime && d.runtime.stage;
          if (!stage || stage === 'RUNNING') setMode('online');
          else if (WAKING.includes(stage)) setMode('waking');
          else setMode('offline');
        })
        .catch(() => setMode('online')) // unknown: try live, fall back on failure
        .finally(() => timer && clearTimeout(timer));
    };

    // Gradio REST: POST queues the call, GET is a server-sent-event stream of
    // "generating" events (the growing answer) ending with "complete".
    const askLive = async (text, onPartial) => {
      const ctrl = 'AbortController' in window ? new AbortController() : null;
      const timer = ctrl && setTimeout(() => ctrl.abort(), mode === 'waking' ? 120000 : 75000);
      const lastAssistant = (data) => {
        try {
          const msgs = JSON.parse(data)[0];
          const last = Array.isArray(msgs) && msgs[msgs.length - 1];
          return last && last.role === 'assistant' && last.content ? String(last.content) : '';
        } catch (e) {
          return '';
        }
      };
      try {
        const past = history.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content }));
        const r = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [text, past] }),
          signal: ctrl ? ctrl.signal : undefined,
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const { event_id: id } = await r.json();
        const s = await fetch(API + '/' + id, { signal: ctrl ? ctrl.signal : undefined });
        if (!s.ok) throw new Error('HTTP ' + s.status);

        let answer = '';
        let event = '';
        let done = false;
        let buffer = '';
        const handle = (line) => {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) {
            if (event === 'error') throw new Error('Assistant error');
            if (event === 'generating' || event === 'complete') {
              const a = lastAssistant(line.slice(5).trim());
              if (a) { answer = a; onPartial && onPartial(answer); }
              if (event === 'complete') done = true;
            }
          }
        };
        if (s.body && s.body.getReader) {
          const reader = s.body.getReader();
          const dec = new TextDecoder();
          while (!done) {
            const { value, done: end } = await reader.read();
            if (end) break;
            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            lines.forEach((l) => handle(l.trim()));
          }
          if (buffer) handle(buffer.trim());
          reader.cancel().catch(() => {});
        } else {
          (await s.text()).split('\n').forEach((l) => handle(l.trim()));
        }
        if (!answer) throw new Error('Empty answer');
        return answer;
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const ask = async (text) => {
      text = text.trim().slice(0, 500);
      if (!text || busy) return;
      busy = true;
      send.disabled = true;
      input.value = '';
      autosize();
      bubble('user', text);
      const dots = typing();
      let reply;
      let local = false;
      let live = null; // bubble that grows while the answer streams in
      let pending = '';
      let frame = 0;
      const pin = () => {
        // Follow the text until the reply gets long, then keep its start in view
        if (live.offsetHeight > log.clientHeight * 0.6) log.scrollTop = live.offsetTop - 12;
        else scroll();
      };
      const onPartial = (partial) => {
        pending = partial;
        if (!live) {
          dots.remove();
          live = bubble('assistant', '');
          live.querySelector('.cm-msg').classList.add('cm-streaming');
        }
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            live.querySelector('.cm-msg').innerHTML = md(pending);
            pin();
          });
        }
      };
      if (mode === 'offline') {
        await new Promise((r) => setTimeout(r, 500));
        reply = localAnswer(text);
        local = true;
      } else {
        try {
          reply = await askLive(text, onPartial);
          if (mode !== 'online') setMode('online');
        } catch (e) {
          if (pending) {
            reply = pending; // keep what already streamed
          } else {
            setMode('offline');
            reply = localAnswer(text);
            local = true;
          }
        }
      }
      if (frame) cancelAnimationFrame(frame);
      dots.remove();
      history.push({ role: 'user', content: text });
      history.push({ role: 'assistant', content: reply, local });
      save();
      let row;
      if (live && !local) {
        row = live;
        const msg = row.querySelector('.cm-msg');
        msg.classList.remove('cm-streaming');
        msg.innerHTML = md(reply);
      } else {
        if (live) live.remove();
        row = bubble('assistant', reply, { local });
      }
      // Long replies: show the start of the answer, not its last line
      if (row.offsetHeight > log.clientHeight * 0.6) log.scrollTop = row.offsetTop - 12;
      else scroll();
      busy = false;
      send.disabled = !input.value.trim();
      if (isOpen && window.matchMedia('(hover: hover)').matches) input.focus();
    };

    const autosize = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    };

    renderSuggestions();
    renderAll();

    suggest.addEventListener('click', (e) => {
      const chip = e.target.closest('.cm-chip');
      if (chip) ask(chip.dataset.q);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ask(input.value);
    });
    input.addEventListener('input', () => {
      autosize();
      send.disabled = busy || !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        ask(input.value);
      }
    });

    const setOpen = (open) => {
      isOpen = open;
      panel.classList.toggle('open', open);
      fab.classList.toggle('open', open);
      fab.setAttribute('aria-expanded', String(open));
      fab.setAttribute('aria-label', open ? 'Close AI assistant' : 'Open AI assistant');
      panel.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('chat-open', open);
      if (open) {
        checkStatus();
        scroll();
        setTimeout(() => input.focus(), 250);
      }
    };

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'close') {
        setOpen(false);
        fab.focus();
      } else if (btn.dataset.act === 'reset' && !busy) {
        history = [];
        save();
        renderAll();
        input.focus();
      }
    });
    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!isOpen);
    });
    document.querySelectorAll('[data-open-chat]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(true);
      })
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
        fab.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (isOpen && !panel.contains(e.target) && !fab.contains(e.target)) setOpen(false);
    });
  }

  // ---------- CV: the profile page prints as a clean A4 CV ----------
  function initPrintCV() {
    const print = () => {
      // Make sure lazy reveals and skill bars are in their final state before printing
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
      const go = () => window.print();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
      else go();
    };
    document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', print));
    // profile.html?cv opens the print dialog straight away ("Download CV" links)
    if (document.querySelector('[data-print]') && /[?&]cv\b/.test(window.location.search)) {
      if (window.history && history.replaceState) history.replaceState(null, '', window.location.pathname);
      window.addEventListener('load', () => setTimeout(print, 400));
    }
  }

  // ---------- Footer year ----------
  function initYear() {
    document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  function init() {
    initLoader();
    initMotionToggle();
    initWorks();
    initHeader();
    initMenu();
    initActiveNav();
    initReveal();
    initTilt();
    initCounters();
    initRoles();
    initFilters();
    initCopy();
    initChatbot();
    initPrintCV();
    initYear();
  }

  // This script sits at the end of <body>, so the DOM is already parsed: start now
  // instead of waiting for DOMContentLoaded (which also waits on module scripts).
  init();

  // ---------- Service worker (network-first, offline fallback) ----------
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
