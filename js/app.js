/* Router + render loop. Modes: master (default), helper (#helper), taster (#join=...). */
var App = {
  tab: (function () { try { return sessionStorage.getItem('cup.tab'); } catch (e) { return null; } })() || 'setup',

  mode: function () {
    var hash = location.hash;
    if (hash.indexOf('#join=') === 0) return 'taster';
    if (hash === '#helper') return 'helper';
    return 'master';
  },

  go: function (hash) { location.hash = hash; },

  render: function () {
    var root = document.getElementById('app');
    var scroll = window.scrollY;
    try { sessionStorage.setItem('cup.tab', App.tab); } catch (e) {}
    root.innerHTML = '';
    var mode = App.mode();
    document.body.dataset.mode = mode;
    if (mode === 'taster') {
      // The join link is adopted once, then the hash is cleared so a reload keeps the same state.
      Views.taster(root);
    } else if (mode === 'helper') {
      if (!State.ev) { root.appendChild(h('main', null, h('p', null, t('No event on this device.')), h('button', { onclick: function () { App.go('#'); } }, t('Back')))); }
      else Views.helper(root);
    } else {
      Views.master(root);
    }
    window.scrollTo(0, scroll);
  },

  start: function () {
    State.load();
    var cfg = QR.parseJoinHash(location.hash);
    if (cfg) {
      Taster.join(cfg);
      // Replace the (long) hash with a short marker; the taster state now lives in localStorage.
      history.replaceState(null, '', location.pathname + location.search + '#taster');
    } else if (location.hash === '#taster') {
      Taster.load();
    }
    window.addEventListener('hashchange', function () { App.editCoffee = null; App.render(); });
    App.render();
  }
};

/* '#taster' (after the join link was consumed) behaves like taster mode. */
(function () {
  var orig = App.mode;
  App.mode = function () { return location.hash === '#taster' ? 'taster' : orig(); };
})();

window.addEventListener('DOMContentLoaded', App.start);
