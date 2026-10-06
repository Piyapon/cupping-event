/* Export / import event file, results CSV, reset (SPEC 10). */
var Views = window.Views || (window.Views = {});

function resultsCsv() {
  var ev = State.ev;
  var rs = State.roundKeys().concat(State.hasFinal() ? ['F'] : []).map(function (k) {
    var cm = State.cupMap(k);
    if (!cm) return null;
    return { round: k, strength: State.scored(k).strength, cupMap: cm, ballots: State.ballotsFor(k) };
  }).filter(Boolean);
  var ents = Stats.entries(rs, State.pts());
  var rank = State.hasFinal() && State.scored('F') ? finalRanking() : null;
  var finalPos = {};
  if (rank) rank.positions.forEach(function (p) { p.ids.forEach(function (id) { finalPos[id] = p.position; }); });
  var finalEnt = {}; ents.filter(function (e) { return e.round === 'F'; }).forEach(function (e) { finalEnt[e.id] = e; });
  var main = ents.filter(function (e) { return e.round !== 'F'; });
  var head = CSV.COLS.map(function (c) { return c[1]; }).concat(['round', 'cup', 'round_rank', 'points', 'aroma_likes', 'taste_likes',
    'distinct_likers', 'aroma_likers', 'taste_likers', 'round_strength', 'round_voters', 'finalist', 'final_position', 'final_taste', 'final_aroma']);
  var rows = [head];
  ev.coffees.forEach(function (c) {
    var e = main.filter(function (x) { return x.id === c.id; })[0];
    var inRound = e ? main.filter(function (x) { return x.round === e.round; }) : [];
    var sorted = CupScoring.sortByChain(inRound.map(function (x) { return Object.assign({}, x); }), {});
    var rr = e ? sorted.map(function (x) { return x.id; }).indexOf(c.id) + 1 : '';
    var cup = e && ev.cups[e.round] ? ev.cups[e.round].indexOf(c.id) + 1 : '';
    var fe = finalEnt[c.id];
    rows.push(CSV.COLS.map(function (col) { return c[col[0]]; }).concat([
      e ? e.round : '', cup, rr, e ? e.points : '', e ? e.aroma : '', e ? e.taste : '', e ? e.likers : '',
      e ? e.aromaBy.map(State.name).join('; ') : '', e ? e.tasteBy.map(State.name).join('; ') : '',
      e ? e.strength : '', e ? e.voters : '',
      ev.finalists && ev.finalists.some(function (f) { return f.id === c.id; }) ? 'yes' : '',
      finalPos[c.id] || '', fe ? fe.taste : '', fe ? fe.aroma : '']));
  });
  return CSV.stringify(rows);
}

Views.data = function (root) {
  var ev = State.ev;
  var slug = (ev.name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
  var fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: function (e) {
    var f = e.target.files[0]; if (!f) return;
    if (!confirm(t('Importing replaces the event on this device. Continue?'))) return;
    f.text().then(State.importFile).then(function () { toast(t('Event imported')); }).catch(function (err) { toast(err.message); });
  } });
  var confirmName = h('input', { type: 'text', placeholder: t('Type the event name to reset') });

  root.appendChild(h('section', null, h('h2', null, t('Data')),
    h('p', { class: 'note' }, t('Everything is autosaved on this device. Export a backup before the event ends.')),
    h('div', { class: 'row wrap' },
      h('button', { class: 'primary', onclick: function () {
        State.exportFile(false).then(function (txt) { download(slug + '.json', txt, 'application/json'); });
      } }, t('Export event file')),
      h('button', { onclick: function () {
        State.exportFile(true).then(function (txt) { download(slug + '-with-photos.json', txt, 'application/json'); });
      } }, t('Export with photos')),
      h('button', { onclick: function () { fileIn.click(); } }, t('Import event file')), fileIn,
      h('button', { onclick: function () { download(slug + '-results.csv', resultsCsv(), 'text/csv'); } }, t('Export results CSV'))),
    h('h3', null, t('Hand to helper')),
    h('button', { onclick: function () { App.go('#helper'); } }, t('Open helper mode')),
    h('h3', null, t('Reset event')),
    confirmName,
    h('button', { class: 'danger', onclick: function () {
      if (confirmName.value.trim() !== ev.name) { toast(t('Name does not match')); return; }
      State.reset();
    } }, t('Reset event'))));
};
