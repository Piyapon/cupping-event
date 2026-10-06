/* End-of-event stats (SPEC section 9). Pure. Browser global Stats / CommonJS. */
(function (root) {
  'use strict';

  /**
   * rounds: [{round, strength, cupMap:{letter:coffeeId}, ballots:[...]}]  (final round has round 'F')
   * Returns one entry per coffee per round with the names of who liked it in each phase.
   */
  function entries(rounds, pts) {
    var out = [];
    rounds.forEach(function (r) {
      var by = {}, voters = {};
      Object.keys(r.cupMap).forEach(function (l) {
        by[r.cupMap[l]] = { id: r.cupMap[l], round: r.round, letter: l, aromaBy: [], tasteBy: [] };
      });
      r.ballots.forEach(function (b) {
        voters[b.p] = true;
        (b.a || []).forEach(function (l) { var e = by[r.cupMap[l]]; if (e) e.aromaBy.push(b.p); });
        (b.t || []).forEach(function (l) { var e = by[r.cupMap[l]]; if (e) e.tasteBy.push(b.p); });
      });
      var nv = Object.keys(voters).length;
      Object.keys(by).forEach(function (id) {
        var e = by[id], set = {};
        e.aromaBy.concat(e.tasteBy).forEach(function (p) { set[p] = true; });
        e.likerCodes = Object.keys(set);
        e.aroma = e.aromaBy.length; e.taste = e.tasteBy.length;
        e.points = pts.aroma * e.aroma + pts.taste * e.taste;
        e.likers = e.likerCodes.length;
        e.voters = nv; e.strength = r.strength;
        out.push(e);
      });
    });
    return out;
  }

  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
  function key(e) { return e.round + ':' + e.id; }

  function compute(ents, coffeesById, participants) {
    var main = ents.filter(function (e) { return e.round !== 'F'; });
    var res = {};

    // Agreement with the group: mean share-of-voters who liked each coffee the taster liked.
    var likedBy = {};
    participants.forEach(function (p) { likedBy[p.code] = []; });
    ents.forEach(function (e) {
      e.likerCodes.forEach(function (p) {
        if (likedBy[p]) likedBy[p].push(e);
      });
    });
    var agree = participants.filter(function (p) { return likedBy[p.code].length; }).map(function (p) {
      return { code: p.code, name: p.name, score: mean(likedBy[p.code].map(function (e) { return e.voters ? e.likers / e.voters : 0; })) };
    }).sort(function (a, b) { return a.score - b.score; });
    res.contrarian = agree[0] || null;
    res.mainstream = agree.length ? agree[agree.length - 1] : null;
    res.agreement = agree;

    // Palate twins: Jaccard over liked (round, coffee) sets.
    var best = null;
    for (var i = 0; i < participants.length; i++) {
      for (var j = i + 1; j < participants.length; j++) {
        var A = {}, B = {}, inter = 0, uni = 0;
        likedBy[participants[i].code].forEach(function (e) { A[key(e)] = 1; });
        likedBy[participants[j].code].forEach(function (e) { B[key(e)] = 1; });
        Object.keys(A).forEach(function (k) { if (B[k]) inter++; });
        uni = Object.keys(A).length + Object.keys(B).length - inter;
        if (uni && (!best || inter / uni > best.jaccard)) {
          best = { a: participants[i].name, b: participants[j].name, jaccard: inter / uni, shared: inter };
        }
      }
    }
    res.twins = best;

    // Nose vs mouth
    var gap = main.map(function (e) { return { e: e, gap: e.aroma - e.taste }; });
    res.noseOverMouth = gap.filter(function (g) { return g.gap > 0; }).sort(function (a, b) { return b.gap - a.gap; }).slice(0, 3);
    res.mouthOverNose = gap.filter(function (g) { return g.gap < 0; }).sort(function (a, b) { return a.gap - b.gap; }).slice(0, 3);

    // Per-taster profile: share of likes by attribute value (where the field exists)
    function attr(c, f) {
      if (!c) return '';
      if (f === 'varietal') return String(c.varietals || '').split(';')[0].replace(/\d+(\.\d+)?\s*%/, '').trim();
      return String(c[f] || '').trim();
    }
    res.profiles = participants.map(function (p) {
      var prof = { name: p.name, process: {}, country: {}, varietal: {} };
      likedBy[p.code].filter(function (e) { return e.round !== 'F'; }).forEach(function (e) {
        var n = (e.aromaBy.indexOf(p.code) >= 0 ? 1 : 0) + (e.tasteBy.indexOf(p.code) >= 0 ? 1 : 0);
        ['process', 'country', 'varietal'].forEach(function (f) {
          var v = attr(coffeesById[e.id], f);
          if (v) prof[f][v] = (prof[f][v] || 0) + n;
        });
      });
      ['process', 'country', 'varietal'].forEach(function (f) {
        var tot = 0; Object.keys(prof[f]).forEach(function (k) { tot += prof[f][k]; });
        Object.keys(prof[f]).forEach(function (k) { prof[f][k] = tot ? prof[f][k] / tot : 0; });
      });
      return prof;
    });

    // Leaderboards: average points per coffee
    function board(f) {
      var g = {};
      main.forEach(function (e) {
        var v = attr(coffeesById[e.id], f);
        if (!v) return;
        (g[v] = g[v] || []).push(e.points);
      });
      return Object.keys(g).map(function (v) { return { value: v, avg: mean(g[v]), n: g[v].length }; })
        .sort(function (a, b) { return b.avg - a.avg; });
    }
    res.processBoard = board('process');
    res.countryBoard = board('country');

    // Round strength vs spread
    var rr = {};
    main.forEach(function (e) { (rr[e.round] = rr[e.round] || { round: e.round, strength: e.strength, pts: [] }).pts.push(e.points); });
    res.strengthSpread = Object.keys(rr).map(function (k) {
      var r = rr[k];
      return { round: r.round, strength: r.strength, spread: Math.max.apply(null, r.pts) - Math.min.apply(null, r.pts) };
    });
    return res;
  }

  var api = { entries: entries, compute: compute };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Stats = api;
})(typeof window !== 'undefined' ? window : this);
