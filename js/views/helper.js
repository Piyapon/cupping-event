/* Helper (shuffler) screen: letter -> cup number per round (SPEC 4). Route #helper. */
var Views = window.Views || (window.Views = {});

Views.helper = function (root) {
  var ev = State.ev;
  function leave() {
    if (ev.pin) {
      var p = prompt(t('Master PIN to leave helper mode'));
      if (p === null) return;
      if (p !== ev.pin) { toast(t('Wrong PIN')); return; }
    }
    App.go('#');
  }
  var head = h('header', { class: 'bar' }, h('b', null, t('Helper')), h('span', { class: 'grow' }, ev.name),
    h('button', { onclick: leave }, t('Done')));
  root.appendChild(head);

  if (!ev.rounds) {
    return root.appendChild(h('main', null, h('p', { class: 'warn' }, t('The master has not locked rounds yet.'))));
  }
  var keys = State.roundKeys().concat(State.hasFinal() ? ['F'] : []);
  var k = App.helperRound;
  if (k === undefined || keys.indexOf(k) < 0) k = App.helperRound = keys[0];

  var letters = State.lettersFor(k), n = letters.length;
  var draft = App.helperDraft && App.helperDraft.k === k ? App.helperDraft.map : null;
  if (!draft) { draft = {}; App.helperDraft = { k: k, map: draft }; }
  var isLocked = !!ev.letters[k];

  var tabs = h('div', { class: 'tabs' }, keys.map(function (key) {
    return h('button', { class: key === k ? 'on' : '', onclick: function () { App.helperRound = key; App.render(); } },
      (key === 'F' ? t('Final') : key) + (ev.letters[key] ? ' ✓' : ''));
  }));

  var main = h('main', null, tabs);
  if (isLocked) {
    main.appendChild(h('p', { class: 'ok' }, t('Locked ✓. Letters are mapped. Nothing more to do for this round.')));
    main.appendChild(h('button', { class: 'danger', disabled: State.ballotsFor(k).length > 0, onclick: function () {
      if (!confirm(t('Clear this mapping and redo it?'))) return;
      State.update(function (s) { delete s.letters[k]; });
    } }, t('Redo mapping')));
  } else {
    var nums = []; for (var i = 1; i <= n; i++) nums.push(i);
    var used = {}, dup = false;
    letters.forEach(function (l) { var v = draft[l]; if (v) { if (used[v]) dup = true; used[v] = true; } });
    var complete = letters.every(function (l) { return draft[l]; }) && !dup;

    main.appendChild(h('p', { class: 'note' }, t('Put the cup numbers (stickers underneath) on the table letters. Each number exactly once.')));
    main.appendChild(h('button', { class: 'primary', onclick: function () {
      var p = shuffle(nums);
      letters.forEach(function (l, i2) { draft[l] = p[i2]; });
      App.render();
    } }, t('Shuffle for me')));
    main.appendChild(h('ul', { class: 'plain' }, letters.map(function (l) {
      return h('li', { class: 'row' }, h('span', { class: 'letter' }, l),
        selectEl([{ value: '', label: '—' }].concat(nums.map(function (x) { return { value: x, label: String(x) }; })),
          draft[l] || '', function (v) { draft[l] = v ? +v : 0; App.render(); }));
    })));
    if (dup) main.appendChild(h('p', { class: 'warn' }, t('A number is used more than once.')));
    main.appendChild(h('button', { class: 'primary', disabled: !complete, onclick: function () {
      State.update(function (s) { s.letters[k] = JSON.parse(JSON.stringify(draft)); });
      App.helperDraft = null; toast(t('Saved and locked'));
    } }, t('Save & lock')));
  }
  root.appendChild(main);
};
