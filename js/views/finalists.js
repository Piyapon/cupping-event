/* Finalist proposal, reasons, master override, confirm (SPEC 6). */
var Views = window.Views || (window.Views = {});

Views.finalists = function (root) {
  var ev = State.ev;
  var rounds = State.roundKeys().map(State.scored);
  if (!ev.rounds || rounds.some(function (r) { return !r; })) {
    return root.appendChild(h('section', null, h('h2', null, t('Finalists')),
      h('p', { class: 'warn' }, t('Every round needs locked cups and helper mappings first.'))));
  }
  var open = State.roundKeys().filter(function (k) { return !ev.closed[k]; });
  var label = function (id) { return State.coffee(id).label; };

  var res = CupScoring.selectFinalists(rounds, { F: ev.F, normalize: ev.normalize, pick: ev.pick });
  var list = ev.finalists && !App.reproposed ? ev.finalists : (App.edited || res.finalists);
  var confirmed = !!ev.finalists;
  var inList = {}; list.forEach(function (f) { inList[f.id] = true; });

  var tables = rounds.map(function (r) {
    var sorted = CupScoring.sortByChain(r.coffees.map(function (c) { return Object.assign({ strength: r.strength }, c); }), {});
    return h('div', { class: 'card' },
      h('h3', null, t('Round') + ' ' + r.round, h('small', null, ' · ' + t(r.strength) + ' · ' + r.voters + ' ' + t('voters'))),
      h('table', null,
        h('tr', null, h('th', null, t('Coffee')), h('th', null, t('Pts')), h('th', null, t('Taste')), h('th', null, t('Likers')), h('th', null, t('Pts/voter'))),
        sorted.map(function (c) {
          return h('tr', { class: inList[c.id] ? 'sel' : '' }, h('td', null, label(c.id)), h('td', null, c.points), h('td', null, c.taste),
            h('td', null, c.likers), h('td', null, r.voters ? (c.points / r.voters).toFixed(2) : '–'));
        })));
  });

  var swapOptions = ev.coffees.filter(function (c) { return !inList[c.id]; });
  var propose = h('ul', { class: 'plain' }, list.map(function (f, i) {
    return h('li', { class: 'row' },
      h('span', { class: 'grow' }, h('b', null, label(f.id)), h('div', { class: 'sub' }, f.reason)),
      confirmed ? null : selectEl([{ value: '', label: t('Swap…') }].concat(swapOptions.map(function (c) { return { value: c.id, label: c.label }; })), '',
        function (v) {
          if (!v) return;
          var copy = list.map(function (x) { return Object.assign({}, x); });
          copy[i] = { id: v, round: State.coffee(v) && roundOf(v), reason: t('Master pick') };
          App.edited = copy; App.render();
        }));
  }));
  function roundOf(id) {
    for (var i = 0; i < ev.rounds.length; i++) if (ev.rounds[i].indexOf(id) >= 0) return i + 1;
  }

  var ties = res.unresolved.map(function (ids) {
    return h('div', { class: 'card' },
      h('p', { class: 'warn' }, t('Weak round tie, pick which one goes through:')),
      selectEl([{ value: '', label: '—' }].concat(ids.map(function (id) { return { value: id, label: label(id) }; })),
        (ev.pick.filter(function (p) { return ids.indexOf(p) >= 0; })[0]) || '',
        function (v) {
          State.update(function (s) { s.pick = s.pick.filter(function (p) { return ids.indexOf(p) < 0; }); if (v) s.pick.push(v); });
          App.edited = null; App.render();
        }));
  });

  root.appendChild(h('section', null,
    h('h2', null, t('Finalists')),
    open.length ? h('p', { class: 'warn' }, t('Rounds not closed yet:') + ' ' + open.join(', ')) : null,
    res.warnings.map(function (w) { return h('div', { class: 'banner' }, w); }),
    field(t('Normalize runner-ups'), h('input', { type: 'checkbox', checked: ev.normalize, disabled: confirmed, onchange: function (e) {
      State.update(function (s) { s.normalize = e.target.checked; }); App.edited = null;
    } }), t('Rank runner-ups by points per voter instead of raw points')),
    ties,
    h('h3', null, confirmed ? t('Confirmed finalists') : t('Proposed finalists') + ' (' + list.length + '/' + ev.F + ')'),
    propose,
    confirmed
      ? h('button', { class: 'danger', disabled: State.ballotsFor('F').length > 0 || !!ev.letters.F, onclick: function () {
          if (!confirm(t('Re-open the finalist choice? The final cups are cleared.'))) return;
          State.update(function (s) { s.finalists = null; delete s.cups.F; delete s.letters.F; });
          App.edited = null; App.reproposed = true;
        } }, t('Change finalists'))
      : h('div', { class: 'row wrap' },
        h('button', { class: 'primary', disabled: list.length !== ev.F, onclick: function () {
          State.update(function (s) {
            s.finalists = list.map(function (f) { return Object.assign({}, f); });
            s.cups.F = shuffle(list.map(function (f) { return f.id; }));
            delete s.letters.F;
          });
          App.edited = null; App.reproposed = false; App.tab = 'grind'; App.render();
        } }, t('Confirm finalists')),
        h('button', { onclick: function () { App.edited = null; App.render(); } }, t('Reset proposal'))),
    h('h3', null, t('Round scores')), tables));
};
