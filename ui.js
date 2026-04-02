/**
 * @fileoverview ui.js — UI Renderer for vmedulife-marks-extension
 * @description
 * This module runs in the ISOLATED world and is responsible for:
 * 1. Listening to the 'vmedulife-marks-detected' custom DOM event
 * 2. Reading marks data from the shared DOM store element
 * 3. Parsing and transforming the API data
 * 4. Rendering a dark-themed slide-in marks panel
 *
 * The UI displays:
 * - Quick stats (SGPA, credits, subject count, pass/fail status)
 * - Subject-wise result table with marks, percentage, grade, GP, credits
 * - Theory subjects detailed breakdown (Internal 40 / External 60)
 * - Practical subjects breakdown
 * - Internal vs External performance comparison
 * - Performance bar chart visualization
 *
 * @author vmedulife-marks-extension contributors
 * @version 1.0.1
 * @license MIT
 */

(function () {
  'use strict';

  if (document.getElementById('vmedulife-marks-panel')) return;

  var DEBUG = false;
  function log() {
    if (DEBUG) console.log.apply(console, ['[ui.js]'].concat(Array.from(arguments)));
  }

  log('script starting');

  // ── Debug indicator ───────────────────────────────────────────────────────

  function initDebug() {
    if (document.getElementById('vmedulife-debug')) return;
    var el = document.createElement('div');
    el.id = 'vmedulife-debug';
    el.textContent = 'VMarks: waiting for result API…';
    el.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:999999;background:#1e1e1e;color:#42a5f5;font-family:"Inter",system-ui,sans-serif;font-size:12px;padding:6px 12px;border-radius:6px;border:1px solid #333333;cursor:pointer;opacity:0.9;';
    el.title = 'Click to remove';
    el.addEventListener('click', function () { el.remove(); });
    (document.body || document.documentElement).appendChild(el);
  }

  function setDebug(msg) {
    var el = document.getElementById('vmedulife-debug');
    if (el) el.textContent = 'VMarks: ' + msg;
    log('debug:', msg);
  }

  if (document.body) initDebug();
  else document.addEventListener('DOMContentLoaded', initDebug);

  // ══════════════════════════════════════════════════════════════════════════
  // Constants
  // ══════════════════════════════════════════════════════════════════════════

  /** @type {string} Panel DOM element ID */
  var PANEL_ID = 'vmedulife-marks-panel';

  /** @type {string} CSS selector prefix for max specificity */
  var P = '#' + PANEL_ID;

  /**
   * Grade-to-color mapping for visual grade pills
   * @type {Object.<string, string>}
   */
  var GRADE_COLORS = {
    O: '#26a69a', E: '#42a5f5', A: '#66bb6a',
    B: '#ffa726', C: '#ff7043', D: '#ef5350', F: '#d32f2f',
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Utility Functions
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Escapes HTML special characters to prevent XSS.
   *
   * @param {*} str - Value to escape
   * @returns {string} HTML-escaped string safe for innerHTML insertion
   */
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Parses a value as a floating-point number with fallback.
   *
   * @param {*} val - Value to parse
   * @param {number} [fb=0] - Fallback value if parsing fails
   * @returns {number} Parsed number or fallback
   */
  function num(val, fb) {
    var n = parseFloat(val);
    return isNaN(n) ? (fb || 0) : n;
  }

  /**
   * Converts a string to Title Case while preserving acronyms and certain words.
   *
   * @param {string} str - String to convert
   * @returns {string} Title-cased string
   */
  function titleCase(str) {
    if (!str) return '';
    if (str !== str.toUpperCase()) return str;
    var keep = ['OOP', 'SDE', 'CAO', 'III', 'II', 'IV', 'I', 'CS', 'MA', 'CY', 'HS', 'SD', 'IT', 'AI', 'ML', 'OS', 'DBMS', 'DSA', 'BCA', 'MCA', 'SE', 'CN', 'HCI'];
    return str.toLowerCase().split(' ').map(function (word) {
      var upper = word.toUpperCase();
      for (var i = 0; i < keep.length; i++) {
        if (upper === keep[i]) return upper;
      }
      if (word.indexOf('-') !== -1) {
        return word.split('-').map(function (part) {
          var pUp = part.toUpperCase();
          for (var j = 0; j < keep.length; j++) { if (pUp === keep[j]) return pUp; }
          return part.charAt(0).toUpperCase() + part.slice(1);
        }).join('-');
      }
      if (['and', 'or', 'of', 'the', 'in', 'for', 'to', 'with', 'using', 'a'].indexOf(word) !== -1) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  /**
   * Returns a color based on percentage value.
   *
   * @param {number} pct - Percentage value
   * @returns {string} Hex color code
   *
   * Color scheme:
   * - Green (#10b981): >= 75%
   * - Gray (#b3b3b3): 60-74%
   * - Orange (#f59e0b): < 60%
   */
  function pctColor(pct) {
    if (pct >= 75) return '#10b981';
    if (pct >= 60) return '#b3b3b3';
    return '#f59e0b';
  }

  /**
   * Generates an observation message comparing internal vs external performance.
   *
   * @param {number} intPct - Internal exam percentage
   * @param {number} extPct - External/semester exam percentage
   * @returns {{text: string, color: string}} Observation message and color
   */
  function getObservation(intPct, extPct) {
    var diff = extPct - intPct;
    if (intPct < 60 && extPct < 45) return { text: 'Struggled in both; ext barely passed', color: '#f59e0b' };
    if (Math.abs(diff) <= 10) return { text: 'Consistent across both', color: '#b3b3b3' };
    if (diff > 20) return { text: 'Big jump in sem exam', color: '#10b981' };
    if (diff > 10) return { text: 'Recovered well in sem exam', color: '#10b981' };
    if (diff < -10) return { text: 'Strong internal, dipped in sem exam', color: '#b3b3b3' };
    return { text: 'Room for growth in sem exam', color: '#b3b3b3' };
  }

  /**
   * Creates an HTML span element styled as a colored grade pill.
   *
   * @param {string} grade - Single letter grade (O, E, A, B, C, D, F)
   * @returns {string} HTML string for the grade pill
   */
  function gradePill(grade) {
    var bg = GRADE_COLORS[grade] || GRADE_COLORS['F'];
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:4px;font-weight:700;font-size:12px;color:#fff;background:' + bg + '">' + grade + '</span>';
  }

  /**
   * Shortens a subject name for display in bar chart labels.
   *
   * @param {string} name - Full subject name
   * @returns {string} Shortened name suitable for chart labels
   */
  function shortName(name) {
    if (name.length <= 12) return name;
    var s = name
      .replace('Computer ', 'Comp. ')
      .replace('Architecture', 'Arch.')
      .replace('Organization', 'Org.')
      .replace('Programming', 'Prog.')
      .replace('Oriented', '')
      .replace('  ', ' ').trim();
    if (s.length > 14) s = s.substring(0, 12) + '…';
    return s;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Data Parser
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Parses raw API response into a structured result object.
   *
   * @param {Object} raw - Raw API response containing student marks data
   * @returns {Object} Parsed result with student info and normalized subjects
   */
  function parseResult(raw) {
    var d = raw.data || {};
    var order = raw.sortedSubjectIdArray || Object.keys(d).filter(function (k) { return k !== 'SGPA'; });

    var subjects = [];
    order.forEach(function (id) {
      if (id === 'SGPA' || !d[id]) return;
      var s = d[id];
      var isPract = (s.courseType || '').toLowerCase() === 'practical';

      var o = {
        id: id,
        code: s.courseCode || '',
        name: titleCase(s.subjectName || s.courseName || ''),
        type: isPract ? 'practical' : 'theory',
        overall: num(s.col_1096),
        max: num(s.col_1474, 100),
        pct: num(s.col_3187),
        grade: String(s.col_7493 || 'F').toUpperCase(),
        gp: num(s.col_9639),
        credits: num(s.col_3695),
        obtCrd: num(s.col_6152),
        cp: num(s.col_4044),
        pass: s.col_9997 || 'Pass',
      };

      if (isPract) {
        o.practMax = num(s.col_7978, 100);
        o.practSec = num(s.col_6954);
        o.practPct = num(s.col_6297);
      } else {
        o.intMax = num(s.col_1498, 40);
        o.intSec = num(s.col_9026);
        o.extMax = num(s.col_2403, 60);
        o.extSec = num(s.col_5396);
        o.extPct = isFinite(num(s.col_5138)) ? num(s.col_5138) : NaN;
        o.thPct = num(s.col_5753);
        o.intPct = (o.intMax > 0) ? (o.intSec / o.intMax) * 100 : 0;
        if (!isFinite(o.intPct)) o.intPct = NaN;
      }

      subjects.push(o);
    });

    var totCr = 0, earnCr = 0, thCt = 0, prCt = 0;
    subjects.forEach(function (s) {
      totCr += s.credits; earnCr += s.obtCrd;
      if (s.type === 'theory') thCt++; else prCt++;
    });

    return {
      name: titleCase(raw.studentName || 'Unknown'),
      prn: raw.studentPRN || raw.rollNumber || 'N/A',
      sem: raw.semesterNumber || 'N/A',
      year: raw.academicYear || '',
      branch: titleCase(raw.academicBranch || ''),
      group: raw.group || '',
      sgpa: num(raw.SGPA || (raw.data && raw.data.SGPA)),
      cgpa: num(raw.CGPA),
      fails: parseInt(raw.failSubjectCount || 0, 10),
      subs: subjects,
      totCr: totCr, earnCr: earnCr, thCt: thCt, prCt: prCt,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Panel HTML Builder
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Builds the complete HTML for the marks panel.
   *
   * @param {Object} r - Parsed result object from parseResult()
   * @returns {string} Complete HTML string for the panel
   */
  function buildPanel(r) {
    var theory = r.subs.filter(function (s) { return s.type === 'theory'; });
    var pract  = r.subs.filter(function (s) { return s.type === 'practical'; });
    var failClr = r.fails > 0 ? '#ef5350' : '#22c55e';
    var failTxt = r.fails > 0 ? r.fails + ' failed' : 'All passed';
    var h = []; // html accumulator

    // ═══ STATS ═══════════════════════════════════════════
    h.push('<div class="vm-stats">');
    h.push('  <div class="vm-s"><div class="vm-sl">SGPA</div><div class="vm-sv">' + (!isFinite(r.sgpa) ? 'N/A' : r.sgpa.toFixed(2)) + '</div><div class="vm-ss">Semester ' + esc(r.sem) + '</div></div>');
    h.push('  <div class="vm-s"><div class="vm-sl">Total credits</div><div class="vm-sv">' + r.earnCr + '</div><div class="vm-ss">All earned</div></div>');
    h.push('  <div class="vm-s"><div class="vm-sl">Subjects</div><div class="vm-sv">' + r.subs.length + '</div><div class="vm-ss">' + r.thCt + ' theory · ' + r.prCt + ' practical</div></div>');
    h.push('  <div class="vm-s"><div class="vm-sl">Failed</div><div class="vm-sv" style="color:' + failClr + '">' + r.fails + '</div><div class="vm-ss">' + failTxt + '</div></div>');
    h.push('</div>');

    // ═══ SUBJECT-WISE RESULT ══════════════════════════
    h.push('<div class="vm-card">');
    h.push('  <div class="vm-ct vm-ct-gray">Subject-wise Result</div>');
    h.push('  <div class="vm-tw">');
    h.push('    <table>');
    h.push('      <thead><tr>');
    h.push('        <th style="text-align:left">Subject</th>');
    h.push('        <th>Code</th><th>Type</th>');
    h.push('        <th style="text-align:right">Marks</th>');
    h.push('        <th style="text-align:right;padding-right:16px">%</th>');
    h.push('        <th style="text-align:center">Grade</th>');
    h.push('        <th style="text-align:right">GP</th>');
    h.push('        <th style="text-align:right">Credits</th>');
    h.push('        <th style="text-align:right">CP</th>');
    h.push('      </tr></thead>');
    h.push('      <tbody>');
    r.subs.forEach(function (s) {
      var ov = isNaN(s.overall) ? 'N/A' : Math.round(s.overall);
      var mx = isNaN(s.max) ? 'N/A' : Math.round(s.max);
      var pct = isNaN(s.pct) ? 'N/A' : Math.round(s.pct);
      h.push('      <tr>');
      h.push('        <td class="vm-tn">' + esc(s.name) + '</td>');
      h.push('        <td class="vm-tm">' + esc(s.code) + '</td>');
      h.push('        <td class="vm-tm">' + (s.type === 'practical' ? 'Practical' : 'Theory') + '</td>');
      h.push('        <td style="text-align:right;color:#fff">' + ov + '/' + mx + '</td>');
      h.push('        <td style="text-align:right;color:#fff;padding-right:16px">' + pct + '%</td>');
      h.push('        <td style="text-align:center">' + gradePill(s.grade) + '</td>');
      h.push('        <td style="text-align:right;color:#fff">' + (isNaN(s.gp) ? 'N/A' : s.gp) + '</td>');
      h.push('        <td style="text-align:right;color:#fff">' + (isNaN(s.credits) ? 'N/A' : s.credits) + '</td>');
      h.push('        <td style="text-align:right;color:#fff">' + (isNaN(s.cp) ? 'N/A' : s.cp) + '</td>');
      h.push('      </tr>');
    });
    h.push('      </tbody>');
    h.push('    </table>');
    h.push('  </div>');
    h.push('</div>');

    // ═══ THEORY DETAIL ═══════════════════════════════════════
    h.push('<div class="vm-card">');
    h.push('  <div class="vm-ct vm-ct-gray">Theory Subjects — Detailed Mark Breakdown</div>');
    h.push('  <div class="vm-tw">');
    h.push('    <table class="vm-tt">');
    h.push('      <thead>');
    h.push('        <tr>');
    h.push('          <th rowspan="2" style="text-align:left;vertical-align:middle">Subject</th>');
    h.push('          <th colspan="2" class="vm-bl" style="text-align:center">Internal (40)</th>');
    h.push('          <th colspan="2" class="vm-bl" style="text-align:center">External / Sem Exam (60)</th>');
    h.push('          <th colspan="2" class="vm-bl" style="text-align:center">Total (100)</th>');
    h.push('          <th rowspan="2" class="vm-bl" style="text-align:center;vertical-align:middle">Grade</th>');
    h.push('        </tr>');
    h.push('        <tr class="vm-subhdr">');
    h.push('          <th class="vm-bl" style="text-align:center">Scored</th>');
    h.push('          <th style="text-align:center">%</th>');
    h.push('          <th class="vm-bl" style="text-align:center">Scored</th>');
    h.push('          <th style="text-align:center">%</th>');
    h.push('          <th class="vm-bl" style="text-align:center">Scored</th>');
    h.push('          <th style="text-align:center">%</th>');
    h.push('        </tr>');
    h.push('      </thead>');
    h.push('      <tbody>');
    theory.forEach(function (s) {
      var ip = isNaN(s.intPct) ? 'N/A' : Math.round(s.intPct) + '%';
      var ep = s.extPct;
      var tp = isNaN(s.pct) ? 'N/A' : Math.round(s.pct) + '%';
      h.push('      <tr>');
      h.push('        <td style="text-align:left"><span style="font-weight:700;color:#fff">' + esc(s.name) + '</span> <span style="font-size:10px;color:#b3b3b3;font-weight:400">' + esc(s.code) + '</span></td>');
      h.push('        <td class="vm-bl" style="text-align:center;font-weight:600;color:#fff">' + (isNaN(s.intSec) ? 'N/A' : s.intSec) + ' / ' + (isNaN(s.intMax) ? 'N/A' : s.intMax) + '</td>');
      h.push('        <td style="text-align:center;font-weight:600;color:' + pctColor(s.intPct) + '">' + ip + '</td>');
      h.push('        <td class="vm-bl" style="text-align:center;font-weight:600;color:#fff">' + (isNaN(s.extSec) ? 'N/A' : s.extSec) + ' / ' + (isNaN(s.extMax) ? 'N/A' : s.extMax) + '</td>');
      h.push('        <td style="text-align:center;font-weight:600;color:' + pctColor(ep) + '">' + (isNaN(ep) ? 'N/A' : ep.toFixed(1)) + '%</td>');
      h.push('        <td class="vm-bl" style="text-align:center;font-weight:600;color:#fff">' + (isNaN(s.overall) ? 'N/A' : Math.round(s.overall)) + ' / ' + (isNaN(s.max) ? 'N/A' : Math.round(s.max)) + '</td>');
      h.push('        <td style="text-align:center;font-weight:600;color:' + pctColor(s.pct) + '">' + tp + '</td>');
      h.push('        <td class="vm-bl" style="text-align:center;font-weight:700;color:#fff">' + s.grade + '</td>');
      h.push('      </tr>');
    });
    h.push('      </tbody>');
    h.push('    </table>');
    h.push('  </div>');
    h.push('  <div class="vm-note">Internal (40) = mid-sem exam (20) + assignments/others (20) — the API returns the combined internal score, not the individual 20+20 split. Pass criteria: external ≥ 35% (21/60), overall ≥ 40%.</div>');
    h.push('</div>');

    // ═══ PRACTICAL ══════════════════════════════════════════
    h.push('<div class="vm-card">');
    h.push('  <div class="vm-ct">Practical Subjects — Mark Breakdown</div>');
    h.push('  <div class="vm-tw">');
    h.push('    <table>');
    h.push('      <thead><tr>');
    h.push('        <th style="text-align:left">Subject</th>');
    h.push('        <th style="text-align:center">Practical scored</th>');
    h.push('        <th style="text-align:center">Out of</th>');
    h.push('        <th style="text-align:center">%</th>');
    h.push('        <th style="text-align:center">Grade</th>');
    h.push('        <th style="text-align:center">Credits</th>');
    h.push('      </tr></thead>');
    h.push('      <tbody>');
    pract.forEach(function (s) {
      var prPct = isNaN(s.practPct) ? 'N/A' : Math.round(s.practPct);
      h.push('      <tr>');
      h.push('        <td style="text-align:left"><span style="font-weight:700;color:#fff;font-size:16px">' + esc(s.name) + '</span> <span style="color:#b3b3b3;font-size:14px">' + esc(s.code) + '</span></td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#fff;font-size:16px">' + (isNaN(s.practSec) ? 'N/A' : s.practSec) + '</td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#fff;font-size:16px">' + (isNaN(s.practMax) ? 'N/A' : s.practMax) + '</td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#10b981;font-size:16px">' + prPct + '%</td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#fff;font-size:16px">' + s.grade + '</td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#fff;font-size:16px">' + (isNaN(s.credits) ? 'N/A' : s.credits) + '</td>');
      h.push('      </tr>');
    });
    h.push('      </tbody>');
    h.push('    </table>');
    h.push('  </div>');
    h.push('  <div class="vm-note">Practical subjects don\'t have an internal/external split in the API — score is recorded as a single combined practical mark (PRACT SEC / PRACT MAX).</div>');
    h.push('</div>');

    // ═══ COMPARISON ═════════════════════════════════════
    h.push('<div class="vm-card">');
    h.push('  <div class="vm-ct">Internal vs External Comparison — Theory Only</div>');
    h.push('  <div class="vm-tw">');
    h.push('    <table>');
    h.push('      <thead><tr>');
    h.push('        <th style="text-align:left">Subject</th>');
    h.push('        <th style="text-align:center">Internal performance</th>');
    h.push('        <th style="text-align:center">External performance</th>');
    h.push('        <th style="text-align:right">Observation</th>');
    h.push('      </tr></thead>');
    h.push('      <tbody>');
    theory.forEach(function (s) {
      var ip = isNaN(s.intPct) ? 0 : Math.round(s.intPct);
      var ep = isNaN(s.extPct) ? 0 : Math.round(s.extPct);
      var obs = getObservation(ip, ep);
      h.push('      <tr>');
      h.push('        <td style="text-align:left"><span style="font-weight:700;color:#fff;font-size:16px">' + esc(s.name) + '</span></td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#fff;font-size:16px">' + (isNaN(s.intSec) ? 'N/A' : s.intSec) + '/' + (isNaN(s.intMax) ? 'N/A' : s.intMax) + ' — ' + ip + '%</td>');
      h.push('        <td style="text-align:center;font-weight:700;color:#fff;font-size:16px">' + (isNaN(s.extSec) ? 'N/A' : s.extSec) + '/' + (isNaN(s.extMax) ? 'N/A' : s.extMax) + ' — ' + ep + '%</td>');
      h.push('        <td style="text-align:right;font-weight:500;color:' + obs.color + '">' + obs.text + '</td>');
      h.push('      </tr>');
    });
    h.push('      </tbody>');
    h.push('    </table>');
    h.push('  </div>');
    h.push('</div>');

    // ═══ CHART ═══════════════════════════════════════════════
    h.push('<div class="vm-card">');
    h.push('  <div class="vm-ct" style="margin-bottom:4px">Performance by Subject</div>');
    h.push('  <div class="vm-legend">');
    h.push('    <span class="vm-li"><span class="vm-ld" style="background:#2196f3"></span>Theory</span>');
    h.push('    <span class="vm-li"><span class="vm-ld" style="background:#00c853"></span>Practical</span>');
    h.push('  </div>');
    h.push('  <div class="vm-chart">');
    // Y-axis
    h.push('    <div class="vm-ya">');
    for (var y = 100; y >= 0; y -= 10) h.push('      <span>' + y + '%</span>');
    h.push('    </div>');
    // Chart area
    h.push('    <div class="vm-ca">');
    // Grid lines
    h.push('      <div class="vm-gl">');
    for (var g = 0; g < 11; g++) h.push('        <div></div>');
    h.push('      </div>');
    // Bars
    h.push('      <div class="vm-bars">');
    theory.forEach(function (s) {
      var pct = isNaN(s.pct) ? 0 : Math.round(s.pct);
      h.push('        <div class="vm-bc"><div class="vm-b" title="' + pct + '%" style="height:' + pct + '%;background:#2196f3"></div><div class="vm-bx" title="' + esc(s.name) + '">' + esc(shortName(s.name)) + '</div></div>');
    });
    // spacer
    h.push('        <div class="vm-bc"></div>');
    pract.forEach(function (s) {
      var pct = isNaN(s.pct) ? 0 : Math.round(s.pct);
      h.push('        <div class="vm-bc"><div class="vm-b" title="' + pct + '%" style="height:' + pct + '%;background:#00c853"></div><div class="vm-bx" title="' + esc(s.name) + '">' + esc(shortName(s.name)) + '</div></div>');
    });
    h.push('      </div>');
    h.push('    </div>');
    h.push('  </div>');
    h.push('</div>');

    // ═══ FULL PANEL WRAPPER ═════════════════════════════════════════════════
    var panel =
      '<div id="' + PANEL_ID + '" class="vm-root vm-entering" role="dialog">' +
        '<div class="vm-backdrop"></div>' +
        '<div class="vm-panel">' +
          '<div class="vm-header">' +
            '<div class="vm-htitle">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>' +
              '<span>vmedulife-marks-extension</span>' +
            '</div>' +
            '<button class="vm-close" id="vmedulife-marks-close" aria-label="Close">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="vm-body">' +
            h.join('\n') +
          '</div>' +
        '</div>' +
      '</div>';

    return panel;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Styles Injection
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Injects the panel's CSS styles into the document head.
   *
   * All rules are scoped under #vmedulife-marks-panel for maximum CSS
   * specificity to prevent style conflicts with the host page.
   *
   * Also injects the Inter font from Google Fonts CDN.
   */
  function injectStyles() {
    if (document.getElementById('vm-styles')) return;

    // Inject Inter font
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
      var fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      (document.head || document.documentElement).appendChild(fontLink);
    }

    var el = document.createElement('style');
    el.id = 'vm-styles';
    el.textContent = '\
/* ═══ vmedulife-marks-extension ═══ */\n\
\n\
' + P + ' { position:fixed!important; inset:0!important; z-index:2147483647!important; font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif!important; font-size:14px!important; line-height:1.5!important; color:#ffffff!important; -webkit-font-smoothing:antialiased!important; }\n\
' + P + ' *, ' + P + ' *::before, ' + P + ' *::after { box-sizing:border-box!important; margin:0!important; padding:0!important; }\n\
\n\
/* Backdrop */\n\
' + P + ' .vm-backdrop { position:absolute!important; inset:0!important; background:rgba(0,0,0,0.55)!important; backdrop-filter:blur(3px)!important; transition:opacity 0.3s!important; }\n\
\n\
/* Panel */\n\
' + P + ' .vm-panel { position:absolute!important; top:0!important; right:0!important; width:880px!important; max-width:100vw!important; height:100%!important; background:#121212!important; display:flex!important; flex-direction:column!important; box-shadow:-8px 0 48px rgba(0,0,0,0.7)!important; transform:translateX(0)!important; opacity:1!important; transition:transform 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.3s!important; }\n\
' + P + '.vm-entering .vm-panel { transform:translateX(100%)!important; opacity:0!important; }\n\
' + P + '.vm-closing .vm-panel { transform:translateX(100%)!important; opacity:0!important; }\n\
' + P + '.vm-closing .vm-backdrop { opacity:0!important; }\n\
\n\
/* Header */\n\
' + P + ' .vm-header { display:flex!important; align-items:center!important; justify-content:space-between!important; padding:14px 24px!important; background:#1e1e1e!important; border-bottom:1px solid #333333!important; flex-shrink:0!important; }\n\
' + P + ' .vm-htitle { display:flex!important; align-items:center!important; gap:10px!important; font-size:15px!important; font-weight:600!important; color:#fff!important; }\n\
' + P + ' .vm-close { background:rgba(255,255,255,0.06)!important; border:1px solid #333!important; border-radius:6px!important; width:32px!important; height:32px!important; display:flex!important; align-items:center!important; justify-content:center!important; cursor:pointer!important; color:#b3b3b3!important; transition:all 0.15s!important; }\n\
' + P + ' .vm-close:hover { background:rgba(255,255,255,0.14)!important; color:#fff!important; }\n\
\n\
/* Body scroll */\n\
' + P + ' .vm-body { flex:1!important; overflow-y:auto!important; padding:0 0 40px!important; scrollbar-width:thin; scrollbar-color:#444 transparent; }\n\
' + P + ' .vm-body::-webkit-scrollbar { width:6px; }\n\
' + P + ' .vm-body::-webkit-scrollbar-track { background:transparent; }\n\
' + P + ' .vm-body::-webkit-scrollbar-thumb { background:#444; border-radius:10px; }\n\
\n\
/* ═══ STATS ═══ */\n\
' + P + ' .vm-stats { display:grid!important; grid-template-columns:repeat(4,1fr)!important; gap:24px!important; padding:28px 32px!important; }\n\
' + P + ' .vm-s { padding:0!important; }\n\
' + P + ' .vm-sl { font-size:11px!important; font-weight:600!important; text-transform:uppercase!important; letter-spacing:0.06em!important; color:#b3b3b3!important; margin-bottom:6px!important; }\n\
' + P + ' .vm-sv { font-size:30px!important; font-weight:700!important; color:#ffffff!important; line-height:1.15!important; }\n\
' + P + ' .vm-ss { font-size:14px!important; color:#b3b3b3!important; margin-top:4px!important; }\n\
\n\
/* ═══ CARD ═══ */\n\
' + P + ' .vm-card { margin:0 20px 20px!important; background:#1e1e1e!important; border:1px solid #333333!important; border-radius:16px!important; padding:28px 32px!important; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)!important; }\n\
\n\
/* Card titles */\n\
' + P + ' .vm-ct { font-size:14px!important; font-weight:700!important; text-transform:uppercase!important; letter-spacing:0.06em!important; color:#ffffff!important; margin-bottom:24px!important; }\n\
' + P + ' .vm-ct-gray { color:#b3b3b3!important; font-size:12px!important; }\n\
\n\
/* ═══ TABLE WRAPPER ═══ */\n\
' + P + ' .vm-tw { overflow-x:auto!important; }\n\
' + P + ' .vm-tw::-webkit-scrollbar { height:4px; }\n\
' + P + ' .vm-tw::-webkit-scrollbar-thumb { background:#444; border-radius:10px; }\n\
\n\
/* ═══ TABLES — General ═══ */\n\
' + P + ' table { width:100%!important; border-collapse:collapse!important; font-size:14px!important; }\n\
' + P + ' th { font-size:12px!important; font-weight:600!important; text-transform:uppercase!important; letter-spacing:0.03em!important; color:#b3b3b3!important; padding:0 12px 16px!important; white-space:nowrap!important; border-bottom:1px solid rgba(51,51,51,0.6)!important; }\n\
' + P + ' td { padding:16px 12px!important; color:#ffffff!important; white-space:nowrap!important; border-bottom:1px solid #333333!important; font-size:14px!important; }\n\
' + P + ' tr:last-child td { border-bottom:none!important; }\n\
' + P + ' tbody tr:hover { background:rgba(255,255,255,0.03)!important; }\n\
\n\
/* Subject name cell */\n\
' + P + ' .vm-tn { font-weight:700!important; color:#fff!important; white-space:normal!important; min-width:150px!important; padding-right:20px!important; }\n\
/* Muted cell (code, type) */\n\
' + P + ' .vm-tm { color:#b3b3b3!important; }\n\
\n\
/* ═══ THEORY TABLE (code(1).html) ═══ */\n\
' + P + ' .vm-tt th { border-top:1px solid #333333!important; border-bottom:1px solid #333333!important; padding:14px 12px!important; font-size:12px!important; font-weight:500!important; }\n\
' + P + ' .vm-tt .vm-subhdr th { font-size:10px!important; padding:8px 12px!important; }\n\
' + P + ' .vm-bl { border-left:1px solid #333333!important; }\n\
' + P + ' .vm-tt td { padding:16px 12px!important; border-bottom:1px solid #333333!important; }\n\
\n\
/* ═══ NOTE ═══ */\n\
' + P + ' .vm-note { font-size:12px!important; color:#b3b3b3!important; line-height:1.6!important; padding:16px!important; background:#262626!important; border:1px solid #333333!important; border-radius:8px!important; margin-top:24px!important; }\n\
\n\
/* ═══ CHART ═══ */\n\
' + P + ' .vm-legend { display:flex!important; gap:16px!important; margin-bottom:20px!important; font-size:12px!important; color:#b3b3b3!important; }\n\
' + P + ' .vm-li { display:flex!important; align-items:center!important; gap:8px!important; }\n\
' + P + ' .vm-ld { width:12px!important; height:12px!important; border-radius:2px!important; display:inline-block!important; }\n\
\n\
' + P + ' .vm-chart { display:flex!important; height:240px!important; }\n\
' + P + ' .vm-ya { display:flex!important; flex-direction:column!important; justify-content:space-between!important; height:100%!important; padding:2px 0!important; }\n\
' + P + ' .vm-ya span { font-size:11px!important; color:#757575!important; width:38px!important; text-align:right!important; padding-right:10px!important; line-height:1!important; }\n\
\n\
' + P + ' .vm-ca { flex:1!important; position:relative!important; border-bottom:1px solid #333333!important; }\n\
' + P + ' .vm-gl { position:absolute!important; inset:0!important; display:flex!important; flex-direction:column!important; justify-content:space-between!important; padding:2px 0!important; pointer-events:none!important; }\n\
' + P + ' .vm-gl div { height:1px!important; background:#333333!important; width:100%!important; }\n\
\n\
' + P + ' .vm-bars { position:absolute!important; inset:0!important; display:flex!important; justify-content:space-around!important; align-items:flex-end!important; padding:0 16px!important; }\n\
' + P + ' .vm-bc { width:60px!important; display:flex!important; flex-direction:column!important; justify-content:flex-end!important; align-items:center!important; height:100%!important; }\n\
' + P + ' .vm-b { width:18px!important; border-radius:4px 4px 0 0!important; transition:height 0.6s cubic-bezier(0.4,0,0.2,1)!important; }\n\
' + P + ' .vm-bx { font-size:11px!important; color:#b3b3b3!important; text-align:center!important; width:60px!important; margin-top:8px!important; overflow:hidden!important; text-overflow:ellipsis!important; white-space:nowrap!important; padding:0!important; border:none!important; }\n\
\n\
/* ═══ RESPONSIVE ═══ */\n\
@media(max-width:880px) {\n\
  ' + P + ' .vm-panel { width:100vw!important; }\n\
}\n\
@media(max-width:640px) {\n\
  ' + P + ' .vm-stats { grid-template-columns:repeat(2,1fr)!important; gap:16px!important; padding:20px 16px!important; }\n\
  ' + P + ' .vm-card { margin:0 10px 14px!important; padding:20px 16px!important; border-radius:12px!important; }\n\
  ' + P + ' .vm-sv { font-size:24px!important; }\n\
  ' + P + ' .vm-chart { height:180px!important; }\n\
  ' + P + ' .vm-bc { width:40px!important; }\n\
  ' + P + ' .vm-bx { width:40px!important; font-size:9px!important; }\n\
  ' + P + ' .vm-b { width:14px!important; }\n\
}\n\
';
    (document.head || document.documentElement).appendChild(el);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Error Panel
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Displays a user-friendly error panel with a title and message.
   *
   * @param {string} title - Error title (e.g., 'Data Error', 'Parse Error')
   * @param {string} message - Detailed error message with guidance
   */
  function showErrorPanel(title, message) {
    var old = document.getElementById(PANEL_ID);
    if (old) old.remove();

    var panel =
      '<div id="' + PANEL_ID + '" class="vm-root" role="dialog">' +
        '<div class="vm-backdrop"></div>' +
        '<div class="vm-panel">' +
          '<div class="vm-header">' +
            '<div class="vm-htitle">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
              '<span>vmedulife-marks-extension — ' + esc(title) + '</span>' +
            '</div>' +
            '<button class="vm-close" id="vmedulife-marks-close" aria-label="Close">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="vm-body" style="display:flex;align-items:center;justify-content:center;height:100%;">' +
            '<div style="text-align:center;padding:40px;max-width:400px;">' +
              '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
              '<div style="font-size:18px;font-weight:600;color:#fff;margin-bottom:12px;">' + esc(title) + '</div>' +
              '<div style="font-size:14px;color:#b3b3b3;line-height:1.6;">' + esc(message) + '</div>' +
              '<div style="font-size:12px;color:#666;margin-top:24px;">Report this issue on GitHub if it persists.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var w = document.createElement('div');
    w.innerHTML = panel;
    var p = w.firstElementChild;
    document.body.appendChild(p);

    document.getElementById('vmedulife-marks-close').addEventListener('click', closePanel);
    p.querySelector('.vm-backdrop').addEventListener('click', closePanel);

    if (_kh) document.removeEventListener('keydown', _kh);
    _kh = function (e) { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', _kh);

    setDebug(title + ' — panel shown');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Panel Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  /** @type {?function} Keyboard event handler reference */
  var _kh = null;

  /**
   * Opens the marks panel with the given raw data.
   *
   * @param {Object} rawData - Raw API response to parse and display
   */
  function openPanel(rawData) {
    log('openPanel called');
    if (!rawData || !rawData.data) {
      log('invalid data');
      try { injectStyles(); } catch (e) { log('style error:', e); }
      showErrorPanel('Data Error', 'The API response was invalid or empty. Try refreshing the results page.');
      return;
    }

    var r;
    try { r = parseResult(rawData); }
    catch (e) {
      log('parse error:', e);
      try { injectStyles(); } catch (e2) { log('style error:', e2); }
      showErrorPanel('Parse Error', 'Failed to process the result data. Please refresh and try again.');
      return;
    }

    log('parsed:', r.name, '|', r.subs.length, 'subjects');
    if (r.subs.length === 0) {
      try { injectStyles(); } catch (e) { log('style error:', e); }
      showErrorPanel('No subjects found', 'The API response doesn\'t contain recognizable subject data. The VMedulife portal may have updated their system.');
      return;
    }

    try { injectStyles(); } catch (e) { log('style error:', e); }

    var old = document.getElementById(PANEL_ID);
    if (old) old.remove();

    var html;
    try { html = buildPanel(r); }
    catch (e) {
      log('render error:', e);
      showErrorPanel('Render Error', 'Failed to build the marks panel. Please refresh and try again.');
      return;
    }

    var w = document.createElement('div');
    w.innerHTML = html;
    var panel = w.firstElementChild;
    document.body.appendChild(panel);

    document.getElementById('vmedulife-marks-close').addEventListener('click', closePanel);
    panel.querySelector('.vm-backdrop').addEventListener('click', closePanel);

    if (_kh) document.removeEventListener('keydown', _kh);
    _kh = function (e) { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', _kh);

    requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.remove('vm-entering'); }); });

    setTimeout(function () { var d = document.getElementById('vmedulife-debug'); if (d) d.remove(); }, 800);
    setDebug('panel rendered ✓');
  }

  /**
   * Closes the marks panel with a slide-out animation.
   */
  function closePanel() {
    var p = document.getElementById(PANEL_ID);
    if (!p) return;
    p.classList.add('vm-closing');
    if (_kh) { document.removeEventListener('keydown', _kh); _kh = null; }
    p.addEventListener('transitionend', function h() { p.removeEventListener('transitionend', h); p.remove(); });
    setTimeout(function () { var el = document.getElementById(PANEL_ID); if (el) el.remove(); }, 500);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Data Retrieval
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Reads and parses marks data from the shared DOM store element.
   *
   * @returns {?Object} Parsed marks data or null if not available
   */
  function readStored() {
    var el = document.getElementById('vmedulife-marks-store');
    if (!el || !el.getAttribute('data-ready')) return null;
    try { var d = JSON.parse(el.textContent); el.remove(); return d; }
    catch (e) { log('parse stored error:', e); return null; }
  }

  function tryOpen() {
    if (document.getElementById(PANEL_ID)) return;
    var d = readStored();
    if (d) { log('data found'); clearPoll(); setDebug('data found, rendering…'); openPanel(d); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Event Listeners & Initialization
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Attempts to open the panel by reading stored data.
   * Called on custom event, MutationObserver detection, and polling fallback.
   */
  document.addEventListener('vmedulife-marks-detected', function () {
    log('event received');
    setTimeout(tryOpen, 50);
  });

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++)
      for (var j = 0; j < muts[i].addedNodes.length; j++)
        if (muts[i].addedNodes[j].id === 'vmedulife-marks-store') { setTimeout(tryOpen, 50); return; }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  tryOpen();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryOpen);

  var pollN = 0;
  var pollT = setInterval(function () {
    pollN++;
    if (document.getElementById(PANEL_ID) || pollN > 120) { clearPoll(); if (pollN > 120) setDebug('timed out'); return; }
    tryOpen();
  }, 500);

  function clearPoll() {
    if (pollT) { clearInterval(pollT); pollT = null; }
    obs.disconnect();
  }

  setDebug('ui.js loaded, listening…');
  log('listeners registered, readyState:', document.readyState);

})();
