/* ============================================================================
 * quack.js — v6.3.quack gag layer for TPS Schedule
 *
 * Self-contained, framework-free. index.html loads this file and calls
 * window.Quack.setName(name) whenever the search name changes. Nothing here
 * touches schedule data or app logic; if this file fails to load the app
 * works exactly as v6.3.
 *
 * Activation (rollout):
 *   - The search name (normalized) must be in TARGETS below (the whole class).
 *   - Each day a coverage % (multiples of 10, random walk with an upward
 *     drift) decides how many of TARGETS are hit; which ones is a seeded
 *     shuffle of the list for that date, so every phone agrees.
 *   - A hit student gets one gag mode for the whole day (never the same mode
 *     as the last day they were hit), with fresh random content each open.
 *   - Quack.plan(14) in the console prints the next 14 days of the rollout.
 *   - URL override for testing:  ?quack=1  force on (auto mode)
 *                                ?quack=0  force off
 *                                ?quack=sparks|bread|crash|ad|captcha  force on in that mode
 *                                ?captcha=grid|until|text|slider|facing  pick the first challenge
 *
 * Modes (one per hit student per day, chosen by the rollout engine):
 *   sparks — ambient duck fly-bys/waddles + quack & duck-shower on every tap
 *   bread  — small ducks roam the screen; every tap drops a bread crumb and
 *            the ducks run to the nearest crumb and eat it
 *   crash  — the first time an event is expanded, a duck flies straight into
 *            the screen, cracks it, and slides down like it's on a window
 *   ad     — a fake newspaper-style interstitial ad: loads slowly, tiny [x]
 *            that moves, tapping the ad "opens" it; closing it summons a
 *            finger-wagging duck ("nuh-uh-uh, not quite yet") and another ad
 *   captcha— "prove you are human and not a duck": duck-only challenges
 *            (grid select, tap-until-none, distorted "quack", pond puzzle
 *            slider, facing left/right); N rounds before they're through
 *
 * Console helpers while testing: Quack.setMode('bread'), Quack.crash(),
 * Quack.showAd(), Quack.showCaptcha(), Quack.burst(x, y), Quack.quack(),
 * Quack.config.<key> = value
 * ========================================================================== */
