/* Cupping scoring: pure functions, no DOM, no storage.
 * Works as a browser global (window.CupScoring) and as a CommonJS module (for tests in Node).
 *
 * Shapes
 *   rules   {min, max}                       likes per phase per taster
 *   ballot  {v, e, p, r, a:[letters], t:[letters]|undefined, s:'W'|'B'|'S'}
 *           t absent/null = aroma-only ballot. r is a round number or "F".
 *   coffee score  {id, aroma, taste, points, likers, voters}
 *   round   {round, strength:'weak'|'balanced'|'strong', voters, coffees:[coffee score]}
 */
(function (root) {
  'use strict';

  var STRENGTH_RANK = { weak: 0, balanced: 1, strong: 2 };
  var STRENGTH_CODE = { W: 'weak', B: 'balanced', S: 'strong' };

  // ---------- ballots ----------

  function checkLikes(list, label, letters, rules, errors) {
    if (!Array.isArray(list)) { errors.push(label + ' must be a list'); return; }
    var seen = {};
    list.forEach(function (l) {
      if (letters.indexOf(l) < 0) errors.push(label + ': unknown cup "' + l + '"');
      if (seen[l]) errors.push(label + ': duplicate cup "' + l + '"');
      seen[l] = true;
    });
    if (list.length < rules.min) errors.push(label + ': at least ' + rules.min + ' like(s) required');
    if (list.length > rules.max) errors.push(label + ': at most ' + rules.max + ' like(s) allowed');
  }

  /**
   * ctx: {eventId, letters:['A',...], rules:{min,max}}
   * Final ballots carry no strength vote; main-round ballots may.
   */
  function validateBallot(ballot, ctx) {
    var errors = [];
    if (!ballot || typeof ballot !== 'object') return { ok: false, errors: ['not a ballot'] };
    if (ballot.v !== 1) errors.push('unsupported version');
    if (ballot.e !== ctx.eventId) errors.push('wrong event');
    if (!ballot.p) errors.push('missing participant');
    if (ballot.r === undefined || ballot.r === null) errors.push('missing round');
    checkLikes(ballot.a, 'aroma', ctx.letters, ctx.rules, errors);
    if (ballot.t !== undefined && ballot.t !== null) {
      checkLikes(ballot.t, 'taste', ctx.letters, ctx.rules, errors);
    }
    if (ballot.s !== undefined && ballot.s !== null) {
      if (ballot.r === 'F') errors.push('final ballots have no strength vote');
      else if (!STRENGTH_CODE[ballot.s]) errors.push('bad strength "' + ballot.s + '"');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * Returns {status, ballots, existing?, errors?}. status:
   *   'rejected'  invalid or wrong event (ballots unchanged)
   *   'duplicate' same participant+round already present; call again with {replace:true}
   *   'added' | 'replaced'
   */
  function addBallot(ballots, ballot, ctx, opts) {
    var v = validateBallot(ballot, ctx);
    if (!v.ok) return { status: 'rejected', errors: v.errors, ballots: ballots };
    var idx = -1;
    for (var i = 0; i < ballots.length; i++) {
      if (ballots[i].p === ballot.p && ballots[i].r === ballot.r) { idx = i; break; }
    }
    if (idx >= 0) {
      if (!(opts && opts.replace)) {
        return { status: 'duplicate', existing: ballots[idx], ballots: ballots };
      }
      var copy = ballots.slice();
      copy[idx] = ballot;
      return { status: 'replaced', ballots: copy };
    }
    return { status: 'added', ballots: ballots.concat([ballot]) };
  }

  // ---------- round scoring ----------

  /** Majority label; ties between labels and no votes -> balanced. */
  function roundStrength(ballots) {
    var n = { weak: 0, balanced: 0, strong: 0 };
    ballots.forEach(function (b) { if (STRENGTH_CODE[b.s]) n[STRENGTH_CODE[b.s]]++; });
    var top = Math.max(n.weak, n.balanced, n.strong);
    if (top === 0) return 'balanced';
    var winners = Object.keys(n).filter(function (k) { return n[k] === top; });
    return winners.length === 1 ? winners[0] : 'balanced';
  }

  /**
   * ballots: ballots of ONE round. cupMap: {letter: coffeeId}. pts: {aroma:1, taste:2}.
   * Aroma-only ballots count aroma and contribute zero taste.
   */
  function scoreRound(round, ballots, cupMap, pts) {
    pts = pts || { aroma: 1, taste: 2 };
    var by = {};
    Object.keys(cupMap).forEach(function (l) {
      by[cupMap[l]] = { id: cupMap[l], aroma: 0, taste: 0, points: 0, likersSet: {} };
    });
    ballots.forEach(function (b) {
      (b.a || []).forEach(function (l) {
        var c = by[cupMap[l]]; if (!c) return;
        c.aroma++; c.likersSet[b.p] = true;
      });
      (b.t || []).forEach(function (l) {
        var c = by[cupMap[l]]; if (!c) return;
        c.taste++; c.likersSet[b.p] = true;
      });
    });
    var voters = {};
    ballots.forEach(function (b) { voters[b.p] = true; });
    var coffees = Object.keys(by).map(function (id) {
      var c = by[id];
      return {
        id: c.id, aroma: c.aroma, taste: c.taste,
        points: pts.aroma * c.aroma + pts.taste * c.taste,
        likers: Object.keys(c.likersSet).length
      };
    });
    var nv = Object.keys(voters).length;
    coffees.forEach(function (c) { c.voters = nv; c.pointsPerVoter = nv ? c.points / nv : 0; });
    return { round: round, strength: roundStrength(ballots), voters: nv, coffees: coffees };
  }

  // ---------- comparison chain ----------

  /**
   * Compare coffees a, b (each a coffee score plus .strength, .voters).
   * Negative = a ranks ahead. Returns 0 when the chain cannot separate them.
   * opts.normalize: step 1 uses points/voters. opts.crossRound: apply strength step.
   */
  function compareChain(a, b, opts) {
    opts = opts || {};
    var pa = a.points, pb = b.points;
    if (opts.normalize) {
      pa = a.voters ? a.points / a.voters : 0;
      pb = b.voters ? b.points / b.voters : 0;
    }
    if (pa !== pb) return pb - pa;
    if (a.taste !== b.taste) return b.taste - a.taste;
    if (a.likers !== b.likers) return b.likers - a.likers;
    if (opts.crossRound && a.strength && b.strength) {
      var d = STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength];
      if (d) return d;
    }
    return 0;
  }

  /** Sort by chain; ties fall to opts.pick (ordered list of coffee ids, master/coin flip), then input order. */
  function sortByChain(list, opts) {
    var pick = (opts && opts.pick) || [];
    var order = {};
    list.forEach(function (c, i) { order[c.id] = i; });
    function pr(c) { var i = pick.indexOf(c.id); return i < 0 ? Infinity : i; }
    return list.slice().sort(function (a, b) {
      return compareChain(a, b, opts) || (pr(a) - pr(b)) || (order[a.id] - order[b.id]);
    });
  }

  // ---------- finalist selection ----------

  function votersWarning(rounds) {
    var counts = rounds.map(function (r) { return r.voters; });
    var uneven = counts.some(function (c) { return c !== counts[0]; });
    return uneven
      ? { warn: true, counts: counts, message: 'Voter counts differ across rounds: ' + counts.join(', ') }
      : { warn: false, counts: counts };
  }

  /**
   * rounds: [{round, strength, voters, coffees}]. Returns
   *   {finalists:[{id, round, reason}], warnings:[], unresolved:[[ids]], excluded:[ids]}
   * opts: {F, normalize, pick}
   * `unresolved` lists tie groups settled only by step 5 (master pick / coin flip prompt).
   */
  function selectFinalists(rounds, opts) {
    var F = opts.F;
    var cmp = { normalize: false, crossRound: true, pick: opts.pick };
    var warnings = [];
    var vw = votersWarning(rounds);
    if (vw.warn) warnings.push(vw.message);

    var all = [];       // flattened coffees with round context
    var qualified = {}; // id -> {id, round, reason, rep}
    var excluded = {};  // weak-round co-winners barred from fill
    var unresolved = [];

    rounds.forEach(function (r) {
      var cs = r.coffees.map(function (c) {
        var x = Object.assign({}, c);
        x.round = r.round; x.strength = r.strength; x.voters = r.voters;
        all.push(x);
        return x;
      });
      if (!cs.length) return;
      if (r.voters === 0) warnings.push('Round ' + r.round + ' has no ballots');
      var top = Math.max.apply(null, cs.map(function (c) { return c.points; }));
      var T = cs.filter(function (c) { return c.points === top; });
      var sorted = sortByChain(T, { crossRound: false, pick: opts.pick });
      var rep = sorted[0];
      var tiedWithRep = T.filter(function (c) { return compareChain(c, rep, {}) === 0; });
      // Only a weak round must choose one; balanced/strong keep every co-winner.
      if (r.strength === 'weak' && tiedWithRep.length > 1) {
        unresolved.push(tiedWithRep.map(function (c) { return c.id; }));
      }
      if (r.strength === 'weak') {
        qualified[rep.id] = { id: rep.id, round: r.round, reason: 'Round ' + r.round + ' winner (weak round)', rep: true };
        T.forEach(function (c) { if (c.id !== rep.id) excluded[c.id] = true; });
      } else {
        T.forEach(function (c) {
          qualified[c.id] = {
            id: c.id, round: r.round, rep: c.id === rep.id,
            reason: T.length === 1 ? 'Round ' + r.round + ' winner' : 'Co-winner R' + r.round
          };
        });
      }
    });

    var byId = {};
    all.forEach(function (c) { byId[c.id] = c; });
    var qlist = Object.keys(qualified).map(function (id) { return qualified[id]; });

    // Overflow: cut co-winners (never a round's representative) worst-first.
    if (qlist.length > F) {
      var cuttable = sortByChain(
        qlist.filter(function (q) { return !q.rep; }).map(function (q) { return byId[q.id]; }),
        cmp
      ).reverse();
      while (qlist.length > F && cuttable.length) {
        var cut = cuttable.shift();
        qlist = qlist.filter(function (q) { return q.id !== cut.id; });
        delete qualified[cut.id];
      }
      if (qlist.length > F) warnings.push('More rounds than final cups: cannot keep every round winner');
    }

    // Fill from Balanced/Strong runner-ups, then Weak as a last resort.
    if (qlist.length < F) {
      var fcmp = { normalize: !!opts.normalize, crossRound: true, pick: opts.pick };
      var pool = all.filter(function (c) { return !qualified[c.id] && c.strength !== 'weak'; });
      sortByChain(pool, fcmp).forEach(function (c) {
        if (qlist.length >= F) return;
        qlist.push({
          id: c.id, round: c.round,
          reason: 'Best runner-up, ' + c.points + ' pts' + (opts.normalize ? ' (' + (c.voters ? (c.points / c.voters).toFixed(2) : '0') + '/voter)' : '')
        });
        qualified[c.id] = true;
      });
      if (qlist.length < F) {
        var weakPool = all.filter(function (c) { return !qualified[c.id]; });
        sortByChain(weakPool, fcmp).forEach(function (c) {
          if (qlist.length >= F) return;
          qlist.push({ id: c.id, round: c.round, reason: 'Weak-round fill, ' + c.points + ' pts' });
          qualified[c.id] = true;
        });
      }
    }

    var finalists = qlist.map(function (q) { return { id: q.id, round: q.round, reason: q.reason }; });
    var fids = {};
    finalists.forEach(function (f) { fids[f.id] = true; });
    return {
      finalists: finalists,
      warnings: warnings,
      unresolved: unresolved,
      excluded: Object.keys(excluded).filter(function (id) { return !fids[id]; })
    };
  }

  // ---------- final round ----------

  function tieKey(ids) { return ids.slice().sort().join('|'); }

  /** Uniform random permutation (coin flip for 2, repeated for 3+). rng defaults to Math.random. */
  function coinFlip(ids, rng) {
    rng = rng || Math.random;
    var a = ids.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * coffees: score objects from scoreRound (final ballots). Chain: taste, aroma, likers.
   * resolutions: {[tieKey(ids)]: {type:'co'} | {type:'coin', order:[ids]}}
   * Returns {positions:[{position, ids, tied, resolution}], needsDecision:[ids...]}
   * Co-champions share a position (1,1,3). Coin results rank sequentially.
   */
  function rankFinal(coffees, resolutions) {
    resolutions = resolutions || {};
    function cmpF(a, b) {
      return (b.taste - a.taste) || (b.aroma - a.aroma) || (b.likers - a.likers);
    }
    var sorted = coffees.slice().sort(cmpF);
    var groups = [];
    sorted.forEach(function (c) {
      var g = groups[groups.length - 1];
      if (g && cmpF(g[0], c) === 0) g.push(c); else groups.push([c]);
    });
    var positions = [], needs = [], pos = 1;
    groups.forEach(function (g) {
      var ids = g.map(function (c) { return c.id; });
      if (g.length === 1) {
        positions.push({ position: pos, ids: ids, tied: false });
        pos++;
        return;
      }
      var res = resolutions[tieKey(ids)];
      if (!res) {
        needs.push(ids);
        positions.push({ position: pos, ids: ids, tied: true, resolution: null });
        pos += ids.length;
      } else if (res.type === 'co') {
        positions.push({ position: pos, ids: ids, tied: true, resolution: 'co' });
        pos += ids.length;
      } else {
        res.order.forEach(function (id) {
          positions.push({ position: pos, ids: [id], tied: true, resolution: 'coin' });
          pos++;
        });
      }
    });
    return { positions: positions, needsDecision: needs };
  }

  var api = {
    validateBallot: validateBallot, addBallot: addBallot,
    roundStrength: roundStrength, scoreRound: scoreRound,
    compareChain: compareChain, sortByChain: sortByChain,
    votersWarning: votersWarning, selectFinalists: selectFinalists,
    rankFinal: rankFinal, coinFlip: coinFlip, tieKey: tieKey
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CupScoring = api;
})(typeof window !== 'undefined' ? window : this);
