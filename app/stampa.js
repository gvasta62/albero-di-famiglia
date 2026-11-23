/* =====================================================================
   Albero di famiglia - stampa dell'albero intero, in vettoriale (SVG).
   Si stampa dal browser (o si salva in PDF dalla finestra di stampa)
   oppure si scarica il file .svg. In vita e defunti hanno colori diversi.
   Usa le funzioni e lo "stato" di app.js, che va caricato prima.
   ===================================================================== */
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/* fogli in millimetri, lato lungo per primo */
const FOGLI = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
const MARGINE_MM = 8;

/* misure del disegno, in punti dell'SVG */
const M = { W: 180, H: 66, GC: 30, GB: 34, GV: 64, BORDO: 30, TESTA: 96, CORSIA: 14 };

const TAVOLOZZE = {
  colori: {
    vivo: { fondo: '#e3efe7', bordo: '#2f6b4f', testo: '#17231b', tenue: '#3f5a49', volto: '#bcd9c7' },
    defunto: { fondo: '#ece8e1', bordo: '#8a7f6e', testo: '#3d3830', tenue: '#6b6253', volto: '#d4ccbf' },
    linea: '#6f6a60', titolo: '#1e2620', sottotitolo: '#5b665e', tratteggio: false
  },
  bn: {
    vivo: { fondo: '#ffffff', bordo: '#111111', testo: '#111111', tenue: '#333333', volto: '#dddddd' },
    defunto: { fondo: '#e6e6e6', bordo: '#555555', testo: '#222222', tenue: '#444444', volto: '#c8c8c8' },
    linea: '#444444', titolo: '#111111', sottotitolo: '#444444', tratteggio: true
  }
};

/* ---------------------------------------------------------------- chi entra nella stampa */
function personeDaStampare(opz) {
  const tutti = new Set(stato.persone.keys());
  if (opz.chi === 'tutti' || !opz.id || !stato.persone.has(opz.id)) return tutti;
  const insieme = new Set([opz.id]);
  const coda = [opz.id];
  if (opz.chi === 'discendenti') {
    while (coda.length) {
      const id = coda.shift();
      for (const f of figliDi(id)) if (!insieme.has(f)) { insieme.add(f); coda.push(f); }
    }
    for (const id of [...insieme]) for (const c of coniugiDi(id)) insieme.add(c);
  } else {
    while (coda.length) {
      const id = coda.shift();
      for (const g of genitoriDi(id)) if (!insieme.has(g)) { insieme.add(g); coda.push(g); }
    }
  }
  return insieme;
}

/* ---------------------------------------------------------------- disposizione */
/* regressione isotona (pool adjacent violators): la sequenza più vicina a "obiettivo" che non scende mai */
function nonDecrescente(obiettivo, peso) {
  const pile = [];
  for (let i = 0; i < obiettivo.length; i++) {
    pile.push({ v: obiettivo[i], w: peso[i], n: 1 });
    while (pile.length > 1 && pile[pile.length - 2].v > pile[pile.length - 1].v) {
      const b = pile.pop(), a = pile[pile.length - 1];
      a.v = (a.v * a.w + b.v * b.w) / (a.w + b.w); a.w += b.w; a.n += b.n;
    }
  }
  const fuori = [];
  for (const p of pile) for (let k = 0; k < p.n; k++) fuori.push(p.v);
  return fuori;
}

/* K: misure lungo le due direzioni. "croce" = lato della carta lungo la riga di una generazione,
   "prof" = lato nella direzione da una generazione all'altra; gc/gb = spazio nella coppia / fra blocchi */
