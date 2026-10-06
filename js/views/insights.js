/* Insights: event stats, per-taster profiles, event summary table (SPEC 9).
 * Uses every round that has cups + helper mapping, so it also works mid-event. */
var Views = window.Views || (window.Views = {});

function insightsData() {
  var ev = State.ev;
  var keys = State.roundKeys().concat(State.hasFinal() ? ['F'] : []);
  var rs = keys.map(function (k) {
    var sc = State.scored(k);
    return sc ? { round: k, strength: sc.strength, cupMap: State.cupMap(k), ballots: State.ballotsFor(k) } : null;
  }).filter(Boolean);
  var ents = Stats.entries(rs, State.pts());
  var cof = {}; ev.coffees.forEach(function (c) { cof[c.id] = c; });
  return { rounds: rs, ents: ents, st: Stats.compute(ents, cof, ev.participants) };
}

Views.insights = function (root) {
  var ev = State.ev;
  if (ev.pin && !App.revealOK) {
    var inp = h('input', { type: 'password', inputmode: 'numeric', placeholder: 'PIN' });
    return root.appendChild(h('section', null, h('h2', null, t('Insights')),
      h('p', null, t('Insights show results. Enter the master PIN to unlock.')), inp,
      h('button', { class: 'primary', onclick: function () {
        if (inp.value === ev.pin) { App.revealOK = true; App.render(); } else toast(t('Wrong PIN'));
      } }, t('Unlock'))));
  }
  var d = insightsData();
  if (!d.rounds.length || !ev.ballots.length) {
    return root.appendChild(h('section', null, h('h2', null, t('Insights')),
      h('p', { class: 'note' }, t('Insights appear once a round has cups, a helper mapping and ballots.'))));
  }
  var st = d.st;
  var sub = App.insightsTab || 'stats';
  var pct = function (x) { return Math.round(x * 100) + '%'; };
  var label = function (id) { return State.coffee(id).label; };

  var tabs = h('div', { class: 'tabs' }, [['stats', 'Stats'], ['people', 'Participants'], ['table', 'Summary table']].map(function (x) {
    return h('button', { class: x[0] === sub ? 'on' : '', onclick: function () { App.insightsTab = x[0]; App.render(); } }, t(x[1]));
  }));

  var body;
  if (sub === 'stats') {
    body = h('div', null, Reveal.statsEl(st));
  } else if (sub === 'people') {
    body = h('div', null, ev.participants.map(function (p) { return personCard(p); }));
  } else {
    body = summaryTable();
  }

  root.appendChild(h('section', null, h('h2', null, t('Insights')),
    h('p', { class: 'note' }, t('Contains results. Keep it off the big screen until the reveal.')),
    d.rounds.length < ev.R ? h('p', { class: 'warn' }, t('Partial: only rounds with a helper mapping are included.')) : null,
    tabs, body));

  function bars(title, shares) {
    var list = Object.keys(shares).map(function (k) { return [k, shares[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (!list.length) return null;
    return h('div', null, h('b', null, title),
      list.map(function (x) {
        return h('div', { class: 'barrow' }, h('span', { class: 'barlbl' }, x[0]),
          h('span', { class: 'bartrack' }, h('span', { class: 'barfill', style: 'width:' + pct(x[1]) })),
          h('span', { class: 'barval' }, pct(x[1])));
      }));
  }

  function personCard(p) {
    var liked = d.ents.filter(function (e) { return e.likerCodes.indexOf(p.code) >= 0; });
    var ag = st.agreement.filter(function (a) { return a.code === p.code; })[0];
    var prof = st.profiles.filter(function (x) { return x.name === p.name; })[0];
    var nA = 0, nT = 0;
    d.ents.forEach(function (e) { if (e.aromaBy.indexOf(p.code) >= 0) nA++; if (e.tasteBy.indexOf(p.code) >= 0) nT++; });
    var rounds = {}; ev.ballots.forEach(function (b) { if (b.p === p.code) rounds[b.r] = true; });
    var twin = bestTwin(p.code);
    var tags = [];
    if (st.contrarian && st.contrarian.code === p.code) tags.push(t('Contrarian of the night'));
    if (st.mainstream && st.mainstream.code === p.code) tags.push(t('Mainstream palate'));
    var empty = !liked.length;
    return h('div', { class: 'card' },
      h('h3', null, p.name, tags.length ? h('small', null, ' · ' + tags.join(' · ')) : null),
      empty ? h('p', { class: 'muted' }, t('No ballots yet.')) : h('div', null,
        h('p', null, t('Ballots') + ': ' + Object.keys(rounds).length + ' · ' + t('Aroma likes') + ': ' + nA + ' · ' + t('Taste likes') + ': ' + nT +
          (ag ? ' · ' + t('Agreement with group') + ': ' + pct(ag.score) : '')),
        twin ? h('p', null, t('Closest palate') + ': ' + twin.name + ' (' + pct(twin.j) + ' ' + t('overlap') + ')') : null,
        prof ? bars(t('Process'), prof.process) : null,
        prof ? bars(t('Country'), prof.country) : null,
        prof ? bars(t('Varietal'), prof.varietal) : null,
        h('details', null, h('summary', null, t('Liked coffees') + ' (' + liked.length + ')'),
          h('ul', { class: 'plain' }, liked.map(function (e) {
            var how = [e.aromaBy.indexOf(p.code) >= 0 ? t('aroma') : '', e.tasteBy.indexOf(p.code) >= 0 ? t('taste') : ''].filter(Boolean).join(' + ');
            return h('li', null, (e.round === 'F' ? t('Final') : 'R' + e.round) + ' · ' + label(e.id) + ' · ' + how + ' · ' + e.points + ' ' + t('pts'));
          })))));
  }

  function bestTwin(code) {
    var mine = {}, best = null;
    d.ents.forEach(function (e) { if (e.likerCodes.indexOf(code) >= 0) mine[e.round + ':' + e.id] = 1; });
    ev.participants.forEach(function (o) {
      if (o.code === code) return;
      var theirs = {}, inter = 0;
      d.ents.forEach(function (e) { if (e.likerCodes.indexOf(o.code) >= 0) theirs[e.round + ':' + e.id] = 1; });
      Object.keys(mine).forEach(function (k) { if (theirs[k]) inter++; });
      var uni = Object.keys(mine).length + Object.keys(theirs).length - inter;
      if (uni && (!best || inter / uni > best.j)) best = { name: o.name, j: inter / uni };
    });
    return best && best.j > 0 ? best : null;
  }

  function summaryTable() {
    var main = d.ents.filter(function (e) { return e.round !== 'F'; });
    var rank = State.hasFinal() && State.scored('F') ? finalRanking() : null;
    var fpos = {};
    if (rank) rank.positions.forEach(function (p) { p.ids.forEach(function (id) { fpos[id] = p.position; }); });
    var rrank = {};
    d.rounds.filter(function (r) { return r.round !== 'F'; }).forEach(function (r) {
      CupScoring.sortByChain(main.filter(function (e) { return e.round === r.round; }).map(function (e) { return Object.assign({}, e); }), {})
        .forEach(function (e, i) { rrank[e.id] = i + 1; });
    });
    var rows = main.slice().sort(function (a, b) {
      var fa = fpos[a.id] || 999, fb = fpos[b.id] || 999;
      return (fa - fb) || (b.points - a.points) || (b.taste - a.taste);
    });
    return h('div', null,
      h('button', { onclick: function () {
        var slug = (ev.name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        download(slug + '-results.csv', resultsCsv(), 'text/csv');
      } }, t('Export CSV (all fields)')),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('tr', null, ['Final', 'Coffee', 'Round', 'Rank', 'Pts', 'Aroma', 'Taste', 'Likers', 'Pts/voter', 'Process', 'Country', 'Roaster']
          .map(function (x) { return h('th', null, t(x)); })),
        rows.map(function (e) {
          var c = State.coffee(e.id);
          return h('tr', { class: fpos[e.id] ? 'sel' : '' },
            h('td', null, fpos[e.id] || ''), h('td', null, c.label), h('td', null, e.round), h('td', null, rrank[e.id]),
            h('td', null, e.points), h('td', null, e.aroma), h('td', null, e.taste), h('td', null, e.likers),
            h('td', null, e.voters ? (e.points / e.voters).toFixed(2) : '–'),
            h('td', null, c.process || ''), h('td', null, c.country || ''), h('td', null, c.roaster || ''));
        }))));
  }
};
