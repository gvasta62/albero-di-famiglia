/* =====================================================================
   Albero di famiglia - mappa della famiglia, in vettoriale (SVG).
   Luoghi di nascita oppure dove vivono oggi; frecce da genitore a figlio
   quando sono nati in posti diversi. Si stampa e si scarica come l'albero.
   Usa app.js e stampa.js (caricati prima).
   I luoghi si cercano su OpenStreetMap (Nominatim): si manda solo il nome
   del luogo, e la risposta resta memorizzata sul dispositivo.
   ===================================================================== */
'use strict';

const LIBRERIE_MAPPA = [
  'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js',
  'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js',
  'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'
];
const MONDO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const CHIAVE_LUOGHI = 'albero-luoghi-v1';   // memoria dei luoghi già cercati, comune a tutte le famiglie del dispositivo

/* ---------------------------------------------------------------- librerie e cartina del mondo */
const scriptCaricati = new Map();
function caricaScript(src) {
  if (!scriptCaricati.has(src)) scriptCaricati.set(src, new Promise((ok, ko) => {
    const el = document.createElement('script');
    el.src = src; el.onload = ok;
    el.onerror = () => { scriptCaricati.delete(src); ko(new Error('rete')); };
    document.head.append(el);
  }));
  return scriptCaricati.get(src);
}
let mondo = null;
async function preparaMondo() {
  if (mondo) return mondo;
  for (const src of LIBRERIE_MAPPA) await caricaScript(src);
  const r = await fetch(MONDO_URL);
  if (!r.ok) throw new Error('rete');
  const topo = await r.json();
  mondo = topojson.feature(topo, topo.objects.countries);
  return mondo;
}

/* ---------------------------------------------------------------- dal nome del luogo alle coordinate */
const normale = s => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const TIPI_ABITATO = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'quarter', 'neighbourhood', 'city_district', 'borough']);
function leggiLuoghi() { try { return JSON.parse(memoria.leggi(CHIAVE_LUOGHI) || '{}'); } catch { return {}; } }
function scriviLuoghi(c) { memoria.scrivi(CHIAVE_LUOGHI, JSON.stringify(c)); }
let ultimaRicerca = 0;
async function cercaLuogo(testo) {
  const k = normale(testo);
  const memo = leggiLuoghi();
  if (memo[k]) return memo[k];
  // OpenStreetMap chiede al massimo una richiesta al secondo
  const attesa = ultimaRicerca + 1100 - Date.now();
  if (attesa > 0) await new Promise(r => setTimeout(r, attesa));
  ultimaRicerca = Date.now();
  const r = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    format: 'jsonv2', limit: '8', 'accept-language': 'it', addressdetails: '1', q: testo.trim() }));
  if (!r.ok) throw new Error('rete');
  const lista = await r.json();
  // solo città e paesi; altrimenti un risultato che si chiami esattamente così (Tokyo è una "provincia").
  // Un nome scritto male non deve finire in un posto a caso: meglio "non trovato".
  const x = lista.find(y => TIPI_ABITATO.has(y.addresstype)) || lista.find(y => normale(y.name) === k);
  const a = (x && x.address) || {};
  const v = x ? { lat: +x.lat, lon: +x.lon, nome: x.name, dove: [a.state || a.county || '', a.country || ''].filter(Boolean).join(', ') } : { nessuno: true };
  const nuova = leggiLuoghi(); nuova[k] = v; scriviLuoghi(nuova);
  return v;
}
function scartaLuogo(testo) { const c = leggiLuoghi(); c[normale(testo)] = { nessuno: true, scartato: true }; scriviLuoghi(c); }
function dimenticaLuogo(testo) { const c = leggiLuoghi(); delete c[normale(testo)]; scriviLuoghi(c); }