function disponi(ids, K) {
  const par = id => (stato.genitori.get(id) || []).filter(x => ids.has(x));
  const fig = id => ordina(stato.figli.get(id) || []).filter(x => ids.has(x));
  const con = id => coppieDi(id).map(c => c.id).filter(x => ids.has(x));

  // 1. generazioni: i figli sotto i genitori, le coppie sulla stessa riga
  const gen = new Map([...ids].map(i => [i, 0]));
  for (let giro = 0; giro < 300; giro++) {
    let cambiato = false;
    for (const i of ids) {
      let g = gen.get(i);
      for (const p of par(i)) g = Math.max(g, gen.get(p) + 1);
      for (const c of con(i)) g = Math.max(g, gen.get(c));
      if (!par(i).length) {
        const fs = fig(i);
        if (fs.length) g = Math.max(g, Math.min(...fs.map(f => gen.get(f))) - 1);
      }
      if (g !== gen.get(i)) { gen.set(i, g); cambiato = true; }
    }
    if (!cambiato) break;
  }
  const minimo = Math.min(...gen.values());
  for (const [i, g] of gen) gen.set(i, g - minimo);
  const ultima = Math.max(...gen.values());

  // 2. blocchi: una persona con i suoi coniugi, uno accanto all'altro
  const bloccoDi = new Map();
  const blocchi = [];
  for (const i of ordina([...ids])) {
    if (bloccoDi.has(i)) continue;
    const membri = [];
    const pila = [i];
    const visti = new Set([i]);
    while (pila.length) {
      const x = pila.pop(); membri.push(x);
      for (const c of con(x)) if (!visti.has(c) && gen.get(c) === gen.get(i)) { visti.add(c); pila.push(c); }
    }
    // ordine dentro il blocco: si segue la catena dei matrimoni partendo da un capo
    const grado = x => con(x).filter(c => visti.has(c)).length;
    const inizio = ordina(membri).find(x => grado(x) <= 1) || membri[0];
    const ordine = [];
    const percorri = x => {
      if (ordine.includes(x)) return;
      ordine.push(x);
      for (const c of ordina(con(x).filter(c => visti.has(c)))) percorri(c);
    };
    percorri(inizio);
    for (const x of membri) if (!ordine.includes(x)) ordine.push(x);
    // chi ha più coniugi va in mezzo
    if (ordine.length === 3 && grado(ordine[0]) === 2) ordine.push(ordine.shift());
    const b = { membri: ordine, gen: gen.get(i), x: 0, w: ordine.length * K.croce + (ordine.length - 1) * K.gc };
    blocchi.push(b);
    for (const x of ordine) bloccoDi.set(x, b);
  }

  // 3. ordine iniziale per righe: si scende dagli antenati, i figli dopo i genitori
  const righe = Array.from({ length: ultima + 1 }, () => []);
  const visitati = new Set();
  const visita = b => {
    if (visitati.has(b)) return;
    visitati.add(b); righe[b.gen].push(b);
    for (const m of b.membri) for (const f of fig(m)) visita(bloccoDi.get(f));
  };
  const radici = blocchi.filter(b => b.membri.every(m => !par(m).length)).sort((a, b) => a.gen - b.gen);
  for (const b of radici) visita(b);
  for (const b of blocchi) visita(b);

  const centroDi = id => { const b = bloccoDi.get(id); return b.x + b.membri.indexOf(id) * (K.croce + K.gc) + K.croce / 2; };
  const impacchetta = riga => { let x = 0; for (const b of riga) { b.x = x; x += b.w + K.gb; } };
  righe.forEach(impacchetta);
  const media = v => v.reduce((s, x) => s + x, 0) / v.length;
  const versoGenitori = b => {
    const c = b.membri.filter(m => par(m).length).map(m => media(par(m).map(centroDi)) - b.membri.indexOf(m) * (K.croce + K.gc) - K.croce / 2);
    return c.length ? media(c) : null;
  };
  const versoFigli = b => {
    const c = b.membri.filter(m => fig(m).length).map(m => media(fig(m).map(centroDi)) - b.membri.indexOf(m) * (K.croce + K.gc) - K.croce / 2);
    return c.length ? media(c) : null;
  };

  // chi non ha genitori nella stampa (per esempio i suoceri) si regola sui figli, e viceversa
  const conRiserva = (prima, poi) => b => {
    const v = prima(b);
    if (v != null) return { v, w: 1 };
    const r = poi(b);
    return r != null ? { v: r, w: 0.4 } : null;
  };
  const sopra = conRiserva(versoGenitori, versoFigli), sotto = conRiserva(versoFigli, versoGenitori);
  // in una coppia, ciascuno dal lato dei propri genitori: così le linee non si incrociano
  const giraCoppia = b => {
    if (b.membri.length !== 2) return;
    const [m0, m1] = b.membri;
    const pc = m => par(m).length ? media(par(m).map(centroDi)) : null;
    const c0 = pc(m0), c1 = pc(m1), mezzo = b.x + b.w / 2;
    const scambia = c0 != null && c1 != null ? c0 > c1 : c0 != null ? c0 > mezzo : c1 != null ? c1 < mezzo : false;
    if (scambia) b.membri.reverse();
  };

  // 4. si riordinano le righe col baricentro, per ridurre gli incroci
  const riordina = (riga, chiave, gira) => {
    if (gira) riga.forEach(giraCoppia);
    const k = new Map(riga.map(b => { const v = chiave(b); return [b, v == null ? b.x : v.v]; }));
    riga.sort((a, b) => k.get(a) - k.get(b));
    impacchetta(riga);
  };
  for (let giro = 0; giro < 8; giro++) {
    for (let g = 1; g <= ultima; g++) riordina(righe[g], sopra, true);
    for (let g = ultima - 1; g >= 0; g--) riordina(righe[g], sotto);
  }
  for (let g = 1; g <= ultima; g++) riordina(righe[g], sopra, true);

  // 5. posizioni: ogni blocco il più vicino possibile a dove vorrebbe stare, senza sovrapporsi
  const sistema = (riga, chiave) => {
    if (!riga.length) return;
    let scarto = 0;
    const obiettivo = [], peso = [];
    for (const b of riga) {
      const v = chiave(b);
      obiettivo.push((v == null ? b.x : v.v) - scarto);
      peso.push(v == null ? 0.05 : v.w);
      scarto += b.w + K.gb;
    }
    const u = nonDecrescente(obiettivo, peso);
    scarto = 0;
    riga.forEach((b, i) => { b.x = u[i] + scarto; scarto += b.w + K.gb; });
  };
  for (let giro = 0; giro < 10; giro++) {
    for (let g = 1; g <= ultima; g++) { righe[g].forEach(giraCoppia); sistema(righe[g], sopra); }
    for (let g = ultima - 1; g >= 0; g--) sistema(righe[g], sotto);
  }
  for (let g = 1; g <= ultima; g++) sistema(righe[g], sopra);

  const sinistra = Math.min(...blocchi.map(b => b.x));
  for (const b of blocchi) b.x -= sinistra;
  const larghezza = Math.max(...blocchi.map(b => b.x + b.w));

  // 6. linee genitori-figli, raggruppate per coppia di genitori; le linee orizzontali su corsie diverse
  const gruppi = new Map();
  for (const i of ids) {
    const ps = par(i).sort();
    if (!ps.length) continue;
    const k = ps.join('|') + '>' + gen.get(i);
    if (!gruppi.has(k)) gruppi.set(k, { genitori: ps, figli: [], gen: gen.get(i) });
    gruppi.get(k).figli.push(i);
  }
  const perRiga = new Map();
  for (const gr of gruppi.values()) {
    const [a, b] = gr.genitori;
    const ba = bloccoDi.get(a);
    gr.coppia = gr.genitori.length === 2 && ba === bloccoDi.get(b) && Math.abs(ba.membri.indexOf(a) - ba.membri.indexOf(b)) === 1;
    gr.origini = gr.coppia ? [(centroDi(a) + centroDi(b)) / 2] : gr.genitori.map(centroDi);
    // figlio unico quasi allineato a chi sta sopra: la linea va dritta, senza gradino
    if (gr.figli.length === 1 && gr.origini.length === 1) {
      const bf = bloccoDi.get(gr.figli[0]), scarto = gr.origini[0] - centroDi(gr.figli[0]);
      if (Math.abs(scarto) < 6 && bf.membri.length === 1) bf.x += scarto;
    }
    const xs = [...gr.origini, ...gr.figli.map(centroDi)];
    gr.da = Math.min(...xs); gr.a = Math.max(...xs);
    if (!perRiga.has(gr.gen)) perRiga.set(gr.gen, []);
    perRiga.get(gr.gen).push(gr);
  }
  const corsie = new Map();
  for (const [g, lista] of perRiga) {
    lista.sort((p, q) => p.da - q.da);
    const fine = [];
    for (const gr of lista) {
      let c = fine.findIndex(f => f + 14 < gr.da);
      if (c < 0) { c = fine.length; fine.push(0); }
      fine[c] = gr.a; gr.corsia = c;
    }
    corsie.set(g, fine.length);
  }
  // altezza di ogni riga: lo spazio sopra cresce con le corsie che servono
  const y = [];
  let cima = 0;
  for (let g = 0; g <= ultima; g++) {
    if (g > 0) cima += Math.max(M.GV, ((corsie.get(g) || 0) + 1) * M.CORSIA);
    y[g] = cima; cima += K.prof;
  }
  for (const gr of gruppi.values()) {
    const sopra = y[gr.gen - 1] + K.prof, spazio = y[gr.gen] - sopra;
    gr.y = sopra + (gr.corsia + 1) * spazio / (corsie.get(gr.gen) + 1);
  }

  return { ids, gen, blocchi, gruppi, centroDi, y, larghezza, altezza: cima, bloccoDi, con };
}

