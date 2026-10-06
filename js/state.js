/* Event data model, persistence (localStorage + IndexedDB photos), export/import.
 *
 * Event shape (State.ev):
 *  id,name,date,R,N,F,expandFinal, min,max, ptsAroma,ptsTaste, pin
 *  participants:[{code,name}]
 *  coffees:[{id,label,...}]
 *  rounds:[[coffeeId]]           locked round membership (index = round-1)
 *  cups:{ "1":[coffeeId by cup], ..., "F":[...] }   grind screen
 *  letters:{ "1":{A:cupNo}, ..., "F":{...} }        helper mapping, hidden until reveal
 *  ballots:[ballot], closed:{round:true}, importLog:[ballot]
 *  finalists:[{id,round,reason}] | null, normalize:bool, pick:[ids], resolutions:{}
 */
var State = (function () {
  var KEY = 'cup.event', ev = null;

  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

  function load() {
    try { ev = JSON.parse(localStorage.getItem(KEY)); } catch (e) { ev = null; }
    return ev;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ev)); }
    catch (e) { toast(t('Could not save (storage full or blocked)')); }
  }
  /** Apply a change, autosave, re-render. */
  function update(fn) { fn(ev); save(); App.render(); }
  /** Apply a change without re-render (text inputs). */
  function quiet(fn) { fn(ev); save(); }

  function create(cfg) {
    ev = Object.assign({
      id: uid(), name: '', date: new Date().toISOString().slice(0, 10),
      R: 4, N: 6, F: 6, expandFinal: false, min: 1, max: 2, ptsAroma: 1, ptsTaste: 2, pin: '',
      participants: [], coffees: [], rounds: null, cups: {}, letters: {}, ballots: [], closed: {},
      importLog: [], finalists: null, normalize: false, pick: [], resolutions: {}
    }, cfg || {});
    save();
    return ev;
  }
  function replace(obj) { ev = obj; save(); App.render(); }
  function reset() { ev = null; try { localStorage.removeItem(KEY); } catch (e) {} Photos.clear(); App.render(); }

  // ---- derived helpers ----
  function roundKeys() { var k = []; for (var i = 1; i <= ev.R; i++) k.push(i); return k; }
  function cupCount(k) { return k === 'F' ? ev.F : ev.N; }
  function lettersFor(k) {
    var n = cupCount(k), a = [];
    for (var i = 0; i < n; i++) a.push(String.fromCharCode(65 + i));
    return a;
  }
  function coffee(id) { return ev.coffees.filter(function (c) { return c.id === id; })[0]; }
  function name(code) {
    var p = ev.participants.filter(function (x) { return x.code === code; })[0];
    return p ? p.name : code;
  }
  function ballotsFor(k) { return ev.ballots.filter(function (b) { return b.r === k; }); }
  /** letter -> coffeeId for a round, or null until cups and letters are both set. */
  function cupMap(k) {
    var cups = ev.cups[k], lm = ev.letters[k];
    if (!cups || !lm) return null;
    var m = {};
    Object.keys(lm).forEach(function (l) { m[l] = cups[lm[l] - 1]; });
    return m;
  }
  function ballotCtx(k) {
    return { eventId: ev.id, letters: lettersFor(k), rules: { min: ev.min, max: ev.max } };
  }
  function pts() { return { aroma: ev.ptsAroma, taste: ev.ptsTaste }; }
  function scored(k) {
    var m = cupMap(k);
    if (!m) return null;
    return CupScoring.scoreRound(k, ballotsFor(k), m, pts());
  }
  function joinConfig() {
    return {
      id: ev.id, n: ev.name, R: ev.R, N: ev.N, F: ev.F, min: ev.min, max: ev.max,
      ps: ev.participants.map(function (p) { return [p.code, p.name]; })
    };
  }
  function hasFinal() { return !!(ev.finalists && ev.cups.F); }

  // ---- export / import ----
  function exportFile(withPhotos) {
    return Photos.all(withPhotos).then(function (photos) {
      return JSON.stringify({ app: 'cupping-event', version: 1, event: ev, photos: photos });
    });
  }
  function importFile(text) {
    var o = JSON.parse(text);
    if (!o || o.app !== 'cupping-event' || !o.event) throw new Error('Not a cupping event file');
    ev = o.event; save();
    return Photos.restore(o.photos || {}).then(function () { App.render(); });
  }

  return {
    get ev() { return ev; }, uid: uid, load: load, save: save, update: update, quiet: quiet, create: create,
    replace: replace, reset: reset, roundKeys: roundKeys, cupCount: cupCount, lettersFor: lettersFor,
    coffee: coffee, name: name, ballotsFor: ballotsFor, cupMap: cupMap, ballotCtx: ballotCtx, pts: pts,
    scored: scored, joinConfig: joinConfig, hasFinal: hasFinal, exportFile: exportFile, importFile: importFile
  };
})();

/* Photos in IndexedDB as data URLs (compressed ~1000px JPEG). */
var Photos = (function () {
  var dbp = null, cache = {};
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('cup-photos', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('p'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var store = d.transaction('p', mode).objectStore('p'), req = fn(store);
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      });
    });
  }
  function put(id, dataUrl) { cache[id] = dataUrl; return tx('readwrite', function (s) { return s.put(dataUrl, id); }); }
  function get(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    return tx('readonly', function (s) { return s.get(id); }).then(function (v) { if (v) cache[id] = v; return v; });
  }
  function del(id) { delete cache[id]; return tx('readwrite', function (s) { return s.delete(id); }); }
  function clear() { cache = {}; return tx('readwrite', function (s) { return s.clear(); }).catch(function () {}); }
  function all(include) {
    if (!include) return Promise.resolve({});
    var out = {};
    return Promise.all((State.ev.coffees || []).map(function (c) {
      return get(c.id).then(function (v) { if (v) out[c.id] = v; });
    })).then(function () { return out; });
  }
  function restore(map) {
    return Promise.all(Object.keys(map).map(function (id) { return put(id, map[id]); }));
  }
  /** File -> compressed JPEG data URL. */
  function compress(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { rej(new Error('Not an image')); };
      img.src = url;
    });
  }
  /** <img> that fills in once the stored photo loads; null if none. */
  function img(id, cls) {
    var el = h('img', { class: cls || 'photo', alt: '' });
    el.hidden = true;
    get(id).then(function (v) { if (v) { el.src = v; el.hidden = false; } }).catch(function () {});
    return el;
  }
  return { put: put, get: get, del: del, clear: clear, all: all, restore: restore, compress: compress, img: img };
})();
