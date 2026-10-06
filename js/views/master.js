/* Master hub: tab bar over the setup / coffees / rounds / ... screens. */
var Views = window.Views || (window.Views = {});

Views.master = function (root) {
  if (!State.ev) {
    if (!App.draft) {
      App.draft = { name: '', date: new Date().toISOString().slice(0, 10), R: 4, N: 6, F: 6, expandFinal: false, min: 1, max: 2,
        ptsAroma: 1, ptsTaste: 2, pin: '', participants: [] };
    }
    var f = h('input', { type: 'file', accept: '.json', hidden: true, onchange: function (e) {
      var file = e.target.files[0]; if (!file) return;
      file.text().then(State.importFile).catch(function (err) { toast(err.message); });
    } });
    root.appendChild(h('header', { class: 'bar' }, h('b', null, t('Cupping Event'))));
    var main = h('main', null);
    Views.setup(main, true);
    main.appendChild(h('p', { class: 'center' }, t('or'), ' ', h('button', { onclick: function () { f.click(); } }, t('Import an event file')), f));
    root.appendChild(main);
    return;
  }
  var tabs = [['setup', 'Setup'], ['coffees', 'Coffees'], ['rounds', 'Rounds'], ['grind', 'Grind'], ['ballots', 'Ballots'],
    ['finalists', 'Finalists'], ['final', 'Final'], ['reveal', 'Reveal'], ['insights', 'Insights'], ['data', 'Data']];
  var tab = App.tab || 'setup';
  if (tab !== 'reveal') document.body.classList.remove('show');

  root.appendChild(h('header', { class: 'bar' }, h('b', null, State.ev.name), h('span', { class: 'grow' }),
    h('small', null, State.ev.date)));
  root.appendChild(h('nav', { class: 'tabs' }, tabs.map(function (x) {
    return h('button', { class: x[0] === tab ? 'on' : '', onclick: function () { App.tab = x[0]; App.editCoffee = null; App.render(); } }, t(x[1]));
  })));
  var main2 = h('main', null);
  root.appendChild(main2);
  Views[tab](main2);
};