/* ---------------------------------------------------------------- disegno SVG */
function s(tag, attrs, ...figli) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
  for (const f of figli.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
const FONT = 'Segoe UI, Helvetica, Arial, sans-serif';
const FONT_TITOLO = 'Palatino Linotype, Palatino, Georgia, serif';
let misuratore = null;
function taglia(testo, px, peso, max) {
  if (!misuratore) misuratore = document.createElement('canvas').getContext('2d');
  misuratore.font = `${peso} ${px}px Arial, sans-serif`;
  if (misuratore.measureText(testo).width <= max) return testo;
  let t = testo;
  while (t.length > 1 && misuratore.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
function anniStampa(p) {
  const n = anno(p.data_nascita), m = anno(p.data_morte);
  if (p.deceduto) return `${n || '?'} – † ${m || '?'}`;
  return n ? `n. ${n}` : '';
}

/* due modi di disporre: generazioni in righe (dall'alto) o in colonne (da sinistra);
   le famiglie larghe stanno meglio in colonne, perché le carte sono più larghe che alte */
const MISURE = {
  alto: { croce: M.W, prof: M.H, gc: 30, gb: 34 },
  sinistra: { croce: M.H, prof: M.W, gc: 22, gb: 20 }
};
function disegnaAlbero(opz) {
  if (opz.direzione === 'alto' || opz.direzione === 'sinistra') return disegnaVerso(opz, opz.direzione);
  const a = disegnaVerso(opz, 'alto'), b = disegnaVerso(opz, 'sinistra');
  return impaginazione(a, opz.foglio).puntiNome >= impaginazione(b, opz.foglio).puntiNome ? a : b;
}
function disegnaVerso(opz, dir) {
  const ids = personeDaStampare(opz);
  const tav = TAVOLOZZE[opz.colori ? 'colori' : 'bn'];
  const td = dir === 'alto', K = MISURE[dir];
  const L = ids.size ? disponi(ids, K) : null;
  const estC = L ? L.larghezza : 0, estP = L ? L.altezza : 0;
  const largContenuto = td ? estC : estP, altContenuto = td ? estP : estC;
  const W = Math.max(largContenuto, 720) + 2 * M.BORDO;
  const H = altContenuto + M.TESTA + 2 * M.BORDO;
  const ox = M.BORDO + (W - 2 * M.BORDO - largContenuto) / 2, oy = M.BORDO + M.TESTA;

  const svg = s('svg', { xmlns: SVG_NS, 'xmlns:xlink': XLINK_NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'font-family': FONT, 'data-direzione': dir });
  const defs = s('defs');
  svg.append(defs, s('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));

  // intestazione
  const fam = stato.famiglia ? stato.famiglia.nome : 'Albero di famiglia';
  const oggi = new Date();
  let sotto = `${ids.size} ${ids.size === 1 ? 'persona' : 'persone'}`;
  if (opz.chi !== 'tutti' && P(opz.id)) sotto = (opz.chi === 'discendenti' ? 'Discendenti di ' : 'Antenati di ') + nomeCompleto(P(opz.id)) + ' · ' + sotto;
  sotto += ` · aggiornato al ${oggi.getDate()} ${MESI[oggi.getMonth()]} ${oggi.getFullYear()}`;
  svg.append(s('text', { x: M.BORDO, y: M.BORDO + 30, 'font-family': FONT_TITOLO, 'font-size': 30, 'font-weight': 600, fill: tav.titolo }, fam),
    s('text', { x: M.BORDO, y: M.BORDO + 56, 'font-size': 14, fill: tav.sottotitolo }, sotto));

  // legenda in alto a destra
  const leg = s('g', { transform: `translate(${W - M.BORDO - 300},${M.BORDO + 6})`, 'font-size': 13, fill: tav.titolo });
  const riq = (x, c, testo, tratteggio) => [
    s('rect', { x, y: 0, width: 26, height: 18, rx: 4, fill: c.fondo, stroke: c.bordo, 'stroke-width': 1.6, 'stroke-dasharray': tratteggio ? '4 3' : null }),
    s('text', { x: x + 32, y: 14 }, testo)];
  const lin = (x, yy, testo, dash) => [
    s('line', { x1: x, y1: yy, x2: x + 26, y2: yy, stroke: tav.linea, 'stroke-width': 2, 'stroke-dasharray': dash }),
    s('text', { x: x + 32, y: yy + 5 }, testo)];
  leg.append(...riq(0, tav.vivo, 'In vita'), ...riq(150, tav.defunto, 'Defunti †', tav.tratteggio),
    ...lin(0, 40, 'Sposati'), ...lin(150, 40, 'Conviventi', '6 4'), ...lin(0, 62, 'Separati', '1.5 4'), ...lin(150, 62, 'Genitore e figlio'));
  svg.append(leg);

  if (!L) { svg.append(s('text', { x: W / 2, y: oy + 40, 'text-anchor': 'middle', fill: tav.sottotitolo, 'font-size': 16 }, 'Nessuna persona da stampare.')); return svg; }

  const corpo = s('g', { transform: `translate(${ox},${oy})` });
  svg.append(corpo);
  // (p, c) = posizione lungo le generazioni e lungo la riga; pt() la traduce in x y
  const pt = (pp, c) => td ? `${c} ${pp}` : `${pp} ${c}`;
  const seg = (p1, c1, p2, c2) => `M${pt(p1, c1)}L${pt(p2, c2)}`;
  const inizioC = id => L.centroDi(id) - K.croce / 2;
  const inizioP = id => L.y[L.gen.get(id)];
  const xDi = id => td ? inizioC(id) : inizioP(id);
  const yDi = id => td ? inizioP(id) : inizioC(id);

  // linee genitori-figli (sotto le carte)
  const linee = s('g', { stroke: tav.linea, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' });
  for (const gr of L.gruppi.values()) {
    const d = [];
    if (gr.coppia) d.push(seg(inizioP(gr.genitori[0]) + K.prof / 2, gr.origini[0], gr.y, gr.origini[0]));
    else for (const g of gr.genitori) d.push(seg(inizioP(g) + K.prof, L.centroDi(g), gr.y, L.centroDi(g)));
    d.push(seg(gr.y, gr.da, gr.y, gr.a));
    for (const f of gr.figli) d.push(seg(gr.y, L.centroDi(f), inizioP(f), L.centroDi(f)));
    linee.append(s('path', { d: d.join('') }));
  }
  corpo.append(linee);

  // linee di coppia
  const coppie = s('g', { stroke: tav.linea, 'stroke-width': 2, fill: 'none' });
  const fatte = new Set();
  for (const r of stato.relazioni) {
    if (r.tipo === 'genitore' || !L.ids.has(r.da) || !L.ids.has(r.a)) continue;
    const k = [r.da, r.a].sort().join('|');
    if (fatte.has(k)) continue;
    fatte.add(k);
    const dash = r.dettaglio === 'conviventi' ? '6 4' : r.dettaglio === 'separati' ? '1.5 4' : null;
    const b = L.bloccoDi.get(r.da);
    const ia = b.membri.indexOf(r.da), ib = b.membri.indexOf(r.a);
    if (b === L.bloccoDi.get(r.a) && Math.abs(ia - ib) === 1) {
      const sx = ia < ib ? r.da : r.a, dx = ia < ib ? r.a : r.da;
      const m = inizioP(sx) + K.prof / 2;
      coppie.append(s('path', { d: seg(m, inizioC(sx) + K.croce, m, inizioC(dx)), 'stroke-dasharray': dash }));
    } else {
      // coniugi non vicini: un arco fuori dalle carte
      const c1 = L.centroDi(r.da), c2 = L.centroDi(r.a), p1 = inizioP(r.da), p2 = inizioP(r.a), pm = Math.min(p1, p2) - 30;
      coppie.append(s('path', { d: `M${pt(p1, c1)}C${pt(pm, c1)} ${pt(pm, c2)} ${pt(p2, c2)}`, 'stroke-dasharray': dash }));
    }
  }
  corpo.append(coppie);

  // carte
  let n = 0;
  for (const id of L.ids) {
    const p = P(id), c = p.deceduto ? tav.defunto : tav.vivo;
    const x = xDi(id), yy = yDi(id);
    const g = s('g', { transform: `translate(${x},${yy})` });
    g.append(s('rect', { x: 0, y: 0, width: M.W, height: M.H, rx: 9, fill: c.fondo, stroke: c.bordo, 'stroke-width': 1.6, 'stroke-dasharray': p.deceduto && tav.tratteggio ? '5 3' : null }));
    let tx = M.W / 2, anc = 'middle', max = M.W - 16;
    if (opz.foto) {
      const r = 22, cx = 10 + r, cy = M.H / 2;
      if (p.miniatura) {
        const clip = 'v' + (n++);
        // il cerchio di ritaglio è nelle coordinate della carta che lo usa
        defs.append(s('clipPath', { id: clip }, s('circle', { cx, cy, r })));
        const img = s('image', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, href: p.miniatura, preserveAspectRatio: 'xMidYMid slice',
          'clip-path': `url(#${clip})`, filter: opz.colori ? null : 'url(#grigio)' });
        img.setAttributeNS(XLINK_NS, 'xlink:href', p.miniatura);
        g.append(img);
      } else {
        g.append(s('circle', { cx, cy, r, fill: c.volto }),
          s('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: c.tenue }, iniziali(p)));
      }
      g.append(s('circle', { cx, cy, r, fill: 'none', stroke: c.bordo, 'stroke-width': 1.2 }));
      tx = 10 + 2 * r + 9; anc = 'start'; max = M.W - tx - 8;
    }
    const riga1 = taglia(p.nome || '?', 14, 700, max);
    const riga2 = p.cognome ? taglia(p.cognome, 13, 400, max) : '';
    // il luogo si aggiunge solo se ci sta per intero
    const conLuogo = [anniStampa(p), p.luogo_nascita].filter(Boolean).join(' · ');
    const riga3 = taglia(taglia(conLuogo, 11.5, 400, max) === conLuogo ? conLuogo : anniStampa(p) || p.luogo_nascita || '', 11.5, 400, max);
    g.append(s('text', { x: tx, y: riga2 ? 22 : 28, 'text-anchor': anc, 'font-size': 14, 'font-weight': 700, fill: c.testo }, riga1));
    if (riga2) g.append(s('text', { x: tx, y: 39, 'text-anchor': anc, 'font-size': 13, fill: c.testo }, riga2));
    if (riga3) g.append(s('text', { x: tx, y: riga2 ? 56 : 48, 'text-anchor': anc, 'font-size': 11.5, fill: c.tenue }, riga3));
    corpo.append(g);
  }
  if (!opz.colori) defs.append(s('filter', { id: 'grigio' }, s('feColorMatrix', { type: 'saturate', values: 0 })));
  return svg;
}

/* foglio orizzontale o verticale, quello in cui il disegno viene più grande */
function impaginazione(svg, foglio) {
  const [lungo, corto] = FOGLI[foglio];
  const w = +svg.getAttribute('width'), hh = +svg.getAttribute('height');
  const scala = (pw, ph) => Math.min((pw - 2 * MARGINE_MM) / w, (ph - 2 * MARGINE_MM) / hh);
  const oriz = scala(lungo, corto) >= scala(corto, lungo);
  const [pw, ph] = oriz ? [lungo, corto] : [corto, lungo];
  const mmPerPunto = scala(pw, ph);
  return { pw, ph, oriz, mmPerPunto, puntiNome: 14 * mmPerPunto * 72 / 25.4 };
}

/* ---------------------------------------------------------------- stampa e scarica */
function stampaSvg(svg, foglio) {
  const imp = impaginazione(svg, foglio);
  const stile = h('style', { id: 'stile-pagina' }, `@page { size: ${imp.pw}mm ${imp.ph}mm; margin: ${MARGINE_MM}mm; }
    #foglio-stampa { width: ${imp.pw - 2 * MARGINE_MM}mm; height: ${imp.ph - 2 * MARGINE_MM - 1}mm; }`);
  const copia = svg.cloneNode(true);
  copia.setAttribute('width', '100%'); copia.setAttribute('height', '100%');
  copia.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const foglioEl = h('div', { id: 'foglio-stampa' }, copia);
  document.head.append(stile);
  document.body.append(foglioEl);
  const pulisci = () => { stile.remove(); foglioEl.remove(); window.removeEventListener('afterprint', pulisci); };
  window.addEventListener('afterprint', pulisci);
  // le immagini dentro l'SVG devono essere pronte prima della stampa
  setTimeout(() => { window.print(); setTimeout(() => { if (document.body.contains(foglioEl) && !matchMedia('print').matches) pulisci(); }, 1500); }, 150);
}
function nomeFile(opz, est) {
  const fam = (stato.famiglia ? stato.famiglia.nome : 'Albero').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const chi = opz.chi !== 'tutti' && P(opz.id) ? ` - ${opz.chi} di ${nomeCompleto(P(opz.id))}` : '';
  return `Albero ${fam}${chi}.${est}`.replace(/\s+/g, ' ');
}
function scaricaSvg(svg, opz) {
  const testo = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([testo], { type: 'image/svg+xml' }));
  const a = h('a', { href: url, download: nomeFile(opz, 'svg') });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ================================================================ VISTA: STAMPA */
VISTE.stampa = vista => {
  const CHIAVE = PREFISSO + 'stampa';
  let opz = { chi: 'tutti', id: null, foglio: 'A3', direzione: 'auto', colori: true, foto: true };
  try { Object.assign(opz, JSON.parse(memoria.leggi(CHIAVE) || '{}')); } catch { /* valori normali */ }
  if (!opz.id || !stato.persone.has(opz.id)) opz.id = stato.centro && stato.persone.has(stato.centro) ? stato.centro : centroIniziale();
  if (!FOGLI[opz.foglio]) opz.foglio = 'A3';

  const scelta = (nome, titolo, voci, valore, cambia) => h('div', { class: 'campo' },
    h('span', { class: 'etichetta-campo' }, titolo),
    h('div', { class: 'scelta' }, voci.map(([v, t]) => h('label', null,
      h('input', { type: 'radio', name: nome, value: String(v), checked: v === valore, onchange: () => cambia(v) }), t))));

  const anteprima = h('div', { class: 'anteprima-stampa' });
  const nota = h('p', { class: 'piccolo-testo tenue' });
  const persona = h('div', { class: 'fila', style: 'gap:10px;align-items:center' });
  const opzioni = h('div', { class: 'spazio' });
  let svg = null;

  const aggiorna = () => {
    memoria.scrivi(CHIAVE, JSON.stringify(opz));
    svuota(persona);
    persona.hidden = opz.chi === 'tutti';
    if (!persona.hidden && P(opz.id)) persona.append(volto(P(opz.id), 34), h('strong', null, nomeCompleto(P(opz.id))),
      h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => scegliPersona('Da chi parte la stampa?', [], x => { opz.id = x; aggiorna(); }) }, 'Cambia persona'));
    svg = disegnaAlbero(opz);
    const imp = impaginazione(svg, opz.foglio);
    const foglioEl = h('div', { class: 'foglio', style: `aspect-ratio:${imp.pw}/${imp.ph}` });
    const copia = svg.cloneNode(true);
    copia.setAttribute('width', '100%'); copia.setAttribute('height', '100%');
    copia.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    foglioEl.append(copia);
    svuota(anteprima).append(foglioEl);
    const pt = imp.puntiNome;
    const verso = svg.getAttribute('data-direzione') === 'alto' ? 'generazioni dall’alto in basso' : 'generazioni da sinistra a destra';
    nota.textContent = `Foglio ${opz.foglio} ${imp.oriz ? 'orizzontale' : 'verticale'}, ${verso}. ` + (pt >= 7
      ? `I nomi vengono alti circa ${pt.toFixed(pt < 10 ? 1 : 0)} punti: si leggono bene.`
      : `Attenzione: i nomi verrebbero alti solo ${pt.toFixed(1)} punti, troppo piccoli. Scegli un foglio più grande` + (opz.chi === 'tutti' ? ' oppure stampa solo un ramo (discendenti o antenati di una persona).' : '.'));
    nota.style.color = pt >= 7 ? '' : 'var(--pericolo)';
  };

  opzioni.append(
    scelta('chi', 'Cosa stampare', [['tutti', 'Tutta la famiglia'], ['discendenti', 'I discendenti di una persona'], ['antenati', 'Gli antenati di una persona']], opz.chi, v => { opz.chi = v; aggiorna(); }),
    persona,
    scelta('foglio', 'Foglio', Object.keys(FOGLI).map(k => [k, k]), opz.foglio, v => { opz.foglio = v; aggiorna(); }),
    scelta('direzione', 'Disposizione', [['auto', 'La più leggibile'], ['alto', 'Dall’alto in basso'], ['sinistra', 'Da sinistra a destra']], opz.direzione, v => { opz.direzione = v; aggiorna(); }),
    h('div', { class: 'due-colonne' },
      scelta('colori', 'Colori', [[true, 'A colori'], [false, 'Bianco e nero']], opz.colori, v => { opz.colori = v; aggiorna(); }),
      scelta('foto', 'Foto', [[true, 'Con le foto'], [false, 'Senza foto']], opz.foto, v => { opz.foto = v; aggiorna(); })));

  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('h1', null, 'Stampa l’albero'),
    h('p', { class: 'tenue', style: 'margin:6px 0 14px' }, 'L’albero viene disegnato in vettoriale: resta nitido a qualunque grandezza, anche su un foglio grande da copisteria. Chi è in vita è in verde, chi non c’è più in grigio con la croce †.'),
    h('div', { class: 'riquadro spazio' }, opzioni),
    h('div', { class: 'riquadro', style: 'margin-top:14px' }, h('h3', { style: 'margin-bottom:8px' }, 'Anteprima'), anteprima, nota),
    h('div', { class: 'fila', style: 'margin-top:14px;gap:10px;flex-wrap:wrap' },
      h('button', { type: 'button', class: 'pulsante primario', onclick: () => stampaSvg(svg, opz.foglio) }, 'Stampa o salva in PDF'),
      h('button', { type: 'button', class: 'pulsante', onclick: () => scaricaSvg(svg, opz) }, 'Scarica il file SVG')),
    h('p', { class: 'tenue piccolo-testo', style: 'margin-top:10px' }, 'Per avere il PDF: premi “Stampa o salva in PDF” e come stampante scegli “Salva come PDF”. Nella finestra di stampa lascia la scala al 100% (o “Adatta”), senza intestazioni. Il file SVG si apre con Inkscape, Illustrator o si porta in copisteria.'));
  aggiorna();
};
