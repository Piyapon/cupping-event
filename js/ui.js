/* Tiny DOM helpers + translation hook.
 * UI strings are written in English at the call site: t('Save'). To add a language,
 * fill Strings.map in js/strings.js; missing keys fall back to the English text (SPEC section 13).
 */
function t(s) { return (window.Strings && Strings.map[s]) || s; }

function h(tag, attrs) {
  var el = document.createElement(tag);
  var kids = Array.prototype.slice.call(arguments, 2);
  var value;
  Object.keys(attrs || {}).forEach(function (k) {
    var v = attrs[k];
    if (v === false || v == null) return;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  (function add(list) {
    list.forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) add(c);
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    });
  })(kids);
  if (value !== undefined) el.value = value;
  return el;
}

function toast(msg) {
  var el = h('div', { class: 'toast' }, msg);
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 2600);
}

function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hint ? h('small', null, hint) : null);
}

function selectEl(options, value, onchange, attrs) {
  var a = Object.assign({ value: value, onchange: function (e) { onchange(e.target.value); } }, attrs || {});
  return h('select', a, options.map(function (o) {
    var v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o;
    return h('option', { value: v }, l);
  }));
}

function download(filename, text, mime) {
  var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })), download: filename });
  document.body.appendChild(a); a.click(); a.remove();
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x;
  }
  return a;
}
