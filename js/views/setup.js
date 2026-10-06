/* Event setup (SPEC 3). Used both to create the event (App.draft) and to edit it. */
var Views = window.Views || (window.Views = {});

Views.setup = function (root, creating) {
  var o = creating ? App.draft : State.ev;
  var locked = !creating && !!o.rounds;            // R and N can't change once rounds are locked
  var finalLocked = !creating && !!o.finalists;

  function set(k, v) {
    o[k] = v;
    if (!creating) State.quiet(function () {});
  }
  function num(k, min, max, disabled) {
    return h('input', {
      type: 'number', inputmode: 'numeric', min: min, max: max, value: o[k], disabled: disabled,
      onchange: function (e) {
        var v = parseInt(e.target.value, 10);
        if (isNaN(v)) v = o[k];
        v = Math.max(min == null ? v : min, v);
        if (max != null) v = Math.min(max, v);
        o[k] = v;
        clampFinal();
        if (!creating) State.save();
        App.render();
      }
    });
  }
  function clampFinal() {
    if (o.N < 2) o.N = 2;
    if (o.N > 8) o.N = 8;
    if (o.F < o.R) o.F = o.R;
    if (!o.expandFinal && o.F > o.N) o.F = o.N;
    if (o.F > 26) o.F = 26;
  }

  function errors() {
    var e = [];
    if (!o.name.trim()) e.push(t('Event name is required'));
    if (o.R < 1) e.push(t('At least 1 round'));
    if (o.F < o.R) e.push(t('Final cups must be at least the number of rounds'));
    if (!o.expandFinal && o.F > o.N) e.push(t('Final cups above cups per round needs "Expand final"'));
    if (o.min > o.max) e.push(t('Likes minimum is above maximum'));
    return e;
  }

  // ---- participants ----
  function makeCode(name) {
    var base = name.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 3) || 'X';
    var code = base, i = 2;
    while (o.participants.some(function (p) { return p.code === code; })) code = base + i++;
    return code;
  }
  var nameInput = h('input', { type: 'text', placeholder: t('Name'), enterkeyhint: 'done' });
  function addParticipant() {
    var n = nameInput.value.trim();
    if (!n) return;
    o.participants.push({ code: makeCode(n), name: n });
    if (!creating) State.save();
    App.render();
  }
  nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addParticipant(); } });

  var plist = h('ul', { class: 'plain' }, o.participants.map(function (p, i) {
    return h('li', { class: 'row' },
      h('input', { type: 'text', value: p.name, onchange: function (e) { p.name = e.target.value.trim() || p.name; if (!creating) State.save(); } }),
      h('input', { type: 'text', class: 'code', value: p.code, maxlength: 4, title: t('Short code'),
        onchange: function (e) {
          var c = e.target.value.trim().toUpperCase();
          if (!c || o.participants.some(function (x, j) { return j !== i && x.code === c; })) { toast(t('Code must be unique')); e.target.value = p.code; return; }
          // keep existing ballots attached to this participant
          if (!creating) o.ballots.forEach(function (b) { if (b.p === p.code) b.p = c; });
          p.code = c; if (!creating) State.save();
        } }),
      h('button', { class: 'ghost', onclick: function () {
        if (!creating && o.ballots.some(function (b) { return b.p === p.code; }) && !confirm(t('This participant has ballots. Remove anyway?'))) return;
        o.participants.splice(i, 1); if (!creating) State.save(); App.render();
      } }, '✕'));
  }));

  var errs = errors();
  root.appendChild(h('section', null,
    h('h2', null, creating ? t('New event') : t('Setup')),
    field(t('Event name'), h('input', { type: 'text', value: o.name, onchange: function (e) { set('name', e.target.value); App.render(); } })),
    field(t('Date'), h('input', { type: 'date', value: o.date, onchange: function (e) { set('date', e.target.value); } })),
    h('div', { class: 'grid2' },
      field(t('Rounds'), num('R', 1, 12, locked)),
      field(t('Cups per round'), num('N', 2, 8, locked))),
    h('p', { class: 'note' }, t('Total coffees to enter:'), ' ', h('b', null, o.R * o.N)),
    h('div', { class: 'grid2' },
      field(t('Final cups'), num('F', o.R, 26, finalLocked)),
      field(t('Expand final'), h('input', { type: 'checkbox', checked: o.expandFinal, disabled: finalLocked, onchange: function (e) { o.expandFinal = e.target.checked; clampFinal(); if (!creating) State.save(); App.render(); } }),
        t('Allows final cups above cups per round'))),
    locked ? h('p', { class: 'note' }, t('Rounds are locked, so rounds and cups per round can no longer change.')) : null,
    h('div', { class: 'grid2' },
      field(t('Min likes per phase'), num('min', 0, 8)),
      field(t('Max likes per phase'), num('max', 1, 8))),
    h('div', { class: 'grid2' },
      field(t('Aroma like points'), num('ptsAroma', 0, 20)),
      field(t('Taste like points'), num('ptsTaste', 0, 20))),
    field(t('Master PIN (optional)'), h('input', { type: 'password', inputmode: 'numeric', value: o.pin, autocomplete: 'off',
      onchange: function (e) { set('pin', e.target.value); } }), t('Required to see cup mappings and to leave helper mode')),
    h('h3', null, t('Participants')),
    plist,
    h('div', { class: 'row' }, nameInput, h('button', { onclick: addParticipant }, t('Add'))),
    errs.length ? h('ul', { class: 'errors' }, errs.map(function (e) { return h('li', null, e); })) : null,
    creating ? h('button', { class: 'primary', disabled: errs.length > 0, onclick: function () {
      State.create(o); App.draft = null; App.tab = 'coffees'; App.render();
    } }, t('Create event')) : null
  ));
};