/* ---------------------------------------------------------------- chi va sulla mappa */
function raccogliLuoghi(opz) {
  const campo = opz.cosa === 'residenza' ? 'residenza_citta' : 'luogo_nascita';
  const persone = [...personeDaStampare(opz)].map(P).filter(p => opz.cosa !== 'residenza' || !p.deceduto);
  const gruppi = new Map();
  for (const p of persone) {
    const t = (p[campo] || '').trim();
    if (!t) continue;
    const k = normale(t);
    if (!gruppi.has(k)) gruppi.set(k, { k, scritture: new Map(), persone: [] });
    const g = gruppi.get(k);
    g.persone.push(p);
    g.scritture.set(t, (g.scritture.get(t) || 0) + 1);
  }
  for (const g of gruppi.values()) {
    // si mostra la scrittura più usata, preferendo quella con la maiuscola
    g.testo = [...g.scritture].sort((a, b) => b[1] - a[1] || (/^\p{Lu}/u.test(b[0]) - /^\p{Lu}/u.test(a[0])))[0][0];
  }
  return { campo, persone, gruppi: [...gruppi.values()], senza: persone.filter(p => !(p[campo] || '').trim()) };
}

/* ---------------------------------------------------------------- disegno */
const distanzaKm = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const COLORI_MAPPA = {
  colori: { mare: '#dce9ef', terra: '#f6f3ec', confine: '#b9b09d', vivo: '#2f6b4f', defunto: '#9a8f7d', freccia: '#b0602a', testo: '#1e2620', tenue: '#5b665e' },
  bn: { mare: '#ffffff', terra: '#eeeeee', confine: '#999999', vivo: '#111111', defunto: '#9a9a9a', freccia: '#444444', testo: '#111111', tenue: '#444444' }
};

