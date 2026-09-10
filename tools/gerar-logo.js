// Gera os arquivos da logo a partir do rabisco original (assets/logo/origem.png).
// Roda com o Electron, que já tem decodificador de PNG (nativeImage):
//   ./node_modules/.bin/electron tools/gerar-logo.js
// Saídas:
//   assets/logo/marca.png      — branco com alfa: máscara pra CSS (mask-image) e logo branca
//   assets/logo/marca-azul.png — o azul original sobre transparente (janela, notificações)
//   assets/icon.png            — 512px, azul sobre transparente (janela e bandeja)
//   assets/icon-256.png        — 256px
//   assets/icon.ico            — 256/128/64/48/32/16 em PNG dentro do ICO (instalador)
const { app, nativeImage } = require('electron');
const fs = require('fs'); const path = require('path');
const R = path.join(__dirname, '..');

function processar() {
  const src = nativeImage.createFromPath(path.join(R, 'assets', 'logo', 'origem.png'));
  const { width: W, height: H } = src.getSize();
  const bmp = src.toBitmap(); // BGRA
  // alfa a partir de "quanto não é branco": o azul tem R e G perto de zero
  const alfa = new Float32Array(W * H);
  let minx = W, miny = H, maxx = 0, maxy = 0; let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2], a0 = bmp[i + 3] / 255;
    // fundo transparente (alfa 0) ou branco: os dois viram alfa 0
    let a = a0 * (1 - (r + g) / 510); a = Math.min(1, Math.max(0, (a - 0.08) / 0.84));
    alfa[y * W + x] = a;
    if (a > 0.05) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    if (a > 0.97) { sr += r; sg += g; sb += b; n++; }
  }
  const azul = [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
  // recorte quadrado em volta do rabisco, com respiro de 6%
  const bw = maxx - minx + 1, bh = maxy - miny + 1, lado = Math.round(Math.max(bw, bh) * 1.12);
  const cx = Math.round((minx + maxx) / 2), cy = Math.round((miny + maxy) / 2);
  const x0 = cx - Math.round(lado / 2), y0 = cy - Math.round(lado / 2);
  const gerar = (cor) => { // cor = [r,g,b]; devolve imagem quadrada `lado` em BGRA
    const out = Buffer.alloc(lado * lado * 4);
    for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
      const sx = x0 + x, sy = y0 + y; let a = 0;
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) a = alfa[sy * W + sx];
      const o = (y * lado + x) * 4; const A = Math.round(a * 255);
      // nativeImage espera alfa pré-multiplicado
      out[o] = Math.round(cor[2] * a); out[o + 1] = Math.round(cor[1] * a); out[o + 2] = Math.round(cor[0] * a); out[o + 3] = A;
    }
    return nativeImage.createFromBitmap(out, { width: lado, height: lado });
  };
  const branca = gerar([255, 255, 255]); const azulImg = gerar(azul);
  const dir = path.join(R, 'assets', 'logo'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'marca.png'), branca.resize({ width: 512, height: 512 }).toPNG());
  fs.writeFileSync(path.join(dir, 'marca-azul.png'), azulImg.resize({ width: 512, height: 512 }).toPNG());
  fs.writeFileSync(path.join(R, 'assets', 'icon.png'), azulImg.resize({ width: 512, height: 512 }).toPNG());
  fs.writeFileSync(path.join(R, 'assets', 'icon-256.png'), azulImg.resize({ width: 256, height: 256 }).toPNG());
  // ICO com entradas PNG (Windows Vista em diante lê)
  const tamanhos = [256, 128, 64, 48, 32, 16];
  const pngs = tamanhos.map(t => azulImg.resize({ width: t, height: t }).toPNG());
  const cab = Buffer.alloc(6); cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(tamanhos.length, 4);
  const dirs = []; let off = 6 + 16 * tamanhos.length;
  tamanhos.forEach((t, i) => {
    const d = Buffer.alloc(16); d.writeUInt8(t === 256 ? 0 : t, 0); d.writeUInt8(t === 256 ? 0 : t, 1); d.writeUInt8(0, 2); d.writeUInt8(0, 3);
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(pngs[i].length, 8); d.writeUInt32LE(off, 12);
    dirs.push(d); off += pngs[i].length;
  });
  fs.writeFileSync(path.join(R, 'assets', 'icon.ico'), Buffer.concat([cab, ...dirs, ...pngs]));
  console.log(`origem ${W}x${H} · recorte ${lado}px em (${x0},${y0}) · azul rgb(${azul.join(',')}) · marca.png, marca-azul.png, icon.png, icon-256.png, icon.ico gerados`);
}

app.whenReady().then(() => { try { processar(); } catch (e) { console.error(e); process.exitCode = 1; } app.quit(); });
