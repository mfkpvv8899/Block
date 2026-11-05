const $ = s => document.querySelector(s);
const NAMES = ['A', 'B', 'C'];
let board = new Uint8Array(N * N), slots = [null, null, null], sel = 0, solution = null;

try {
  const s = JSON.parse(localStorage.getItem('bbs') || 'null');
  if (s && s.board && s.board.length === N * N) board = Uint8Array.from(s.board);
} catch (e) {}
const save = () => { try { localStorage.setItem('bbs', JSON.stringify({ board: [...board] })); } catch (e) {} };

/* ---------- tabuleiro ---------- */
const boardEl = $('#board'), cellEls = [];
for (let i = 0; i < N * N; i++) {
  const d = document.createElement('div');
  d.className = 'cell'; d.dataset.i = i;
  boardEl.appendChild(d); cellEls.push(d);
}
let painting = null;
boardEl.addEventListener('pointerdown', e => {
  const t = e.target.closest('.cell'); if (!t) return;
  e.preventDefault();
  const i = +t.dataset.i;
  painting = board[i] ? 0 : 1; board[i] = painting;
  try { boardEl.setPointerCapture(e.pointerId); } catch (x) {}
  update();
});
boardEl.addEventListener('pointermove', e => {
  if (painting === null) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const c = el && el.closest ? el.closest('.cell') : null;
  if (c && board[+c.dataset.i] !== painting) { board[+c.dataset.i] = painting; update(); }
});
['pointerup', 'pointercancel'].forEach(ev => boardEl.addEventListener(ev, () => { painting = null; }));

/* ---------- peças ---------- */
function thumb(shape, px) {
  const d = document.createElement('div');
  d.className = 'thumb';
  d.style.gridTemplateColumns = `repeat(${shape.w}, ${px}px)`;
  d.style.gridAutoRows = px + 'px';
  for (let r = 0; r < shape.h; r++) for (let c = 0; c < shape.w; c++) {
    const x = document.createElement('i');
    if (shape.rows[r][c] === 'X') x.className = 'on';
    d.appendChild(x);
  }
  return d;
}

const paletteEl = $('#palette');
SHAPES.forEach((s, id) => {
  const b = document.createElement('button');
  b.className = 'pbtn'; b.setAttribute('aria-label', 'Peça ' + (id + 1));
  b.appendChild(thumb(s, 11));
  b.onclick = () => {
    slots[sel] = id;
    const nxt = [0, 1, 2].find(i => slots[i] == null);
    if (nxt !== undefined) sel = nxt;
    update();
  };
  paletteEl.appendChild(b);
});

function renderSlots() {
  const el = $('#slots'); el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('button');
    b.className = 'slot s' + i + (sel === i ? ' sel' : '');
    const lab = document.createElement('span'); lab.textContent = NAMES[i];
    b.appendChild(lab);
    if (slots[i] != null) b.appendChild(thumb(SHAPES[slots[i]], 16));
    else { const e = document.createElement('em'); e.textContent = 'escolhe'; b.appendChild(e); }
    b.onclick = () => { slots[i] = null; sel = i; update(); };
    el.appendChild(b);
  }
}

/* ---------- resultado ---------- */
function render() {
  solution = solve(board, slots);
  const overlay = {}, cleared = new Set();
  const res = $('#result');

  if (solution) {
    let sim = board;
    solution.moves.forEach((m, k) => {
      const shape = SHAPES[slots[m.slot]];
      for (const [dr, dc] of shape.cells) overlay[(m.r + dr) * N + m.c + dc] = { k: k + 1, slot: m.slot };
      const r = applyMove(sim, shape, m.r, m.c); sim = r.board;
      m.rows.forEach(i => { for (let j = 0; j < N; j++) cleared.add(i * N + j); });
      m.cols.forEach(j => { for (let i = 0; i < N; i++) cleared.add(i * N + j); });
    });
    const lines = solution.moves.reduce((a, m) => a + m.rows.length + m.cols.length, 0);
    let html = '<ol>';
    solution.moves.forEach(m => {
      const n = m.rows.length + m.cols.length;
      html += `<li><b class="dot s${m.slot}">${NAMES[m.slot]}</b> linha ${m.r + 1}, coluna ${m.c + 1}` +
              (n ? ` — limpa ${n} ${n > 1 ? 'linhas' : 'linha'}` : '') + '</li>';
    });
    html += '</ol>';
    if (solution.unplaced) html += `<p class="warn">Não cabem todas as peças. Esta é a melhor jogada possível.</p>`;
    else if (lines) html += `<p class="ok">Total: ${lines} ${lines > 1 ? 'linhas limpas' : 'linha limpa'}.</p>`;
    res.innerHTML = html;
  } else {
    res.innerHTML = '<p class="hint">Escolhe pelo menos uma peça.</p>';
  }

  for (let i = 0; i < N * N; i++) {
    const el = cellEls[i], o = overlay[i];
    el.className = 'cell' + (board[i] ? ' on' : '') + (o ? ' ghost s' + o.slot : '') + (cleared.has(i) ? ' clr' : '');
    el.textContent = o ? o.k : '';
  }
  renderSlots();
  $('#apply').disabled = !solution;
}

function update() { save(); render(); }

$('#apply').onclick = () => {
  if (!solution) return;
  board = solution.board.slice(); slots = [null, null, null]; sel = 0; update();
};
$('#clearPieces').onclick = () => { slots = [null, null, null]; sel = 0; update(); };
$('#clearBoard').onclick = () => { board = new Uint8Array(N * N); update(); };

render();
