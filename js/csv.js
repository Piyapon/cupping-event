/* CSV for coffees. Columns match coffee_import_template.csv. */
var CSV = (function () {
  var COLS = [
    ['label', 'label'], ['roaster', 'roaster'], ['source', 'source'], ['country', 'country'],
    ['region', 'region'], ['farm', 'farm'], ['producer', 'producer'], ['altitude', 'altitude_masl'],
    ['type', 'type'], ['varietals', 'varietals'], ['process', 'process'], ['roastDate', 'roast_date'],
    ['roastLevel', 'roast_level'], ['bagNotes', 'bag_tasting_notes'], ['compScore', 'competition_score'],
    ['price', 'price'], ['notes', 'notes']
  ];

  function parse(text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = ''; rows.push(row); row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
  }

  function quote(v) {
    v = v == null ? '' : String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function stringify(rows) { return rows.map(function (r) { return r.map(quote).join(','); }).join('\r\n') + '\r\n'; }

  /** CSV text -> coffee objects (ids assigned by caller). Rows without a label are skipped. */
  function parseCoffees(text) {
    var rows = parse(text);
    if (!rows.length) return [];
    var head = rows[0].map(function (c) { return c.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var c = {};
      COLS.forEach(function (col) {
        var i = head.indexOf(col[1]);
        c[col[0]] = i >= 0 && r[i] != null ? r[i].trim() : '';
      });
      return c;
    }).filter(function (c) { return c.label; });
  }

  function coffeesToCsv(coffees) {
    return stringify([COLS.map(function (c) { return c[1]; })].concat(
      coffees.map(function (cf) { return COLS.map(function (c) { return cf[c[0]]; }); })));
  }

  return { COLS: COLS, parse: parse, stringify: stringify, parseCoffees: parseCoffees, coffeesToCsv: coffeesToCsv };
})();
