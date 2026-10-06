/* Payload encoding + QR render/scan. Needs lib/qrcode.js and lib/jsQR.js. */
var QR = (function () {
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64dec(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  var PREFIX = 'CUP1:';
  function encodeBallot(b) { return PREFIX + b64enc(JSON.stringify(b)); }
  /** Returns ballot object or null if the text is not a ballot code. */
  function decodeBallot(text) {
    text = String(text || '').trim();
    if (text.indexOf(PREFIX) !== 0) return null;
    try { return JSON.parse(b64dec(text.slice(PREFIX.length))); } catch (e) { return null; }
  }

  function joinUrl(cfg) {
    return location.href.split('#')[0] + '#join=' + b64enc(JSON.stringify(cfg));
  }
  function parseJoinHash(hash) {
    if (hash.indexOf('#join=') !== 0) return null;
    try { return JSON.parse(b64dec(hash.slice(6))); } catch (e) { return null; }
  }

  /** Returns an element showing the QR for text. */
  function render(text) {
    try {
      var q = qrcode(0, 'L');
      q.addData(text); q.make();
      var box = document.createElement('div');
      box.className = 'qr';
      box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
      return box;
    } catch (e) {
      var err = document.createElement('p');
      err.textContent = t('Too much data for a QR code. Use the text code instead.');
      return err;
    }
  }

  /** Starts the camera into <video>; calls onText(text) for each new decoded QR. Returns stop(). */
  function scan(video, onText, onError) {
    var stream, stopped = false, canvas = document.createElement('canvas'), last = '', lastAt = 0;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    function tick() {
      if (stopped) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        var now = Date.now();
        if (code && code.data && (code.data !== last || now - lastAt > 4000)) {
          last = code.data; lastAt = now; onText(code.data);
        }
      }
      requestAnimationFrame(tick);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError && onError(new Error('Camera not available (needs HTTPS)'));
      return function () {};
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
      if (stopped) { s.getTracks().forEach(function (tr) { tr.stop(); }); return; }
      stream = s; video.srcObject = s; video.setAttribute('playsinline', ''); video.play(); tick();
    }).catch(function (e) { onError && onError(e); });
    return function () {
      stopped = true;
      if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); });
      video.srcObject = null;
    };
  }

  return { encodeBallot: encodeBallot, decodeBallot: decodeBallot, joinUrl: joinUrl, parseJoinHash: parseJoinHash, render: render, scan: scan };
})();
