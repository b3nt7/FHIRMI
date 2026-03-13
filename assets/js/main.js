/* assets/js/main.js
   - Floating TOC + scroll‑spy (.is-active on .btn in #toc)
   - Open-only behavior for collapsibles:
       * On load: open first TWO <details.collapse>
       * On navigation (TOC/content): open ancestor <details>, or first child <details> if none
   - Back to Top:
       * Converts legacy "back to contents" links to a Back‑to‑Top action
       * Uses #top anchor (auto-created if absent) without breaking the browser Back button
   - No preventDefault() on hash links unless you explicitly enable smooth-scroll
*/
(function () {
  'use strict';

  // ------------------------------------------------------------
  // 0) JS-available signal
  // ------------------------------------------------------------
  document.documentElement.classList.add('js');

  // Ensure a #top anchor exists so href="#top" always works (and Back button too)
  (function ensureTopAnchor() {
    if (!document.getElementById('top')) {
      const topAnchor = document.createElement('div');
      topAnchor.id = 'top';
      // Visually hidden, no layout shift
      topAnchor.className = 'top-anchor';
      document.body.prepend(topAnchor);
    }
  })();

  // ------------------------------------------------------------
  // 1) Existing TOC expand/collapse toggle (kept)
  // ------------------------------------------------------------
  const btn = document.querySelector('.toc__toggle');
  const list = document.getElementById('toc-list');
  if (btn && list) {
    btn.addEventListener('click', () => {
      list.classList.toggle('is-open');
      const exp = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!exp));
    });
  }

  // ------------------------------------------------------------
  // 2) Open-first-two collapsibles on load (open-only)
  // ------------------------------------------------------------
  const detailsAll = document.querySelectorAll('main details.collapse');
  if (detailsAll.length > 0) detailsAll[0].setAttribute('open', '');
  if (detailsAll.length > 1) detailsAll[1].setAttribute('open', '');

  // ------------------------------------------------------------
  // 3) Helper: Open-only for a given target id
  //    A) If target is INSIDE <details.collapse>, open that ancestor
  //    B) Else if target CONTAINS a <details.collapse>, open its first child
  // ------------------------------------------------------------
  function ensureSectionOpenById(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;

    const parentDetails = el.closest('details.collapse');
    if (parentDetails) {
      parentDetails.setAttribute('open', '');
      return;
    }
    const childDetails = el.querySelector('details.collapse');
    if (childDetails) {
      childDetails.setAttribute('open', '');
    }
  }

  // ------------------------------------------------------------
  // 4) Scroll‑spy: highlight active TOC pill
  // ------------------------------------------------------------
  const toc = document.getElementById('toc');
  const links = toc ? toc.querySelectorAll('.btn[href^="#"]') : [];
  const targets = links.length
    ? Array.from(links)
        .map(a => document.getElementById(a.getAttribute('href').slice(1)))
        .filter(Boolean)
    : [];

  function setActiveById(id) {
    if (!toc || !links.length || !id) return;
    links.forEach(l => l.classList.remove('is-active'));
    const active = toc.querySelector(`.btn[href="#${CSS.escape(id)}"]`);
    if (active) {
      active.classList.add('is-active');
      // Scroll the active button into view within the horizontally-scrollable
      // navbox list. block:'nearest' prevents the page from scrolling vertically.
      active.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }

  // ------------------------------------------------------------
  // 5) TOC clicks: highlight + open-only; leave default navigation (hash) intact
  // ------------------------------------------------------------
  if (toc) {
    toc.addEventListener('click', (e) => {
      const a = e.target.closest('.btn[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      setActiveById(id);
      ensureSectionOpenById(id);
      // No preventDefault: keep hash updates so Back button works.
    });
  }

  // ------------------------------------------------------------
  // 6) Back‑to‑Top behavior
  //    - Convert legacy "back to contents" links into Back‑to‑Top
  //    - We map:
  //        a.btn.back-to-toc  OR  a[href="#toc"]  →  navigate to #top
  //    - We still do NOT preventDefault, so history is preserved.
  // ------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const backToContents = e.target.closest('a.btn.back-to-toc, a[href="#toc"], a[aria-label="back to contents"], a[aria-label="Back to contents"]');
    if (!backToContents) return;

    // If href is already "#top", nothing to do; otherwise, re-point to #top so hash history is clean
    if (backToContents.getAttribute('href') !== '#top') {
      backToContents.setAttribute('href', '#top');
    }

    // Let the default anchor navigation set the hash to #top (Back button friendly).
    // As a UX assist (because #toc is fixed and may already be visible), nudge scroll to top after frame.
    requestAnimationFrame(() => {
      if (window.scrollY > 8) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, { capture: true });

  // ------------------------------------------------------------
  // 7) Any in-page anchor click (from content): open-only augmentation
  //    - Do NOT preventDefault, to preserve browser Back button
  // ------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;

    // If this is #top we don't open anything; otherwise open relevant details
    if (id !== 'top') {
      ensureSectionOpenById(id);
      if (toc && a.closest('#toc')) setActiveById(id);
    }
  });

  // ------------------------------------------------------------
  // 8) On load with hash: highlight (if TOC has that id) + ensure visible
  // ------------------------------------------------------------
  if (location.hash) {
    const initialId = location.hash.replace('#', '');
    if (document.getElementById(initialId)) {
      setActiveById(initialId);
      ensureSectionOpenById(initialId);
    }
  }

  // ------------------------------------------------------------
  // 9) IntersectionObserver scroll‑spy (preferred) + hashchange sync
  // ------------------------------------------------------------
  if (targets.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(en => en.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveById(visible.target.id);
    }, {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: [0.1, 0.5, 0.75]
    });
    targets.forEach(t => io.observe(t));

    window.addEventListener('hashchange', () => {
      const id = location.hash.replace('#', '');
      if (document.getElementById(id)) {
        setActiveById(id);
        ensureSectionOpenById(id);
      }
    });

  } else if (targets.length) {
    // ----------------------------------------------------------
    // 10) Fallback scroll‑spy without IntersectionObserver
    // ----------------------------------------------------------
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const viewportMid = window.scrollY + window.innerHeight / 2;
        const best = targets
          .map(el => ({ el, top: el.getBoundingClientRect().top + window.scrollY }))
          .filter(({ top }) => top <= viewportMid)
          .sort((a, b) => b.top - a.top)[0];
        if (best?.el?.id) setActiveById(best.el.id);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  // ------------------------------------------------------------
  // 11) Star rating
  //     Click a star → mark that star and all lower ones as selected
  //     (aria-checked="true" + .selected); deselect stars above.
  //     Also clears any validation error state left by a failed submit.
  //     Keyboard: Space / Enter trigger the click (belt-and-braces
  //     for role="radio" behaviour in older assistive tech).
  // ------------------------------------------------------------
  const starBtns   = document.querySelectorAll('.stars .star');
  const starsPill  = document.querySelector('.stars');
  const starsError = document.getElementById('stars-error');

  function clearStarError() {
    if (starsPill)  starsPill.classList.remove('has-error');
    if (starsError) { starsError.classList.add('is-hidden'); starsError.setAttribute('aria-hidden', 'true'); }
  }

  if (starBtns.length) {
    starBtns.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.rating, 10);
        starBtns.forEach(s => {
          const selected = parseInt(s.dataset.rating, 10) <= rating;
          s.setAttribute('aria-checked', String(selected));
          s.classList.toggle('selected', selected);
        });
        clearStarError();
      });

      star.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          star.click();
        }
      });
    });
  }

  // ------------------------------------------------------------
  // 12) Feedback submission — session-token state management
  //
  //     A single button (#submit-feedback) serves all three states:
  //       fresh     — label "Send";               click → submit
  //       submitted — label "Update my feedback"; click → open editing
  //       editing   — label "RE-SEND";            click → submit (upsert)
  //
  //     State is indicated by .feedback-submitted on .collapse-content.
  //     No button is ever hidden — only the label and behaviour change.
  //
  //     sessionStorage key : 'ucb_feedback'
  //     Stored object      : { token, rating, comment, anonymous }
  //     Token is session-only and not linked to any user identity.
  // ------------------------------------------------------------
  // Cloudflare Worker endpoint (D1 database — ucb-mi-feedback)
  const FEEDBACK_ENDPOINT = 'https://ucb-mi-feedback.fw6k95f6d8.workers.dev';

  const actionBtn       = document.getElementById('submit-feedback');
  const feedbackMsg     = document.getElementById('feedback-message');
  const collapseContent = document.querySelector('#feedback .collapse-content');
  const STORAGE_KEY     = 'ucb_feedback';
  const feedbackSection = document.getElementById('feedback');
  const docNumber       = feedbackSection?.dataset.documentNumber     ?? '';
  const caseNumber      = feedbackSection?.dataset.caseResponseNumber ?? '';
  const labelUpdate     = feedbackSection?.dataset.labelUpdate ?? 'Update my feedback';
  const labelResend     = feedbackSection?.dataset.labelResend ?? 'RE-SEND';
  const msgThanks       = feedbackSection?.dataset.msgThanks   ?? 'Thank you for your feedback!';

  function generateToken() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // Apply a numeric rating (1–5) to the star buttons
  function applyRating(rating) {
    starBtns.forEach(s => {
      const selected = parseInt(s.dataset.rating, 10) <= rating;
      s.setAttribute('aria-checked', String(selected));
      s.classList.toggle('selected', selected);
    });
  }

  // Validate, save, and enter submitted state (used by Send and RE-SEND)
  function performSubmit() {
    const hasRating = Array.from(starBtns).some(s => s.getAttribute('aria-checked') === 'true');

    if (!hasRating) {
      if (starsPill) {
        starsPill.classList.remove('has-error');
        void starsPill.offsetWidth; // force reflow so shake restarts
        starsPill.classList.add('has-error');
      }
      if (starsError) {
        starsError.classList.remove('is-hidden');
        starsError.removeAttribute('aria-hidden');
      }
      starsPill?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Build data — reuse existing token (upsert) or mint a new one
    const prev      = sessionStorage.getItem(STORAGE_KEY);
    const token     = prev ? JSON.parse(prev).token : generateToken();
    const anonymous = document.getElementById('anonymous')?.checked ?? false;
    const data      = {
      token,
      rating:                Array.from(starBtns).filter(s => s.getAttribute('aria-checked') === 'true').length,
      comment:               document.getElementById('comment')?.value.trim() ?? '',
      anonymous,
      'document-number':     docNumber,
      ...(!anonymous ? { 'case-response-number': caseNumber } : {}),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    enterSubmittedState(data);

    // Fire-and-forget POST to Cloudflare Worker — UI is not blocked by this.
    // Failures are logged to the console but never shown to the user.
    fetch(FEEDBACK_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    }).catch(err => console.warn('Feedback submission failed:', err));
  }

  // Freeze the form and switch button label to "Update my feedback"
  function enterSubmittedState(data) {
    applyRating(data.rating);
    const textarea  = document.getElementById('comment');
    const anonCheck = document.getElementById('anonymous');
    if (textarea)  { textarea.value  = data.comment;   textarea.disabled  = true; }
    if (anonCheck) { anonCheck.checked = data.anonymous; anonCheck.disabled = true; }

    if (actionBtn) actionBtn.textContent = labelUpdate;
    collapseContent?.classList.add('feedback-submitted');
    if (feedbackMsg) feedbackMsg.textContent = msgThanks;
    clearStarError();
  }

  // Re-enable the form and switch button label to "RE-SEND"
  function enterEditingState(data) {
    applyRating(data.rating);
    const textarea  = document.getElementById('comment');
    const anonCheck = document.getElementById('anonymous');
    if (textarea)  { textarea.value  = data.comment;   textarea.disabled  = false; }
    if (anonCheck) { anonCheck.checked = data.anonymous; anonCheck.disabled = false; }

    if (actionBtn) actionBtn.textContent = labelResend;
    collapseContent?.classList.remove('feedback-submitted');
    if (feedbackMsg) feedbackMsg.textContent = '';
    clearStarError();
  }

  // On page load: restore submitted state if a token exists from this session
  (function restoreState() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { enterSubmittedState(JSON.parse(raw)); }
    catch (_) { sessionStorage.removeItem(STORAGE_KEY); }
  })();

  // Single click handler — behaviour depends on current state
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (collapseContent?.classList.contains('feedback-submitted')) {
        // Submitted → enter editing
        const raw = sessionStorage.getItem(STORAGE_KEY);
        try {
          enterEditingState(raw ? JSON.parse(raw) : { rating: 0, comment: '', anonymous: false });
        } catch (_) {
          enterEditingState({ rating: 0, comment: '', anonymous: false });
        }
      } else {
        // Fresh or editing → submit
        performSubmit();
      }
    });
  }

  // ------------------------------------------------------------
  // 13) Print preparation
  //     beforeprint: open every details.collapse so the UA shows
  //     all content on paper (CSS also forces display, belt-and-braces).
  //     No afterprint handler — leaves sections open post-print,
  //     which is the simpler, safer default.
  // ------------------------------------------------------------
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details.collapse').forEach(d => d.setAttribute('open', ''));
  });

})();