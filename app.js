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
    const MIN = 1400;
    const MAX = 4000;
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

  // ---------- Career-takAI chatbot (Gradio, loaded on first open) ----------
  function initChatbot() {
    const fab = document.getElementById('chat-fab');
    const panel = document.getElementById('chat-panel');
    const body = document.getElementById('chat-body');
    const closeBtn = document.getElementById('chat-close');
    if (!fab || !panel || !body) return;

    // Keep this version in sync with the Space's Gradio SDK version.
    const GRADIO_SRC = 'https://gradio.s3-us-west-2.amazonaws.com/5.34.2/gradio.js';
    const SPACE = 'MANO066/Career-takAI';
    // Stages in which the Space can serve (or wake up and serve) the app.
    const USABLE = ['RUNNING', 'SLEEPING', 'APP_STARTING', 'RUNNING_BUILDING', 'RUNNING_APP_STARTING', 'BUILDING'];
    let loaded = false;
    let isOpen = false;

    const showError = () => {
      body.innerHTML =
        '<div class="chat-state"><i class="ti ti-alert-circle"></i>' +
        '<p>The AI assistant is offline right now.</p>' +
        '<p>Email <a href="mailto:manomathew1943@gmail.com">manomathew1943@gmail.com</a> instead, or</p>' +
        '<p><a href="https://huggingface.co/spaces/' + SPACE + '" target="_blank" rel="noopener">Open it on Hugging Face</a></p></div>';
    };

    // Ask the Hub whether the Space is healthy; on any lookup failure, try anyway.
    const spaceUsable = () => {
      const ctrl = 'AbortController' in window ? new AbortController() : null;
      const timer = ctrl && setTimeout(() => ctrl.abort(), 5000);
      return fetch('https://huggingface.co/api/spaces/' + SPACE, ctrl ? { signal: ctrl.signal } : undefined)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const stage = d && d.runtime && d.runtime.stage;
          return !stage || USABLE.includes(stage);
        })
        .catch(() => true)
        .finally(() => timer && clearTimeout(timer));
    };

    const load = () => {
      if (loaded) return;
      loaded = true;
      spaceUsable().then((usable) => (usable ? loadGradio() : showError()));
    };

    const loadGradio = () => {
      const mount = () => {
        const app = document.createElement('gradio-app');
        app.setAttribute('space', SPACE);
        app.setAttribute('theme_mode', 'light');
        app.setAttribute('eager', 'true');
        app.setAttribute('container', 'false');
        app.setAttribute('info', 'false');
        app.style.cssText = 'display:block;width:100%;min-height:100%;';
        body.innerHTML = '';
        body.appendChild(app);
      };
      if (window.customElements && customElements.get('gradio-app')) {
        mount();
        return;
      }
      const s = document.createElement('script');
      s.type = 'module';
      s.src = GRADIO_SRC;
      s.onerror = showError;
      document.head.appendChild(s);
      const timeout = setTimeout(showError, 15000);
      customElements.whenDefined('gradio-app').then(() => {
        clearTimeout(timeout);
        mount();
      });
    };

    const setOpen = (open) => {
      isOpen = open;
      panel.classList.toggle('open', open);
      fab.classList.toggle('open', open);
      fab.setAttribute('aria-expanded', String(open));
      fab.setAttribute('aria-label', open ? 'Close AI assistant' : 'Open AI assistant');
      panel.setAttribute('aria-hidden', String(!open));
      if (open) {
        load();
        setTimeout(() => closeBtn && closeBtn.focus(), 250);
      }
    };

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!isOpen);
    });
    closeBtn && closeBtn.addEventListener('click', () => {
      setOpen(false);
      fab.focus();
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
    initYear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // ---------- Service worker (network-first, offline fallback) ----------
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
