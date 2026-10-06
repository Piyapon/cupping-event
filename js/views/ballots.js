/* Master: join QR, ballot import (scan or paste), per-round checklist, close rounds (SPEC 5.1, 5.5). */
var Views = window.Views || (window.Views = {});

var BallotImport = {
  /** Returns a short result message. Prompts before replacing a duplicate. */
  fromText: function (text) {
    var ev = State.ev;
    var b = QR.decodeBallot(text);
    if (!b) return { ok: false, msg: t('Not a ballot code') };
    var validRound = b.r === 'F' ? true : (typeof b.r === 'number' && b.r >= 1 && b.r <= ev.R);
    if (!validRound) return { ok: false, msg: t('Unknown round') };
    if (b.r === 'F' && !State.hasFinal()) return { ok: false, msg: t('The final is not set up yet') };
    if (!ev.participants.some(function (p) { return p.code === b.p; })) return { ok: false, msg: t('Unknown participant') + ' ' + b.p };
    var ctx = State.ballotCtx(b.r);
    var res = CupScoring.addBallot(ev.ballots, b, ctx);
    var who = State.name(b.p), rl = b.r === 'F' ? t('Final') : t('Round') + ' ' + b.r;
    if (res.status === 'rejected') return { ok: false, msg: who + ': ' + res.errors.join('; ') };
    if (ev.closed[b.r] && !confirm(rl + ' ' + t('is closed. Add this ballot anyway?'))) return { ok: false, msg: t('Skipped') };
    var prev = null;
    if (res.status === 'duplicate') {
      if (!confirm(who + ' ' + t('already has a ballot for') + ' ' + rl + '. ' + t('Replace it?'))) return { ok: false, msg: t('Kept the existing ballot') };
      prev = res.existing;
      res = CupScoring.addBallot(ev.ballots, b, ctx, { replace: true });
    }
    State.update(function (s) {
      s.ballots = res.ballots;
      s.importLog.push({ ballot: b, prev: prev });
    });
    return { ok: true, msg: who + ' · ' + rl + (b.t ? '' : ' (' + t('aroma only') + ')') + (prev ? ' · ' + t('replaced') : '') };
  },
  undo: function () {
    var log = State.ev.importLog;
    if (!log.length) return toast(t('Nothing to undo'));
    var last = log[log.length - 1];
    State.update(function (s) {
      s.importLog.pop();
      s.ballots = s.ballots.filter(function (x) { return !(x.p === last.ballot.p && x.r === last.ballot.r); });
      if (last.prev) s.ballots.push(last.prev);
    });
    toast(t('Undid last import'));
  }
};

Views.ballots = function (root) {
  var ev = State.ev;
  if (!ev.participants.length) {
    return root.appendChild(h('section', null, h('h2', null, t('Ballots')), h('p', { class: 'warn' }, t('Add participants in Setup first.'))));
  }
  var joinUrl = QR.joinUrl(State.joinConfig());
  var keys = State.roundKeys().concat(State.hasFinal() ? ['F'] : []);
  var k = App.ballotRound;
  if (k === undefined || keys.indexOf(k) < 0) k = App.ballotRound = 1;

  var paste = h('textarea', { rows: 3, placeholder: 'CUP1:…' });
  var out = h('div', { class: 'note' });
  function doPaste() {
    paste.value.split(/\s+/).filter(Boolean).forEach(function (code) {
      var r = BallotImport.fromText(code);
      toast(r.msg);
    });
  }

  function scanner() {
    var video = h('video', { muted: true, playsinline: true });
    var log = h('div', { class: 'scanlog' });
    var stop = function () {};
    var overlay = h('div', { class: 'overlay' }, video, log,
      h('button', { class: 'primary', onclick: function () { stop(); overlay.remove(); App.render(); } }, t('Close scanner')));
    document.body.appendChild(overlay);
    stop = QR.scan(video, function (text) {
      var r = BallotImport.fromText(text);
      log.insertBefore(h('div', { class: r.ok ? 'ok' : 'warn' }, (r.ok ? '✓ ' : '✕ ') + r.msg), log.firstChild);
    }, function (e) { log.appendChild(h('div', { class: 'warn' }, e.message || t('Camera error'))); });
  }

  var bs = State.ballotsFor(k);
  var sc = State.scored(k);
  var list = h('ul', { class: 'plain' }, ev.participants.map(function (p) {
    var b = bs.filter(function (x) { return x.p === p.code; })[0];
    return h('li', { class: 'row' }, h('span', { class: 'grow' }, p.name),
      b ? h('span', { class: 'ok' }, '✓' + (b.t ? '' : ' ' + t('aroma only'))) : h('span', { class: 'muted' }, '—'));
  }));

  root.appendChild(h('section', null,
    h('h2', null, t('Ballots')),
    h('details', null, h('summary', null, t('Join QR (show to tasters)')),
      h('div', { class: 'card center' }, QR.render(joinUrl), h('small', { class: 'break' }, joinUrl),
        h('p', { class: 'note' }, t('Added a participant? Tasters re-scan this QR.')))),
    h('div', { class: 'row wrap' },
      h('button', { class: 'primary', onclick: scanner }, t('Scan ballots')),
      h('button', { onclick: BallotImport.undo, disabled: !ev.importLog.length }, t('Undo last import'))),
    paste, h('button', { onclick: doPaste }, t('Import pasted code(s)')), out,
    h('div', { class: 'tabs' }, keys.map(function (key) {
      return h('button', { class: key === k ? 'on' : '', onclick: function () { App.ballotRound = key; App.render(); } },
        (key === 'F' ? t('Final') : key) + (ev.closed[key] ? ' 🔒' : ''));
    })),
    h('p', null, bs.length + ' / ' + ev.participants.length + ' ' + t('submitted')),
    list,
    sc ? null : h('p', { class: 'note' }, t('Scores appear once cups are ground and the helper has locked this round.')),
    h('button', { onclick: function () { State.update(function (s) { s.closed[k] = !s.closed[k]; }); } },
      ev.closed[k] ? t('Reopen round') : t('Close round with who submitted'))));
};
