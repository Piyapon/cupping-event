/* Pure round-building algorithms (SPEC 3.2). Browser global RoundBuilder / CommonJS. */
(function (root) {
  'use strict';

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }

  /** First varietal name from "Geisha 60%; Caturra 40%". */
  function firstVarietal(s) {
    var first = String(s || '').split(';')[0].replace(/\d+(\.\d+)?\s*%/, '').trim();
    return first;
  }

  function attrValue(coffee, attr) {
    var v = attr === 'varietal' ? firstVarietal(coffee.varietals) : (coffee[attr] || '');
    return String(v).trim() || '(none)';
  }

  /** Groups coffees by attribute, biggest group first (stable for equal sizes). */
  function groupBy(coffees, attr) {
    var map = {}, order = [];
    coffees.forEach(function (c) {
      var v = attrValue(c, attr);
      if (!map[v]) { map[v] = []; order.push(v); }
      map[v].push(c.id);
    });
    return order.map(function (v) { return { value: v, ids: map[v] }; })
      .sort(function (a, b) { return b.ids.length - a.ids.length; });
  }

  function chunk(ids, N, R) {
    var rounds = [];
    for (var r = 0; r < R; r++) rounds.push(ids.slice(r * N, (r + 1) * N));
    return rounds;
  }

  /** mode: random | grouped | balanced. Returns {rounds:[[ids]], flags:[{round, values}]} */
  function build(coffees, R, N, mode, attr) {
    var ids, rounds;
    if (mode === 'grouped') {
      ids = [].concat.apply([], groupBy(shuffle(coffees), attr).map(function (g) { return g.ids; }));
      rounds = chunk(ids, N, R);
    } else if (mode === 'balanced') {
      ids = [].concat.apply([], groupBy(shuffle(coffees), attr).map(function (g) { return g.ids; }));
      rounds = [];
      for (var r = 0; r < R; r++) rounds.push([]);
      ids.forEach(function (id, i) { rounds[i % R].push(id); });
    } else {
      rounds = chunk(shuffle(coffees.map(function (c) { return c.id; })), N, R);
    }
    var flags = [];
    if (mode === 'grouped' && attr) {
      var byId = {}; coffees.forEach(function (c) { byId[c.id] = c; });
      rounds.forEach(function (ids2, i) {
        var vals = {};
        ids2.forEach(function (id) { vals[attrValue(byId[id], attr)] = true; });
        var list = Object.keys(vals);
        if (list.length > 1) flags.push({ round: i + 1, values: list });
      });
    }
    return { rounds: rounds, flags: flags };
  }

  /** Balanced-mode quality: distinct attribute values per round (for display). */
  function diversity(coffees, rounds, attr) {
    var byId = {}; coffees.forEach(function (c) { byId[c.id] = c; });
    return rounds.map(function (ids) {
      var vals = {};
      ids.forEach(function (id) { vals[attrValue(byId[id], attr)] = true; });
      return Object.keys(vals).length;
    });
  }

  var api = { build: build, groupBy: groupBy, attrValue: attrValue, firstVarietal: firstVarietal, diversity: diversity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoundBuilder = api;
})(typeof window !== 'undefined' ? window : this);
