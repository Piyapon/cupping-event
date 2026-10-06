/* Coffee list, edit form, CSV import/export (SPEC 3.1). */
var Views = window.Views || (window.Views = {});

var PROCESSES = ['', 'Washed', 'Natural', 'Honey (Yellow)', 'Honey (Red)', 'Honey (Black)', 'Anaerobic',
  'Carbonic maceration', 'Co-ferment/Infused', 'Wet-hulled', 'Experimental', 'Other', 'Unknown'];

Views.coffees = function (root) {
  var ev = State.ev, total = ev.R * ev.N;
  var editing = App.editCoffee;           // coffee id, 'new', or null

  function status() {
    var n = ev.coffees.length;
    return h('p', { class: n === total ? 'ok' : 'warn' },
      n + ' / ' + total + ' ' + t('coffees') + (n === total ? ' ✓' : ' — ' + t('the event needs exactly') + ' ' + total));
  }

  function csvImport() {
    var f = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: function (e) {
      var file = e.target.files[0]; if (!file) return;
      file.text().then(function (text) {
        var list = CSV.parseCoffees(text);
        if (!list.length) { toast(t('No coffees found in that file')); return; }
        State.update(function (s) { list.forEach(function (c) { c.id = State.uid(); s.coffees.push(c); }); });
        var n = State.ev.coffees.length;
        if (n !== total) toast(t('Imported') + ' ' + list.length + '. ' + t('Warning: total is') + ' ' + n + ', ' + t('expected') + ' ' + total);
        else toast(t('Imported') + ' ' + list.length);
      });
    } });
    return h('span', null, f, h('button', { onclick: function () { f.click(); } }, t('Import CSV')));
  }

  function row(c) {
    return h('li', { class: 'coffee' },
      Photos.img(c.id, 'thumb'),
      h('div', { class: 'grow' },
        h('b', null, c.label),
        h('div', { class: 'sub' }, [c.roaster, c.country, c.process].filter(Boolean).join(' · '))),
      h('button', { onclick: function () { App.editCoffee = c.id; App.render(); } }, t('Edit')));
  }

  if (editing) return root.appendChild(editForm(editing));

  root.appendChild(h('section', null,
    h('h2', null, t('Coffees')),
    status(),
    h('div', { class: 'row wrap' },
      h('button', { class: 'primary', onclick: function () { App.editCoffee = 'new'; App.render(); } }, t('Add coffee')),
      csvImport(),
      h('button', { onclick: function () { download('coffees.csv', CSV.coffeesToCsv(ev.coffees), 'text/csv'); } }, t('Export CSV')),
      h('button', { onclick: function () {
        download('coffee_import_template.csv', CSV.coffeesToCsv([]), 'text/csv');
      } }, t('Blank template'))),
    ev.rounds ? h('p', { class: 'note' }, t('Rounds are locked: editing details is fine, but adding or removing coffees would break them.')) : null,
    h('ul', { class: 'plain' }, ev.coffees.map(row))
  ));

  function editForm(id) {
    var isNew = id === 'new';
    var c = isNew ? { id: State.uid() } : Object.assign({}, State.coffee(id));
    var photoBox = h('div', { class: 'photobox' }, Photos.img(c.id, 'photo'));
    var newPhoto = null, removePhoto = false;
    function txt(k, label, hint, type) {
      return field(label, h('input', { type: type || 'text', value: c[k] || '', onchange: function (e) { c[k] = e.target.value.trim(); } }), hint);
    }
    var fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function (e) {
      var file = e.target.files[0]; if (!file) return;
      Photos.compress(file).then(function (url) {
        newPhoto = url; removePhoto = false;
        photoBox.innerHTML = ''; photoBox.appendChild(h('img', { class: 'photo', src: url, alt: '' }));
      }).catch(function () { toast(t('Could not read that image')); });
    } });
    var body = h('section', null,
      h('h2', null, isNew ? t('Add coffee') : t('Edit coffee')),
      txt('label', t('Label') + ' *', t('Short display name, e.g. "Finca X Geisha"')),
      photoBox, fileIn,
      h('div', { class: 'row' },
        h('button', { onclick: function () { fileIn.click(); } }, t('Photo (camera or gallery)')),
        h('button', { class: 'ghost', onclick: function () { removePhoto = true; newPhoto = null; photoBox.innerHTML = ''; } }, t('Remove photo'))),
      txt('roaster', t('Roaster')), txt('source', t('Source'), t('Where bought, e.g. "PTY airport"')),
      h('div', { class: 'grid2' }, txt('country', t('Country')), txt('region', t('Region'))),
      h('div', { class: 'grid2' }, txt('farm', t('Farm')), txt('producer', t('Producer'))),
      txt('altitude', t('Altitude (masl)'), t('A number or a range like 1700-1900')),
      field(t('Type'), selectEl([{ value: '', label: '' }, { value: 'single', label: t('Single varietal') }, { value: 'blend', label: t('Blend') }],
        c.type || '', function (v) { c.type = v; })),
      txt('varietals', t('Varietals'), 'Geisha 60%; Caturra 40%'),
      field(t('Process'), selectEl(PROCESSES, c.process || '', function (v) { c.process = v; })),
      h('div', { class: 'grid2' }, txt('roastDate', t('Roast date'), null, 'date'), txt('roastLevel', t('Roast level'))),
      txt('bagNotes', t('Bag tasting notes')),
      h('div', { class: 'grid2' }, txt('compScore', t('Competition score')), txt('price', t('Price'))),
      txt('notes', t('Notes')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'primary', onclick: function () {
          if (!c.label) { toast(t('Label is required')); return; }
          var p = newPhoto ? Photos.put(c.id, newPhoto) : (removePhoto ? Photos.del(c.id) : Promise.resolve());
          p.then(function () {
            State.update(function (s) {
              if (isNew) s.coffees.push(c);
              else s.coffees[s.coffees.map(function (x) { return x.id; }).indexOf(c.id)] = c;
            });
            App.editCoffee = null; App.render();
          });
        } }, t('Save')),
        h('button', { onclick: function () { App.editCoffee = null; App.render(); } }, t('Cancel')),
        !isNew ? h('button', { class: 'danger', onclick: function () {
          if (ev.rounds) { toast(t('Rounds are locked. Reset the event to remove coffees.')); return; }
          if (!confirm(t('Delete this coffee?'))) return;
          Photos.del(c.id);
          State.update(function (s) { s.coffees = s.coffees.filter(function (x) { return x.id !== c.id; }); });
          App.editCoffee = null; App.render();
        } }, t('Delete')) : null));
    return body;
  }
};
