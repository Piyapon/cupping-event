/* Acceptance tests for js/scoring.js (SPEC section 11).
 * Shared by tests/scoring.test.html (browser) and Node (require).
 * Each case is {name, fn}; fn throws on failure.
 */
(function (root) {
  'use strict';
  var S = (typeof module !== 'undefined' && module.exports) ? require('../js/scoring.js') : root.CupScoring;

  function eq(actual, expected, msg) {
    var a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'expected ' + e + ' but got ' + a);
  }
  function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

  // coffee score: points = 1*aroma + 2*taste
  function c(id, aroma, taste, likers) {
    return { id: id, aroma: aroma, taste: taste, points: aroma + 2 * taste, likers: likers == null ? aroma + taste : likers };
  }
  function rnd(n, strength, voters, coffees) {
    return { round: n, strength: strength, voters: voters, coffees: coffees };
  }
  function ids(res) { return res.finalists.map(function (f) { return f.id; }).sort(); }

  var RULES = { min: 1, max: 2 };
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var CTX = { eventId: 'EV1', letters: LETTERS, rules: RULES };
  function ballot(p, r, a, t, s) {
    var b = { v: 1, e: 'EV1', p: p, r: r, a: a };
    if (t !== undefined) b.t = t;
    if (s !== undefined) b.s = s;
    return b;
  }

  var cases = [];
  function test(name, fn) { cases.push({ name: name, fn: fn }); }

  test('1. Clear winners, R=4 F=6 -> 4 winners + 2 best runner-ups by points', function () {
    var rounds = [
      rnd(1, 'balanced', 6, [c('a1', 3, 3), c('a2', 2, 1), c('a3', 1, 0)]),   // 9, 4, 1
      rnd(2, 'balanced', 6, [c('b1', 2, 3), c('b2', 3, 2), c('b3', 0, 0)]),   // 8, 7, 0
      rnd(3, 'balanced', 6, [c('c1', 2, 4), c('c2', 4, 2), c('c3', 1, 0)]),   // 10, 8, 1
      rnd(4, 'balanced', 6, [c('d1', 2, 5), c('d2', 1, 1), c('d3', 0, 0)])    // 12, 3, 0
    ];
    var res = S.selectFinalists(rounds, { F: 6 });
    eq(ids(res), ['a1', 'b1', 'b2', 'c1', 'c2', 'd1']);
    eq(res.warnings, []);
    ok(/winner/i.test(res.finalists.filter(function (f) { return f.id === 'a1'; })[0].reason), 'winner reason');
    ok(/runner-up/i.test(res.finalists.filter(function (f) { return f.id === 'c2'; })[0].reason), 'runner-up reason');
  });

  test('2. Runner-ups tie on points -> more taste likes wins', function () {
    var rounds = [
      rnd(1, 'balanced', 5, [c('x1', 3, 3), c('x2', 2, 2), c('x3', 0, 0)]),  // 9, 6 (taste 2)
      rnd(2, 'balanced', 5, [c('y1', 3, 3), c('y2', 4, 1), c('y3', 0, 0)])   // 9, 6 (taste 1)
    ];
    eq(ids(S.selectFinalists(rounds, { F: 3 })), ['x1', 'x2', 'y1']);
  });

  test('3. Balanced round with 2-way top tie -> both qualify', function () {
    var rounds = [
      rnd(1, 'balanced', 5, [c('a1', 2, 3), c('a2', 4, 2), c('a3', 0, 0)]),  // 8, 8
      rnd(2, 'balanced', 5, [c('b1', 3, 3), c('b2', 1, 0), c('b3', 0, 0)])
    ];
    var res = S.selectFinalists(rounds, { F: 3 });
    eq(ids(res), ['a1', 'a2', 'b1']);
    ok(/co-winner/i.test(res.finalists.filter(function (f) { return f.id === 'a2'; })[0].reason));
  });

  test('4. Weak round 2-way tie -> one via chain; the other excluded from fill', function () {
    var rounds = [
      rnd(1, 'weak', 5, [c('w1', 2, 2), c('w2', 4, 1), c('w3', 0, 0)]),      // 6 (taste 2), 6 (taste 1)
      rnd(2, 'balanced', 5, [c('b1', 3, 3), c('b2', 2, 1), c('b3', 0, 0)]),  // 9, 4
      rnd(3, 'balanced', 5, [c('c1', 3, 2), c('c2', 1, 1), c('c3', 0, 0)])   // 7, 3
    ];
    var res = S.selectFinalists(rounds, { F: 4 });
    eq(ids(res), ['b1', 'b2', 'c1', 'w1']);          // w2 (6 pts) loses to b2 (4 pts) for the fill seat
    ok(res.excluded.indexOf('w2') >= 0, 'w2 flagged excluded');
    eq(res.unresolved, [], 'chain separated them, no prompt');

    // fully tied weak winners -> needs master pick
    var tied = [rnd(1, 'weak', 5, [c('w1', 2, 2), c('w2', 2, 2)]), rnd(2, 'balanced', 5, [c('b1', 3, 3), c('b2', 0, 0)])];
    var r2 = S.selectFinalists(tied, { F: 2 });
    eq(r2.unresolved, [['w1', 'w2']]);
    eq(ids(S.selectFinalists(tied, { F: 2, pick: ['w2'] })), ['b1', 'w2']);
  });

  test('5. Overflow: 3 rounds with 2-way ties, R=4 F=6 -> cut 1 co-winner, every round keeps >=1', function () {
    var rounds = [
      rnd(1, 'balanced', 5, [c('a1', 2, 3), c('a2', 4, 2), c('a3', 0, 0)]),  // 8, 8
      rnd(2, 'balanced', 5, [c('b1', 2, 4), c('b2', 4, 3), c('b3', 0, 0)]),  // 10, 10
      rnd(3, 'balanced', 5, [c('c1', 2, 2), c('c2', 4, 1), c('c3', 0, 0)]),  // 6, 6
      rnd(4, 'balanced', 5, [c('d1', 2, 5), c('d2', 1, 0), c('d3', 0, 0)])   // 12
    ];
    var res = S.selectFinalists(rounds, { F: 6 });
    eq(res.finalists.length, 6);
    eq(ids(res), ['a1', 'a2', 'b1', 'b2', 'c1', 'd1']);   // c2 (weakest co-winner) cut
    [1, 2, 3, 4].forEach(function (r) {
      ok(res.finalists.some(function (f) { return f.round === r; }), 'round ' + r + ' represented');
    });
  });

  test('6. Unequal voters (7 vs 5) -> warning; normalize changes fill order', function () {
    var rounds = [
      rnd(1, 'balanced', 7, [c('x1', 4, 3), c('x2', 2, 2), c('x3', 1, 0)]),  // 10, 6
      rnd(2, 'balanced', 5, [c('y1', 3, 3), c('y2', 1, 2), c('y3', 1, 0)])   // 9, 5
    ];
    var raw = S.selectFinalists(rounds, { F: 3 });
    ok(raw.warnings.length === 1, 'warning shown');
    eq(ids(raw), ['x1', 'x2', 'y1'], 'raw fill picks x2 (6 > 5)');
    var norm = S.selectFinalists(rounds, { F: 3, normalize: true });
    eq(ids(norm), ['x1', 'y1', 'y2'], 'normalized: 5/5=1.0 beats 6/7=0.86');
    eq(S.votersWarning([rnd(1, 'balanced', 6, []), rnd(2, 'balanced', 6, [])]).warn, false);
  });

  test('7. Final: taste tie broken by aroma; full tie -> co-champion / coin flip prompt', function () {
    var coffees = [c('A', 1, 3), c('B', 2, 3), c('C', 1, 1), c('D', 1, 1), c('E', 0, 0)];
    var r = S.rankFinal(coffees);
    eq(r.positions[0].ids, ['B'], 'aroma breaks taste tie');
    eq(r.positions[1].ids, ['A']);
    eq(r.needsDecision, [['C', 'D']], 'prompt for full tie');

    var co = {}; co[S.tieKey(['C', 'D'])] = { type: 'co' };
    var rc = S.rankFinal(coffees, co);
    eq(rc.needsDecision, []);
    eq(rc.positions.map(function (p) { return p.position; }), [1, 2, 3, 5], 'co-champions share 3rd, next is 5th');

    var coin = {}; coin[S.tieKey(['C', 'D'])] = { type: 'coin', order: ['D', 'C'] };
    var rf = S.rankFinal(coffees, coin);
    eq(rf.positions.map(function (p) { return p.ids[0]; }), ['B', 'A', 'D', 'C', 'E']);
    eq(rf.positions.map(function (p) { return p.position; }), [1, 2, 3, 4, 5]);

    var flip = S.coinFlip(['x', 'y', 'z'], function () { return 0; });
    eq(flip.slice().sort(), ['x', 'y', 'z'], 'coin flip is a permutation');
  });

  test('8. Taster leaves after round 2 -> later rounds use fewer voters, no errors', function () {
    var map = { A: 'k1', B: 'k2', C: 'k3' };
    var r1 = S.scoreRound(1, [ballot('P1', 1, ['A'], ['A'], 'B'), ballot('P2', 1, ['B'], ['A'], 'B'), ballot('P3', 1, ['A'], ['B'], 'S')], map);
    var r3 = S.scoreRound(3, [ballot('P1', 3, ['A'], ['A'], 'B'), ballot('P2', 3, ['B'], ['B'], 'B')], map);
    var r4 = S.scoreRound(4, [], map);
    eq([r1.voters, r3.voters, r4.voters], [3, 2, 0]);
    eq(r4.strength, 'balanced', 'no votes -> balanced');
    var res = S.selectFinalists([r1, r3, r4], { F: 3 });
    eq(res.finalists.length, 3);
    ok(res.warnings.length >= 1, 'voter warning present');
    eq(r1.coffees.filter(function (x) { return x.id === 'k1'; })[0].points, 1 * 2 + 2 * 2, 'k1: 2 aroma + 2 taste');
  });

  test('9. Aroma-only ballot counts aroma, zero taste', function () {
    var map = { A: 'k1', B: 'k2' };
    var b = ballot('P1', 1, ['A', 'B'], undefined, 'B');
    ok(S.validateBallot(b, CTX).ok, 'aroma-only is valid');
    var r = S.scoreRound(1, [b], map);
    eq(r.coffees.map(function (x) { return [x.aroma, x.taste, x.points, x.likers]; }), [[1, 0, 1, 1], [1, 0, 1, 1]]);
    eq(r.voters, 1);
  });

  test('10. Duplicate ballot -> replace prompt; wrong event id -> rejected', function () {
    var first = ballot('P1', 1, ['A'], ['A'], 'B');
    var r1 = S.addBallot([], first, CTX);
    eq(r1.status, 'added');
    var again = ballot('P1', 1, ['B'], ['B'], 'B');
    var r2 = S.addBallot(r1.ballots, again, CTX);
    eq(r2.status, 'duplicate');
    eq(r2.ballots.length, 1);
    eq(r2.existing.a, ['A']);
    var r3 = S.addBallot(r1.ballots, again, CTX, { replace: true });
    eq(r3.status, 'replaced');
    eq(r3.ballots[0].a, ['B']);
    ok(S.addBallot([], ballot('P1', 2, ['A'], ['A']), CTX).status === 'added', 'same taster, other round is not a duplicate');
    var wrong = Object.assign({}, first, { e: 'OTHER' });
    var r4 = S.addBallot([], wrong, CTX);
    eq(r4.status, 'rejected');
    ok(r4.errors.indexOf('wrong event') >= 0);
  });

  test('11. Ballots violating min/max likes -> rejected', function () {
    ok(!S.validateBallot(ballot('P1', 1, [], ['A']), CTX).ok, 'aroma below min');
    ok(!S.validateBallot(ballot('P1', 1, ['A', 'B', 'C'], ['A']), CTX).ok, 'aroma above max');
    ok(!S.validateBallot(ballot('P1', 1, ['A'], []), CTX).ok, 'taste below min');
    ok(!S.validateBallot(ballot('P1', 1, ['A'], ['A', 'B', 'C']), CTX).ok, 'taste above max');
    ok(!S.validateBallot(ballot('P1', 1, ['A', 'A'], ['A']), CTX).ok, 'duplicate cup');
    ok(!S.validateBallot(ballot('P1', 1, ['Z'], ['A']), CTX).ok, 'unknown cup');
    ok(!S.validateBallot(ballot('P1', 'F', ['A'], ['A'], 'B'), CTX).ok, 'final has no strength vote');
    ok(S.validateBallot(ballot('P1', 'F', ['A'], ['A']), CTX).ok, 'valid final ballot');
    eq(S.addBallot([], ballot('P1', 1, [], ['A']), CTX).status, 'rejected', 'rejected at import');
  });

  test('Round strength: majority, tie -> balanced', function () {
    eq(S.roundStrength([{ s: 'S' }, { s: 'S' }, { s: 'B' }]), 'strong');
    eq(S.roundStrength([{ s: 'W' }, { s: 'S' }]), 'balanced');
    eq(S.roundStrength([{ s: 'W' }, { s: 'W' }, { s: 'B' }]), 'weak');
    eq(S.roundStrength([]), 'balanced');
  });

  var api = { cases: cases };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScoringCases = api;
})(typeof window !== 'undefined' ? window : this);
