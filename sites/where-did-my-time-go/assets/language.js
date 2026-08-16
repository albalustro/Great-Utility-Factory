/*
 * language.js — language resolution, country lookup and the language switcher.
 *
 * Shared by the root redirector (/) and by both localised pages (/en/, /pt-br/).
 *
 * Rules (in priority order):
 *   1. A language the visitor chose manually (localStorage: preferred_language).
 *   2. Country resolved from the IP address — "BR" means Brazilian Portuguese.
 *   3. navigator.language — a pt-BR browser gets Portuguese.
 *   4. English.
 *
 * A direct visit to /en/ or /pt-br/ is always respected; detection only ever
 * runs on the root page.
 */
(function () {
  'use strict';

  var W = (window.WDMTG = window.WDMTG || {});

  var LANGUAGES = ['en', 'pt-BR'];
  var DEFAULT_LANGUAGE = 'en';
  var STORAGE_KEY = 'preferred_language';
  var SESSION_KEY = 'wdmtg_resolved_language';

  /*
   * The only place the site talks to a geo provider.
   *
   * The endpoint must be country-level only, must support browser CORS and must
   * not require a key. Swap the three fields below to change providers — nothing
   * else in the codebase knows where the country came from.
   *
   * We read the ISO 3166-1 alpha-2 country code and nothing else. The IP address
   * is never read, never displayed and never stored.
   */
  var GEO_PROVIDER = {
    url: 'https://ipapi.co/country/',
    timeoutMs: 1200,
    read: function (response) {
      // This provider answers with the bare country code as plain text.
      return response.text();
    }
  };

  function track(name, payload) {
    if (typeof W.trackEvent === 'function') W.trackEvent(name, payload);
  }

  function normaliseLanguage(value) {
    if (!value) return null;
    var v = String(value).toLowerCase();
    if (v === 'pt-br' || v === 'ptbr' || v === 'pt') return 'pt-BR';
    if (v === 'en' || v.indexOf('en-') === 0) return 'en';
    return null;
  }

  function readStorage(store, key) {
    try {
      return window[store].getItem(key);
    } catch (err) {
      return null; // private mode / storage disabled
    }
  }

  function writeStorage(store, key, value) {
    try {
      window[store].setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** The language the visitor picked by hand on a previous visit, if any. */
  function getPreferredLanguage() {
    return normaliseLanguage(readStorage('localStorage', STORAGE_KEY));
  }

  /** Persist a manual choice. From now on it beats country detection. */
  function setPreferredLanguage(lang) {
    var value = normaliseLanguage(lang);
    if (!value) return null;
    writeStorage('localStorage', STORAGE_KEY, value);
    return value;
  }

  function getBrowserLanguage() {
    var list = [];
    if (navigator.languages && navigator.languages.length) {
      list = Array.prototype.slice.call(navigator.languages);
    } else if (navigator.language) {
      list = [navigator.language];
    }
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]).toLowerCase().indexOf('pt-br') === 0) return 'pt-BR';
    }
    return DEFAULT_LANGUAGE;
  }

  function queryParam(name) {
    var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Resolve the visitor's country from their IP address.
   * Resolves to an upper-case ISO country code, or null when we could not tell
   * within the timeout. It never rejects — localisation must not block the page.
   */
  function lookupCountry() {
    // Test hooks: ?country=BR forces a country, ?geo=off simulates a failure.
    var forced = queryParam('country');
    if (forced) return Promise.resolve(/^[A-Za-z]{2}$/.test(forced) ? forced.toUpperCase() : null);
    if (queryParam('geo') === 'off') return Promise.resolve(null);

    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') {
      return Promise.resolve(null);
    }

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, GEO_PROVIDER.timeoutMs);

    return fetch(GEO_PROVIDER.url, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    })
      .then(function (response) {
        if (!response.ok) throw new Error('geo lookup failed: ' + response.status);
        return GEO_PROVIDER.read(response);
      })
      .then(function (code) {
        var value = String(code == null ? '' : code).trim();
        return /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null;
      })
      .catch(function () {
        return null;
      })
      .then(function (result) {
        window.clearTimeout(timer);
        return result;
      });
  }

  /**
   * Decide which language the root page should send this visitor to.
   * Resolves to 'en' or 'pt-BR' together with the reason, which is useful when
   * testing and is passed to analytics later.
   */
  function resolveLanguage() {
    var forcedLang = normaliseLanguage(queryParam('lang'));
    if (forcedLang) return Promise.resolve({ language: forcedLang, source: 'query' });

    var preferred = getPreferredLanguage();
    if (preferred) return Promise.resolve({ language: preferred, source: 'manual' });

    var cached = normaliseLanguage(readStorage('sessionStorage', SESSION_KEY));
    if (cached) return Promise.resolve({ language: cached, source: 'session-cache' });

    return lookupCountry().then(function (country) {
      var result;
      if (country === 'BR') {
        result = { language: 'pt-BR', source: 'country', country: 'BR' };
      } else if (country) {
        result = { language: 'en', source: 'country', country: country };
      } else {
        result = { language: getBrowserLanguage(), source: 'navigator-language' };
      }
      writeStorage('sessionStorage', SESSION_KEY, result.language);
      return result;
    });
  }

  /**
   * Path of the given language page, relative to the current document, so the
   * site works at a domain root, in a sub-folder or straight off the file system.
   */
  function pathFor(lang) {
    var folder = lang === 'pt-BR' ? 'pt-br/' : 'en/';
    var isRoot = document.documentElement.getAttribute('data-page') === 'root';
    return (isRoot ? './' : '../') + folder;
  }

  function currentLanguage() {
    return normaliseLanguage(document.documentElement.lang) || DEFAULT_LANGUAGE;
  }

  /** Wire up the EN | PT-BR switcher on a localised page. */
  function initLanguageSwitcher() {
    var current = currentLanguage();
    var links = document.querySelectorAll('[data-lang-switch]');

    Array.prototype.forEach.call(links, function (link) {
      var target = normaliseLanguage(link.getAttribute('data-lang-switch'));
      if (!target) return;

      if (target === current) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }

      link.addEventListener('click', function (event) {
        if (target === current) {
          event.preventDefault();
          return;
        }
        // The href already points at the right page, so a middle-click or a
        // no-JS visit still works. We intercept only to remember the choice.
        event.preventDefault();
        setPreferredLanguage(target);
        track('language_changed', { from: current, to: target });
        window.location.href = pathFor(target);
      });
    });
  }

  /** Root document: resolve a language and hand the visitor over to it. */
  function initRootRedirect() {
    var status = document.getElementById('redirect-status');

    resolveLanguage().then(function (result) {
      if (status) {
        status.textContent = result.language === 'pt-BR'
          ? 'Redirecionando para a versão em português…'
          : 'Taking you to the English version…';
      }
      // replace() keeps the root out of the back-button history, so "back"
      // from a language page leaves the site instead of bouncing again.
      window.location.replace(pathFor(result.language));
    });
  }

  W.language = {
    LANGUAGES: LANGUAGES,
    DEFAULT_LANGUAGE: DEFAULT_LANGUAGE,
    STORAGE_KEY: STORAGE_KEY,
    GEO_PROVIDER: GEO_PROVIDER,
    current: currentLanguage,
    lookupCountry: lookupCountry,
    resolveLanguage: resolveLanguage,
    getPreferredLanguage: getPreferredLanguage,
    setPreferredLanguage: setPreferredLanguage,
    getBrowserLanguage: getBrowserLanguage,
    pathFor: pathFor
  };

  function init() {
    if (document.documentElement.getAttribute('data-page') === 'root') {
      initRootRedirect();
    } else {
      initLanguageSwitcher();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
