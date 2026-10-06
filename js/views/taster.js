/* Taster mode: opened from the join QR (#join=...). Ballots stay on this device (SPEC 5). */
var Views = window.Views || (window.Views = {});

var Taster = (function () {
  var KEY = 'cup.taster';
  var st = null;
  function load() { try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { st = null; } return st; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { toast(t('Could not save on this device')); } }
  /** Adopt the config from a join link; keep ballots only when it is the same event. */
  function join(cfg) {
    load();
    if (!st || !st.cfg || st.cfg.id !== cfg.id) st = { cfg: cfg, me: null, ballots: [] };
    else st.cfg = cfg;
    if (st.me && !cfg.ps.some(function (p) { return p[0] === st.me; })) st.me = null;
    save();
  }
  return { load: load, save: save, join: join, get st() { return st; } };
})();

Views.taster = function (root) {
  var st = Taster.st;
  if (!st) return root.appendChild(h('main', null, h('p', null, t('Open the join QR from the event master.'))));
  var cfg = st.cfg;
  var head = h('header', { class: 'bar' }, h('b', null, cfg.n), h('span', { class: 'grow' }));
  root.appendChild(head);

  // --- choose name ---
  if (!st.me) {
    return root.appendChild(h('main', null, h('h2', null, t('Who are you?')),
      h('div', { class: 'namegrid' }, cfg.ps.map(function (p) {
        return h('button', { onclick: function () { st.me = p[0]; Taster.save(); App.render(); } }, p[1]);
      })),
      cfg.ps.length ? null : h('p', { class: 'warn' }, t('No participants yet. Ask the master to add you, then scan the join QR again.'))));
  }
  var meName = cfg.ps.filter(function (p) { return p[0] === st.me; })[0][1];
  head.appendChild(h('span', null, meName));
  head.appendChild(h('button', { onclick: function () { st.me = null; App.draftBallot = null; Taster.save(); App.render(); } }, t('Switch participant')));

  var keys = []; for (var i = 1; i <= cfg.R; i++) keys.push(i); keys.push('F');
  var k = App.tasterRound;
  if (k === undefined || keys.indexOf(k) < 0) k = App.tasterRound = 1;
  var n = k === 'F' ? cfg.F : cfg.N;
  var letters = []; for (var j = 0; j < n; j++) letters.push(String.fromCharCode(65 + j));
  var ctx = { eventId: cfg.id, letters: letters, rules: { min: cfg.min, max: cfg.max } };

  function mine(r) { return st.ballots.filter(function (b) { return b.e === cfg.id && b.p === st.me && b.r === r; })[0]; }

  var tabs = h('div', { class: 'tabs' }, keys.map(function (key) {
    return h('button', { class: key === k ? 'on' : '', onclick: function () { App.tasterRound = key; App.draftBallot = null; App.render(); } },
      (key === 'F' ? t('Final') : key) + (mine(key) ? ' ✓' : ''));
  }));
  var main = h('main', null, tabs);
  root.appendChild(main);

  var existing = mine(k);
  var d = App.draftBallot;
  if (!d || d.k !== k || d.me !== st.me) {
    d = App.draftBallot = {
      k: k, me: st.me,
      a: existing ? existing.a.slice() : [], t: existing && existing.t ? existing.t.slice() : [],
      s: existing && existing.s ? existing.s : 'B'
    };
  }

  if (existing && !App.editingBallot) {
    main.appendChild(h('p', { class: 'ok' }, t('Submitted ✓. Show this to the master or send the code.')));
    main.appendChild(showCode(existing));
    main.appendChild(h('button', { onclick: function () { App.editingBallot = true; App.render(); } }, t('Edit and resubmit')));
    return;
  }

  function toggles(list, label) {
    return h('div', { class: 'card' }, h('h3', null, label),
      h('small', null, cfg.min === cfg.max ? t('Pick') + ' ' + cfg.min : t('Pick') + ' ' + cfg.min + '–' + cfg.max),
      h('div', { class: 'cups' }, letters.map(function (l) {
        var on = list.indexOf(l) >= 0;
        return h('button', { class: 'cup' + (on ? ' on' : ''), 'aria-pressed': on, onclick: function () {
          var i2 = list.indexOf(l);
          if (i2 >= 0) list.splice(i2, 1);
          else if (list.length >= cfg.max) { toast(t('At most') + ' ' + cfg.max); return; }
          else list.push(l);
          App.render();
        } }, l);
      })));
  }

  main.appendChild(toggles(d.a, t('Aroma')));
  main.appendChild(toggles(d.t, t('Taste')));
  if (k !== 'F') {
    main.appendChild(h('div', { class: 'card' }, h('h3', null, t('Round strength')),
      h('div', { class: 'seg' }, [['W', t('Weak')], ['B', t('Balanced')], ['S', t('Strong')]].map(function (o) {
        return h('button', { class: d.s === o[0] ? 'on' : '', onclick: function () { d.s = o[0]; App.render(); } }, o[1]);
      }))));
  }

  function submit(aromaOnly) {
    var b = { v: 1, e: cfg.id, p: st.me, r: k, a: d.a.slice().sort() };
    if (!aromaOnly) b.t = d.t.slice().sort();
    if (k !== 'F') b.s = d.s;
    var v = CupScoring.validateBallot(b, ctx);
    if (!v.ok) { toast(v.errors[0]); return; }
    st.ballots = st.ballots.filter(function (x) { return !(x.e === cfg.id && x.p === b.p && x.r === b.r); }).concat([b]);
    Taster.save(); App.editingBallot = false; App.render();
  }
  main.appendChild(h('div', { class: 'row wrap' },
    h('button', { class: 'primary', onclick: function () { submit(false); } }, t('Submit')),
    h('button', { onclick: function () { submit(true); } }, t('Submit aroma only (leaving early)'))));
  if (existing) main.appendChild(h('button', { class: 'ghost', onclick: function () { App.editingBallot = false; App.draftBallot = null; App.render(); } }, t('Cancel')));

  function showCode(b) {
    var code = QR.encodeBallot(b);
    return h('div', { class: 'card center' }, QR.render(code),
      h('textarea', { readonly: true, rows: 3, onclick: function (e) { e.target.select(); } }, code),
      h('button', { onclick: function () {
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { toast(t('Copied')); }, function () { toast(t('Select the code and copy it')); });
        else toast(t('Select the code and copy it'));
      } }, t('Copy code')));
  }
};
