/* Reveal show: one tap per reveal, large type (SPEC 8, 9). Letter mappings only become visible here. */
var Views = window.Views || (window.Views = {});

var Reveal = (function () {
  function names(codes) { return codes.length ? codes.map(State.name).join(', ') : '—'; }

  function allRounds() {
    return State.roundKeys().concat(['F']).map(function (k) {
      var sc = State.scored(k);
      if (!sc) return null;
      return { round: k, strength: sc.strength, cupMap: State.cupMap(k), ballots: State.ballotsFor(k), scored: sc };
    });
  }

  function split(ballots) {
    var n = { W: 0, B: 0, S: 0 };
    ballots.forEach(function (b) { if (n[b.s] !== undefined) n[b.s]++; });
    return t('Weak') + ' ' + n.W + ' · ' + t('Balanced') + ' ' + n.B + ' · ' + t('Strong') + ' ' + n.S;
  }

  /** Why a is ahead of b in the final chain. */
  function why(a, b) {
    if (!b) return '';
    if (a.taste !== b.taste) return t('ahead on taste likes') + ' (' + a.taste + ' vs ' + b.taste + ')';
    if (a.aroma !== b.aroma) return t('tied on taste, won on aroma likes') + ' (' + a.aroma + ' vs ' + b.aroma + ')';
    if (a.likers !== b.likers) return t('tied on taste and aroma, won on distinct likers');
    return '';
  }

  function build(mode) {
    var ev = State.ev, rs = allRounds(), steps = [];
    var missing = rs.filter(function (r, i) { return !r && (i < ev.R || State.hasFinal()); });
    if (missing.length) return { error: t('Every round (and the final) needs locked cups and helper mappings before the reveal.') };
    var ents = Stats.entries(rs.filter(Boolean).map(function (r) { return { round: r.round, strength: r.strength, cupMap: r.cupMap, ballots: r.ballots }; }), State.pts());
    function entry(k, id) { return ents.filter(function (e) { return e.round === k && e.id === id; })[0]; }

    State.roundKeys().forEach(function (k) {
      var r = rs[k - 1], list = Object.keys(r.cupMap).sort().map(function (l) { return entry(k, r.cupMap[l]); });
      var ranked = CupScoring.sortByChain(list.map(function (e) { return Object.assign({}, e); }), {});
      if (mode === 'rank') list = ranked.slice().reverse().map(function (e) { return entry(k, e.id); });
      list.forEach(function (e) { steps.push({ type: 'cup', k: k, e: e }); });
      steps.push({ type: 'summary', k: k, r: r, ranked: ranked });
    });

    if (ev.finalists) steps.push({ type: 'finalists' });

    if (State.hasFinal()) {
      var rank = finalRanking(), by = {};
      ents.filter(function (e) { return e.round === 'F'; }).forEach(function (e) { by[e.id] = e; });
      var flat = [];
      rank.positions.forEach(function (p) { p.ids.forEach(function (id) { flat.push({ pos: p, e: by[id] }); }); });
      flat.slice().reverse().forEach(function (x) {
        var idx = flat.indexOf(x), next = flat[idx + 1] ? flat[idx + 1].e : null;
        var note = x.pos.resolution === 'coin' ? t('Decided by coin flip') : x.pos.resolution === 'co' ? t('Co-champions: shared position')
          : why(flat[idx].e, next);
        steps.push({ type: 'final', e: x.e, position: x.pos.position, note: note, total: flat.length });
      });
    }

    var cof = {}; ev.coffees.forEach(function (c) { cof[c.id] = c; });
    var st = Stats.compute(ents, cof, ev.participants);
    steps.push({ type: 'stats', st: st, ents: ents });
    return { steps: steps };
  }

  function coffeeCard(c) {
    var meta = [c.roaster, [c.country, c.region].filter(Boolean).join(', '), c.farm, c.producer, c.process, c.varietals,
      c.altitude ? c.altitude + ' masl' : '', c.roastLevel].filter(Boolean);
    return h('div', { class: 'coffeecard' }, Photos.img(c.id, 'bigphoto'), h('div', { class: 'big' }, c.label),
      h('div', { class: 'meta' }, meta.map(function (m) { return h('div', null, m); })));
  }

  function slide(s) {
    if (s.type === 'cup') {
      var c = State.coffee(s.e.id);
      return h('div', null, h('div', { class: 'giant' }, s.e.letter), coffeeCard(c),
        h('div', { class: 'likes' }, h('b', null, t('Aroma') + ' (' + s.e.aroma + ')'), ' ', names(s.e.aromaBy)),
        h('div', { class: 'likes' }, h('b', null, t('Taste') + ' (' + s.e.taste + ')'), ' ', names(s.e.tasteBy)),
        h('div', { class: 'points' }, s.e.points + ' ' + t('pts')));
    }
    if (s.type === 'summary') {
      var top = s.ranked[0], topTies = s.ranked.filter(function (e) { return CupScoring.compareChain(e, top, {}) === 0; });
      var last = s.ranked[s.ranked.length - 1];
      return h('div', null, h('h2', { class: 'giant2' }, t('Round') + ' ' + s.k),
        h('div', { class: 'likes' }, h('b', null, topTies.length > 1 ? t('Co-winners') : t('Winner')), ' ',
          topTies.map(function (e) { return State.coffee(e.id).label + ' (' + e.points + ')'; }).join(' · ')),
        h('div', { class: 'likes' }, h('b', null, t('Last place')), ' ', State.coffee(last.id).label + ' (' + last.points + ')'),
        h('div', { class: 'likes' }, h('b', null, t('Strength')), ' ', t(s.r.strength), ' — ', split(s.r.ballots)),
        h('div', { class: 'likes' }, h('b', null, t('Voters')), ' ', s.r.scored.voters));
    }
    if (s.type === 'finalists') {
      return h('div', null, h('h2', { class: 'giant2' }, t('Finalists')),
        State.ev.finalists.map(function (f) {
          return h('div', { class: 'likes' }, h('b', null, State.coffee(f.id).label), ' — ', f.reason);
        }));
    }
    if (s.type === 'final') {
      var c2 = State.coffee(s.e.id);
      return h('div', null, h('div', { class: 'giant' }, '#' + s.position), coffeeCard(c2),
        h('div', { class: 'likes' }, h('b', null, t('Taste') + ' (' + s.e.taste + ')'), ' ', names(s.e.tasteBy)),
        h('div', { class: 'likes' }, h('b', null, t('Aroma') + ' (' + s.e.aroma + ')'), ' ', names(s.e.aromaBy)),
        s.note ? h('div', { class: 'note' }, s.note) : null);
    }
    return statsSlide(s);
  }

  function statsSlide(s) {
    var st = s.st, L = function (e) { return State.coffee(e.id).label + ' (R' + e.round + ')'; };
    function stat(title, body) { return h('div', { class: 'card' }, h('h3', null, title), body); }
    var box = h('div', null, h('h2', { class: 'giant2' }, t('Stats')));
    if (st.contrarian) box.appendChild(stat(t('Contrarian of the night'), h('div', { class: 'likes' }, st.contrarian.name + ' (' + Math.round(st.contrarian.score * 100) + '% ' + t('agreement') + ')')));
    if (st.mainstream) box.appendChild(stat(t('Mainstream palate'), h('div', { class: 'likes' }, st.mainstream.name + ' (' + Math.round(st.mainstream.score * 100) + '%)')));
    if (st.twins) box.appendChild(stat(t('Palate twins'), h('div', { class: 'likes' }, st.twins.a + ' + ' + st.twins.b + ' (' + Math.round(st.twins.jaccard * 100) + '% ' + t('overlap') + ')')));
    box.appendChild(stat(t('Nose vs mouth'), h('div', null,
      st.noseOverMouth.map(function (g) { return h('div', null, t('Great nose, weaker cup:') + ' ' + L(g.e) + ' (' + g.e.aroma + ' ' + t('aroma') + ', ' + g.e.taste + ' ' + t('taste') + ')'); }),
      st.mouthOverNose.map(function (g) { return h('div', null, t('Better in the mouth:') + ' ' + L(g.e) + ' (' + g.e.aroma + ' ' + t('aroma') + ', ' + g.e.taste + ' ' + t('taste') + ')'); }))));
    if (st.processBoard.length) box.appendChild(stat(t('Process leaderboard'), h('div', null, st.processBoard.map(function (r) { return h('div', null, r.value + ': ' + r.avg.toFixed(1) + ' ' + t('avg pts') + ' (' + r.n + ')'); }))));
    if (st.countryBoard.length) box.appendChild(stat(t('Country leaderboard'), h('div', null, st.countryBoard.map(function (r) { return h('div', null, r.value + ': ' + r.avg.toFixed(1) + ' ' + t('avg pts') + ' (' + r.n + ')'); }))));
    box.appendChild(stat(t('Round strength vs spread'), h('div', null, st.strengthSpread.map(function (r) { return h('div', null, t('Round') + ' ' + r.round + ': ' + t(r.strength) + ', ' + t('spread') + ' ' + r.spread + ' ' + t('pts')); }))));
    return box;
  }

  return { build: build, slideEl: slide };
})();