function disegnaMappa(opz, dati, geo) {
  const tav = COLORI_MAPPA[opz.colori ? 'colori' : 'bn'];
  // punti: luoghi trovati, uniti se cadono nello stesso posto
  const punti = [];
  for (const g of dati.gruppi) {
    const c = geo.get(g.k);
    if (!c || c.nessuno) continue;
    let pt = punti.find(x => distanzaKm(x, c) < 2);
    if (!pt) { pt = { lat: c.lat, lon: c.lon, nomi: [], persone: [] }; punti.push(pt); }
    pt.nomi.push(g.testo); pt.persone.push(...g.persone);
  }
  for (const pt of punti) {
    pt.etichetta = pt.nomi.join(' / ');
    pt.vivi = pt.persone.filter(p => !p.deceduto).length;
    pt.n = pt.persone.length;
  }
  punti.sort((a, b) => b.n - a.n);
  const puntoDi = new Map();
  for (const pt of punti) for (const p of pt.persone) puntoDi.set(p.id, pt);

  // frecce genitore -> figlio (solo luoghi di nascita), contate per coppia di luoghi
  const frecce = new Map();
  if (opz.cosa !== 'residenza' && opz.frecce) {
    for (const r of stato.relazioni) {
      if (r.tipo !== 'genitore') continue;
      const a = puntoDi.get(r.da), b = puntoDi.get(r.a);
      if (!a || !b || a === b) continue;
      const k = punti.indexOf(a) + '>' + punti.indexOf(b);
      if (!frecce.has(k)) frecce.set(k, { da: a, a: b, figli: new Set() });
      frecce.get(k).figli.add(r.a);
    }
  }

  // riquadri: tutto insieme, più uno "da vicino" se la famiglia è sparsa nel mondo
  const principale = punti[0];
  const vicini = principale ? punti.filter(p => distanzaKm(p, principale) < 700) : [];
  const riquadri = [];
  if (punti.length) {
    // il riquadro "da vicino" serve solo se qualcuno sta davvero lontano (altri continenti, nord Europa)
    const sparsi = vicini.length < punti.length && punti.some(p => distanzaKm(p, principale) > 2500);
    riquadri.push({ titolo: sparsi ? 'Nel mondo' : null, punti, mondo: sparsi });
    if (sparsi && vicini.length >= 2) riquadri.push({ titolo: 'Da vicino', punti: vicini, mondo: false });
  }

  const LARG = 1000, BORDO = 30, TESTA = 110, COLONNA = 300, RIGA = 16;
  const svg = s('svg', { xmlns: SVG_NS, 'xmlns:xlink': XLINK_NS, 'font-family': FONT });
  const defs = s('defs', null,
    s('marker', { id: 'punta', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' },
      s('path', { d: 'M0 0L10 5L0 10z', fill: tav.freccia })));
  svg.append(defs);
  const fondo = s('rect', { x: 0, y: 0, fill: '#ffffff' });
  svg.append(fondo);

  let y = BORDO + TESTA;
  const corpo = s('g');
  svg.append(corpo);
  riquadri.forEach((rq, i) => {
    const alto = disegnaRiquadro(corpo, rq, BORDO, y, LARG, tav, frecce, i);
    y += alto + 24;
  });
  if (!riquadri.length) {
    corpo.append(s('text', { x: BORDO + LARG / 2, y: y + 40, 'text-anchor': 'middle', 'font-size': 16, fill: tav.tenue },
      'Nessun luogo da mettere sulla mappa.'));
    y += 80;
  }
  const altoMappa = y - BORDO - TESTA;

  // elenco a destra: luoghi e persone, su più colonne se serve
  const elenco = [];
  for (const pt of punti) {
    elenco.push({ tipo: 'luogo', testo: `${pt.etichetta} (${pt.n})` });
    for (const p of ordina(pt.persone.map(x => x.id)).map(P)) elenco.push({ tipo: 'persona', p });
    elenco.push({ tipo: 'spazio' });
  }
  const perColonna = Math.max(20, Math.floor((altoMappa - 10) / RIGA));
  const colonne = Math.max(1, Math.ceil(elenco.length / perColonna));
  const xElenco = BORDO + LARG + 30;
  elenco.forEach((e, i) => {
    const x = xElenco + Math.floor(i / perColonna) * COLONNA, yy = BORDO + TESTA + 12 + (i % perColonna) * RIGA;
    if (e.tipo === 'luogo') corpo.append(s('text', { x, y: yy, 'font-size': 13, 'font-weight': 700, fill: tav.testo }, taglia(e.testo, 13, 700, COLONNA - 16)));
    else if (e.tipo === 'persona') {
      const t = nomeCompleto(e.p) + (e.p.deceduto ? ' †' : '') + (anno(e.p.data_nascita) ? ` (${anno(e.p.data_nascita)})` : '');
      corpo.append(s('text', { x: x + 10, y: yy, 'font-size': 12, fill: e.p.deceduto ? tav.defunto : tav.testo }, taglia(t, 12, 400, COLONNA - 26)));
    }
  });
  const W = xElenco + colonne * COLONNA + BORDO - 20;
  let H = Math.max(y, BORDO + TESTA + Math.min(elenco.length, perColonna) * RIGA + 20);

  // in fondo: chi non c'è sulla mappa
  const nonTrovati = dati.gruppi.filter(g => { const c = geo.get(g.k); return !c || c.nessuno; });
  const note = [];
  if (nonTrovati.length) note.push('Luoghi non riconosciuti: ' + nonTrovati.map(g => `${g.testo} (${g.persone.length})`).join(', ') + '.');
  if (dati.senza.length) note.push(`${dati.senza.length} ${dati.senza.length === 1 ? 'persona' : 'persone'} senza ${opz.cosa === 'residenza' ? 'città di residenza' : 'luogo di nascita'}.`);
  note.push('Cartina: Natural Earth. Luoghi: © OpenStreetMap.');
  note.forEach((t, i) => svg.append(s('text', { x: BORDO, y: H + 4 + i * 18, 'font-size': 12, fill: tav.tenue }, t)));
  H += note.length * 18 + BORDO - 4;

  // intestazione e legenda
  const fam = stato.famiglia ? stato.famiglia.nome : 'Albero di famiglia';
  const oggi = new Date();
  let sotto = opz.cosa === 'residenza' ? 'Dove vivono oggi' : 'Dove sono nati';
  if (opz.chi !== 'tutti' && P(opz.id)) sotto += (opz.chi === 'discendenti' ? ' · discendenti di ' : ' · antenati di ') + nomeCompleto(P(opz.id));
  sotto += ` · ${dati.persone.length - dati.senza.length} persone su ${punti.length} luoghi · aggiornato al ${oggi.getDate()} ${MESI[oggi.getMonth()]} ${oggi.getFullYear()}`;
  svg.append(s('text', { x: BORDO, y: BORDO + 30, 'font-family': FONT_TITOLO, 'font-size': 30, 'font-weight': 600, fill: tav.testo }, fam),
    s('text', { x: BORDO, y: BORDO + 56, 'font-size': 14, fill: tav.tenue }, sotto));
  const leg = s('g', { transform: `translate(${BORDO},${BORDO + 74})`, 'font-size': 13, fill: tav.testo });
  leg.append(s('circle', { cx: 8, cy: 0, r: 7, fill: tav.vivo }), s('text', { x: 22, y: 5 }, 'in vita'));
  if (opz.cosa !== 'residenza') {
    leg.append(s('circle', { cx: 98, cy: 0, r: 7, fill: tav.defunto }), s('text', { x: 112, y: 5 }, 'defunti'),
      s('text', { x: 190, y: 5, fill: tav.tenue }, 'il cerchio cresce con il numero di persone'));
    if (opz.frecce) leg.append(s('path', { d: 'M480 0H520', stroke: tav.freccia, 'stroke-width': 2, 'marker-end': 'url(#punta)' }),
      s('text', { x: 530, y: 5 }, 'dal luogo di nascita del genitore a quello del figlio'));
  } else leg.append(s('text', { x: 100, y: 5, fill: tav.tenue }, 'il cerchio cresce con il numero di persone'));
  svg.append(leg);

  fondo.setAttribute('width', W); fondo.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.datiMappa = { punti, nonTrovati };
  return svg;
}

function disegnaRiquadro(corpo, rq, x0, y0, larg, tav, frecce, n) {
  const pad = 46;
  const lats = rq.punti.map(p => p.lat), lons = rq.punti.map(p => p.lon);
  // si inquadra un po' più dei punti, e mai una zona troppo piccola
  const minimo = rq.mondo ? 30 : 3;
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2, cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const dLat = Math.max(Math.max(...lats) - Math.min(...lats), minimo * 0.6) / 2 * 1.15;
  const dLon = Math.max(Math.max(...lons) - Math.min(...lons), minimo) / 2 * 1.15;
  const box = { type: 'MultiPoint', coordinates: [[cLon - dLon, cLat - dLat], [cLon + dLon, cLat + dLat], [cLon - dLon, cLat + dLat], [cLon + dLon, cLat - dLat]] };
  const proj = rq.mondo ? d3.geoNaturalEarth1() : d3.geoMercator();
  const altoMax = rq.mondo ? 560 : 720;
  proj.fitExtent([[pad, pad], [larg - pad, altoMax - pad]], box);
  // altezza vera del riquadro: quanto serve ai punti (con un minimo)
  const angoli = box.coordinates.map(c => proj(c));
  const yMin = Math.min(...angoli.map(a => a[1])), yMax = Math.max(...angoli.map(a => a[1]));
  const alto = Math.max(300, Math.min(altoMax, yMax - yMin + 2 * pad));
  const [tx, ty] = proj.translate();
  proj.translate([tx, ty - (yMin - pad) + (alto - (yMax - yMin) - 2 * pad) / 2]);
  proj.clipExtent([[0, 0], [larg, alto]]);
  const percorso = d3.geoPath(proj);

  const g = s('g', { transform: `translate(${x0},${y0})` });
  const clip = 'riq' + n;
  g.append(s('clipPath', { id: clip }, s('rect', { x: 0, y: 0, width: larg, height: alto, rx: 10 })));
  const base = s('g', { 'clip-path': `url(#${clip})` });
  base.append(s('rect', { x: 0, y: 0, width: larg, height: alto, fill: tav.mare }));
  base.append(s('path', { d: percorso(mondo) || '', fill: tav.terra, stroke: tav.confine, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }));
  g.append(base, s('rect', { x: 0, y: 0, width: larg, height: alto, rx: 10, fill: 'none', stroke: tav.confine, 'stroke-width': 1 }));
  if (rq.titolo) g.append(s('text', { x: 14, y: 26, 'font-size': 15, 'font-weight': 700, fill: tav.testo }, rq.titolo));

  const xy = new Map(rq.punti.map(p => [p, proj([p.lon, p.lat])]));
  const raggio = p => 5 + 3.4 * Math.sqrt(p.n);

  // frecce (curve, con la punta che si ferma sul bordo del cerchio)
  const strato = s('g', { fill: 'none', stroke: tav.freccia, 'stroke-linecap': 'round', opacity: 0.85 });
  for (const f of frecce.values()) {
    if (!xy.has(f.da) || !xy.has(f.a)) continue;
    const [x1, y1] = xy.get(f.da), [x2, y2] = xy.get(f.a);
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
    if (l < 4) continue;
    const cx = (x1 + x2) / 2 - dy * 0.22, cy = (y1 + y2) / 2 + dx * 0.22;
    const fine = (px, py, qx, qy, r) => { const d = Math.hypot(qx - px, qy - py) || 1; return [px + (qx - px) * r / d, py + (qy - py) * r / d]; };
    const [ax, ay] = fine(x1, y1, cx, cy, raggio(f.da) + 2), [bx, by] = fine(x2, y2, cx, cy, raggio(f.a) + 3);
    strato.append(s('path', { d: `M${ax} ${ay}Q${cx} ${cy} ${bx} ${by}`, 'stroke-width': 1.3 + 0.7 * Math.min(f.figli.size, 6), 'marker-end': 'url(#punta)' }));
  }
  g.append(strato);

  // cerchi: verde per chi è in vita, grigio per i defunti (a spicchio)
  const cerchi = s('g');
  for (const p of rq.punti) {
    const [x, y] = xy.get(p), r = raggio(p);
    const frazione = p.n ? p.vivi / p.n : 1;
    if (frazione >= 1 || frazione <= 0) cerchi.append(s('circle', { cx: x, cy: y, r, fill: frazione > 0 ? tav.vivo : tav.defunto, stroke: '#fff', 'stroke-width': 1.5 }));
    else {
      const a = 2 * Math.PI * frazione, ex = x + r * Math.sin(a), ey = y - r * Math.cos(a);
      cerchi.append(s('circle', { cx: x, cy: y, r, fill: tav.defunto }),
        s('path', { d: `M${x} ${y}L${x} ${y - r}A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${ex} ${ey}Z`, fill: tav.vivo }),
        s('circle', { cx: x, cy: y, r, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }));
    }
  }
  g.append(cerchi);

  // etichette: si prova attorno al cerchio, la prima posizione che non si sovrappone; se serve, con una lineetta
  const occupati = rq.punti.map(p => { const [x, y] = xy.get(p), r = raggio(p); return [x - r, y - r, x + r, y + r]; });
  const sovrapposto = b => b[0] < 4 || b[2] > larg - 4 || b[1] < (rq.titolo ? 34 : 4) || b[3] > alto - 4 ||
    occupati.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  if (!misuratore) misuratore = document.createElement('canvas').getContext('2d');
  const etichette = s('g', { 'font-size': 13, fill: tav.testo });
  for (const p of rq.punti) {
    const [x, y] = xy.get(p), r = raggio(p);
    const testo = `${p.etichetta} ${p.n}`;
    misuratore.font = '600 13px Arial, sans-serif';
    const w = misuratore.measureText(testo).width + 6, h = 16;
    let scelta = null;
    for (const dist of [r + 4, r + 18, r + 34, r + 54]) {
      for (const ang of [0, 180, -90, 90, -35, 35, -145, 145]) {
        const rad = ang * Math.PI / 180, ax = x + Math.cos(rad) * dist, ay = y + Math.sin(rad) * dist;
        const bx = Math.cos(rad) > 0.3 ? ax : Math.cos(rad) < -0.3 ? ax - w : ax - w / 2;
        const by = Math.sin(rad) > 0.3 ? ay : Math.sin(rad) < -0.3 ? ay - h : ay - h / 2;
        const b = [bx, by, bx + w, by + h];
        if (!sovrapposto(b)) { scelta = { b, ax, ay, lontana: dist > r + 10 }; break; }
      }
      if (scelta) break;
    }
    if (!scelta) { const b = [x + r + 4, y - h / 2, x + r + 4 + w, y + h / 2]; scelta = { b, ax: b[0], ay: y, lontana: false }; }
    occupati.push(scelta.b);
    if (scelta.lontana) etichette.append(s('line', { x1: x, y1: y, x2: scelta.ax, y2: scelta.ay, stroke: tav.tenue, 'stroke-width': 0.8 }));
    etichette.append(s('rect', { x: scelta.b[0], y: scelta.b[1], width: w, height: h, rx: 3, fill: '#ffffff', opacity: 0.8 }),
      s('text', { x: scelta.b[0] + 3, y: scelta.b[1] + 12.5 }, s('tspan', { 'font-weight': 600 }, p.etichetta), s('tspan', { fill: tav.tenue }, ' ' + p.n)));
  }
  g.append(etichette);
  corpo.append(g);
  return alto;
}

/* ================================================================ VISTA: MAPPA */
VISTE.mappa = vista => {
  const CHIAVE = PREFISSO + 'mappa';
  const opz = { cosa: 'nascita', chi: 'tutti', id: null, foglio: 'A3', colori: true, frecce: true };
  try { Object.assign(opz, JSON.parse(memoria.leggi(CHIAVE) || '{}')); } catch { /* valori normali */ }
  if (!opz.id || !stato.persone.has(opz.id)) opz.id = stato.centro && stato.persone.has(stato.centro) ? stato.centro : centroIniziale();
  if (!FOGLI[opz.foglio]) opz.foglio = 'A3';

  const scelta = (nome, titolo, voci, valore, cambia) => h('div', { class: 'campo' },
    h('span', { class: 'etichetta-campo' }, titolo),
    h('div', { class: 'scelta' }, voci.map(([v, t]) => h('label', null,
      h('input', { type: 'radio', name: nome, value: String(v), checked: v === valore, onchange: () => cambia(v) }), t))));
  const anteprima = h('div', { class: 'anteprima-stampa' }, h('p', { class: 'tenue' }, 'Preparo la cartina…'));
  const nota = h('p', { class: 'piccolo-testo tenue' });
  const persona = h('div', { class: 'fila', style: 'gap:10px;align-items:center' });
  const controlli = h('div', { class: 'spazio' });
  const boxFrecce = h('div');
  let svg = null, giro = 0;

  const aggiorna = async () => {
    const mio = ++giro;
    memoria.scrivi(CHIAVE, JSON.stringify(opz));
    svuota(persona);
    persona.hidden = opz.chi === 'tutti';
    if (!persona.hidden && P(opz.id)) persona.append(volto(P(opz.id), 34), h('strong', null, nomeCompleto(P(opz.id))),
      h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => scegliPersona('Di chi vuoi la mappa?', [], x => { opz.id = x; aggiorna(); }) }, 'Cambia persona'));
    boxFrecce.hidden = opz.cosa === 'residenza';

    const dati = raccogliLuoghi(opz);
    const geo = new Map();
    let errore = null;
    const stato_ = h('p', { class: 'tenue' }, 'Preparo la cartina…');
    svuota(anteprima).append(stato_);
    try {
      await conAttesa((async () => {
        await preparaMondo();
        let fatti = 0;
        for (const g of dati.gruppi) {
          if (mio !== giro) return;
          if (!leggiLuoghi()[g.k]) stato_.textContent = `Cerco i luoghi sulla cartina: ${fatti + 1} di ${dati.gruppi.length}…`;
          try { geo.set(g.k, await cercaLuogo(g.testo)); } catch (e) { errore = e; }
          fatti++;
        }
      })());
    } catch (e) {
      svuota(anteprima).append(h('p', null, 'Non riesco a caricare la cartina: controlla la connessione e riprova.'));
      return;
    }
    if (mio !== giro) return;
    svg = disegnaMappa(opz, dati, geo);
    const imp = impaginazione(svg, opz.foglio);
    const foglioEl = h('div', { class: 'foglio', style: `aspect-ratio:${imp.pw}/${imp.ph}` });
    const copia = svg.cloneNode(true);
    copia.setAttribute('width', '100%'); copia.setAttribute('height', '100%');
    copia.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    foglioEl.append(copia);
    svuota(anteprima).append(foglioEl);
    nota.textContent = `Foglio ${opz.foglio} ${imp.oriz ? 'orizzontale' : 'verticale'}.` + (errore ? ' Alcuni luoghi non si sono potuti cercare (connessione): riprova più tardi.' : '');
    disegnaControlli(dati, geo, svg.datiMappa);
  };

  // sotto la cartina: cosa non è stato trovato e come è stato riconosciuto il resto
  const disegnaControlli = (dati, geo, dm) => {
    svuota(controlli);
    const chip = p => h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => vai({ v: 'scheda', id: p.id }) }, nomeCompleto(p));
    if (dm.nonTrovati.length) {
      controlli.append(h('div', { class: 'riquadro' }, h('h2', null, 'Luoghi da correggere'),
        h('p', { class: 'tenue piccolo-testo', style: 'margin:4px 0 10px' }, 'Questi nomi non corrispondono a nessuna città o paese: forse sono scritti male. Apri la scheda della persona, tocca Modifica e correggi il luogo.'),
        dm.nonTrovati.map(g => h('div', { class: 'differenza' }, h('div', { class: 'testo' }, h('strong', null, '«' + g.testo + '»'),
          h('div', { class: 'fila', style: 'gap:6px;flex-wrap:wrap;margin-top:6px' }, g.persone.map(chip)))))));
    }
    const trovati = dati.gruppi.filter(g => geo.get(g.k) && !geo.get(g.k).nessuno);
    if (trovati.length) {
      controlli.append(h('div', { class: 'riquadro' }, h('h2', null, 'Come ho riconosciuto i luoghi'),
        h('p', { class: 'tenue piccolo-testo', style: 'margin:4px 0 10px' }, 'Se un luogo è finito nel posto sbagliato, tocca “Non è questo”: sparisce dalla mappa e va tra quelli da correggere.'),
        trovati.map(g => { const c = geo.get(g.k); const diverso = normale(c.nome) !== g.k;
          return h('div', { class: 'differenza' }, h('div', { class: 'testo' },
            h('strong', null, g.testo), ' → ', c.nome + (c.dove ? ', ' + c.dove : ''),
            diverso ? h('div', { class: 'piccolo-testo', style: 'color:var(--attenzione)' }, 'Nome diverso da quello scritto: controlla.') : null,
            h('div', { class: 'tenue piccolo-testo' }, g.persone.length + (g.persone.length === 1 ? ' persona' : ' persone'))),
            h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => { scartaLuogo(g.testo); aggiorna(); } }, 'Non è questo')); })));
    }
    const scartati = dati.gruppi.filter(g => geo.get(g.k) && geo.get(g.k).scartato);
    if (scartati.length) controlli.append(h('p', { class: 'tenue piccolo-testo' }, 'Scartati da te: ', scartati.map(g => [g.testo, ' ',
      h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => { dimenticaLuogo(g.testo); aggiorna(); } }, 'cerca di nuovo'), ' '])));
  };

  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('h1', null, 'Mappa della famiglia'),
    h('p', { class: 'tenue', style: 'margin:6px 0 14px' }, 'Dove sono nati o dove vivono oggi, su una cartina vettoriale da stampare o salvare in PDF. Il cerchio è più grande dove ci sono più persone: verde chi è in vita, grigio chi non c’è più.'),
    h('div', { class: 'riquadro spazio' },
      scelta('cosa', 'Cosa mostrare', [['nascita', 'Dove sono nati'], ['residenza', 'Dove vivono oggi']], opz.cosa, v => { opz.cosa = v; aggiorna(); }),
      scelta('chi-m', 'Chi', [['tutti', 'Tutta la famiglia'], ['discendenti', 'I discendenti di una persona'], ['antenati', 'Gli antenati di una persona']], opz.chi, v => { opz.chi = v; aggiorna(); }),
      persona,
      scelta('foglio-m', 'Foglio', Object.keys(FOGLI).map(k => [k, k]), opz.foglio, v => { opz.foglio = v; aggiorna(); }),
      h('div', { class: 'due-colonne' },
        scelta('colori-m', 'Colori', [[true, 'A colori'], [false, 'Bianco e nero']], opz.colori, v => { opz.colori = v; aggiorna(); }),
        boxFrecce)),
    h('div', { class: 'riquadro', style: 'margin-top:14px' }, h('h3', { style: 'margin-bottom:8px' }, 'Anteprima'), anteprima, nota),
    h('div', { class: 'fila', style: 'margin-top:14px;gap:10px;flex-wrap:wrap' },
      h('button', { type: 'button', class: 'pulsante primario', onclick: () => svg && stampaSvg(svg, opz.foglio) }, 'Stampa o salva in PDF'),
      h('button', { type: 'button', class: 'pulsante', onclick: () => svg && scaricaSvg(svg, opz, 'Mappa') }, 'Scarica il file SVG')),
    h('div', { class: 'spazio', style: 'margin-top:14px' }, controlli),
    h('p', { class: 'tenue piccolo-testo', style: 'margin-top:10px' }, 'Per trovare i luoghi sulla cartina l’app chiede a OpenStreetMap solo il nome del paese o della città, mai i nomi delle persone. La risposta resta salvata su questo dispositivo.'));
  boxFrecce.append(scelta('frecce', 'Frecce genitore → figlio', [[true, 'Sì'], [false, 'No']], opz.frecce, v => { opz.frecce = v; aggiorna(); }));
  aggiorna();
};
