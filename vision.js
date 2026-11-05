(function () {
  const cv = $('#frame'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const vid = document.createElement('video'); vid.muted = true; vid.playsInline = true;
  const KEY = new Map(SHAPES.map((s, i) => [s.rows.join('|'), i]));
  let src = null, img = new Image(), stream = null, timer = null, mode = null, drag = null, last = '', same = 0, applied = '';
  let rects = { board: null, tray: null };
  try { const s = JSON.parse(localStorage.getItem('bbr') || 'null'); if (s) rects = s; } catch (e) {}
  const msg = t => { $('#vmsg').textContent = t; };
  const px = r => ({ x: r.x * cv.width, y: r.y * cv.height, w: r.w * cv.width, h: r.h * cv.height });

  function fill(d, x, y, th) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return false;
    const i = (y * cv.width + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx > th && (mx - mn) / mx > 0.3;
  }
  function vote(d, cx, cy, rad, th) {
    let n = 0;
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) if (fill(d, cx + a * rad, cy + b * rad, th)) n++;
    return n >= 5;
  }
  function piece(d, x0, y0, w, h, cw, th) {
    let a = 1e9, b = 1e9, c = -1, e = -1, n = 0; const st = 2;
    for (let y = y0; y < y0 + h; y += st) for (let x = x0; x < x0 + w; x += st)
      if (fill(d, x, y, th)) { n++; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > e) e = y; }
    if (n < 8) return null;
    const W = c - a + st, H = e - b + st, exp = +$('#sc').value;
    let best = null, bs = 9;
    for (let nw = 1; nw <= 5; nw++) for (let nh = 1; nh <= 5; nh++) {
      const sw = W / nw, sh = H / nh;
      if (Math.abs(sw - sh) / Math.max(sw, sh) > 0.15) continue;
      const rows = [];
      for (let r = 0; r < nh; r++) {
        let s = '';
        for (let q = 0; q < nw; q++) s += vote(d, a + (q + .5) * sw, b + (r + .5) * sh, Math.min(sw, sh) * .2, th) ? 'X' : '.';
        rows.push(s);
      }
      const id = KEY.get(rows.join('|')); if (id === undefined) continue;
      const sc = Math.abs((sw + sh) / 2 / cw - exp);
      if (sc < bs) { bs = sc; best = id; }
    }
    return best;
  }

  function analyze() {
    if (!rects.board) { msg('Passo 1: arraste sobre o tabuleiro 8×8 no quadro (botão "Marcar tabuleiro").'); return; }
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data, th = +$('#th').value;
    const B = px(rects.board), cw = B.w / 8, ch = B.h / 8, nb = new Uint8Array(64);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
      nb[r * 8 + c] = vote(d, B.x + (c + .5) * cw, B.y + (r + .5) * ch, Math.min(cw, ch) * .22, th) ? 1 : 0;
    let ns = [null, null, null];
    if (rects.tray) { const T = px(rects.tray); ns = [0, 1, 2].map(i => piece(d, T.x + i * T.w / 3, T.y, T.w / 3, T.h, cw, th)); }
    else msg('Passo 2: marque a área das 3 peças.');
    const sig = nb.join('') + ns.join(',');
    same = sig === last ? same + 1 : 0; last = sig;
    if ((src === 'img' || same >= 1) && sig !== applied) {
      applied = sig; board = nb; slots = ns; sel = Math.max(0, ns.indexOf(null)); update();
      if (rects.tray) msg(`Lido: ${nb.reduce((a, b) => a + b, 0)} blocos e ${ns.filter(x => x != null).length}/3 peças reconhecidas.` +
        (ns.includes(null) ? ' Ajuste a escala/brilho ou escolha a peça à mão.' : ''));
    }
  }

  function outline() {
    ctx.lineWidth = 3;
    for (const [k, col] of [['board', '#7dffb0'], ['tray', '#ffa62b']]) {
      const r = rects[k]; if (!r) continue; const p = px(r), n = k === 'board' ? 8 : 3;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(p.x, p.y, p.w, p.h); ctx.lineWidth = 1;
      for (let i = 1; i < n; i++) {
        ctx.beginPath(); ctx.moveTo(p.x + i * p.w / n, p.y); ctx.lineTo(p.x + i * p.w / n, p.y + p.h);
        if (k === 'board') { ctx.moveTo(p.x, p.y + i * p.h / 8); ctx.lineTo(p.x + p.w, p.y + i * p.h / 8); }
        ctx.stroke();
      }
    }
    if (drag) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); const p = dragRect(); ctx.strokeRect(p.x, p.y, p.w, p.h); ctx.setLineDash([]); }
  }

  function frame(skip) {
    const s = src === 'video' ? vid : img;
    const w = s.videoWidth || s.naturalWidth, h = s.videoHeight || s.naturalHeight; if (!w) return;
    const k = Math.min(1, 960 / w), W = Math.round(w * k), H = Math.round(h * k);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.drawImage(s, 0, 0, W, H);
    if (!skip) analyze();
    outline();
  }

  const pt = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * cv.width / b.width, y: (e.clientY - b.top) * cv.height / b.height }; };
  const dragRect = () => ({ x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) });
  cv.addEventListener('pointerdown', e => {
    if (!mode || !src) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const p = pt(e); drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  });
  cv.addEventListener('pointermove', e => { if (!drag) return; const p = pt(e); drag.x1 = p.x; drag.y1 = p.y; frame(true); });
  cv.addEventListener('pointerup', () => {
    if (!drag) return; const r = dragRect(); drag = null;
    if (r.w > 10 && r.h > 10) {
      rects[mode] = { x: r.x / cv.width, y: r.y / cv.height, w: r.w / cv.width, h: r.h / cv.height };
      try { localStorage.setItem('bbr', JSON.stringify(rects)); } catch (x) {}
    }
    mode = null; applied = ''; frame();
  });

  const ask = m => () => { if (!src) { msg('Compartilhe a tela ou envie um print primeiro.'); return; }
    mode = m; msg(m === 'board' ? 'Arraste um retângulo sobre o tabuleiro 8×8.' : 'Arraste um retângulo sobre a área das 3 peças.'); };
  $('#mkBoard').onclick = ask('board'); $('#mkTray').onclick = ask('tray');
  ['#th', '#sc'].forEach(s => $(s).oninput = () => { applied = ''; if (src) frame(); });

  $('#file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    clearInterval(timer); src = 'img'; img = new Image();
    img.onload = () => { applied = ''; frame(); if (!rects.board) msg('Passo 1: marque o tabuleiro.'); };
    img.src = URL.createObjectURL(f);
  };

  $('#share').onclick = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      msg('Este navegador não permite compartilhar a tela (comum no celular). Use "Enviar print".'); return;
    }
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      vid.srcObject = stream; await vid.play(); src = 'video'; applied = ''; clearInterval(timer);
      timer = setInterval(() => frame(), 600);
      stream.getVideoTracks()[0].onended = () => { clearInterval(timer); msg('Compartilhamento encerrado.'); };
      msg('Ao vivo. ' + (rects.board ? '' : 'Marque o tabuleiro e as peças.'));
    } catch (err) {
      msg('Não foi possível compartilhar a tela aqui (' + (err.name || 'erro') + '). Abra o arquivo no navegador do computador ou use "Enviar print".');
    }
  };
  msg('Compartilhe a tela do jogo ou envie um print.');
})();
