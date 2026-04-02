/**
 * @fileoverview interceptor.js — Network Interceptor for VMedulife Marks Extension
 * @description
 * This module runs in the MAIN world (page context) to intercept HTTP requests
 * made by the VMedulife portal. It hooks XMLHttpRequest and fetch to capture
 * API responses from the studentResult.php endpoint.
 *
 * When valid marks data is detected, it stores the data in a hidden DOM element
 * and dispatches a custom DOM event for the UI script to render the marks panel.
 *
 * @author vmedulife-marks-extension contributors
 * @version 1.0.1
 * @license MIT
 */

(function () {
  'use strict';

  /** @type {string} API endpoint to monitor for marks data */
  var TARGET = 'studentResult.php';

  /** @type {boolean} Enable debug logging (disable in production) */
  var DEBUG = false;

  /** @type {boolean} Prevents multiple firings for the same page load */
  var hasFired = false;

  /**
   * Debug logging utility — only outputs when DEBUG is true
   * @param {...*} args - Arguments to log
   */
  function log() {
    if (DEBUG) console.log.apply(console, ['[interceptor]'].concat(Array.from(arguments)));
  }

  /**
   * Validates that the API response contains actual student result data.
   *
   * The VMedulife API may return multiple responses per page load.
   * This function ensures we only process the one containing subject marks.
   *
   * @param {Object} data - Parsed JSON response from the API
   * @returns {boolean} True if response contains valid marks data
   *
   * @example
   * // Valid response structure:
   * {
   *   success: true,
   *   data: {
   *     SGPA: { ... },
   *     "subject-id-1": { col_7493: "A", ... },
   *     "subject-id-2": { col_7493: "B", ... }
   *   }
   * }
   */
  function isValidResult(data) {
    if (!data) return false;
    if (data.success !== true && data.success !== 'true') return false;
    if (!data.data || typeof data.data !== 'object') return false;

    var keys = Object.keys(data.data);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key === 'SGPA') continue;
      var entry = data.data[key];
      if (entry && typeof entry === 'object' && entry.col_7493) {
        return true;
      }
    }
    return false;
  }

  /**
   * Processes intercepted API responses and stores valid marks data.
   *
   * When valid marks data is detected:
   * 1. Stores the data in a hidden DOM element (#vmedulife-marks-store)
   * 2. Dispatches a custom 'vmedulife-marks-detected' event
   *
   * @param {string} url - The request URL
   * @param {string} rawText - Response body as string
   */
  function handleResponse(url, rawText) {
    if (hasFired) return;
    if (!url || url.indexOf(TARGET) === -1) return;

    var data;
    try {
      data = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    } catch (e) {
      log('JSON parse failed for', url);
      return;
    }

    if (!isValidResult(data)) {
      log('response from', url, 'is not valid result data (success:', data && data.success, ')');
      return;
    }

    hasFired = true;
    log('✓ valid result detected!');
    log('  student:', data.studentName, '| SGPA:', data.SGPA);
    log('  subjects:', Object.keys(data.data).filter(function (k) { return k !== 'SGPA'; }).length);

    // Store in a hidden DOM element (readable by both MAIN and ISOLATED worlds)
    // Remove any existing store first to prevent accumulation on rapid pageshow
    var existingStore = document.getElementById('vmedulife-marks-store');
    if (existingStore) existingStore.remove();

    var store = document.createElement('div');
    store.id = 'vmedulife-marks-store';
    store.setAttribute('data-ready', 'true');
    store.textContent = JSON.stringify(data);
    store.style.display = 'none';
    (document.head || document.documentElement).appendChild(store);

    // Dispatch custom event (propagates to ISOLATED world listeners too)
    document.dispatchEvent(new CustomEvent('vmedulife-marks-detected', {
      detail: { ready: true },
      bubbles: true
    }));

    log('event dispatched + data stored in DOM');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // XMLHttpRequest Interceptor
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Wraps the native XMLHttpRequest to intercept responses.
   *
   * The interceptor:
   * 1. Captures the request URL via the open() method
   * 2. Attaches a load listener to capture the response
   * 3. Passes matching responses to handleResponse()
   *
   * Static properties and prototype are preserved to maintain
   * compatibility with code that inspects XHR types.
   */
  var OrigXHR = XMLHttpRequest;

  /**
   * Hooked XMLHttpRequest constructor.
   * @constructor
   */
  function HookedXHR() {
    var xhr = new OrigXHR();
    var _url = '';

    var _open = xhr.open;
    xhr.open = function () {
      _url = arguments[1] || '';
      return _open.apply(xhr, arguments);
    };

    var _send = xhr.send;
    xhr.send = function () {
      xhr.addEventListener('load', function () {
        if (_url.indexOf(TARGET) !== -1) {
          log('XHR load:', _url, 'status:', xhr.status);
          handleResponse(_url, xhr.responseText);
        }
      });
      return _send.apply(xhr, arguments);
    };

    return xhr;
  }

  Object.keys(OrigXHR).forEach(function (k) {
    try { HookedXHR[k] = OrigXHR[k]; } catch (e) {}
  });
  HookedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = HookedXHR;

  // ══════════════════════════════════════════════════════════════════════════
  // Fetch Interceptor
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Wraps the native fetch API to intercept responses.
   *
   * The interceptor:
   * 1. Captures the request URL from fetch arguments
   * 2. Clones the response to read its body without consuming it
   * 3. Passes matching responses to handleResponse()
   *
   * Note: The response is cloned to avoid interfering with the
   * original request flow.
   */
  var origFetch = window.fetch;

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';

    return origFetch.apply(this, arguments).then(function (response) {
      if (url.indexOf(TARGET) !== -1) {
        log('fetch response:', url, 'status:', response.status);
        response.clone().text().then(function (txt) {
          handleResponse(url, txt);
        }).catch(function (e) {
          log('fetch clone error:', e);
        });
      }
      return response;
    });
  };

  log('interceptor loaded (MAIN world)');

  // ══════════════════════════════════════════════════════════════════════════
  // SPA Navigation Handler
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Handles bfcache page restoration in Single Page Applications (SPAs).
   *
   * When a user navigates back/forward through browser history, the page
   * may be restored from bfcache without triggering a full page load.
   * This listener:
   * 1. Resets hasFired to allow re-detection on the restored page
   * 2. Removes any stale store element from the previous page state
   */
  window.addEventListener('pageshow', function () {
    hasFired = false;
    // Clear any stale store element from previous page load
    var existingStore = document.getElementById('vmedulife-marks-store');
    if (existingStore) existingStore.remove();
    log('pageshow detected, reset hasFired and cleared store');
  });
})();
