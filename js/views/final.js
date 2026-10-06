/* Final ranking with tie prompts (co-champions / animated coin flip) (SPEC 7). */
var Views = window.Views || (window.Views = {});

/** Computes the final ranking from stored ballots. Returns {positions, needsDecision} or null. */
function finalRanking() {
  var sc = State.scored('F');
  if (!sc) return null;
  return CupScoring.rankFinal(sc.coffees, State.ev.resolutions);
}

Views.final = function (root) {
  var ev = State.ev;
  if (!State.hasFinal()) {
    return root.appendChild(h('section', null, h('h2', null, t('Final')), h('p', { class: 'warn' }, t('Confirm the finalists first.'))));
  }
  var sc = State.scored('F');
  if (!sc) {
    return root.appendChild(h('section', null, h('h2', null, t('Final')),
      h('p', { class: 'warn' }, t('Final cups are on the Grind tab. The helper must map letters before ballots can be scored.'))));
  }
  var rank = finalRanking();
  var by = {}; sc.coffees.forEach(function (c) { by[c.id] = c; });

  function flip(ids) {
    var order = CupScoring.coinFlip(ids);
    var box = h('div', { class: 'coin' }, '🪙');
    var cur = 0, ticks = 0;
    var overlay = h('div', { class: 'overlay center' }, h('h2', null, t('Coin flip')), box);
    document.body.appendChild(overlay);
    var iv = setInterval(function () {
      box.textContent = State.coffee(ids[cur++ % ids.length]).label;
      if (++ticks > 18) {
        clearInterval(iv);
        box.textContent = order.map(function (id, i) { return (i + 1) + '. ' + State.coffee(id).label; }).join('\n');
        overlay.appendChild(h('button', { class: 'primary', onclick: function () {
          overlay.remove();
          State.update(function (s) { s.resolutions[CupScoring.tieKey(ids)] = { type: 'coin', order: order }; });
        } }, t('Accept')));
      }
    }, 110);
  }

  var prompts = rank.needsDecision.map(function (ids) {
    return h('div', { class: 'card' },
      h('p', { class: 'warn' }, t('Unresolved tie:') + ' ' + ids.map(function (id) { return State.coffee(id).label; }).join(' = ')),
      h('div', { class: 'row wrap' },
        h('button', { onclick: function () { State.update(function (s) { s.resolutions[CupScoring.tieKey(ids)] = { type: 'co' }; }); } }, t('Co-champions / shared position')),
        h('button', { class: 'primary', onclick: function () { flip(ids); } }, t('Coin flip'))));
  });

  var rows = [];
  rank.positions.forEach(function (p) {
    p.ids.forEach(function (id) {
      var c = by[id];
      rows.push(h('tr', null, h('td', null, p.position), h('td', null, State.coffee(id).label),
        h('td', null, c.taste), h('td', null, c.aroma), h('td', null, c.likers),
        h('td', null, p.resolution === 'coin' ? '🪙' : p.resolution === 'co' ? t('shared') : p.tied ? '?' : '')));
    });
  });

  root.appendChild(h('section', null, h('h2', null, t('Final')),
    h('p', null, sc.voters + ' ' + t('voters')),
    prompts,
    h('table', null, h('tr', null, h('th', null, '#'), h('th', null, t('Coffee')), h('th', null, t('Taste')), h('th', null, t('Aroma')), h('th', null, t('Likers')), h('th', null, '')), rows),
    Object.keys(ev.resolutions).length ? h('button', { class: 'ghost', onclick: function () {
      if (confirm(t('Clear tie decisions?'))) State.update(function (s) { s.resolutions = {}; });
    } }, t('Clear tie decisions')) : null));
};
