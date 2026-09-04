/* Passionate Care — mobile navigation toggle.
   Progressive enhancement: nav is visible by default at >=64rem via CSS,
   and this only manages the collapsed state on small screens. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  toggle.hidden = false;
  toggle.setAttribute('aria-expanded', 'false');

  toggle.addEventListener('click', function () {
    var open = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', open ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
})();

/* Passionate Care — the four-question check on the get-paid page.

   COMPLIANCE: this collects no protected health information and never can.
   Everything happens in the visitor's browser. Answers are never submitted,
   transmitted, or persisted: there is no fetch, no form action, and no use of
   localStorage, sessionStorage, or cookies anywhere in this block. Reloading the
   page discards the answers entirely. Do not add a submit button, an analytics
   call, or a free-text field — any of those would turn this into a channel for
   medical detail, which is exactly what the no-PHI rule exists to prevent.

   The nav buttons ship hidden and are revealed here, so they can never appear
   without the code that drives them. With JavaScript off, a <noscript> rule on
   the page hides the card entirely and offers the phone number instead. */
(function () {
  var root = document.querySelector('[data-quiz]');
  if (!root) return;

  var toArray = function (list) { return Array.prototype.slice.call(list); };

  var steps = toArray(root.querySelectorAll('[data-step]'));
  var dots = toArray(root.querySelectorAll('[data-dot]'));
  var variants = toArray(root.querySelectorAll('[data-variant]'));
  var count = root.querySelector('[data-count]');
  var hint = root.querySelector('[data-hint]');
  var nav = root.querySelector('[data-nav]');
  var prev = root.querySelector('[data-prev]');
  var next = root.querySelector('[data-next]');
  var result = root.querySelector('[data-result]');
  var ctaBoth = root.querySelector('[data-cta-both]');
  var ctaEmail = root.querySelector('[data-cta-email]');
  var restart = root.querySelector('[data-restart]');

  if (!steps.length || !count || !hint || !nav || !prev || !next || !result) return;

  var total = steps.length;
  var at = 0;
  var advanceTimer = null;
  var swapTimer = null;

  /* Step transition timing.

     The question leaving starts PRE_ROLL after the tap — inside the advance
     window rather than after it — so the step turns over at PRE_ROLL +
     STEP_OUT = 300ms. The only time added to the interaction is the arriving
     question. */
  var STEP_OUT = 200;
  var STEP_IN = 250;
  var PRE_ROLL = 100;
  var ADVANCE_DELAY = PRE_ROLL + STEP_OUT; // 300ms

  var quietMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  nav.hidden = false;

  function cancelAdvance() {
    if (advanceTimer !== null) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function cancelSwap() {
    if (swapTimer !== null) {
      window.clearTimeout(swapTimer);
      swapTimer = null;
    }
  }

  /* Hold the card at its current height while one question is replaced by
     another, so nothing below it moves during the swap. */
  function lockHeight() { root.style.minHeight = root.offsetHeight + 'px'; }
  function releaseHeight() { root.style.minHeight = ''; }

  function focusStep(i) {
    var box = steps[i].querySelector('.quiz-fieldset');
    if (box) box.focus();
  }

  var MOVING = ['is-leaving', 'is-leaving-back', 'is-entering', 'is-entering-back'];
  function clearMotion() {
    steps.forEach(function (step) {
      MOVING.forEach(function (c) { step.classList.remove(c); });
    });
  }

  /* The current question slides out, then `done` runs. */
  function leave(back, done) {
    if (quietMotion) { done(); return; }
    var from = steps[at];
    lockHeight();
    from.classList.add(back ? 'is-leaving-back' : 'is-leaving');
    swapTimer = window.setTimeout(function () {
      swapTimer = null;
      from.classList.remove('is-leaving', 'is-leaving-back');
      done();
    }, STEP_OUT);
  }

  /* The new question slides in. Focus follows only once it is in place. */
  function enter(i, back, moveFocus) {
    if (quietMotion) {
      releaseHeight();
      if (moveFocus) focusStep(i);
      return;
    }
    var to = steps[i];
    to.classList.add(back ? 'is-entering-back' : 'is-entering');
    swapTimer = window.setTimeout(function () {
      swapTimer = null;
      to.classList.remove('is-entering', 'is-entering-back');
      releaseHeight();
      if (moveFocus) focusStep(i);
    }, STEP_IN);
  }

  function transitionTo(i, back, moveFocus) {
    cancelSwap();
    leave(back, function () {
      showStep(i, false);
      enter(i, back, moveFocus);
    });
  }

  function answerAt(i) {
    var picked = steps[i].querySelector('input:checked');
    return picked ? picked.value : null;
  }

  function answers() {
    return steps.map(function (_, i) { return answerAt(i); });
  }

  /* Routing, not scoring.

     The first question asks what the family is actually looking for, and the
     answer decides which half of the agency they are sent to — the paid family
     caregiver route, the developmental-disability waiver route, or ordinary
     agency-directed home care. The last two questions can override that, and
     they are tested first, because a family outside the counties we reach needs
     to hear that before anything else, and a family not yet on Health First
     Colorado needs to hear about enrolment before they hear about services.

     a[0] need   paid | waiver | home
     a[1] cover  yes  | unsure | no
     a[2] waiver yes  | unsure | no
     a[3] county yes  | unsure | no */
  function verdict(a) {
    if (a[3] === 'no') return 'outside';
    if (a[1] === 'no') return 'medicaid';
    if (a[0] === 'waiver') return a[2] === 'yes' ? 'waiver-ready' : 'waiver-explore';
    if (a[0] === 'paid') return a[2] === 'yes' ? 'paid-waiver' : 'paid';
    return a[2] === 'yes' ? 'home-waiver' : 'home';
  }

  function showStep(i, moveFocus) {
    cancelAdvance();
    clearMotion();
    at = i;
    result.hidden = true;
    hint.hidden = true;

    steps.forEach(function (step, n) { step.hidden = n !== i; });
    dots.forEach(function (dot, n) {
      dot.setAttribute('data-state', n === i ? 'current' : (n < i ? 'done' : 'todo'));
    });

    count.textContent = 'Question ' + (i + 1) + ' of ' + total;
    prev.hidden = i === 0;
    next.hidden = false;
    next.textContent = i === total - 1 ? 'See what this means' : 'Next';

    if (moveFocus) focusStep(i);
  }

  function showResult() {
    cancelAdvance();
    var name = verdict(answers());

    variants.forEach(function (v) {
      v.hidden = v.getAttribute('data-variant') !== name;
    });
    if (ctaBoth) ctaBoth.hidden = name === 'outside';
    if (ctaEmail) ctaEmail.hidden = name !== 'outside';

    steps.forEach(function (step) { step.hidden = true; });
    dots.forEach(function (dot) { dot.setAttribute('data-state', 'done'); });
    count.textContent = 'What this suggests';
    hint.hidden = true;
    next.hidden = true;
    prev.hidden = false;
    result.hidden = false;

    var heading = result.querySelector('[data-variant]:not([hidden]) h3');
    if (heading) heading.focus();
  }

  function advance() {
    cancelAdvance();
    if (!answerAt(at)) {
      hint.hidden = false;
      var box = steps[at].querySelector('.quiz-fieldset');
      if (box) box.focus();
      return;
    }
    if (at === total - 1) {
      // the last question leaves, then the result card plays its own entrance
      cancelSwap();
      leave(false, function () { showResult(); releaseHeight(); });
    } else {
      transitionTo(at + 1, false, true);
    }
  }

  next.addEventListener('click', advance);

  prev.addEventListener('click', function () {
    cancelAdvance();
    cancelSwap();
    releaseHeight();
    if (!result.hidden) {
      // coming back from the result there is no question to slide out
      showStep(total - 1, false);
      enter(total - 1, true, true);
    } else if (at > 0) {
      transitionTo(at - 1, true, true);
    }
  });

  /* Auto-advance, but only when the answer was chosen with a pointer.

     Arrow keys move through a radio group and fire `change` on every stop, so
     auto-advancing on `change` alone would skip a keyboard user past the options
     they were still reading. Tracking the pointer gesture keeps the two apart:
     tap or click advances itself, arrow keys only select, and Enter advances
     deliberately. */
  var pickedByPointer = false;

  function notePointer(event) {
    pickedByPointer = !!(event.target && event.target.closest &&
                         event.target.closest('.quiz-option'));
  }
  root.addEventListener('mousedown', notePointer);
  root.addEventListener('touchstart', notePointer, { passive: true });

  root.addEventListener('keydown', function (event) {
    pickedByPointer = false;
    if (event.key !== 'Enter' || !event.target || event.target.type !== 'radio') return;
    event.preventDefault(); // no form to submit; Enter means "go on"
    advance();
  });

  root.addEventListener('change', function (event) {
    if (!event.target || event.target.type !== 'radio') return;
    hint.hidden = true;
    if (!pickedByPointer) return;
    pickedByPointer = false;
    cancelAdvance();
    advanceTimer = window.setTimeout(function () {
      advanceTimer = null;
      advance();
    }, PRE_ROLL);
  });

  if (restart) {
    restart.addEventListener('click', function () {
      cancelAdvance();
      cancelSwap();
      releaseHeight();
      toArray(root.querySelectorAll('input[type="radio"]')).forEach(function (input) {
        input.checked = false;
      });
      pickedByPointer = false;
      showStep(0, true);
    });
  }

  showStep(0, false);
})();

/* Passionate Care — scroll reveal.

   The page ships visible. This only hides anything after it has confirmed it can
   put it back: IntersectionObserver present, and the visitor has not asked for
   reduced motion. If either check fails, nothing is touched and the page behaves
   exactly as it did before.

   Anything already on screen when the script runs is marked revealed before the
   hiding rule is switched on, so the hero and anything else above the fold never
   animates and never flashes.

   Motion is opacity and transform only — neither affects layout, so nothing
   shifts as elements appear. Each element reveals once and is then unobserved,
   so scrolling back up does not replay it. */
(function () {
  var root = document.documentElement;

  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var main = document.getElementById('main');
  if (!main) return;

  var toArray = function (list) { return Array.prototype.slice.call(list); };

  var STAGGER = 70;    // ms between neighbours in the same group
  var MAX_STEPS = 5;   // beyond this the later ones stop waiting longer

  var targets = [];
  toArray(main.querySelectorAll(':scope > section')).forEach(function (section) {
    // The hero is above the fold on every page; it is never part of this.
    if (section.classList.contains('hero')) return;

    toArray(section.querySelectorAll(':scope > .wrap > *')).forEach(function (block) {
      // A grid of cards comes in card by card; anything else arrives as one piece.
      var group = block.matches('.card-grid, .steps, .media-row, .pathways, .chip-set')
        ? toArray(block.children)
        : [block];

      group.forEach(function (el, i) {
        el.setAttribute('data-reveal', '');
        if (group.length > 1) {
          el.style.setProperty('--reveal-delay', Math.min(i, MAX_STEPS) * STAGGER + 'ms');
        }
        targets.push(el);
      });
    });
  });

  if (!targets.length) return;

  var viewport = window.innerHeight || root.clientHeight;
  targets.forEach(function (el) {
    if (el.getBoundingClientRect().top < viewport) el.classList.add('is-revealed');
  });

  root.classList.add('js-reveal');

  /* A block is revealed once it has been seen, or once it has been passed.

     Observer callbacks are delivered asynchronously, so a fast enough scroll —
     a hard flick of the scrollbar, or a lazy image loading and displacing what
     is below it — can carry a block from below the fold to above it between two
     deliveries. The entry then arrives saying isIntersecting: false, and a
     callback that only looks at that flag leaves the block at opacity 0 for the
     rest of the visit, with no second chance on the way down.

     Testing the top edge instead distinguishes the two reasons an entry can be
     non-intersecting: still below the fold, which is the case worth waiting for,
     and already gone past, which is not. Nothing is revealed early. */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0 });

  var waiting = [];
  targets.forEach(function (el) {
    if (!el.classList.contains('is-revealed')) {
      observer.observe(el);
      waiting.push(el);
    }
  });

  /* Reconciliation, for the blocks the observer never reports at all.

     An IntersectionObserver reports state *changes*. A block that is below the
     fold at one delivery and above it at the next has no change to report, and
     so produces no entry — not even the isIntersecting: false entry the callback
     above handles. It then stays at opacity 0 for the rest of the visit, because
     the walk down never brings it back.

     It takes a very fast scroll: a flick of the scrollbar, or a lazily loaded
     image displacing everything beneath it. Rare, but "a section of the page is
     invisible until you reload" is too poor a failure to leave in.

     So once scrolling stops, anything still waiting that is no longer below the
     fold is revealed, on the same threshold the observer uses. The listener is
     passive, does its work in one animation frame per burst of scrolling, and
     takes itself off as soon as nothing is waiting. */
  var ticking = false;

  function reconcile() {
    ticking = false;
    var edge = (window.innerHeight || root.clientHeight) - 60;
    waiting = waiting.filter(function (el) {
      if (!el.classList.contains('is-revealed')) {
        if (el.getBoundingClientRect().top > edge) return true;
        el.classList.add('is-revealed');
        observer.unobserve(el);
      }
      return false;
    });
    if (!waiting.length) window.removeEventListener('scroll', onScroll);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(reconcile);
  }

  if (waiting.length) window.addEventListener('scroll', onScroll, { passive: true });
})();

