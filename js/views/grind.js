/* Grind screen: "Round k: cup 1 = ..., cup 2 = ..." (SPEC 3.2, 7). Master sees cup -> coffee, never letters. */
var Views = window.Views || (window.Views = {});

Views.grind = function (root) {
  var ev = State.ev;
  if (!ev.rounds) {
    return root.appendChild(h('section', null, h('h2', null, t('Grind')), h('p', { class: 'warn' }, t('Lock rounds first.'))));
  }
  var keys = State.roundKeys().concat(State.hasFinal() ? ['F'] : []);

  function block(k) {
    var cups = ev.cups[k];
    var hasBallots = State.ballotsFor(k).length > 0;
    var editing = App.editCups === k;
    var draft = editing ? App.cupDraft : null;
    var title = k === 'F' ? t('Final') : t('Round') + ' ' + k;

    var list = cups.map(function (id, i) {
      var c = State.coffee(id);
      if (!editing) {
        return h('li', { class: 'cuprow' }, h('span', { class: 'cupnum' }, i + 1), Photos.img(id, 'thumb'),
          h('span', { class: 'grow' }, h('b', null, c.label), h('div', { class: 'sub' }, [c.roaster, c.process].filter(Boolean).join(' · '))));
      }
      return h('li', { class: 'cuprow' }, h('span', { class: 'cupnum' }, i + 1),
        selectEl(cups.map(function (cid) { return { value: cid, label: State.coffee(cid).label }; }), draft[i],
          function (v) { draft[i] = v; }));
    });

    var actions = [];
    if (!editing) {
      actions.push(h('button', { disabled: hasBallots || !!ev.letters[k], onclick: function () { App.editCups = k; App.cupDraft = cups.slice(); App.render(); } }, t('Edit cup numbers')));
      actions.push(h('button', { disabled: hasBallots || !!ev.letters[k], onclick: function () {
        State.update(function (s) { s.cups[k] = shuffle(s.cups[k]); });
      } }, t('Reshuffle')));
      if (ev.letters[k]) actions.push(h('small', null, t('Cups cannot change after the helper has mapped letters.')));
    } else {
      actions.push(h('button', { class: 'primary', onclick: function () {
        var seen = {};
        for (var i = 0; i < draft.length; i++) { if (seen[draft[i]]) { toast(t('Each coffee must appear exactly once')); return; } seen[draft[i]] = 1; }
        State.update(function (s) { s.cups[k] = draft.slice(); });
        App.editCups = null; App.render();
      } }, t('Save')));
      actions.push(h('button', { onclick: function () { App.editCups = null; App.render(); } }, t('Cancel')));
    }
    return h('div', { class: 'card' }, h('h3', null, title), h('ul', { class: 'plain' }, list), h('div', { class: 'row wrap' }, actions));
  }

  root.appendChild(h('section', null, h('h2', null, t('Grind')),
    h('p', { class: 'note' }, t('Grind in cup-number order. Letter mappings stay hidden until the reveal.')),
    keys.map(block)));
};