Views.reveal = function (root) {
  var ev = State.ev;
  if (ev.pin && !App.revealOK) {
    var inp = h('input', { type: 'password', inputmode: 'numeric', placeholder: 'PIN' });
    return root.appendChild(h('section', null, h('h2', null, t('Reveal')), h('p', null, t('Enter the master PIN to unlock the reveal.')), inp,
      h('button', { class: 'primary', onclick: function () {
        if (inp.value === ev.pin) { App.revealOK = true; App.render(); } else toast(t('Wrong PIN'));
      } }, t('Unlock'))));
  }
  var mode = App.revealMode || 'cup';
  var built = Reveal.build(mode);
  if (built.error) return root.appendChild(h('section', null, h('h2', null, t('Reveal')), h('p', { class: 'warn' }, built.error)));
  var steps = built.steps;
  if (App.revealIdx === undefined || App.revealIdx === null) {
    return root.appendChild(h('section', null, h('h2', null, t('Reveal')),
      field(t('Reveal order'), selectEl([{ value: 'cup', label: t('By cup (A, B, C…)') }, { value: 'rank', label: t('By ranking (last to first)') }], mode,
        function (v) { App.revealMode = v; App.render(); })),
      h('button', { class: 'primary', onclick: function () { App.revealIdx = 0; App.render(); } }, t('Start the show'))));
  }
  var i = Math.min(Math.max(App.revealIdx, 0), steps.length - 1);
  function go(d) { App.revealIdx = Math.min(Math.max(i + d, 0), steps.length - 1); App.render(); }
  document.body.classList.add('show');
  root.appendChild(h('div', { class: 'stage', onclick: function () { go(1); } },
    h('div', { class: 'slide' }, Reveal.slideEl(steps[i]))));
  root.appendChild(h('div', { class: 'stagebar' },
    h('button', { onclick: function () { go(-1); } }, '◀'),
    h('span', null, (i + 1) + ' / ' + steps.length),
    h('button', { onclick: function () { go(1); } }, '▶'),
    h('button', { onclick: function () { App.revealIdx = null; document.body.classList.remove('show'); App.render(); } }, t('Exit'))));
};