/* Passionate Care — image rotators.

   Two slots crossfade three pictures instead of showing one: the home hero and
   the band halfway down About. Everything here is enhancement. The markup
   already shows frame one, so if this block never runs the visitor still gets a
   picture — just a still one.

   Three things this deliberately does not do:

   - It does not run under reduced motion. Not a shorter fade, not a longer
     hold: it does not arm at all, and if the visitor turns reduced motion on
     while the page is open it stops and puts frame one back.
   - It does not fetch anything up front. Frame one has a real src in the
     markup; every later frame carries data-src and is only fetched PRELOAD
     before its turn, so a visitor who leaves after four seconds pays for one
     image rather than three.
   - It does not run out of sight. A rotator that is scrolled past, or in a
     background tab, stops; it resumes where it left off.

   Layout cannot shift: the frames are stacked in a single grid cell, so the
   container's height is a frame's height whichever frame is showing. */
(function () {
  var HOLD = 7000;     // ms a frame holds before the next one starts arriving
  var FADE = 1500;     // ms of crossfade; must match the transition in site.css
  var PRELOAD = 2500;  // ms of head start given to the next frame's download

  var roots = Array.prototype.slice.call(document.querySelectorAll('[data-rotator]'));
  if (!roots.length) return;

  var mq = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var reduced = function () { return !!(mq && mq.matches); };

  var rotators = roots.map(build).filter(Boolean);
  if (!rotators.length) return;

  function build(root) {
    var frames = Array.prototype.slice.call(root.children).filter(function (el) {
      return el.classList.contains('rotator-frame');
    });
    // One frame is a picture, not a rotation. Leave it entirely alone.
    if (frames.length < 2) return null;

    var at = 0;
    var hold = null;   // timer: when to start the next crossfade
    var pre = null;    // timer: when to start fetching the next frame
    var swap = null;   // timer: when to take the outgoing frame back out of flow
    var onScreen = true;

    function next() { return (at + 1) % frames.length; }

    function load(i) {
      var imgs = frames[i].querySelectorAll('img[data-src]');
      Array.prototype.forEach.call(imgs, function (img) {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
    }

    function advance() {
      var from = frames[at];
      var to = frames[next()];

      /* Put the incoming frame back into flow, then force the browser to work
         out its styles before changing opacity. Without the reflow the two
         style changes coalesce and the frame appears instead of fading. */
      to.hidden = false;
      void to.offsetWidth;

      to.classList.add('is-current');
      from.classList.remove('is-current');
      at = next();

      // Once the fade is over, only the current frame is left in the stack.
      clearTimeout(swap);
      swap = setTimeout(function () { from.hidden = true; }, FADE);

      schedule();
    }

    function schedule() {
      clearTimeout(hold);
      clearTimeout(pre);
      pre = setTimeout(function () { load(next()); }, HOLD - PRELOAD);
      hold = setTimeout(advance, HOLD);
    }

    function stop() {
      clearTimeout(hold); hold = null;
      clearTimeout(pre); pre = null;
    }

    /* Back to frame one and nothing pending. Used when a visitor asks for
       reduced motion partway through — the CSS forces frame one visible, and
       this makes the script's idea of the world match what is on screen. */
    function reset() {
      stop();
      clearTimeout(swap); swap = null;
      frames.forEach(function (f, i) {
        f.classList.toggle('is-current', i === 0);
        f.hidden = i !== 0;
      });
      at = 0;
    }

    function sync() {
      if (reduced()) { reset(); root.removeAttribute('data-rotating'); return; }
      if (onScreen && document.visibilityState !== 'hidden') {
        if (!hold) schedule();
        root.setAttribute('data-rotating', '');
      } else {
        stop();
        root.removeAttribute('data-rotating');
      }
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { onScreen = e.isIntersecting; });
        sync();
      }, { threshold: 0.2 }).observe(root);
    }

    return { sync: sync, reset: reset };
  }

  function syncAll() { rotators.forEach(function (r) { r.sync(); }); }

  document.addEventListener('visibilitychange', syncAll);

  if (mq) {
    // Safari below 14 only has the deprecated listener.
    if (mq.addEventListener) mq.addEventListener('change', syncAll);
    else if (mq.addListener) mq.addListener(syncAll);
  }

  syncAll();
})();
