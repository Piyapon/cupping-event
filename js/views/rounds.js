/* Round building: random / grouped / balanced / manual, preview, adjust, lock (SPEC 3.2). */
var Views = window.Views || (window.Views = {});

Views.rounds = function (root) {
  var ev = State.ev;
  var total = ev.R * ev.N;

  if (ev.coffees.length !== total) {
    return root.appendChild(h('section', null, h('h2', null, t('Rounds')),
      h('p', { class: 'warn' }, t('Enter exactly') + ' ' + total + ' ' + t('coffees first') + ' (' + ev.coffees.length + ' ' + t('so far') + ').'),
      h('button', { onclick: function () { App.tab = 'coffees'; App.render(); } }, t('Go to coffees'))));
  }

  if (ev.rounds) return root.appendChild(locked());

  var d = App.draftRounds || (App.draftRounds = { mode: 'random', attr: 'process', rounds: null, flags: [] });
  var byId = {}; ev.coffees.forEach(function (c) { byId[c.id] = c; });

  function build() {
    var r = RoundBuilder.build(ev.coffees, ev.R, ev.N, d.mode === 'manual' ? 'random' : d.mode, d.attr);
    d.rounds = r.rounds; d.flags = r.flags; App.render();
  }
  function move(id, to) {
    d.rounds.forEach(function (r) { var i = r.indexOf(id); if (i >= 0) r.splice(i, 1); });
    d.rounds[to].push(id);
    d.flags = [];
    App.render();
  }
  function roundOf(id) { for (var i = 0; i < d.rounds.length; i++) if (d.rounds[i].indexOf(id) >= 0) return i; }
  function sizesOk() { return d.rounds.every(function (r) { return r.length === ev.N; }); }

  var attrs = [{ value: 'process', label: t('Process') }, { value: 'country', label: t('Country') },
    { value: 'varietal', label: t('Varietal') }, { value: 'roaster', label: t('Roaster') }];

  var preview = null;
  if (d.rounds) {
    var div = d.mode === 'balanced' ? RoundBuilder.diversity(ev.coffees, d.rounds, d.attr) : null;
    preview = h('div', null,
      d.rounds.map(function (r, i) {
        var flag = d.flags.filter(function (f) { return f.round === i + 1; })[0];
        return h('div', { class: 'card' },
          h('h3', null, t('Round') + ' ' + (i + 1) + ' (' + r.length + '/' + ev.N + ')',
            div ? h('small', null, ' · ' + div[i] + ' ' + t('distinct')) : null),
          flag ? h('p', { class: 'warn' }, t('Mixed, adjust manually:') + ' ' + flag.values.join(', ')) : null,
          h('ul', { class: 'plain' }, r.map(function (id) {
            return h('li', { class: 'row' },
              h('span', { class: 'grow' }, byId[id].label, ' ', h('small', null, RoundBuilder.attrValue(byId[id], d.attr))),
              selectEl(d.rounds.map(function (_, j) { return { value: j, label: t('R') + (j + 1) }; }), i, function (v) { move(id, +v); }));
          })));
      }),
      sizesOk() ? null : h('p', { class: 'warn' }, t('Each round needs exactly') + ' ' + ev.N + ' ' + t('coffees to lock.')),
      h('button', { class: 'primary', disabled: !sizesOk(), onclick: function () {
        if (!confirm(t('Lock rounds? Cup numbers will be assigned at random.'))) return;
        State.update(function (s) {
          s.rounds = d.rounds.map(function (r) { return r.slice(); });
          s.cups = {}; s.letters = {};
          s.rounds.forEach(function (r, i) { s.cups[i + 1] = shuffle(r); });
        });
        App.draftRounds = null; App.tab = 'grind'; App.render();
      } }, t('Lock rounds')));
  }

  root.appendChild(h('section', null,
    h('h2', null, t('Build rounds')),
    field(t('Mode'), selectEl([
      { value: 'random', label: t('Random') }, { value: 'grouped', label: t('Grouped (one attribute per round)') },
      { value: 'balanced', label: t('Balanced (spread each attribute across rounds)') }, { value: 'manual', label: t('Manual') }
    ], d.mode, function (v) { d.mode = v; d.rounds = null; d.flags = []; App.render(); })),
    (d.mode === 'grouped' || d.mode === 'balanced')
      ? field(t('Attribute'), selectEl(attrs, d.attr, function (v) { d.attr = v; d.rounds = null; d.flags = []; App.render(); })) : null,
    h('button', { onclick: build }, d.rounds ? (d.mode === 'manual' ? t('Start over') : t('Rebuild')) : (d.mode === 'manual' ? t('Start with a random split') : t('Preview'))),
    preview));

  function locked() {
    var hasBallots = ev.ballots.length > 0;
    return h('section', null, h('h2', null, t('Rounds')),
      h('p', { class: 'ok' }, t('Rounds locked ✓. Cup numbers are on the Grind tab.')),
      ev.rounds.map(function (r, i) {
        return h('div', { class: 'card' }, h('b', null, t('Round') + ' ' + (i + 1)),
          h('ul', { class: 'plain' }, r.map(function (id) { return h('li', null, State.coffee(id).label); })));
      }),
      h('button', { class: 'danger', disabled: hasBallots, onclick: function () {
        if (!confirm(t('Unlock rounds? Cup numbers and helper mappings are cleared.'))) return;
        State.update(function (s) { s.rounds = null; s.cups = {}; s.letters = {}; s.finalists = null; });
      } }, t('Unlock rounds')),
      hasBallots ? h('small', null, ' ' + t('Not possible once ballots exist.')) : null);
  }
};
