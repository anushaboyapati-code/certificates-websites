/**
 * Persists UTM and common click IDs in sessionStorage and appends them to
 * same-site links so marketing attribution carries across internal navigation.
 * Loaded on every page after the main Webflow bundle.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ccbp_utm_persist_v1';
  var PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'fbclid',
    'msclkid',
    'twclid',
    'li_fat_id',
  ];

  function readStore() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeStore(obj) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function fromSearch(search) {
    var o = {};
    if (!search || search === '?') return o;
    var s = search.charAt(0) === '?' ? search.slice(1) : search;
    var usp = new URLSearchParams(s);
    for (var i = 0; i < PARAMS.length; i++) {
      var p = PARAMS[i];
      var v = usp.get(p);
      if (v) o[p] = v;
    }
    return o;
  }

  var incoming = fromSearch(window.location.search);
  var bag = readStore();
  for (var k in incoming) {
    if (Object.prototype.hasOwnProperty.call(incoming, k)) {
      bag[k] = incoming[k];
    }
  }
  if (Object.keys(incoming).length) {
    writeStore(bag);
  }

  function applyToHref(anchorHref) {
    if (!anchorHref) return null;
    var t = anchorHref.trim();
    if (t === '' || t.charAt(0) === '#') return null;
    if (/^(mailto|javascript|tel):/i.test(t)) return null;
    if (t.indexOf('//') > 0 && t.indexOf('//') < 6) {
      if (t.toLowerCase().indexOf('http') !== 0) return null;
    }
    var u;
    try {
      u = new URL(anchorHref, window.location.href);
    } catch (e) {
      return null;
    }
    if (u.origin !== window.location.origin) return null;
    if (Object.keys(bag).length === 0) return null;

    var usp = new URLSearchParams(u.search);
    var changed = false;
    for (var i2 = 0; i2 < PARAMS.length; i2++) {
      var p2 = PARAMS[i2];
      if (bag[p2] && !usp.get(p2)) {
        usp.set(p2, bag[p2]);
        changed = true;
      }
    }
    if (!changed) return null;

    var q = usp.toString();
    return u.pathname + (q ? '?' + q : '') + (u.hash || '');
  }

  function patchAll() {
    var list = document.querySelectorAll('a[href]');
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var h = a.getAttribute('href');
      var next = applyToHref(h);
      if (next !== null) a.setAttribute('href', next);
    }
  }

  function run() {
    patchAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  document.addEventListener(
    'click',
    function (e) {
      if (Object.keys(bag).length === 0) return;
      var el = e.target && e.target.closest && e.target.closest('a[href]');
      if (!el) return;
      if (e.defaultPrevented) return;
      if (e.button != null && e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var h = el.getAttribute('href');
      var next = applyToHref(h);
      if (next !== null) el.setAttribute('href', next);
    },
    true
  );
})();
