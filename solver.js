const BEAM = 80;

function placements(board, shape) {
  const out = [];
  for (let r = 0; r <= N - shape.h; r++)
    for (let c = 0; c <= N - shape.w; c++) {
      let ok = true;
      for (const [dr, dc] of shape.cells) if (board[(r + dr) * N + c + dc]) { ok = false; break; }
      if (ok) out.push([r, c]);
    }
  return out;
}

function applyMove(board, shape, r, c) {
  const b = board.slice();
  for (const [dr, dc] of shape.cells) b[(r + dr) * N + c + dc] = 1;
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) {
    let fr = true, fc = true;
    for (let j = 0; j < N; j++) { if (!b[i * N + j]) fr = false; if (!b[j * N + i]) fc = false; }
    if (fr) rows.push(i);
    if (fc) cols.push(i);
  }
  for (const i of rows) for (let j = 0; j < N; j++) b[i * N + j] = 0;
  for (const j of cols) for (let i = 0; i < N; i++) b[i * N + j] = 0;
  return { board: b, rows, cols };
}

function evalBoard(b) {
  let empty = 0, lonely = 0, trans = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = b[r * N + c];
    if (!v) {
      empty++;
      let n = 0;
      if (r > 0 && !b[(r - 1) * N + c]) n++;
      if (r < N - 1 && !b[(r + 1) * N + c]) n++;
      if (c > 0 && !b[r * N + c - 1]) n++;
      if (c < N - 1 && !b[r * N + c + 1]) n++;
      if (n === 0) lonely += 3; else if (n === 1) lonely += 1;
    }
    if (c < N - 1 && v !== b[r * N + c + 1]) trans++;
    if (r < N - 1 && v !== b[(r + 1) * N + c]) trans++;
  }
  return empty - lonely * 2 - trans * 0.35 + (empty === N * N ? 60 : 0);
}

function permutations(a) {
  if (a.length <= 1) return [a];
  const out = [];
  a.forEach((x, i) => permutations(a.filter((_, j) => j !== i)).forEach(p => out.push([x, ...p])));
  return out;
}

// pieceIds: array de 3 (índice em SHAPES ou null). Devolve a melhor sequência.
function solve(board, pieceIds) {
  const used = [];
  pieceIds.forEach((id, i) => { if (id != null) used.push(i); });
  if (!used.length) return null;
  let best = null;
  const seen = new Set();
  for (const perm of permutations(used)) {
    const key = perm.map(i => pieceIds[i]).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    let beam = [{ board, moves: [], score: 0, unplaced: 0, total: 0 }];
    for (const slot of perm) {
      const shape = SHAPES[pieceIds[slot]];
      const next = [];
      for (const st of beam) {
        const pl = placements(st.board, shape);
        if (!pl.length) { next.push({ ...st, unplaced: st.unplaced + 1 }); continue; }
        for (const [r, c] of pl) {
          const res = applyMove(st.board, shape, r, c);
          const n = res.rows.length + res.cols.length;
          const gain = n ? n * 10 + (n - 1) * (n - 1) * 8 : 0;
          next.push({
            board: res.board,
            moves: st.moves.concat({ slot, r, c, rows: res.rows, cols: res.cols }),
            score: st.score + gain, unplaced: st.unplaced, total: 0
          });
        }
      }
      for (const s of next) s.total = s.score + evalBoard(s.board) - s.unplaced * 1000;
      next.sort((a, b) => b.total - a.total);
      beam = next.slice(0, BEAM);
    }
    if (!best || beam[0].total > best.total) best = beam[0];
  }
  return best;
}