(function () {
    'use strict';

    // ---------------------------------------------------------------- config
    // The class — the daily coverage % is taken from this list. Names exactly
    // as on the Whiteboard (asterisks and case are ignored when matching).
    var TARGETS = [
        // flight test
        'Bertke, F', 'Bradley, J', 'Clements, J *', 'Dobbs, D', 'Ghesquiere, L', 'Graham, J',
        'Knoerr, S', 'Leaf, A', 'Martinez, P', 'Morrison, J', 'Novack, R', 'Nyang, B',
        'Olson, C', 'Oren, E', 'Orfitelli, N', 'Oshea, P', 'Pessolano, C', 'Peterson, R',
        'Pope, D', 'Rogers, H', 'Root, S', 'Ryan, J', 'Sternat, N', 'Umland, M',
        // space
        'Barbosa, T', 'Barone, R', 'Bartkowiak, R', 'Butcher, M', 'Doyle, D', 'Holmes, C',
        'Konnath, M', 'Pitre, S', 'Quick, L', 'Sargent, R'
    ];

    var CFG = {
        // --- sparks mode ---------------------------------------------------
        // ambient fly-bys / waddles while active (ms between spawns)
        ambientMinDelay: 12000,
        ambientMaxDelay: 28000,
        welcomeFlock: 10,         // ducks that fly across when the gag first activates
        // tap shower
        sparkCount: [25, 35],     // min/max ducks per tap
        sparkSize: [14, 28],      // px
        sparkSpeed: [260, 640],   // px/s
        gravity: 1500,            // px/s^2
        drag: 0.985,
        sparkLife: [0.8, 1.3],    // seconds
        // selector for "buttons and events" that should quack
        tapSelector: 'button, a, .cursor-pointer, [role="button"]',

        // --- bread mode ----------------------------------------------------
        breadDucks: 7,            // how many ducks roam the screen
        breadDuckSize: [26, 36],  // px
        wanderSpeed: [20, 50],    // px/s while wandering
        runSpeed: [110, 180],     // px/s when heading for bread
        wanderPause: [0.6, 2.5],  // seconds a duck idles between wander legs
        crumbSize: 25,            // px
        crumbBites: 8,            // pecks needed to finish a crumb
        peckTime: 0.35,           // seconds per peck
        maxCrumbs: 40,            // oldest crumbs vanish beyond this

        // --- crash mode ----------------------------------------------------
        crashDelay: 100,          // ms after the first event expand before the duck launches
        crashFlight: 0.8,         // seconds of approach flight
        crashSize: 70,            // base px of the duck (it scales up ~3.5x on impact)
        slideTime: 3.2,           // seconds to slide off the screen
        crackHold: 6000,          // ms the cracked glass stays before fading

        // --- ad mode -------------------------------------------------------
        adDelay: 1500,            // ms after the schedule renders before the ad pops
        adLoadTime: [2.5, 4.5],   // seconds the fake "Loading ad…" spinner runs
        adSkipDelay: 5,           // seconds of "Skip ad in N" before the [x] appears
        adXSize: 15,              // px — the [x] is deliberately tiny
        adXLeftChance: 0.35,      // chance the [x] shows up top-left instead of top-right
        adRounds: 2,              // ads to close before the duck finally lets them through
        adRepeatMinutes: 0,       // 0 = once per page load; else re-show every N minutes
        nuhTime: 2600,            // ms the finger-wagging duck stays up

        // --- captcha mode --------------------------------------------------
        captchaDelay: 1200,       // ms after the schedule renders before the check appears
        captchaRounds: 2,         // challenges to pass before they're "verified"
        captchaRespawnChance: 0.5,// tap-until-none: chance a tapped duck is replaced by another duck
        captchaRespawnMax: 4,     // cap on respawns so it always ends
        captchaSliderTolerance: 7,// px tolerance for the pond puzzle slider

        // --- rollout -------------------------------------------------------
        rollout: {
            seed: 'quack-2026',       // change to reshuffle everything (who, when, which gag)
            startDate: '2026-09-30',  // day 0 — before this nobody is hit
            startPct: 10,             // coverage on day 0
            rampDays: 14,             // upward drift reaches full strength after this many days
            modes: ['sparks', 'bread', 'crash', 'ad', 'captcha'],
            always: ['Sick, T', 'Miller, E', 'Echegaray, S', 'Peterson, W']  // skip the lottery, hit every day
        },

        // --- sound ---------------------------------------------------------
        // docs/quack.mp3 (Pixabay, freesound_community "075176 Duck Quack") is
        // fetched + decoded into memory on activation and played from a
        // WebAudio buffer, so each tap is instant. If the file is missing or
        // fails to decode, a synthesized quack is used instead.
        audioUrl: 'quack.mp3',
        clipStart: 0.28,          // seconds into the file to start playing (quack sits at 0.30-0.48s)
        clipDuration: 0.35,       // seconds to play (0 = to end of file)
        volume: 0.9,
        pitchJitter: [0.92, 1.12]
    };

    // ---------------------------------------------------------------- state
    var state = {
        active: false,
        mode: 'sparks',
        force: null,            // null | true | false (from URL)
        forceMode: null,
        layer: null,
        listener: null,
        timers: [],
        // sparks
        ambientTimer: null,
        particles: [],
        raf: null,
        lastFrame: 0,
        // bread
        bread: null,            // { ducks:[], crumbs:[], raf, last }
        // crash
        crashed: false,
        crashEls: [],
        // ad / captcha
        adDone: false,
        capDone: false,
        forceCaptcha: null,
        manual: false,
        nextMode: null,         // decided by the rollout for the current name
        // audio
        audioCtx: null,
        audioBuffer: null,
        audioLoading: false
    };

    // ---------------------------------------------------------------- utils
    function rand(a, b) { return a + Math.random() * (b - a); }
    function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function later(fn, ms) { var t = setTimeout(fn, ms); state.timers.push(t); return t; }

    function normalizeName(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function readUrlOverride() {
        try {
            var q = new URLSearchParams(window.location.search).get('quack');
            if (q === null) return;
            q = q.toLowerCase();
            if (q === '0' || q === 'off' || q === 'false') { state.force = false; return; }
            state.force = true;
            if (['sparks', 'bread', 'crash', 'ad', 'captcha'].indexOf(q) >= 0) state.forceMode = q;
            var c = new URLSearchParams(window.location.search).get('captcha');
            if (c && ['grid', 'until', 'text', 'slider', 'facing'].indexOf(c.toLowerCase()) >= 0) state.forceCaptcha = c.toLowerCase();
        } catch (e) { /* ignore */ }
    }

    // ---------------------------------------------------------------- rollout engine
    // Seeded PRNG so every device computes the same plan from (seed, date, name).
    function hash32(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rng(seedStr) {
        var a = hash32(seedStr);
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function seededShuffle(arr, seedStr) {
        var r = rng(seedStr), a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function todayStr(d) {
        d = d || new Date();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    function dayIndex(dateStr) {
        var a = dateStr.split('-').map(Number), b = CFG.rollout.startDate.split('-').map(Number);
        return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000);
    }

    // Coverage % for a day: random walk in steps of 10/20/30, mostly upward,
    // with the upward bias growing over rampDays. Clamped to 0..100.
    function coverageFor(di) {
        if (di < 0) return 0;
        var R = CFG.rollout, pct = R.startPct;
        for (var d = 1; d <= di; d++) {
            var r = rng(R.seed + '|cov|' + d);
            var drift = Math.min(1, d / R.rampDays);
            var pUp = 0.40 + 0.25 * drift, pDown = 0.35 - 0.10 * drift;   // early: near-fair walk; later: climbs, still dips ~25% of days
            var x = r(), dir = x < pUp ? 1 : x < pUp + pDown ? -1 : 0;
            var m = r(), mag = m < 0.7 ? 10 : m < 0.95 ? 20 : 30;
            pct = clamp(pct + dir * mag, 0, 100);
        }
        return pct;
    }

    // Everyone hit on a date, in seeded order.
    function hitListFor(dateStr) {
        var R = CFG.rollout;
        var names = TARGETS.map(normalizeName);
        var pct = coverageFor(dayIndex(dateStr));
        var n = pct > 0 ? Math.max(1, Math.round(names.length * pct / 100)) : 0;
        var hit = seededShuffle(names, R.seed + '|who|' + dateStr).slice(0, n);
        R.always.forEach(function (a) { a = normalizeName(a); if (hit.indexOf(a) < 0) hit.push(a); });
        return { pct: pct, hit: hit };
    }

    // Which gag a name gets on a date, given what they got last time (never the same twice in a row).
    function modeFor(dateStr, name, lastMode) {
        var order = seededShuffle(CFG.rollout.modes, CFG.rollout.seed + '|mode|' + dateStr + '|' + normalizeName(name));
        for (var i = 0; i < order.length; i++) if (order[i] !== lastMode) return order[i];
        return order[0];
    }

    function loadHistory() {
        try { return JSON.parse(localStorage.getItem('quackHistory') || '{}'); } catch (e) { return {}; }
    }
    function saveHistory(h) {
        try { localStorage.setItem('quackHistory', JSON.stringify(h)); } catch (e) { /* ignore */ }
    }

    // Decide for the current name: { active, mode }
    function decide(name) {
        if (state.force === false) return { active: false };
        if (state.force === true) return { active: true, mode: state.forceMode || modeFor(todayStr(), name || 'x', null) };
        var n = normalizeName(name);
        if (!n) return { active: false };
        var today = todayStr();
        var p = hitListFor(today);
        if (p.hit.indexOf(n) < 0) return { active: false };
        var h = loadHistory();
        var mode;
        if (h.name === n && h.date === today && h.mode) mode = h.mode;            // same day: stick with it
        else mode = modeFor(today, n, h.name === n ? h.mode : null);              // new day: never repeat last
        saveHistory({ name: n, date: today, mode: mode });
        return { active: true, mode: mode };
    }

    // Preview the plan for the next N days (console helper): Quack.plan(14)
    function plan(days, fromDate) {
        var out = [];
        var d = fromDate ? new Date(fromDate + 'T00:00:00') : new Date();
        for (var i = 0; i < (days || 14); i++) {
            var ds = todayStr(d);
            var p = hitListFor(ds);
            out.push({ date: ds, day: dayIndex(ds), pct: p.pct, hit: p.hit.map(function (n) { return n + ' -> ' + modeFor(ds, n, null); }).join(', ') });
            d.setDate(d.getDate() + 1);
        }
        if (console.table) console.table(out);
        return out;
    }

    // ---------------------------------------------------------------- art
    // Rubber-duck SVG facing RIGHT. Flip with scaleX(-1) to face left.
    var DUCK_SVG =
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="28" cy="41" rx="24" ry="15" fill="#FFD21F"/>' +
        '<path d="M6 36 Q-2 28 6 20 Q13 28 10 38 Z" fill="#FFD21F"/>' +
        '<path d="M18 42 Q30 30 44 44 Q31 52 18 42 Z" fill="#F0BF10"/>' +
        '<circle cx="45" cy="23" r="13" fill="#FFD21F"/>' +
        '<path d="M56 22 L66 26 L56 31 Q53 27 56 22 Z" fill="#FF8A1F"/>' +
        '<circle cx="49" cy="19" r="2.6" fill="#1b1b1b"/>' +
        '<circle cx="50" cy="18.2" r="0.9" fill="#fff"/>' +
        '</svg>';

    // Same duck, dazed: X eyes and a flattened beak — used after the crash.
    var DUCK_DAZED_SVG =
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="28" cy="41" rx="24" ry="15" fill="#FFD21F"/>' +
        '<path d="M6 36 Q-2 28 6 20 Q13 28 10 38 Z" fill="#FFD21F"/>' +
        '<path d="M18 42 Q30 30 44 44 Q31 52 18 42 Z" fill="#F0BF10"/>' +
        '<circle cx="45" cy="23" r="13" fill="#FFD21F"/>' +
        '<path d="M55 25 L66 25 L55 30 Z" fill="#FF8A1F"/>' +
        '<path d="M46 16 L52 22 M52 16 L46 22" stroke="#1b1b1b" stroke-width="2.2" stroke-linecap="round"/>' +
        '</svg>';

    // Slice of bread.
    var BREAD_SVG =
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 12 Q3 3 11 5 Q16 1 21 5 Q29 3 28 12 L28 27 Q28 30 25 30 L7 30 Q4 30 4 27 Z" fill="#C8894A"/>' +
        '<path d="M7 13 Q7 8 12 9 Q16 6 20 9 Q25 8 25 13 L25 26 Q25 27 24 27 L8 27 Q7 27 7 26 Z" fill="#F5E4BE"/>' +
        '<circle cx="12" cy="17" r="1.3" fill="#E7CF9E"/><circle cx="19" cy="21" r="1.1" fill="#E7CF9E"/><circle cx="17" cy="14" r="0.9" fill="#E7CF9E"/>' +
        '</svg>';

    function makeDuck(sizePx, extraClass, svg) {
        var el = document.createElement('div');
        el.className = 'qk-duck' + (extraClass ? ' ' + extraClass : '');
        el.style.width = sizePx + 'px';
        el.style.height = sizePx + 'px';
        el.innerHTML = svg || DUCK_SVG;
        return el;
    }

    // ---------------------------------------------------------------- styles
    var CSS =
        '#qk-layer{position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden}' +
        '.qk-duck{position:absolute;left:0;top:0;will-change:transform,opacity;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}' +
        '.qk-duck svg{width:100%;height:100%;display:block;overflow:visible}' +
        /* fly-by: whole element moves across, inner svg bobs/flaps */
        '.qk-fly{animation:qk-fly var(--dur) linear forwards}' +
        '.qk-fly svg{animation:qk-flap .28s ease-in-out infinite alternate}' +
        '@keyframes qk-fly{from{transform:translate3d(var(--x0),var(--y0),0) var(--face)}to{transform:translate3d(var(--x1),var(--y1),0) var(--face)}}' +
        '@keyframes qk-flap{from{transform:translateY(-4px) rotate(-6deg) scaleY(.94)}to{transform:translateY(4px) rotate(5deg) scaleY(1.04)}}' +
        /* waddle: walks along the bottom edge */
        '.qk-waddle{animation:qk-fly var(--dur) linear forwards}' +
        '.qk-waddle svg,.qk-walking svg{animation:qk-wobble .32s ease-in-out infinite alternate;transform-origin:50% 90%}' +
        '@keyframes qk-wobble{from{transform:rotate(-9deg) translateY(0)}to{transform:rotate(9deg) translateY(-3px)}}' +
        /* bread mode */
        '.qk-pecking svg{animation:qk-peck .18s ease-in-out infinite alternate;transform-origin:30% 80%}' +
        '@keyframes qk-peck{from{transform:rotate(0)}to{transform:rotate(22deg) translateY(4px)}}' +
        '.qk-crumb{position:absolute;left:0;top:0;will-change:transform;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));transition:transform .25s ease}' +
        '.qk-crumb svg{width:100%;height:100%;display:block}' +
        '.qk-crumb-drop{animation:qk-drop .35s cubic-bezier(.2,.8,.3,1.4)}' +
        '@keyframes qk-drop{from{opacity:0;transform:var(--pos) scale(.2)}to{opacity:1;transform:var(--pos) scale(1)}}' +
        /* crash mode */
        '.qk-incoming{animation:qk-incoming var(--flight) cubic-bezier(.55,0,1,.45) forwards;transform-origin:50% 50%}' +
        '.qk-incoming svg{animation:qk-flap .14s ease-in-out infinite alternate}' +
        '@keyframes qk-incoming{from{transform:translate3d(var(--sx),var(--sy),0) scale(calc(.1*var(--fs)),.1) rotate(-25deg);opacity:.75}' +
        '60%{opacity:1}to{transform:translate3d(var(--ix),var(--iy),0) scale(calc(3.5*var(--fs)),3.5) rotate(4deg);opacity:1}}' +
        '.qk-splat{transform:translate3d(var(--ix),var(--iy),0) scale(calc(3.8*var(--fs)),2.3) rotate(0);filter:drop-shadow(0 0 6px rgba(0,0,0,.6))}' +
        '.qk-slide{transition:transform var(--slide) cubic-bezier(.45,.02,.75,.6),opacity .6s ease var(--fadeAt);' +
        'transform:translate3d(var(--ex),var(--ey),0) scale(calc(3.4*var(--fs)),2.6) rotate(14deg);opacity:0}' +
        '.qk-slide svg{animation:qk-squeak .5s ease-in-out infinite alternate}' +
        '@keyframes qk-squeak{from{transform:translateX(-2px) rotate(-3deg)}to{transform:translateX(2px) rotate(3deg)}}' +
        '.qk-crack{position:absolute;left:0;top:0;pointer-events:none;transition:opacity 1.2s ease}' +
        '.qk-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:qk-flash .35s ease-out}' +
        '@keyframes qk-flash{0%{opacity:.85}100%{opacity:0}}' +
        '.qk-shake{animation:qk-shake .5s cubic-bezier(.36,.07,.19,.97) both}' +
        '@keyframes qk-shake{10%,90%{transform:translate3d(-2px,1px,0)}20%,80%{transform:translate3d(4px,-2px,0)}30%,50%,70%{transform:translate3d(-8px,3px,0)}40%,60%{transform:translate3d(8px,-3px,0)}}';

    // Overlay UI (ad + captcha). Injected after CSS; "#qk-ad *" outranks the app's "* { font-family }" rule.
    var CSS_UI =
        '#qk-ad,#qk-cap,.qk-nuh{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-tap-highlight-color:transparent;padding:16px;box-sizing:border-box}' +
        '#qk-ad{background:rgba(0,0,0,.72)}#qk-cap{background:rgba(0,0,0,.75)}' +
        '#qk-ad *,#qk-cap *,.qk-nuh *{font-family:inherit;box-sizing:border-box}' +
        '.qk-ad-box{position:relative;width:100%;max-width:360px;background:#fff;color:#222;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;animation:qk-adin .3s ease-out}' +
        '@keyframes qk-adin{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}' +
        '.qk-ad-top{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#777;padding:7px 10px;border-bottom:1px solid #eee;background:#fafafa}' +
        '.qk-ad-x{position:absolute;text-align:center;font-size:13px;color:#777;border:1px solid #bbb;border-radius:50%;background:#fff;cursor:pointer;user-select:none;z-index:2;font-family:Arial,sans-serif}' +
        '.qk-ad-body{cursor:pointer;min-height:280px}' +
        '.qk-ad-loading{height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#888;font-size:13px}' +
        '.qk-ad-spin{width:28px;height:28px;border:3px solid #ddd;border-top-color:#1a73e8;border-radius:50%;animation:qk-spin .9s linear infinite}' +
        '@keyframes qk-spin{to{transform:rotate(360deg)}}' +
        '.qk-ad-hero{height:190px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}' +
        '.qk-ad-brand{position:absolute;top:10px;left:12px;font-weight:800;font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.9}' +
        '.qk-ad-badge{position:absolute;top:14px;right:-30px;background:#e53935;color:#fff;font-size:11px;font-weight:800;padding:4px 36px;transform:rotate(35deg)}' +
        '.qk-ad-duck{position:relative!important;width:120px;height:120px;animation:qk-bob 1.2s ease-in-out infinite alternate;filter:drop-shadow(0 6px 8px rgba(0,0,0,.3))}' +
        '@keyframes qk-bob{from{transform:translateY(-4px) rotate(-3deg)}to{transform:translateY(4px) rotate(3deg)}}' +
        '.qk-ad-text{padding:12px 14px 16px}.qk-ad-h{font-size:18px;font-weight:800;line-height:1.2;margin:0 0 6px}.qk-ad-p{font-size:13px;color:#555;margin:0 0 12px;line-height:1.35}' +
        '.qk-ad-cta{display:inline-block;background:#1a73e8;color:#fff;font-weight:700;font-size:14px;padding:10px 18px;border-radius:4px}' +
        '.qk-ad-foot{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#999;padding:6px 10px;border-top:1px solid #eee}' +
        '.qk-ad-toast{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);background:#333;color:#fff;font-size:12px;padding:6px 10px;border-radius:4px;white-space:nowrap;animation:qk-adin .2s;z-index:3}' +
        '.qk-nuh{z-index:10001;background:rgba(0,0,0,.6);flex-direction:column;color:#fff;text-align:center;transition:opacity .3s}.qk-nuh.qk-out{opacity:0}' +
        '.qk-nuh-duck{position:relative!important;width:170px;height:170px;animation:qk-nuhbob .5s ease-in-out infinite alternate;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))}' +
        '@keyframes qk-nuhbob{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}' +
        '.qk-wag{transform-origin:30px 40px;animation:qk-wag .28s ease-in-out infinite alternate}@keyframes qk-wag{from{transform:rotate(-30deg)}to{transform:rotate(22deg)}}' +
        '.qk-nuh-bubble{background:#fff;color:#222;border-radius:18px;padding:12px 18px;font-size:19px;font-weight:800;margin-top:16px;animation:qk-adin .25s}' +
        /* captcha */
        '.qk-cap-box{width:100%;max-width:340px;background:#fff;color:#222;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;animation:qk-adin .3s}' +
        '.qk-cap-head{background:#1a73e8;color:#fff;padding:14px 16px;user-select:none}.qk-cap-head b{font-size:17px;display:block}.qk-cap-head small{display:block;opacity:.9;font-size:12px;margin-top:2px}' +
        '.qk-cap-body{padding:14px 16px}' +
        '.qk-cap-check{display:flex;align-items:center;gap:12px;border:1px solid #d3d3d3;background:#f9f9f9;border-radius:4px;padding:12px;cursor:pointer}' +
        '.qk-cap-cb{width:24px;height:24px;flex:none;border:2px solid #c1c1c1;border-radius:3px;background:#fff;display:flex;align-items:center;justify-content:center}' +
        '.qk-cap-note{font-size:11px;color:#777;margin-top:10px;line-height:1.4}' +
        '.qk-cap-more{font-size:12px;color:#d93025;font-weight:700;margin-bottom:8px}' +
        '.qk-cap-q{font-size:14px;margin-bottom:10px;line-height:1.35}' +
        '.qk-cap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}' +
        '.qk-cap-tile{position:relative;aspect-ratio:1;border-radius:3px;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s;user-select:none}' +
        '.qk-cap-tin{width:82%;height:82%}.qk-cap-tin svg{width:100%;height:100%;display:block;overflow:visible}' +
        '.qk-cap-tile.sel{outline:3px solid #1a73e8;outline-offset:-3px;transform:scale(.9)}' +
        '.qk-cap-tile.sel::after{content:"\\2713";position:absolute;top:3px;left:3px;background:#1a73e8;color:#fff;font-size:11px;width:16px;height:16px;border-radius:50%;text-align:center;line-height:16px}' +
        '.qk-cap-tile.fade{animation:qk-tilefade .45s forwards}@keyframes qk-tilefade{to{opacity:0;transform:scale(.5)}}' +
        '.qk-cap-pop{animation:qk-adin .3s}' +
        '.qk-cap-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px}.qk-cap-hint{font-size:11px;color:#777}' +
        '.qk-cap-btn{background:#1a73e8;color:#fff;border:0;border-radius:4px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:.5px}' +
        '.qk-cap-msg{color:#d93025;font-size:12px;min-height:16px;margin-top:8px}' +
        '.qk-cap-row{display:flex;gap:6px;margin-top:10px}.qk-cap-input{flex:1;min-width:0;border:1px solid #c1c1c1;border-radius:4px;padding:10px;font-size:16px;color:#222;background:#fff}' +
        '.qk-cap-refresh{width:44px;border:1px solid #c1c1c1;border-radius:4px;background:#f5f5f5;font-size:18px;cursor:pointer;color:#333}' +
        '.qk-cap-canvas{width:100%;height:auto;display:block;border:1px solid #ddd;border-radius:4px;background:#fff}' +
        '.qk-cap-puzzle{position:relative;width:300px;height:150px;margin:0 auto;border-radius:4px;overflow:hidden}.qk-cap-scene{display:block;width:300px;height:150px}.qk-cap-piece{position:absolute;left:0;top:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}' +
        '.qk-cap-track{position:relative;width:300px;height:40px;margin:12px auto 0;background:#eee;border:1px solid #ddd;border-radius:20px}' +
        '.qk-cap-fill{position:absolute;left:0;top:0;height:100%;width:20px;background:#cfe3fb;border-radius:20px}' +
        '.qk-cap-handle{position:absolute;left:0;top:-1px;width:40px;height:40px;background:#1a73e8;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:grab;touch-action:none;user-select:none;box-shadow:0 2px 6px rgba(0,0,0,.3)}' +
        '.qk-cap-reset{transition:left .3s ease}' +
        '.qk-cap-ok{width:56px;height:56px;margin:10px auto;border-radius:50%;background:#34a853;color:#fff;font-size:34px;display:flex;align-items:center;justify-content:center;animation:qk-adin .3s}' +
        '.qk-shakex{animation:qk-shakex .4s}@keyframes qk-shakex{20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}';

    function injectStyles() {
        if (document.getElementById('qk-style')) return;
        var s = document.createElement('style');
        s.id = 'qk-style';
        s.textContent = CSS + CSS_UI;
        document.head.appendChild(s);
    }

    function ensureLayer() {
        if (state.layer && state.layer.isConnected) return state.layer;
        var l = document.getElementById('qk-layer');
        if (!l) {
            l = document.createElement('div');
            l.id = 'qk-layer';
            document.body.appendChild(l);
        }
        state.layer = l;
        return l;
    }

    // ---------------------------------------------------------------- sound
    function getAudioCtx() {
        if (state.audioCtx) return state.audioCtx;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            state.audioCtx = new AC();
        } catch (e) { return null; }
        return state.audioCtx;
    }

    function resumeAudio() {
        var ctx = getAudioCtx();
        if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
        return ctx;
    }

    function prepareAudioFile() {
        if (!CFG.audioUrl || state.audioBuffer || state.audioLoading) return;
        var ctx = getAudioCtx();
        if (!ctx || !window.fetch) return;
        state.audioLoading = true;
        fetch(CFG.audioUrl, { cache: 'force-cache' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
            .then(function (ab) {
                // callback form for older Safari
                return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); });
            })
            .then(function (buf) { state.audioBuffer = buf; })
            .catch(function (e) { console.log('[quack] audio file unavailable, using synth:', e && e.message); })
            .then(function () { state.audioLoading = false; });
    }

    // Synthesized quack fallback: sawtooth with a fast pitch drop, raspy
    // amplitude modulation, and a nasal band-pass.
    function synthQuack(pitch, volume) {
        var ctx = resumeAudio();
        if (!ctx) return;
        var t = ctx.currentTime;
        var dur = 0.22;

        var osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(320 * pitch, t + 0.04);
        osc.frequency.exponentialRampToValueAtTime(170 * pitch, t + dur);

        var am = ctx.createOscillator();
        am.type = 'square';
        am.frequency.value = 55 * pitch;
        var amDepth = ctx.createGain();
        amDepth.gain.value = 0.45;

        var nasal = ctx.createBiquadFilter();
        nasal.type = 'bandpass';
        nasal.frequency.setValueAtTime(1100 * pitch, t);
        nasal.frequency.exponentialRampToValueAtTime(700 * pitch, t + dur);
        nasal.Q.value = 2.2;

        var honk = ctx.createBiquadFilter();
        honk.type = 'peaking';
        honk.frequency.value = 2200 * pitch;
        honk.Q.value = 3;
        honk.gain.value = 9;

        var env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
        env.gain.setValueAtTime(0.9, t + 0.09);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        var out = ctx.createGain();
        out.gain.value = 0.6 * (volume == null ? 1 : volume);

        var amGain = ctx.createGain();
        amGain.gain.value = 1;
        am.connect(amDepth).connect(amGain.gain);
        osc.connect(amGain).connect(nasal).connect(honk).connect(env).connect(out).connect(ctx.destination);

        osc.start(t); am.start(t);
        osc.stop(t + dur + 0.05); am.stop(t + dur + 0.05);
    }

    function quack(opts) {
        opts = opts || {};
        var pitch = opts.pitch || rand(CFG.pitchJitter[0], CFG.pitchJitter[1]);
        var volume = opts.volume == null ? 1 : opts.volume;
        var ctx = resumeAudio();
        if (ctx && state.audioBuffer) {
            try {
                var src = ctx.createBufferSource();
                src.buffer = state.audioBuffer;
                src.playbackRate.value = pitch;
                var g = ctx.createGain();
                g.gain.value = CFG.volume * volume;
                src.connect(g).connect(ctx.destination);
                var dur = CFG.clipDuration > 0 ? CFG.clipDuration : undefined;
                src.start(ctx.currentTime + (opts.delay || 0), CFG.clipStart || 0, dur);
                return;
            } catch (e) { /* fall through to synth */ }
        }
        if (opts.delay) later(function () { synthQuack(pitch, volume); }, opts.delay * 1000);
        else synthQuack(pitch, volume);
    }

    function noiseBuffer(ctx, seconds) {
        var n = Math.floor(ctx.sampleRate * seconds);
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    // Impact: low thud + glass crackle, then a dazed quack.
    function thud() {
        var ctx = resumeAudio();
        if (!ctx) return;
        var t = ctx.currentTime;

        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.3);
        var g1 = ctx.createGain();
        g1.gain.setValueAtTime(1.0, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g1).connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.4);

        var body = ctx.createBufferSource();
        body.buffer = noiseBuffer(ctx, 0.15);
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 500;
        var g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.7, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        body.connect(lp).connect(g2).connect(ctx.destination);
        body.start(t);

        var crackle = ctx.createBufferSource();
        crackle.buffer = noiseBuffer(ctx, 0.25);
        var hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 2800;
        var g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.0001, t);
        g3.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        crackle.connect(hp).connect(g3).connect(ctx.destination);
        crackle.start(t + 0.01);

        quack({ pitch: 0.8, delay: 0.12 });
    }

    // ---------------------------------------------------------------- sparks
    function burst(x, y) {
        var layer = ensureLayer();
        var n = randInt(CFG.sparkCount[0], CFG.sparkCount[1]);
        for (var i = 0; i < n; i++) {
            var size = rand(CFG.sparkSize[0], CFG.sparkSize[1]);
            var el = makeDuck(size);
            var ang = rand(-Math.PI * 0.95, -Math.PI * 0.05) + (Math.random() < 0.2 ? Math.PI : 0); // mostly up, some down
            var spd = rand(CFG.sparkSpeed[0], CFG.sparkSpeed[1]);
            var p = {
                el: el, size: size,
                x: x - size / 2, y: y - size / 2,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                rot: rand(-40, 40), vr: rand(-540, 540),
                life: rand(CFG.sparkLife[0], CFG.sparkLife[1]), age: 0,
                face: Math.cos(ang) < 0 ? -1 : 1
            };
            layer.appendChild(el);
            state.particles.push(p);
        }
        if (!state.raf) { state.lastFrame = performance.now(); state.raf = requestAnimationFrame(tick); }
    }

    function tick(now) {
        var dt = Math.min(0.05, (now - state.lastFrame) / 1000);
        state.lastFrame = now;
        var ps = state.particles;
        var keep = [];
        var h = window.innerHeight, w = window.innerWidth;
        for (var i = 0; i < ps.length; i++) {
            var p = ps[i];
            p.age += dt;
            if (p.age >= p.life || p.y > h + 40 || p.x < -60 || p.x > w + 60) { p.el.remove(); continue; }
            p.vy += CFG.gravity * dt;
            p.vx *= CFG.drag; p.vy *= CFG.drag;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.rot += p.vr * dt;
            var f = p.age / p.life;
            var alpha = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
            var scale = 1 - f * 0.25;
            p.el.style.opacity = alpha.toFixed(3);
            p.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) rotate(' + p.rot.toFixed(1) + 'deg) scale(' + (scale * p.face).toFixed(3) + ',' + scale.toFixed(3) + ')';
            keep.push(p);
        }
        state.particles = keep;
        state.raf = keep.length ? requestAnimationFrame(tick) : null;
    }

    // ---------------------------------------------------------------- ambient (sparks)
    function spawnAmbient(kind) {
        var layer = ensureLayer();
        var w = window.innerWidth, h = window.innerHeight;
        kind = kind || pick(['fly', 'fly', 'waddle']);
        var ltr = Math.random() < 0.5;
        var size, dur, y0, y1, cls;
        if (kind === 'waddle') {
            size = rand(34, 48);
            dur = rand(7, 11);
            y0 = y1 = h - size - 6;
            cls = 'qk-waddle';
        } else {
            size = rand(28, 44);
            dur = rand(5, 8);
            y0 = rand(h * 0.08, h * 0.7);
            y1 = y0 + rand(-h * 0.15, h * 0.15);
            cls = 'qk-fly';
        }
        var el = makeDuck(size, cls);
        var x0 = ltr ? -size - 10 : w + 10;
        var x1 = ltr ? w + 10 : -size - 10;
        el.style.setProperty('--x0', x0 + 'px');
        el.style.setProperty('--x1', x1 + 'px');
        el.style.setProperty('--y0', y0 + 'px');
        el.style.setProperty('--y1', y1 + 'px');
        el.style.setProperty('--dur', dur + 's');
        el.style.setProperty('--face', ltr ? 'scaleX(1)' : 'scaleX(-1)');
        el.addEventListener('animationend', function () { el.remove(); });
        layer.appendChild(el);
        later(function () { if (el.isConnected) el.remove(); }, (dur + 1) * 1000);
    }

    function scheduleAmbient() {
        clearTimeout(state.ambientTimer);
        if (!state.active) return;
        state.ambientTimer = setTimeout(function () {
            if (!state.active) return;
            if (document.visibilityState === 'visible') spawnAmbient();
            scheduleAmbient();
        }, rand(CFG.ambientMinDelay, CFG.ambientMaxDelay));
    }

    function welcomeFlock() {
        for (var i = 0; i < CFG.welcomeFlock; i++) {
            later(function () { spawnAmbient('fly'); }, 400 + i * 350);
        }
    }

    // ---------------------------------------------------------------- bread mode
    function breadStart() {
        var layer = ensureLayer();
        var b = state.bread = { ducks: [], crumbs: [], raf: null, last: performance.now() };
        var w = window.innerWidth, h = window.innerHeight;
        for (var i = 0; i < CFG.breadDucks; i++) {
            var size = rand(CFG.breadDuckSize[0], CFG.breadDuckSize[1]);
            var el = makeDuck(size, 'qk-roam');
            var d = {
                el: el, size: size,
                x: rand(10, w - size - 10), y: rand(60, h - size - 10),
                face: 1, wp: null, idleUntil: 0, moving: false,
                wanderSpeed: rand(CFG.wanderSpeed[0], CFG.wanderSpeed[1]),
                runSpeed: rand(CFG.runSpeed[0], CFG.runSpeed[1]),
                pecking: 0
            };
            renderDuck(d);
            layer.appendChild(el);
            b.ducks.push(d);
        }
        b.raf = requestAnimationFrame(breadTick);
    }

    function renderDuck(d) {
        d.el.style.transform = 'translate3d(' + d.x.toFixed(1) + 'px,' + d.y.toFixed(1) + 'px,0) scaleX(' + d.face + ')';
    }

    function dropCrumb(x, y) {
        var b = state.bread;
        if (!b) return;
        var layer = ensureLayer();
        var s = CFG.crumbSize;
        var el = document.createElement('div');
        el.className = 'qk-crumb qk-crumb-drop';
        el.style.width = s + 'px'; el.style.height = s + 'px';
        el.innerHTML = BREAD_SVG;
        var c = { el: el, x: x - s / 2, y: y - s / 2, cx: x, cy: y, bites: CFG.crumbBites, rot: rand(-30, 30) };
        var pos = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) rotate(' + c.rot + 'deg)';
        el.style.setProperty('--pos', pos);
        el.style.transform = pos;
        layer.appendChild(el);
        b.crumbs.push(c);
        while (b.crumbs.length > CFG.maxCrumbs) { var old = b.crumbs.shift(); old.el.remove(); }
    }

    function nearestCrumb(d) {
        var b = state.bread, best = null, bd = Infinity;
        var dx0 = d.x + d.size / 2, dy0 = d.y + d.size * 0.7;
        for (var i = 0; i < b.crumbs.length; i++) {
            var c = b.crumbs[i];
            if (c.bites <= 0) continue;
            var dx = c.cx - dx0, dy = c.cy - dy0;
            var dist = dx * dx + dy * dy;
            if (dist < bd) { bd = dist; best = c; }
        }
        return best;
    }

    function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

    function setMoving(d, moving) {
        if (d.moving === moving) return;
        d.moving = moving;
        d.el.classList.toggle('qk-walking', moving);
    }

    function breadTick(now) {
        var b = state.bread;
        if (!b || !state.active) return;
        var dt = Math.min(0.05, (now - b.last) / 1000);
        b.last = now;
        var w = window.innerWidth, h = window.innerHeight;
        var t = now / 1000;

        for (var i = 0; i < b.ducks.length; i++) {
            var d = b.ducks[i];
            if (d.pecking > t) { setMoving(d, false); continue; }
            if (d.pecking) { d.pecking = 0; d.el.classList.remove('qk-pecking'); }

            var crumb = nearestCrumb(d);
            var tx, ty, speed;
            if (crumb) {
                // beak lands on the crumb: aim the duck's front-bottom at it
                tx = crumb.cx - d.size * 0.5;
                ty = crumb.cy - d.size * 0.7;
                speed = d.runSpeed;
            } else {
                if (d.idleUntil > t) { setMoving(d, false); continue; }
                if (!d.wp || dist2(d.x, d.y, d.wp.x, d.wp.y) < 16) {
                    if (d.wp && Math.random() < 0.6) {
                        d.idleUntil = t + rand(CFG.wanderPause[0], CFG.wanderPause[1]);
                        d.wp = null;
                        setMoving(d, false);
                        continue;
                    }
                    d.wp = { x: rand(6, w - d.size - 6), y: rand(50, h - d.size - 6) };
                }
                tx = d.wp.x; ty = d.wp.y; speed = d.wanderSpeed;
            }

            var dx = tx - d.x, dy = ty - d.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (crumb && dist < 4) {
                // peck
                crumb.bites -= 1;
                d.pecking = t + CFG.peckTime;
                d.el.classList.add('qk-pecking');
                if (crumb.bites <= 0) {
                    (function (c) { c.el.style.transform += ' scale(0)'; later(function () { c.el.remove(); }, 250); })(crumb);
                    b.crumbs.splice(b.crumbs.indexOf(crumb), 1);
                    if (Math.random() < 0.7) quack({ volume: 0.5, pitch: rand(1.0, 1.25) });
                } else {
                    var sc = 0.45 + 0.55 * (crumb.bites / CFG.crumbBites);
                    crumb.el.style.transform = 'translate3d(' + crumb.x.toFixed(1) + 'px,' + crumb.y.toFixed(1) + 'px,0) rotate(' + crumb.rot + 'deg) scale(' + sc.toFixed(2) + ')';
                }
                setMoving(d, false);
                continue;
            }
            var step = Math.min(dist, speed * dt);
            if (dist > 0.001) {
                d.x += dx / dist * step; d.y += dy / dist * step;
                if (Math.abs(dx) > 1) d.face = dx < 0 ? -1 : 1;
            }
            d.x = clamp(d.x, 0, w - d.size); d.y = clamp(d.y, 0, h - d.size);
            setMoving(d, step > 0.01);
            renderDuck(d);
        }
        b.raf = requestAnimationFrame(breadTick);
    }

    function breadStop() {
        var b = state.bread;
        if (!b) return;
        if (b.raf) cancelAnimationFrame(b.raf);
        b.ducks.forEach(function (d) { d.el.remove(); });
        b.crumbs.forEach(function (c) { c.el.remove(); });
        state.bread = null;
    }

    // ---------------------------------------------------------------- crash mode
    function makeCrack(x, y) {
        var w = window.innerWidth, h = window.innerHeight;
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'qk-crack');
        svg.setAttribute('width', w); svg.setAttribute('height', h);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

        var maxLen = Math.max(w, h) * 0.9;
        var rays = randInt(10, 14);
        var base = rand(0, Math.PI * 2);
        var rayPts = [];
        var paths = '';
        for (var i = 0; i < rays; i++) {
            var ang = base + i * (Math.PI * 2 / rays) + rand(-0.18, 0.18);
            var len = rand(maxLen * 0.25, maxLen * (i % 3 === 0 ? 1.0 : 0.6));
            var steps = randInt(5, 9);
            var pts = [[x, y]];
            var px = x, py = y, a = ang;
            for (var s = 1; s <= steps; s++) {
                a += rand(-0.35, 0.35);
                var seg = len / steps * rand(0.7, 1.3);
                px += Math.cos(a) * seg; py += Math.sin(a) * seg;
                pts.push([px, py]);
                // occasional side branch
                if (s > 1 && s < steps && Math.random() < 0.35) {
                    var ba = a + (Math.random() < 0.5 ? 1 : -1) * rand(0.5, 1.1);
                    var bl = seg * rand(1.0, 2.2);
                    var bx = px + Math.cos(ba) * bl, by = py + Math.sin(ba) * bl;
                    var bx2 = bx + Math.cos(ba + rand(-0.4, 0.4)) * bl * 0.6, by2 = by + Math.sin(ba + rand(-0.4, 0.4)) * bl * 0.6;
                    paths += 'M' + px.toFixed(1) + ' ' + py.toFixed(1) + 'L' + bx.toFixed(1) + ' ' + by.toFixed(1) + 'L' + bx2.toFixed(1) + ' ' + by2.toFixed(1);
                }
            }
            rayPts.push(pts);
            paths += 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
        }
        // concentric web rings joining neighbouring rays
        var rings = '';
        [0.12, 0.28, 0.5].forEach(function (frac) {
            var d = '';
            for (var i = 0; i <= rays; i++) {
                var pts = rayPts[i % rays];
                var idx = Math.max(1, Math.min(pts.length - 1, Math.round(frac * pts.length * rand(0.8, 1.2))));
                var p = pts[idx];
                d += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
            }
            rings += d;
        });

        svg.innerHTML =
            '<defs><radialGradient id="qk-rg"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
            '<circle cx="' + x + '" cy="' + y + '" r="' + (maxLen * 0.22).toFixed(0) + '" fill="url(#qk-rg)"/>' +
            '<path d="' + paths + rings + '" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<path d="' + rings + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.1" stroke-linejoin="round"/>' +
            '<path d="' + paths + '" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#fff" opacity=".9"/>';
        return svg;
    }

    function shakeScreen() {
        var el = document.getElementById('root') || document.body;
        el.classList.remove('qk-shake');
        void el.offsetWidth; // restart animation
        el.classList.add('qk-shake');
        later(function () { el.classList.remove('qk-shake'); }, 600);
    }

    function crash(x, y) {
        var layer = ensureLayer();
        var w = window.innerWidth, h = window.innerHeight;
        var size = CFG.crashSize;
        if (!(x > 0 || y > 0)) { x = rand(w * 0.3, w * 0.7); y = rand(h * 0.25, h * 0.55); }
        // keep the splatted duck (~3.8x size) mostly on screen even for edge taps
        x = clamp(x, size * 1.6, w - size * 1.6); y = clamp(y, size * 1.2, h - size * 1.2);
        var sx = rand(w * 0.1, w * 0.9), sy = rand(h * 0.05, h * 0.45);
        var fs = x >= sx ? 1 : -1;

        var duck = makeDuck(size, 'qk-incoming');
        duck.style.setProperty('--sx', (sx - size / 2) + 'px');
        duck.style.setProperty('--sy', (sy - size / 2) + 'px');
        duck.style.setProperty('--ix', (x - size / 2) + 'px');
        duck.style.setProperty('--iy', (y - size / 2) + 'px');
        duck.style.setProperty('--fs', fs);
        duck.style.setProperty('--flight', CFG.crashFlight + 's');
        duck.style.zIndex = 3;
        layer.appendChild(duck);
        state.crashEls.push(duck);
        // approach quack — "incoming!"
        quack({ pitch: 1.2, volume: 0.6 });

        later(function () {
            if (!duck.isConnected) return;
            // impact
            thud();
            var flash = document.createElement('div');
            flash.className = 'qk-flash';
            layer.appendChild(flash);
            later(function () { flash.remove(); }, 400);
            var crack = makeCrack(x, y);
            layer.insertBefore(crack, duck);
            state.crashEls.push(crack);
            shakeScreen();
            duck.className = 'qk-duck qk-splat';
            duck.innerHTML = DUCK_DAZED_SVG;

            // ... a beat, then slide off like it's on a window
            later(function () {
                duck.style.setProperty('--ex', (x - size / 2 + rand(-30, 30)) + 'px');
                duck.style.setProperty('--ey', (h + size * 2) + 'px');
                duck.style.setProperty('--slide', CFG.slideTime + 's');
                duck.style.setProperty('--fadeAt', (CFG.slideTime - 0.6) + 's');
                duck.classList.add('qk-slide');
                later(function () { duck.remove(); }, (CFG.slideTime + 0.8) * 1000);
            }, 700);

            later(function () { crack.style.opacity = '0'; later(function () { crack.remove(); }, 1300); }, CFG.crackHold);
        }, CFG.crashFlight * 1000);
    }

    function crashStop() {
        state.crashEls.forEach(function (el) { el.remove(); });
        state.crashEls = [];
        var root = document.getElementById('root') || document.body;
        root.classList.remove('qk-shake');
    }

    // ---------------------------------------------------------------- shared UI helpers
    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // Poll until the schedule has rendered event cards (or give up), then cb.
    function whenLoaded(cb, maxMs) {
        var t0 = Date.now();
        (function poll() {
            if (!state.active) return;
            if (document.querySelector('.glass-card.cursor-pointer') || Date.now() - t0 > (maxMs || 15000)) { cb(); return; }
            later(poll, 300);
        })();
    }

    // ---------------------------------------------------------------- ad mode
    // Fake sponsors only — nothing here is a real company.
    var ADS = [
        { bg: 'linear-gradient(135deg,#0f3460,#16213e)', fg: '#fff', brand: 'QuackVPN', h: 'Your browsing is being watched.', p: 'By ducks. Protect every device with military-grade pond encryption. First 3 months free.', cta: 'Get Protected' },
        { bg: 'linear-gradient(135deg,#fde68a,#f59e0b)', fg: '#3b2a00', brand: 'Crumbs Direct', h: 'Artisanal bread crumbs, delivered daily.', p: 'First bag free for new subscribers. Ducks rate us 5 stars.', cta: 'Claim Offer' },
        { bg: 'linear-gradient(135deg,#a7f3d0,#059669)', fg: '#053a2a', brand: 'Pond & Pond Mattress', h: 'Sleep like a duck on water.', p: 'Zero-gravity float technology. 0% APR for 36 months. This weekend only.', cta: 'Shop the Sale' },
        { bg: 'linear-gradient(135deg,#e0e7ff,#6366f1)', fg: '#1e1b4b', brand: 'Learn To Fly Academy', h: 'Local pilots HATE this one weird trick.', p: 'Number 4 will shock you. Ducks have been doing it for years.', cta: 'Watch Now' },
        { bg: 'linear-gradient(135deg,#fecaca,#dc2626)', fg: '#fff', brand: 'Mallard Financial', h: 'Is your nest egg safe?', p: 'Free retirement review for flight test professionals. Limited slots available.', cta: 'Book a Review' }
    ];

    // Duck wagging a finger: pointing wing pivots at the shoulder, stern eyebrow.
    var DUCK_WAG_SVG =
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="28" cy="41" rx="24" ry="15" fill="#FFD21F"/>' +
        '<path d="M6 36 Q-2 28 6 20 Q13 28 10 38 Z" fill="#FFD21F"/>' +
        '<circle cx="45" cy="23" r="13" fill="#FFD21F"/>' +
        '<path d="M56 22 L66 26 L56 31 Q53 27 56 22 Z" fill="#FF8A1F"/>' +
        '<circle cx="49" cy="19" r="2.6" fill="#1b1b1b"/>' +
        '<path d="M44 13 L53 15.5" stroke="#1b1b1b" stroke-width="2" stroke-linecap="round"/>' +
        '<g class="qk-wag"><path d="M30 40 Q20 30 24 15" stroke="#F0BF10" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="24" cy="12" r="4" fill="#F0BF10"/></g>' +
        '</svg>';

    var ad = { root: null, round: 0, misclicks: 0, lastAd: -1, timers: [] };

    function adTimer(fn, ms) { var t = later(fn, ms); ad.timers.push(t); return t; }

    function showAd(round) {
        adStop();
        ad.round = round || 1;
        var root = el('div'); root.id = 'qk-ad';
        var box = el('div', 'qk-ad-box');
        box.innerHTML =
            '<div class="qk-ad-top"><span>Advertisement</span><span class="qk-ad-skip">Your schedule will resume after this ad</span></div>' +
            '<div class="qk-ad-body"><div class="qk-ad-loading"><div class="qk-ad-spin"></div><div>Loading ad…</div></div></div>' +
            '<div class="qk-ad-foot"><span>Sponsored · <u>Why this ad?</u></span><span>▷ AdChoices</span></div>';
        root.appendChild(box);
        document.body.appendChild(root);
        ad.root = root;
        adTimer(function () { adFill(box); }, rand(CFG.adLoadTime[0], CFG.adLoadTime[1]) * 1000);
    }

    function adPick() {
        var i;
        do { i = randInt(0, ADS.length - 1); } while (ADS.length > 1 && i === ad.lastAd);
        ad.lastAd = i;
        return ADS[i];
    }

    function adFill(box) {
        var a = adPick();
        var body = box.querySelector('.qk-ad-body');
        body.innerHTML =
            '<div class="qk-ad-hero" style="background:' + a.bg + ';color:' + a.fg + '">' +
            '<div class="qk-ad-brand">' + a.brand + '</div>' +
            '<div class="qk-duck qk-ad-duck">' + DUCK_SVG + '</div>' +
            '<div class="qk-ad-badge">' + pick(['LIMITED TIME', 'NEW', '-40%', 'FREE TRIAL', 'HOT DEAL']) + '</div>' +
            '</div>' +
            '<div class="qk-ad-text"><p class="qk-ad-h">' + a.h + '</p><p class="qk-ad-p">' + a.p + '</p><span class="qk-ad-cta">' + a.cta + ' ›</span></div>';
        var skip = box.querySelector('.qk-ad-skip');
        var n = CFG.adSkipDelay;
        skip.textContent = 'Skip ad in ' + n;
        var iv = setInterval(function () {
            n -= 1;
            if (n > 0) { skip.textContent = 'Skip ad in ' + n; return; }
            clearInterval(iv);
            skip.textContent = '';
            adShowX(box);
        }, 1000);
        ad.timers.push(iv);
        // tapping the ad itself "opens" it: everything reloads and the [x] moves
        body.onclick = function (ev) {
            ev.stopPropagation();
            ad.misclicks += 1;
            adToast(box, pick(['Opening sponsor site…', 'Redirecting…', 'Thanks for your interest!', 'Loading offer…']));
            var x = box.querySelector('.qk-ad-x'); if (x) x.remove();
            clearInterval(iv);
            skip.textContent = 'Your schedule will resume after this ad';
            body.onclick = null;
            adTimer(function () {
                body.innerHTML = '<div class="qk-ad-loading"><div class="qk-ad-spin"></div><div>Loading ad…</div></div>';
                adTimer(function () { adFill(box); }, rand(1.2, 2.2) * 1000);
            }, 500);
        };
    }

    function adShowX(box) {
        var x = el('div', 'qk-ad-x', '×');
        // tiny, and not always where you expect it
        var corner = Math.random() < CFG.adXLeftChance ? 'left' : 'right';
        x.style.top = randInt(3, 9) + 'px';
        x.style[corner] = randInt(-2, 8) + 'px';
        x.style.width = x.style.height = CFG.adXSize + 'px';
        x.style.lineHeight = (CFG.adXSize - 2) + 'px';
        x.onclick = function (ev) { ev.stopPropagation(); adClose(); };
        box.appendChild(x);
    }

    function adToast(box, msg) {
        var t = el('div', 'qk-ad-toast', msg);
        box.appendChild(t);
        adTimer(function () { t.remove(); }, 1400);
    }

    function adClose() {
        if (ad.root) { ad.root.remove(); ad.root = null; }
        var more = ad.round < CFG.adRounds;
        var line = more
            ? pick(['Nuh-uh-uh… not quite yet.', 'Nuh-uh-uh. One more.', 'Not so fast, human.'])
            : 'Nuh-uh-uh… okay, fine.';
        nuhUh(line, function () {
            if (more) { showAd(ad.round + 1); return; }
            state.adDone = true;
            if (CFG.adRepeatMinutes > 0) adTimer(function () { showAd(1); }, CFG.adRepeatMinutes * 60000);
        });
    }

    function adStop() {
        ad.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
        ad.timers = [];
        if (ad.root) { ad.root.remove(); ad.root = null; }
        var n = document.querySelector('.qk-nuh'); if (n) n.remove();
    }

    // Finger-wagging duck with a speech bubble; three falling quacks = "nuh-uh-uh".
    function nuhUh(text, done) {
        var n = el('div', 'qk-nuh');
        n.innerHTML = '<div class="qk-duck qk-nuh-duck">' + DUCK_WAG_SVG + '</div><div class="qk-nuh-bubble">' + text + '</div>';
        document.body.appendChild(n);
        quack({ pitch: 1.15, volume: 0.8 });
        quack({ pitch: 1.0, volume: 0.8, delay: 0.22 });
        quack({ pitch: 0.88, volume: 0.8, delay: 0.44 });
        later(function () {
            n.classList.add('qk-out');
            later(function () { n.remove(); if (done) done(); }, 300);
        }, CFG.nuhTime);
    }

    // ---------------------------------------------------------------- captcha mode
    var CLOUD_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M18 44 a10 10 0 0 1 2-19 a13 13 0 0 1 25-3 a9 9 0 0 1 3 22 Z" fill="#eef3f9" stroke="#b9c8da" stroke-width="2"/></svg>';
    var JET_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M6 34 L30 30 L44 14 L48 16 L40 30 L58 30 L58 36 L40 36 L48 50 L44 52 L30 38 L6 40 Z" fill="#7b8794"/></svg>';
    var LEMON_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="34" rx="20" ry="14" fill="#F6E05E" transform="rotate(-20 32 34)"/><circle cx="14" cy="27" r="3.5" fill="#F6E05E"/><circle cx="50" cy="41" r="3.5" fill="#F6E05E"/><path d="M22 30 Q32 26 42 30" stroke="#e5c93a" stroke-width="1.5" fill="none"/></svg>';
    var LILY_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="34" r="18" fill="#4caf50"/><path d="M32 34 L50 22 L46 38 Z" fill="#2a6f9e"/><circle cx="26" cy="30" r="4" fill="#f8bbd0"/></svg>';
    var DECOY_SVGS = [BREAD_SVG, CLOUD_SVG, JET_SVG, LEMON_SVG, LILY_SVG];

    var cap = { root: null, round: 0, types: [], timers: [], hits: 0 };

    function capTimer(fn, ms) { var t = later(fn, ms); cap.timers.push(t); return t; }
    function capBody(box) { return box.querySelector('.qk-cap-body'); }

    function showCaptcha() {
        capStop();
        cap.round = 0; cap.types = []; cap.hits = 0;
        var root = el('div'); root.id = 'qk-cap';
        var box = el('div', 'qk-cap-box');
        box.innerHTML = '<div class="qk-cap-head"><b>Security check</b><small>Please verify that you are human and not a duck.</small></div><div class="qk-cap-body"></div>';
        root.appendChild(box);
        document.body.appendChild(root);
        cap.root = root;
        // escape hatch: tap the blue header 5 times
        box.querySelector('.qk-cap-head').onclick = function () { cap.hits += 1; if (cap.hits >= 5) capFinish(true); };
        capCheckbox(box);
    }

    function capCheckbox(box) {
        var b = capBody(box);
        b.innerHTML =
            '<div class="qk-cap-check"><div class="qk-cap-cb"></div><div><div style="font-size:15px">I\'m not a duck</div><div style="font-size:11px;color:#777">Duck detection by QuackShield™</div></div></div>' +
            '<div class="qk-cap-note">This check is required because unusual waterfowl activity was detected from your device.</div>';
        b.querySelector('.qk-cap-check').onclick = function () {
            var cb = b.querySelector('.qk-cap-cb');
            cb.innerHTML = '<div class="qk-ad-spin" style="width:16px;height:16px;border-width:2px"></div>';
            this.onclick = null;
            capTimer(function () { capNext(box); }, rand(0.9, 1.6) * 1000);
        };
    }

    var CAP_TYPES = ['grid', 'until', 'text', 'slider', 'facing'];

    function capNext(box) {
        cap.round += 1;
        if (cap.round > CFG.captchaRounds) { capFinish(false); return; }
        var unused = CAP_TYPES.filter(function (t) { return cap.types.indexOf(t) < 0; });
        var type = state.forceCaptcha || pick(unused.length ? unused : CAP_TYPES);
        state.forceCaptcha = null;
        cap.types.push(type);
        var b = capBody(box);
        b.innerHTML = cap.round > 1 ? '<div class="qk-cap-more">Additional verification required (' + cap.round + ' of ' + CFG.captchaRounds + ')</div>' : '';
        ({ grid: capGrid, until: capUntil, text: capText, slider: capSlider, facing: capFacing })[type](box, b);
    }

    function capFail(box, msg) {
        var m = box.querySelector('.qk-cap-msg');
        if (m) m.textContent = msg || 'Please try again.';
        box.classList.remove('qk-shakex'); void box.offsetWidth; box.classList.add('qk-shakex');
        quack({ pitch: 0.85, volume: 0.6 });
    }

    function capPass(box) {
        quack({ pitch: 1.2, volume: 0.5 });
        capBody(box).innerHTML = '<div class="qk-cap-ok">✓</div><div style="text-align:center;font-size:14px;color:#444">Verified</div>';
        capTimer(function () { capNext(box); }, 900);
    }

    function capFinish(escaped) {
        if (!cap.root) return;
        var box = cap.root.querySelector('.qk-cap-box');
        capBody(box).innerHTML =
            '<div class="qk-cap-ok">✓</div><div style="text-align:center;font-size:15px;font-weight:700">Verification complete</div>' +
            '<div style="text-align:center;font-size:12px;color:#666;margin-top:4px">' + (escaped ? 'Fine. Go on.' : 'You are human (probably). Not a duck (probably).') + '</div>';
        capTimer(function () { capStop(); state.capDone = true; }, 1600);
    }

    function makeTile(isDuck, facing) {
        var t = el('div', 'qk-cap-tile');
        var inner = el('div', 'qk-cap-tin', isDuck ? DUCK_SVG : pick(DECOY_SVGS));
        var flip = facing != null ? facing : (Math.random() < 0.5 ? -1 : 1);
        inner.style.transform = 'rotate(' + randInt(-30, 30) + 'deg) scale(' + rand(0.7, 1.15).toFixed(2) + ') scaleX(' + flip + ') translate(' + randInt(-8, 8) + '%,' + randInt(-8, 8) + '%)';
        t.appendChild(inner);
        t.dataset.duck = isDuck ? '1' : '0';
        t.dataset.face = flip; // 1 = facing right, -1 = facing left
        t.style.background = pick(['#e8eef5', '#dfe9d8', '#f3e9d2', '#e6e0f0', '#d9e8ee']);
        return t;
    }

    function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = randInt(0, i); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

    var GRID_FOOT = '<div class="qk-cap-msg"></div><div class="qk-cap-foot"><span class="qk-cap-hint">Tap to select</span><button class="qk-cap-btn">VERIFY</button></div>';

    // 1) select all squares with ducks
    function capGrid(box, b) {
        b.insertAdjacentHTML('beforeend', '<div class="qk-cap-q">Select all squares with <b>ducks</b></div><div class="qk-cap-grid"></div>' + GRID_FOOT);
        var g = b.querySelector('.qk-cap-grid');
        var flags = shuffle([true, true, true, true, false, false, false, false, Math.random() < 0.5]);
        flags.forEach(function (isDuck) {
            var t = makeTile(isDuck);
            t.onclick = function () { this.classList.toggle('sel'); };
            g.appendChild(t);
        });
        b.querySelector('.qk-cap-btn').onclick = function () {
            var ok = true;
            g.querySelectorAll('.qk-cap-tile').forEach(function (t) { if ((t.dataset.duck === '1') !== t.classList.contains('sel')) ok = false; });
            if (ok) capPass(box); else capFail(box, 'Please select all matching images.');
        };
    }

    // 2) tap ducks until none are left (tapped ducks are sometimes replaced by more ducks)
    function capUntil(box, b) {
        b.insertAdjacentHTML('beforeend', '<div class="qk-cap-q">Tap every <b>duck</b>. Keep tapping until none are left.</div><div class="qk-cap-grid"></div>' + GRID_FOOT);
        var g = b.querySelector('.qk-cap-grid');
        var respawns = 0;
        function wire(t) {
            t.onclick = function () {
                if (t.dataset.duck !== '1' || t.classList.contains('fade')) return;
                t.classList.add('fade');
                quack({ volume: 0.35, pitch: rand(1.0, 1.3) });
                capTimer(function () {
                    var again = respawns < CFG.captchaRespawnMax && Math.random() < CFG.captchaRespawnChance;
                    if (again) respawns++;
                    var nt = makeTile(again);
                    nt.classList.add('qk-cap-pop');
                    wire(nt);
                    if (t.parentNode === g) g.replaceChild(nt, t);
                }, 450);
            };
        }
        shuffle([true, true, true, true, false, false, false, false, false]).forEach(function (isDuck) { var t = makeTile(isDuck); wire(t); g.appendChild(t); });
        b.querySelector('.qk-cap-btn').onclick = function () {
            var left = 0;
            g.querySelectorAll('.qk-cap-tile').forEach(function (t) { if (t.dataset.duck === '1' && !t.classList.contains('fade')) left++; });
            if (left === 0) capPass(box); else capFail(box, 'There are still ducks. Keep tapping.');
        };
    }

    // 3) distorted text — it always says "quack"
    function drawCaptchaText(canvas) {
        var W = canvas.width = 300, H = canvas.height = 96;
        var c = canvas.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
        for (var i = 0; i < 260; i++) {
            c.fillStyle = 'rgba(0,0,0,' + rand(0.05, 0.3).toFixed(2) + ')';
            c.fillRect(rand(0, W), rand(0, H), rand(1, 2.5), rand(1, 2.5));
        }
        var word = 'quack', x = 24;
        var fonts = ['Georgia', 'Impact', 'Courier New', 'Comic Sans MS', 'Times New Roman', 'Verdana', 'Trebuchet MS'];
        for (var k = 0; k < word.length; k++) {
            var size = randInt(40, 58);
            c.save();
            c.translate(x, H / 2 + rand(-8, 8));
            c.rotate(rand(-0.45, 0.45));
            c.transform(1, rand(-0.25, 0.25), rand(-0.35, 0.35), 1, 0, 0);
            c.font = (Math.random() < 0.4 ? 'italic ' : '') + (Math.random() < 0.5 ? 'bold ' : '') + size + 'px ' + pick(fonts);
            c.fillStyle = pick(['#1b1b1b', '#2b3a67', '#3b3b3b', '#4a2a00']);
            c.textBaseline = 'middle';
            c.fillText(word[k], 0, 0);
            c.restore();
            x += size * 0.6 + rand(-4, 6);
        }
        var lines = randInt(3, 5);
        for (var l = 0; l < lines; l++) {
            c.strokeStyle = 'rgba(' + randInt(0, 80) + ',' + randInt(0, 80) + ',' + randInt(0, 120) + ',' + rand(0.4, 0.8).toFixed(2) + ')';
            c.lineWidth = rand(1, 2.5);
            c.beginPath(); c.moveTo(rand(0, 30), rand(0, H));
            c.bezierCurveTo(rand(0, W), rand(-20, H + 20), rand(0, W), rand(-20, H + 20), rand(W - 30, W), rand(0, H));
            c.stroke();
        }
        // vertical wave distortion
        var img = c.getImageData(0, 0, W, H), out = c.createImageData(W, H);
        var amp = rand(4, 8), freq = rand(0.02, 0.04), ph = rand(0, 6);
        for (var px = 0; px < W; px++) {
            var dy = Math.round(Math.sin(px * freq + ph) * amp);
            for (var py = 0; py < H; py++) {
                var sy = py + dy, di = (py * W + px) * 4;
                if (sy < 0 || sy >= H) { out.data[di] = out.data[di + 1] = out.data[di + 2] = 255; out.data[di + 3] = 255; continue; }
                var si = (sy * W + px) * 4;
                out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1]; out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = 255;
            }
        }
        c.putImageData(out, 0, 0);
    }

    function capText(box, b) {
        b.insertAdjacentHTML('beforeend',
            '<div class="qk-cap-q">Type the characters you see</div><canvas class="qk-cap-canvas"></canvas>' +
            '<div class="qk-cap-row"><input class="qk-cap-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type here"><button class="qk-cap-refresh" title="New image">↻</button></div>' +
            '<div class="qk-cap-msg"></div><div class="qk-cap-foot"><span class="qk-cap-hint">Not case sensitive</span><button class="qk-cap-btn">VERIFY</button></div>');
        var cv = b.querySelector('canvas'); drawCaptchaText(cv);
        var input = b.querySelector('input');
        b.querySelector('.qk-cap-refresh').onclick = function () { drawCaptchaText(cv); };
        function check() {
            if (input.value.trim().toLowerCase() === 'quack') { capPass(box); return; }
            capFail(box, 'Incorrect. Please try again.');
            drawCaptchaText(cv); input.value = '';
        }
        b.querySelector('.qk-cap-btn').onclick = check;
        input.onkeydown = function (e) { if (e.key === 'Enter') check(); };
    }

    // 4) slide the puzzle piece into the pond
    function piecePath(c, x, y, s) {
        var r = 6; // tab on top, notch on the right; shape box is s wide, s + r tall
        c.beginPath();
        c.moveTo(x, y + r);
        c.lineTo(x + s / 2 - r, y + r);
        c.arc(x + s / 2, y + r, r, Math.PI, 0);
        c.lineTo(x + s, y + r);
        c.lineTo(x + s, y + r + s / 2 - r);
        c.arc(x + s, y + r + s / 2, r, -Math.PI / 2, Math.PI / 2, true);
        c.lineTo(x + s, y + r + s);
        c.lineTo(x, y + r + s);
        c.closePath();
    }

    function drawMiniDuck(c, x, y, s, dir) {
        c.save(); c.translate(x, y); c.scale(dir * s / 16, s / 16);
        c.fillStyle = '#FFD21F';
        c.beginPath(); c.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(8, -8, 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#FF8A1F'; c.beginPath(); c.moveTo(13, -8); c.lineTo(20, -6); c.lineTo(13, -4); c.closePath(); c.fill();
        c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(10, -10, 1.2, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    function drawPond(c, W, H) {
        var sky = c.createLinearGradient(0, 0, 0, H * 0.55); sky.addColorStop(0, '#7ec8ff'); sky.addColorStop(1, '#d8f0ff');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        c.fillStyle = '#ffe680'; c.beginPath(); c.arc(W - 40, 28, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7fb069'; c.beginPath(); c.moveTo(0, H * 0.5);
        c.quadraticCurveTo(W * 0.3, H * 0.25, W * 0.55, H * 0.5); c.quadraticCurveTo(W * 0.8, H * 0.3, W, H * 0.5);
        c.lineTo(W, H * 0.6); c.lineTo(0, H * 0.6); c.fill();
        var water = c.createLinearGradient(0, H * 0.55, 0, H); water.addColorStop(0, '#2f80c2'); water.addColorStop(1, '#1b4f80');
        c.fillStyle = water; c.fillRect(0, H * 0.55, W, H * 0.45);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
        for (var i = 0; i < 14; i++) { var y = H * 0.6 + rand(0, H * 0.38), x = rand(0, W); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 15, y - 3, x + 30, y); c.stroke(); }
        c.strokeStyle = '#2d6a4f'; c.lineWidth = 2;
        for (var r = 0; r < 6; r++) { var rx = rand(10, W - 10); c.beginPath(); c.moveTo(rx, H); c.quadraticCurveTo(rx + rand(-8, 8), H - 30, rx + rand(-4, 4), H - rand(35, 55)); c.stroke(); }
        for (var d = 0; d < 5; d++) drawMiniDuck(c, rand(20, W - 20), H * 0.6 + rand(0, H * 0.3), rand(10, 18), Math.random() < 0.5 ? 1 : -1);
    }

    function capSlider(box, b) {
        b.insertAdjacentHTML('beforeend',
            '<div class="qk-cap-q">Slide the piece to complete the pond</div>' +
            '<div class="qk-cap-puzzle"><canvas class="qk-cap-scene"></canvas><canvas class="qk-cap-piece"></canvas></div>' +
            '<div class="qk-cap-track"><div class="qk-cap-fill"></div><div class="qk-cap-handle">›</div></div><div class="qk-cap-msg"></div>');
        var W = 300, H = 150, P = 44, R = 6;
        var scene = b.querySelector('.qk-cap-scene'), piece = b.querySelector('.qk-cap-piece');
        scene.width = W; scene.height = H; piece.width = P + 2; piece.height = P + R + 2;
        var tx = randInt(Math.round(W * 0.45), W - P - 12), ty = randInt(6, H - P - R - 6);
        var sc = scene.getContext('2d'), pc = piece.getContext('2d');
        drawPond(sc, W, H);
        pc.save(); piecePath(pc, 0, 0, P); pc.clip(); pc.drawImage(scene, tx, ty, P + 2, P + R + 2, 0, 0, P + 2, P + R + 2); pc.restore();
        pc.strokeStyle = 'rgba(255,255,255,.9)'; pc.lineWidth = 1.5; piecePath(pc, 0, 0, P); pc.stroke();
        sc.save(); piecePath(sc, tx, ty, P); sc.fillStyle = 'rgba(0,0,0,.55)'; sc.fill(); sc.strokeStyle = 'rgba(255,255,255,.7)'; sc.lineWidth = 1; sc.stroke(); sc.restore();
        piece.style.top = ty + 'px';

        var handle = b.querySelector('.qk-cap-handle'), fill = b.querySelector('.qk-cap-fill');
        var maxX = W - P - 2, dragging = false, startX = 0, curX = 0;
        function setX(x) { curX = clamp(x, 0, maxX); handle.style.left = curX + 'px'; fill.style.width = (curX + 20) + 'px'; piece.style.left = curX + 'px'; }
        setX(0);
        handle.onpointerdown = function (e) { dragging = true; startX = e.clientX - curX; try { handle.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); };
        handle.onpointermove = function (e) { if (dragging) setX(e.clientX - startX); };
        handle.onpointerup = handle.onpointercancel = function () {
            if (!dragging) return;
            dragging = false;
            if (Math.abs(curX - tx) <= CFG.captchaSliderTolerance) { setX(tx); capPass(box); return; }
            capFail(box, 'Not quite. Try again.');
            handle.classList.add('qk-cap-reset'); piece.classList.add('qk-cap-reset');
            setX(0);
            capTimer(function () { handle.classList.remove('qk-cap-reset'); piece.classList.remove('qk-cap-reset'); }, 350);
        };
    }

    // 5) select every duck facing left/right
    function capFacing(box, b) {
        var dir = Math.random() < 0.5 ? -1 : 1;
        b.insertAdjacentHTML('beforeend', '<div class="qk-cap-q">Select every duck facing <b>' + (dir < 0 ? 'LEFT' : 'RIGHT') + '</b></div><div class="qk-cap-grid"></div>' + GRID_FOOT);
        var g = b.querySelector('.qk-cap-grid');
        var faces = shuffle([dir, dir, dir, -dir, -dir, -dir, -dir, dir, Math.random() < 0.5 ? dir : -dir]);
        faces.forEach(function (f) {
            var t = makeTile(true, f);
            t.onclick = function () { this.classList.toggle('sel'); };
            g.appendChild(t);
        });
        b.querySelector('.qk-cap-btn').onclick = function () {
            var ok = true;
            g.querySelectorAll('.qk-cap-tile').forEach(function (t) { if ((parseInt(t.dataset.face, 10) === dir) !== t.classList.contains('sel')) ok = false; });
            if (ok) capPass(box); else capFail(box, 'Look closer at the beaks.');
        };
    }

    function capStop() {
        cap.timers.forEach(clearTimeout);
        cap.timers = [];
        if (cap.root) { cap.root.remove(); cap.root = null; }
    }

    // ---------------------------------------------------------------- input
    function onPointerDown(e) {
        if (!state.active) return;
        // taps inside the ad / captcha overlays are theirs alone
        if (e.target && e.target.closest && e.target.closest('#qk-ad,#qk-cap,.qk-nuh')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        var tappable = e.target && e.target.closest ? e.target.closest(CFG.tapSelector) : null;
        var x = e.clientX, y = e.clientY;
        if (!(x > 0 || y > 0) && tappable) { var r = tappable.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
        resumeAudio();

        if (state.mode === 'sparks') {
            if (!tappable) return;
            quack();
            burst(x, y);
        } else if (state.mode === 'bread') {
            dropCrumb(x, y);
        } else if (state.mode === 'crash') {
            if (state.crashed) return;
            var card = e.target.closest ? e.target.closest('.glass-card.cursor-pointer') : null;
            if (!card) return;
            state.crashed = true;
            later(function () { crash(x, y); }, CFG.crashDelay);
        }
    }

    // ---------------------------------------------------------------- lifecycle
    function markVersion(on) {
        var el = document.getElementById('version-line');
        if (!el) return;
        if (on) {
            if (!el.dataset.orig) el.dataset.orig = el.textContent;
            el.textContent = el.dataset.orig.replace(/v6\.3(\.quack)?/, 'v6.3.quack') + ' 🦆';
        } else if (el.dataset.orig) {
            el.textContent = el.dataset.orig;
        }
    }

    function start() {
        if (state.active) return;
        state.active = true;
        state.mode = state.forceMode || state.nextMode || 'sparks';
        injectStyles();
        ensureLayer();
        prepareAudioFile();
        if (!state.listener) {
            state.listener = onPointerDown;
            document.addEventListener('pointerdown', state.listener, true);
        }
        markVersion(true);
        if (state.mode === 'sparks') {
            welcomeFlock();
            scheduleAmbient();
        } else if (state.mode === 'bread') {
            breadStart();
        } else if (state.mode === 'crash') {
            state.crashed = false;
        } else if (state.mode === 'ad') {
            if (!state.adDone && !state.manual) whenLoaded(function () { later(function () { showAd(1); }, CFG.adDelay); });
        } else if (state.mode === 'captcha') {
            if (!state.capDone && !state.manual) whenLoaded(function () { later(showCaptcha, CFG.captchaDelay); });
        }
        state.manual = false;
        console.log('[quack] active — mode: ' + state.mode);
    }

    function stop() {
        if (!state.active) return;
        state.active = false;
        clearTimeout(state.ambientTimer);
        state.ambientTimer = null;
        state.timers.forEach(clearTimeout);
        state.timers = [];
        if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
        state.particles.forEach(function (p) { p.el.remove(); });
        state.particles = [];
        breadStop();
        crashStop();
        adStop();
        capStop();
        if (state.layer) { state.layer.innerHTML = ''; }
        markVersion(false);
        console.log('[quack] off');
    }

    function setMode(mode) {
        state.forceMode = mode;
        if (state.active) { stop(); start(); }
    }

    function setName(name) {
        var d = decide(name);
        if (d.active) {
            if (state.active && state.mode !== d.mode && !state.forceMode) stop();
            state.nextMode = d.mode;
            if (!state.active) start();
        } else if (state.active) {
            stop();
        }
    }

    readUrlOverride();

    window.Quack = {
        setName: setName,
        setMode: setMode,
        start: start,
        stop: stop,
        burst: burst,
        quack: quack,
        thud: thud,
        spawnAmbient: spawnAmbient,
        dropCrumb: dropCrumb,
        crash: function (x, y) { if (!state.active) start(); crash(x, y); },
        // manual triggers (preview buttons / console): start without arming the automatic one
        showAd: function () { if (!state.active) { state.manual = true; start(); } showAd(1); },
        showCaptcha: function (type) { if (!state.active) { state.manual = true; start(); } if (type) state.forceCaptcha = type; showCaptcha(); },
        targets: TARGETS,
        config: CFG,
        plan: plan,
        coverageFor: coverageFor,
        hitListFor: hitListFor,
        get active() { return state.active; },
        get mode() { return state.mode; },
        get audioReady() { return !!state.audioBuffer; }
    };
})();
