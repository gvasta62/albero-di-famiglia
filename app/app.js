/* =====================================================================
   Albero di famiglia - logica dell'app (nessuna compilazione necessaria)
   Collegamenti:  #k=<chiave>  famiglia (familiare o referente)
                  #g=<chiave>  pagina del gestore
   ===================================================================== */
'use strict';

const CFG = window.ALBERO_CONFIG || {};
const IN_PROVA = !CFG.supabaseUrl || /[?&]prova\b/.test(location.search);

/* ---------------------------------------------------------------- memoria del dispositivo */
const memoria = {
  leggi(k) { try { return localStorage.getItem(k); } catch { return null; } },
  scrivi(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* niente */ } }
};
const PREFISSO = IN_PROVA ? 'albero-prova-' : 'albero-';

/* ---------------------------------------------------------------- piccoli attrezzi */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of figli.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
const svuota = el => { while (el.firstChild) el.firstChild.remove(); return el; };

let attese = 0;
async function conAttesa(promessa) {
  attese++; $('#caricamento').classList.add('attivo');
  try { return await promessa; }
  finally { if (--attese === 0) $('#caricamento').classList.remove('attivo'); }
}

let timerAvviso;
function avvisa(testo, errore = false) {
  const el = $('#avviso');
  el.textContent = testo;
  el.className = 'avviso visibile' + (errore ? ' errore' : '');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => { el.className = 'avviso'; }, errore ? 6000 : 3000);
}

const MESSAGGI = {
  chiave_non_valida: 'Il link non è valido oppure è stato cambiato. Chiedi un link nuovo a chi gestisce l’albero.',
  nome_mancante: 'Manca il nome.',
  foto_non_valida: 'La foto non è in un formato valido.',
  persona_non_trovata: 'Questa persona non c’è più: forse l’ha appena eliminata qualcun altro.',
  legame_circolare: 'Non si può: risulta già il contrario (questa persona è figlia dell’altra).',
  stessa_persona: 'Non si può collegare una persona a se stessa.',
  legame_non_trovato: 'Questo legame non c’è più.',
  non_annullabile: 'Questa modifica non si può annullare.',
  serve_referente: 'Questa operazione può farla solo il referente della famiglia.',
  copia_non_trovata: 'Questa copia non è più disponibile.',
  conferma_errata: 'Il nome scritto non corrisponde: non è stato eliminato nulla.',
  famiglia_non_trovata: 'Famiglia non trovata.',
  check_constraint: 'Un dato non è scritto nel formato giusto (per esempio una data). Controlla e riprova.',
  rete: 'Nessuna connessione, oppure il servizio non risponde. Riprova tra poco.'
};
function messaggioErrore(e) {
  const m = String((e && e.message) || e || '');
  for (const k of Object.keys(MESSAGGI)) if (m.replace(/ /g, '_').includes(k)) return MESSAGGI[k];
  return 'Qualcosa non ha funzionato. Riprova. (' + m.slice(0, 120) + ')';
}

/* ---------------------------------------------------------------- date in italiano */
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const due = n => String(n).padStart(2, '0');
function dataValida(a, m, g) { const d = new Date(Date.UTC(a, m - 1, g)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g; }
function oggiIso() { const d = new Date(); return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`; }
/** "12/5/1948" -> "1948-05-12";  "5/1948" -> "1948-05";  "1948" -> "1948";  "" -> "";  altrimenti null */
function leggiData(s) {
  s = (s || '').trim();
  if (!s) return '';
  let m;
  const annoOk = a => a >= 1000 && a <= new Date().getFullYear();
  if ((m = s.match(/^(\d{1,2})\s*[\/.\- ]\s*(\d{1,2})\s*[\/.\- ]\s*(\d{4})$/))) {
    const g = +m[1], me = +m[2], a = +m[3];
    return annoOk(a) && dataValida(a, me, g) ? `${a}-${due(me)}-${due(g)}` : null;
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    const a = +m[1], me = +m[2], g = +m[3];
    return annoOk(a) && dataValida(a, me, g) ? s : null;
  }
  if ((m = s.match(/^(\d{1,2})\s*[\/.\- ]\s*(\d{4})$/))) {
    const me = +m[1], a = +m[2];
    return annoOk(a) && me >= 1 && me <= 12 ? `${a}-${due(me)}` : null;
  }
  if ((m = s.match(/^(\d{4})$/))) return annoOk(+m[1]) ? m[1] : null;
  return null;
}
function scriviData(v) {
  if (!v) return '';
  const [a, m, g] = v.split('-');
  if (g) return `${+g} ${MESI[+m - 1]} ${a}`;
  if (m) return `${MESI[+m - 1]} ${a}`;
  return a;
}
function dataPerModulo(v) {
  if (!v) return '';
  const [a, m, g] = v.split('-');
  return g ? `${g}/${m}/${a}` : m ? `${m}/${a}` : a;
}
const anno = v => (v || '').slice(0, 4);
function eta(p) {
  const n = p.data_nascita;
  const f = p.deceduto ? p.data_morte : oggiIso();
  if (!n || !f) return null;
  const [a1, m1, g1] = n.split('-').map(Number);
  const [a2, m2, g2] = f.split('-').map(Number);
  if (g1 && g2) {
    let e = a2 - a1;
    if (m2 < m1 || (m2 === m1 && g2 < g1)) e--;
    return { anni: e, circa: false };
  }
  return { anni: a2 - a1, circa: true };
}
function quando(iso) {
  const d = new Date(iso);
  const ora = `${due(d.getHours())}:${due(d.getMinutes())}`;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const giorno = new Date(d); giorno.setHours(0, 0, 0, 0);
  const diff = Math.round((oggi - giorno) / 86400000);
  if (diff === 0) return { giorno: 'Oggi', ora };
  if (diff === 1) return { giorno: 'Ieri', ora };
  return { giorno: `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`, ora };
}
function giornoEsteso(iso) {
  const [a, m, g] = iso.slice(0, 10).split('-').map(Number);
  const d = new Date(a, m - 1, g);
  return `${GIORNI[d.getDay()]} ${g} ${MESI[m - 1]} ${a}`;
}
const maiuscola = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ---------------------------------------------------------------- collegamento al database */
function backendRemoto(chiave) {
  async function rpc(fn, args = {}) {
    let r;
    try {
      r = await fetch(`${CFG.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ p_chiave: chiave, ...args })
      });
    } catch { throw new Error('rete'); }
    const testo = await r.text();
    let dati = null;
    try { dati = testo ? JSON.parse(testo) : null; } catch { dati = testo; }
    if (!r.ok) throw new Error((dati && dati.message) || ('errore ' + r.status));
    return dati;
  }
  return creaApi(rpc);
}
/** stessa interfaccia per il database vero e per quello di prova */
function creaApi(rpc) {
  const chi = () => stato.chi || '';
  return {
    carica: () => rpc('albero_carica'),
    foto: id => rpc('albero_foto', { p_foto_id: id }),
    salvaPersona: (p, foto, mini) => rpc('albero_salva_persona', { p_chi: chi(), p_persona: p, p_foto: foto, p_miniatura: mini }),
    eliminaPersona: id => rpc('albero_elimina_persona', { p_chi: chi(), p_id: id }),
    salvaRelazione: (tipo, da, a, dettaglio = '') => rpc('albero_salva_relazione', { p_chi: chi(), p_tipo: tipo, p_da: da, p_a: a, p_dettaglio: dettaglio }),
    eliminaRelazione: id => rpc('albero_elimina_relazione', { p_chi: chi(), p_id: id }),
    registro: () => rpc('albero_registro'),
    annulla: id => rpc('albero_ripristina', { p_chi: chi(), p_id: id }),
    copie: () => rpc('albero_copie'),
    copia: id => rpc('albero_copia', { p_copia_id: id }),
    ripristinaPersona: (copia, persona) => rpc('albero_ripristina_persona', { p_chi: chi(), p_copia_id: copia, p_persona_id: persona }),
    ripristinaCopia: copia => rpc('albero_ripristina_copia', { p_chi: chi(), p_copia_id: copia }),
    rinomina: nome => rpc('albero_rinomina', { p_nome: nome }),
    nuovoInvito: () => rpc('albero_nuovo_invito'),
    // gestore
    famiglie: () => rpc('gestore_famiglie'),
    creaFamiglia: nome => rpc('gestore_crea_famiglia', { p_nome: nome }),
    nuovoReferente: id => rpc('gestore_nuovo_referente', { p_famiglia: id }),
    eliminaFamiglia: (id, conferma) => rpc('gestore_elimina_famiglia', { p_famiglia: id, p_conferma: conferma })
  };
}
window.creaApi = creaApi;

/* ---------------------------------------------------------------- stato */
const stato = {
  modo: null,            // 'famiglia' | 'gestore'
  chiave: null,
  api: null,
  chi: memoria.leggi(PREFISSO + 'chi') || '',
  famiglia: null, ruolo: 'familiare', invito: null,
  persone: new Map(), relazioni: [],
  genitori: new Map(), figli: new Map(), coppie: new Map(),
  foto: new Map(),       // cache foto grandi
  centro: null
};

function indicizza(dati) {
  stato.famiglia = dati.famiglia;
  stato.ruolo = dati.ruolo;
  stato.invito = dati.invito || (dati.ruolo === 'familiare' ? stato.chiave : null);
  stato.persone = new Map(dati.persone.map(p => [p.id, p]));
  stato.relazioni = dati.relazioni;
  stato.genitori = new Map(); stato.figli = new Map(); stato.coppie = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const r of dati.relazioni) {
    if (!stato.persone.has(r.da) || !stato.persone.has(r.a)) continue;
    if (r.tipo === 'genitore') { add(stato.genitori, r.a, r.da); add(stato.figli, r.da, r.a); }
    else { add(stato.coppie, r.da, { id: r.a, rel: r }); add(stato.coppie, r.a, { id: r.da, rel: r }); }
  }
  $('#nome-famiglia').textContent = stato.famiglia ? stato.famiglia.nome : 'Albero di famiglia';
  $('#sottotitolo').textContent = `${stato.persone.size} ${stato.persone.size === 1 ? 'persona' : 'persone'}` + (stato.ruolo === 'referente' ? ' · sei il referente' : '');
}
async function ricarica() {
  indicizza(await conAttesa(stato.api.carica()));
}

/* ---------------------------------------------------------------- parentele */
const P = id => stato.persone.get(id);
function ordina(ids) {
  return [...new Set(ids)].filter(id => stato.persone.has(id)).sort((x, y) => {
    const a = P(x), b = P(y);
    const da = a.data_nascita || '9999', db = b.data_nascita || '9999';
    return da < db ? -1 : da > db ? 1 : (a.nome + a.cognome).localeCompare(b.nome + b.cognome, 'it');
  });
}
const genitoriDi = id => ordina(stato.genitori.get(id) || []);
const figliDi = id => ordina(stato.figli.get(id) || []);
const coppieDi = id => (stato.coppie.get(id) || []).filter(c => stato.persone.has(c.id));
const coniugiDi = id => ordina(coppieDi(id).map(c => c.id));
const fratelliDi = id => ordina(genitoriDi(id).flatMap(figliDi)).filter(x => x !== id);
const nonniDi = id => ordina(genitoriDi(id).flatMap(genitoriDi));
const bisnonniDi = id => ordina(nonniDi(id).flatMap(genitoriDi));
const nipotiDi = id => ordina(figliDi(id).flatMap(figliDi));
const pronipotiDi = id => ordina(nipotiDi(id).flatMap(figliDi));
const ziiDi = id => ordina(genitoriDi(id).flatMap(fratelliDi));
const cuginiDi = id => ordina(ziiDi(id).flatMap(figliDi));
const nipotiFratelliDi = id => ordina(fratelliDi(id).flatMap(figliDi));
const suoceriDi = id => ordina(coniugiDi(id).flatMap(genitoriDi));
const cognatiDi = id => ordina([...coniugiDi(id).flatMap(fratelliDi), ...fratelliDi(id).flatMap(coniugiDi)]).filter(x => x !== id);
const generiDi = id => ordina(figliDi(id).flatMap(coniugiDi));
function relCoppia(a, b) { const c = coppieDi(a).find(x => x.id === b); return c ? c.rel : null; }

function genere(p, m, f, n) { return p.sesso === 'M' ? m : p.sesso === 'F' ? f : n; }
function nomeCompleto(p) { return (p.nome + ' ' + (p.cognome || '')).trim(); }
function etichettaCoppia(p, rel) {
  const s = rel ? rel.dettaglio : '';
  if (s === 'conviventi') return genere(p, 'Compagno', 'Compagna', 'Compagno/a');
  if (s === 'separati') return genere(p, 'Ex marito', 'Ex moglie', 'Ex coniuge');
  return genere(p, 'Marito', 'Moglie', 'Coniuge');
}
const GRUPPI = [
  { k: 'genitori', titolo: 'Genitori', f: genitoriDi, et: p => genere(p, 'Padre', 'Madre', 'Genitore') },
  { k: 'coniugi', titolo: 'Coniuge o compagno', f: coniugiDi, et: (p, id) => etichettaCoppia(p, relCoppia(id, p.id)) },
  { k: 'figli', titolo: 'Figli', f: figliDi, et: p => genere(p, 'Figlio', 'Figlia', 'Figlio/a') },
  { k: 'fratelli', titolo: 'Fratelli e sorelle', f: fratelliDi, et: p => genere(p, 'Fratello', 'Sorella', 'Fratello/sorella') },
  { k: 'nonni', titolo: 'Nonni', f: nonniDi, et: p => genere(p, 'Nonno', 'Nonna', 'Nonno/a') },
  { k: 'nipoti', titolo: 'Nipoti (figli dei figli)', f: nipotiDi, et: () => 'Nipote' },
  { k: 'bisnonni', titolo: 'Bisnonni', f: bisnonniDi, et: p => genere(p, 'Bisnonno', 'Bisnonna', 'Bisnonno/a') },
  { k: 'pronipoti', titolo: 'Pronipoti', f: pronipotiDi, et: () => 'Pronipote' },
  { k: 'zii', titolo: 'Zii', f: ziiDi, et: p => genere(p, 'Zio', 'Zia', 'Zio/a') },
  { k: 'cugini', titolo: 'Cugini', f: cuginiDi, et: p => genere(p, 'Cugino', 'Cugina', 'Cugino/a') },
  { k: 'nipotiF', titolo: 'Nipoti (figli di fratelli e sorelle)', f: nipotiFratelliDi, et: () => 'Nipote' },
  { k: 'suoceri', titolo: 'Suoceri', f: suoceriDi, et: p => genere(p, 'Suocero', 'Suocera', 'Suocero/a') },
  { k: 'cognati', titolo: 'Cognati', f: cognatiDi, et: p => genere(p, 'Cognato', 'Cognata', 'Cognato/a') },
  { k: 'generi', titolo: 'Generi e nuore', f: generiDi, et: p => genere(p, 'Genero', 'Nuora', 'Genero/nuora') }
];

function anniBreve(p) {
  const n = anno(p.data_nascita), m = anno(p.data_morte);
  if (p.deceduto) return `${n || '?'} – ${m || '?'}`;
  return n ? `n. ${n}` : '';
}

/* ---------------------------------------------------------------- volti e carte */
function iniziali(p) { return ((p.nome || '?')[0] + ((p.cognome || '')[0] || '')).toUpperCase(); }
function volto(p, dim) {
  const el = h('span', { class: 'volto', style: `width:${dim}px;height:${dim}px;font-size:${Math.round(dim * .38)}px`, 'aria-hidden': 'true' });
  if (p.miniatura) el.append(h('img', { src: p.miniatura, alt: '' }));
  else el.textContent = iniziali(p);
  return el;
}
function cartaPersona(p, { centro = false, ruolo = null } = {}) {
  return h('button', {
    type: 'button',
    class: 'carta-persona' + (centro ? ' centro' : '') + (p.deceduto ? ' defunto' : ''),
    onclick: () => centro ? vai({ v: 'scheda', id: p.id }) : vai({ v: 'albero', id: p.id }),
    'aria-label': nomeCompleto(p) + (centro ? ': apri la scheda' : ': metti al centro')
  },
  ruolo ? h('span', { class: 'ruolo' }, ruolo) : null,
  volto(p, centro ? 96 : 64),
  h('span', { class: 'nome' }, p.nome),
  p.cognome ? h('span', { class: 'cognome' }, p.cognome) : null,
  h('span', { class: 'anni' }, anniBreve(p)));
}
function cartaMancante(testo, azione) {
  return h('button', { type: 'button', class: 'carta-persona mancante', onclick: azione },
    h('span', { class: 'piu', 'aria-hidden': 'true' }, '+'), testo);
}
function gettone(p, grado) {
  return h('button', { type: 'button', class: 'gettone', onclick: () => vai({ v: 'scheda', id: p.id }) },
    volto(p, 34), h('span', null, h('span', { class: 'grado' }, grado), h('span', { class: 'chi' }, nomeCompleto(p))));
}

/* ---------------------------------------------------------------- navigazione */
const VISTE = {};
function vai(s, sostituisci = false) {
  chiudiTutteLeFinestre();
  if (sostituisci) history.replaceState(s, '');
  else history.pushState(s, '');
  disegna(s);
}
window.addEventListener('popstate', e => { chiudiTutteLeFinestre(); disegna(e.state || { v: stato.modo === 'gestore' ? 'gestore' : 'albero' }); });
function disegna(s) {
  const vista = $('#vista');
  svuota(vista);
  const gruppo = { albero: 'albero', persone: 'persone', scheda: 'persone', modifica: 'persone', novita: 'novita' }[s.v] || 'altro';
  document.querySelectorAll('.schede button').forEach(b => b.classList.toggle('attiva', b.dataset.vista === gruppo));
  try { (VISTE[s.v] || VISTE.albero)(vista, s); }
  catch (e) { console.error(e); vista.append(h('p', null, messaggioErrore(e))); }
  window.scrollTo(0, 0);
}
document.querySelectorAll('.schede button').forEach(b => b.addEventListener('click', () => vai({ v: b.dataset.vista })));

/* ---------------------------------------------------------------- finestre */
function apriFinestra(titolo, corpo, piede) {
  const contenitore = $('#finestre');
  const velo = h('div', { class: 'velo' });
  const chiudi = () => { velo.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') chiudi(); };
  document.addEventListener('keydown', esc);
  velo.addEventListener('click', e => { if (e.target === velo) chiudi(); });
  const finestra = h('div', { class: 'finestra', role: 'dialog', 'aria-modal': 'true', 'aria-label': titolo },
    h('div', { class: 'finestra-testa' }, h('h2', null, titolo), h('button', { type: 'button', class: 'chiudi', onclick: chiudi }, 'Chiudi')),
    h('div', { class: 'finestra-corpo' }, corpo),
    piede ? h('div', { class: 'finestra-piede' }, piede) : null);
  velo.append(finestra);
  contenitore.append(velo);
  const primo = finestra.querySelector('input, select, textarea');
  if (primo && matchMedia('(pointer: fine)').matches) primo.focus();
  return chiudi;
}
function chiudiTutteLeFinestre() { svuota($('#finestre')); }
function conferma(titolo, testo, siTesto = 'Sì, procedi', pericolo = false) {
  return new Promise(ok => {
    let fatto = false;
    const chiudi = apriFinestra(titolo, h('p', null, testo), [
      h('button', { type: 'button', class: 'pulsante', onclick: () => { fatto = true; chiudi(); ok(false); } }, 'No, lascia stare'),
      h('button', { type: 'button', class: 'pulsante ' + (pericolo ? 'pericolo-pieno' : 'primario'), onclick: () => { fatto = true; chiudi(); ok(true); } }, siTesto)
    ]);
    const osserva = new MutationObserver(() => { if (!fatto && !document.contains($('#finestre .velo'))) { osserva.disconnect(); ok(false); } });
    osserva.observe($('#finestre'), { childList: true });
  });
}

/* ---------------------------------------------------------------- chi sei */
function aggiornaChiSono() {
  const b = $('#chi-sono');
  b.hidden = stato.modo !== 'famiglia';
  b.textContent = stato.chi ? 'Sei: ' + stato.chi : 'Chi sei?';
}
$('#chi-sono').addEventListener('click', () => chiediNome());
function chiediNome(poi) {
  const campo = h('input', { type: 'text', id: 'campo-chi', value: stato.chi, maxlength: 60, autocomplete: 'name', placeholder: 'es. Marco Rossi' });
  const salva = () => {
    const v = campo.value.trim();
    if (!v) { campo.focus(); return; }
    stato.chi = v; memoria.scrivi(PREFISSO + 'chi', v); aggiornaChiSono(); chiudi();
    if (poi) poi();
  };
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') salva(); });
  const chiudi = apriFinestra('Come ti chiami?', h('div', { class: 'modulo' },
    h('p', null, 'Il tuo nome compare accanto a ciò che aggiungi o modifichi, così tutti sanno chi ha inserito un’informazione.'),
    h('div', { class: 'campo' }, h('label', { for: 'campo-chi' }, 'Nome e cognome'), campo)),
  [h('button', { type: 'button', class: 'pulsante primario', onclick: salva }, 'Fatto')]);
}
function serveNome(azione) { if (stato.chi) azione(); else chiediNome(azione); }

/* ================================================================ VISTA: ALBERO */
function centroIniziale() {
  const salvato = memoria.leggi(PREFISSO + 'centro-' + (stato.famiglia && stato.famiglia.id));
  if (salvato && stato.persone.has(salvato)) return salvato;
  let migliore = null, punti = -1;
  for (const id of stato.persone.keys()) {
    const n = genitoriDi(id).length + figliDi(id).length + coniugiDi(id).length + nonniDi(id).length;
    if (n > punti) { punti = n; migliore = id; }
  }
  return migliore;
}
VISTE.albero = (vista, s) => {
  if (!stato.persone.size) {
    vista.append(h('div', { class: 'vuoto riquadro' },
      h('h1', null, 'L’albero è ancora vuoto'),
      h('p', { class: 'tenue' }, 'Comincia da chi vuoi: da te, da un nonno, da chi ricordi meglio. Poi aggiungi i parenti uno alla volta.'),
      h('button', { type: 'button', class: 'pulsante primario', onclick: () => serveNome(() => vai({ v: 'modifica' })) }, 'Aggiungi la prima persona')));
    return;
  }
  let id = s.id && stato.persone.has(s.id) ? s.id : (stato.centro && stato.persone.has(stato.centro) ? stato.centro : centroIniziale());
  stato.centro = id;
  memoria.scrivi(PREFISSO + 'centro-' + stato.famiglia.id, id);
  const p = P(id);

  const cerca = h('input', { type: 'search', class: 'campo-cerca', placeholder: 'Cerca una persona da mettere al centro…', 'aria-label': 'Cerca una persona' });
  cerca.addEventListener('focus', () => { cerca.blur(); scegliPersona('Chi vuoi mettere al centro?', [], x => vai({ v: 'albero', id: x })); });
  vista.append(h('div', { class: 'cerca-albero' }, cerca,
    h('button', { type: 'button', class: 'pulsante', onclick: () => vai({ v: 'stampa' }), 'aria-label': 'Stampa l’albero' }, 'Stampa')));
  vista.append(h('p', { class: 'suggerimento' }, 'Tocca una persona per metterla al centro. Tocca quella al centro per aprire la sua scheda.'));

  const generazione = (titolo, ...contenuto) => {
    const fila = h('div', { class: 'fila-carte' }, contenuto);
    return h('section', { class: 'generazione' }, h('h3', null, titolo), fila);
  };

  // nonni, raggruppati per genitore
  const genitori = genitoriDi(id);
  const gruppiNonni = genitori.map(g => ({ g, nonni: genitoriDi(g) })).filter(x => x.nonni.length);
  if (gruppiNonni.length) {
    vista.append(generazione('Nonni', gruppiNonni.map(({ g, nonni }) =>
      h('div', { class: 'gruppo' }, h('div', { class: 'didascalia' }, 'da parte di ' + P(g).nome),
        h('div', { class: 'carte' }, nonni.map(n => cartaPersona(P(n), { ruolo: genere(P(n), 'Nonno', 'Nonna', 'Nonno/a') })))))));
  }
  // genitori
  vista.append(generazione('Genitori',
    genitori.map(g => cartaPersona(P(g), { ruolo: genere(P(g), 'Padre', 'Madre', 'Genitore') })),
    genitori.length < 2 ? cartaMancante('Aggiungi padre o madre', () => aggiungiParente(id, 'genitore')) : null));
  // centro e coppie
  vista.append(generazione(nomeCompleto(p),
    cartaPersona(p, { centro: true }),
    coniugiDi(id).map(c => cartaPersona(P(c), { ruolo: etichettaCoppia(P(c), relCoppia(id, c)) })),
    cartaMancante('Aggiungi marito, moglie o compagno', () => aggiungiParente(id, 'coppia'))));
  // fratelli
  const fratelli = fratelliDi(id);
  vista.append(generazione('Fratelli e sorelle',
    fratelli.map(f => cartaPersona(P(f), { ruolo: genere(P(f), 'Fratello', 'Sorella', 'Fratello/sorella') })),
    cartaMancante('Aggiungi fratello o sorella', () => aggiungiParente(id, 'fratello'))));
  // figli
  vista.append(generazione('Figli',
    figliDi(id).map(f => cartaPersona(P(f), { ruolo: genere(P(f), 'Figlio', 'Figlia', 'Figlio/a') })),
    cartaMancante('Aggiungi figlio o figlia', () => aggiungiParente(id, 'figlio'))));
  const nipoti = nipotiDi(id);
  if (nipoti.length) vista.append(generazione('Nipoti', nipoti.map(n => cartaPersona(P(n), { ruolo: 'Nipote' }))));
};

/* ---------------------------------------------------------------- scegliere una persona già presente */
function scegliPersona(titolo, escludi, quando, extra) {
  const campo = h('input', { type: 'search', placeholder: 'Scrivi un nome, un cognome o un luogo', 'aria-label': 'Cerca' });
  const lista = h('ul', { class: 'elenco risultati' });
  const aggiorna = () => {
    svuota(lista);
    const q = campo.value.trim().toLowerCase();
    const trovate = [...stato.persone.values()]
      .filter(p => !escludi.includes(p.id))
      .filter(p => !q || (nomeCompleto(p) + ' ' + p.luogo_nascita).toLowerCase().includes(q))
      .sort((a, b) => (a.cognome + a.nome).localeCompare(b.cognome + b.nome, 'it'))
      .slice(0, 80);
    if (!trovate.length) lista.append(h('li', { class: 'tenue', style: 'padding:12px 4px' }, 'Nessuna persona trovata.'));
    for (const p of trovate) lista.append(h('li', null, rigaPersona(p, () => { chiudi(); quando(p.id); })));
  };
  campo.addEventListener('input', aggiorna);
  const chiudi = apriFinestra(titolo, h('div', null, extra || null, h('div', { class: 'campo' }, campo), lista));
  aggiorna();
  return chiudi;
}
function rigaPersona(p, azione) {
  const dettagli = [anniBreve(p), p.luogo_nascita].filter(Boolean).join(' · ');
  return h('button', { type: 'button', class: 'riga-persona', onclick: azione },
    volto(p, 46), h('span', { class: 'testo' }, h('span', { class: 'nome' }, nomeCompleto(p)), dettagli ? h('span', { class: 'dettagli', style: 'display:block' }, dettagli) : null),
    h('span', { class: 'freccia', 'aria-hidden': 'true' }, '›'));
}

/* ---------------------------------------------------------------- aggiungere un parente */
const TITOLI_PARENTE = {
  genitore: 'Aggiungi padre o madre',
  figlio: 'Aggiungi figlio o figlia',
  coppia: 'Aggiungi marito, moglie o compagno',
  fratello: 'Aggiungi fratello o sorella'
};
function aggiungiParente(id, tipo) {
  serveNome(() => {
    const p = P(id);
    const ctx = { tipo, rif: id, altriGenitori: [], stato: '' };
    const corpo = h('div', { class: 'spazio' });
    corpo.append(h('p', null, `Di ${nomeCompleto(p)}.`));

    if (tipo === 'fratello') {
      const g = genitoriDi(id);
      if (!g.length) {
        corpo.append(h('p', null, 'Per collegare fratelli e sorelle serve almeno un genitore in comune. Aggiungi prima il padre o la madre: basta anche solo il nome.'));
        const chiudi = apriFinestra(TITOLI_PARENTE[tipo], corpo, [h('button', { type: 'button', class: 'pulsante primario', onclick: () => { chiudi(); aggiungiParente(id, 'genitore'); } }, 'Aggiungi un genitore')]);
        return;
      }
      corpo.append(h('p', { class: 'tenue piccolo-testo' }, 'Verrà collegato agli stessi genitori: ' + g.map(x => nomeCompleto(P(x))).join(' e ') + '.'));
    }
    if (tipo === 'figlio') {
      const coniugi = coniugiDi(id);
      if (coniugi.length) {
        const caselle = coniugi.map(c => {
          const box = h('input', { type: 'checkbox', checked: coniugi.length === 1, value: c });
          box.addEventListener('change', () => { ctx.altriGenitori = caselle.filter(b => b.checked).map(b => b.value); });
          return box;
        });
        ctx.altriGenitori = caselle.filter(b => b.checked).map(b => b.value);
        corpo.append(h('div', null, h('h3', { style: 'margin-bottom:6px' }, 'L’altro genitore'),
          caselle.map((b, i) => h('label', { class: 'casella' }, b, 'Figlio/a anche di ' + nomeCompleto(P(coniugi[i]))))));
      }
    }
    if (tipo === 'coppia') {
      const sel = h('select', { id: 'stato-coppia' },
        h('option', { value: 'sposati' }, 'Sposati'), h('option', { value: 'conviventi' }, 'Conviventi o compagni'),
        h('option', { value: 'separati' }, 'Separati o divorziati'), h('option', { value: '' }, 'Non so / non indicato'));
      ctx.stato = 'sposati';
      sel.addEventListener('change', () => { ctx.stato = sel.value; });
      corpo.append(h('div', { class: 'campo' }, h('label', { for: 'stato-coppia' }, 'Che legame?'), sel));
    }

    const giaCollegati = [id, ...genitoriDi(id), ...figliDi(id), ...coniugiDi(id), ...(tipo === 'fratello' ? fratelliDi(id) : [])];
    corpo.append(h('div', { class: 'opzioni' },
      h('button', { type: 'button', class: 'opzione', onclick: () => { chiudi(); vai({ v: 'modifica', ctx }); } },
        h('span', { class: 'icona', 'aria-hidden': 'true' }, '+'),
        h('span', null, h('strong', null, 'Persona nuova'), h('span', null, 'Non è ancora nell’albero: la inserisco adesso'))),
      h('button', { type: 'button', class: 'opzione', onclick: () => { chiudi(); scegliPersona('Scegli la persona', giaCollegati, async altro => { await collega(ctx, altro); vai({ v: 'albero', id }); }); } },
        h('span', { class: 'icona', 'aria-hidden': 'true' }, '⌕'),
        h('span', null, h('strong', null, 'Persona già presente'), h('span', null, 'È già nell’albero: la collego e basta')))));
    const chiudi = apriFinestra(TITOLI_PARENTE[tipo], corpo);
  });
}
async function collega(ctx, nuovo) {
  const api = stato.api;
  try {
    await conAttesa((async () => {
      if (ctx.tipo === 'genitore') await api.salvaRelazione('genitore', nuovo, ctx.rif);
      else if (ctx.tipo === 'figlio') {
        await api.salvaRelazione('genitore', ctx.rif, nuovo);
        for (const g of ctx.altriGenitori) if (g !== nuovo) await api.salvaRelazione('genitore', g, nuovo);
      } else if (ctx.tipo === 'coppia') await api.salvaRelazione('coppia', ctx.rif, nuovo, ctx.stato);
      else if (ctx.tipo === 'fratello') for (const g of genitoriDi(ctx.rif)) if (g !== nuovo) await api.salvaRelazione('genitore', g, nuovo);
    })());
    await ricarica();
    avvisa('Collegamento salvato');
  } catch (e) { await ricarica().catch(() => {}); avvisa(messaggioErrore(e), true); }
}

/* ================================================================ VISTA: PERSONE */
VISTE.persone = vista => {
  const campo = h('input', { type: 'search', class: 'campo-cerca', placeholder: 'Cerca per nome, cognome o luogo', 'aria-label': 'Cerca' });
  const lista = h('ul', { class: 'elenco' });
  const conta = h('p', { class: 'tenue piccolo-testo', style: 'margin:10px 0 4px' });
  const aggiorna = () => {
    svuota(lista);
    const q = campo.value.trim().toLowerCase();
    const tutte = [...stato.persone.values()].sort((a, b) => (a.cognome + ' ' + a.nome).localeCompare(b.cognome + ' ' + b.nome, 'it'));
    const trovate = tutte.filter(p => !q || (nomeCompleto(p) + ' ' + p.luogo_nascita).toLowerCase().includes(q));
    conta.textContent = q ? `${trovate.length} su ${tutte.length}` : `${tutte.length} ${tutte.length === 1 ? 'persona' : 'persone'} nell’albero`;
    for (const p of trovate) lista.append(h('li', null, rigaPersona(p, () => vai({ v: 'scheda', id: p.id }))));
  };
  campo.addEventListener('input', aggiorna);
  vista.append(
    h('div', { class: 'fila', style: 'justify-content:space-between;margin-bottom:12px' }, h('h1', null, 'Persone'),
      h('button', { type: 'button', class: 'pulsante primario piccolo', onclick: () => serveNome(() => vai({ v: 'modifica' })) }, '+ Nuova persona')),
    h('div', { class: 'cerca-albero' }, campo), conta, h('div', { class: 'riquadro', style: 'padding:4px 12px' }, lista));
  aggiorna();
};

/* ================================================================ VISTA: SCHEDA */
VISTE.scheda = (vista, s) => {
  const p = P(s.id);
  if (!p) { vista.append(h('p', null, MESSAGGI.persona_non_trovata)); return; }
  const foto = h('div', { class: 'foto-grande' });
  if (p.miniatura) foto.append(h('img', { src: p.miniatura, alt: 'Foto di ' + nomeCompleto(p) }));
  else foto.textContent = iniziali(p);
  if (p.foto_id) caricaFoto(p.foto_id).then(d => { if (d) { svuota(foto).append(h('img', { src: d, alt: 'Foto di ' + nomeCompleto(p) })); } });

  const nato = genere(p, 'Nato', 'Nata', 'Nato/a'), morto = genere(p, 'Morto', 'Morta', 'Morto/a');
  const e = eta(p);
  const righe = [];
  if (p.data_nascita || p.luogo_nascita) {
    righe.push(h('p', null, nato + ' ',
      p.data_nascita ? [(p.data_nascita.length === 10 ? 'il ' : 'nel '), h('strong', null, scriviData(p.data_nascita))] : null,
      p.luogo_nascita ? [' a ', h('strong', null, p.luogo_nascita)] : null));
  }
  if (p.deceduto) {
    righe.push(h('p', null, p.data_morte
      ? [morto + ' ' + (p.data_morte.length === 10 ? 'il ' : 'nel '), h('strong', null, scriviData(p.data_morte)), e ? ` a ${e.circa ? 'circa ' : ''}${e.anni} anni` : '']
      : genere(p, 'Defunto', 'Defunta', 'Defunto/a')));
  } else if (e) righe.push(h('p', null, `Ha ${e.circa ? 'circa ' : ''}${e.anni} anni`));

  const testa = h('div', { class: 'scheda-testa' }, foto, h('h1', null, nomeCompleto(p)), h('div', { class: 'dati-vita' }, righe),
    h('div', { class: 'fila', style: 'justify-content:center' },
      h('button', { type: 'button', class: 'pulsante primario', onclick: () => serveNome(() => vai({ v: 'modifica', id: p.id })) }, 'Modifica'),
      h('button', { type: 'button', class: 'pulsante', onclick: () => vai({ v: 'albero', id: p.id }) }, 'Vedi nell’albero')));

  const destra = h('div', { class: 'spazio' });
  if (p.note) destra.append(h('div', { class: 'riquadro' }, h('h3', { style: 'margin-bottom:6px' }, 'Ricordi e note'), h('p', { class: 'note-testo' }, p.note)));

  const parenti = h('div', { class: 'riquadro spazio' }, h('h2', null, 'Parenti'));
  let qualcuno = false;
  for (const g of GRUPPI) {
    const ids = g.f(p.id);
    if (!ids.length) continue;
    qualcuno = true;
    parenti.append(h('div', { class: 'gruppo-parenti' }, h('h3', null, g.titolo), h('div', { class: 'gettoni' }, ids.map(x => gettone(P(x), g.et(P(x), p.id))))));
  }
  if (!qualcuno) parenti.append(h('p', { class: 'tenue' }, 'Nessun parente collegato.'));
  parenti.append(h('div', { class: 'fila' },
    ['genitore', 'coppia', 'figlio', 'fratello'].map(t => h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => aggiungiParente(p.id, t) }, '+ ' + TITOLI_PARENTE[t].replace('Aggiungi ', '')))));
  destra.append(parenti);

  // legami diretti, con la possibilità di toglierli
  const legami = h('div', { class: 'riquadro' }, h('h2', { style: 'margin-bottom:4px' }, 'Legami diretti'),
    h('p', { class: 'tenue piccolo-testo', style: 'margin-bottom:6px' }, 'Se un collegamento è sbagliato, toglilo qui. Le persone restano nell’albero.'));
  const diretti = [
    ...stato.relazioni.filter(r => r.tipo === 'genitore' && r.a === p.id && P(r.da)).map(r => ({ r, altro: P(r.da), testo: genere(P(r.da), 'Padre', 'Madre', 'Genitore') })),
    ...stato.relazioni.filter(r => r.tipo === 'coppia' && (r.da === p.id || r.a === p.id)).map(r => ({ r, altro: P(r.da === p.id ? r.a : r.da) })).filter(x => x.altro).map(x => ({ ...x, testo: etichettaCoppia(x.altro, x.r) })),
    ...stato.relazioni.filter(r => r.tipo === 'genitore' && r.da === p.id && P(r.a)).map(r => ({ r, altro: P(r.a), testo: genere(P(r.a), 'Figlio', 'Figlia', 'Figlio/a') }))
  ];
  if (!diretti.length) legami.append(h('p', { class: 'tenue' }, 'Nessuno.'));
  for (const d of diretti) {
    legami.append(h('div', { class: 'legame' }, volto(d.altro, 36),
      h('div', { class: 'testo' }, h('div', { class: 'piccolo-testo tenue' }, d.testo), h('div', null, nomeCompleto(d.altro))),
      h('button', { type: 'button', class: 'pulsante piccolo pericolo', onclick: () => serveNome(async () => {
        if (!await conferma('Togliere il collegamento?', `${nomeCompleto(d.altro)} non risulterà più ${d.testo.toLowerCase()} di ${nomeCompleto(p)}. Nessuna persona viene cancellata.`, 'Sì, togli')) return;
        try { await conAttesa(stato.api.eliminaRelazione(d.r.id)); await ricarica(); avvisa('Collegamento tolto'); vai({ v: 'scheda', id: p.id }, true); }
        catch (e) { avvisa(messaggioErrore(e), true); }
      }) }, 'Togli')));
  }
  destra.append(legami);

  const firma = [];
  if (p.creato_da) firma.push(`Inserita da ${p.creato_da}`);
  if (p.aggiornato_da && p.aggiornato_il) { const q = quando(p.aggiornato_il); firma.push(`ultima modifica di ${p.aggiornato_da}, ${q.giorno.toLowerCase()} alle ${q.ora}`); }
  destra.append(h('p', { class: 'tenue piccolo-testo' }, firma.join(' · ')));
  destra.append(h('button', { type: 'button', class: 'pulsante pericolo', onclick: () => serveNome(async () => {
    if (!await conferma('Eliminare ' + nomeCompleto(p) + '?', 'La persona e i suoi collegamenti spariscono dall’albero. Si può recuperare dalla pagina “Novità” con il pulsante Annulla, oppure dalle copie serali.', 'Sì, elimina', true)) return;
    try { await conAttesa(stato.api.eliminaPersona(p.id)); await ricarica(); avvisa('Persona eliminata'); vai({ v: 'persone' }, true); }
    catch (e) { avvisa(messaggioErrore(e), true); }
  }) }, 'Elimina questa persona'));

  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('div', { class: 'scheda-griglia' }, testa, destra));
};
async function caricaFoto(id) {
  if (stato.foto.has(id)) return stato.foto.get(id);
  try { const d = await stato.api.foto(id); stato.foto.set(id, d); return d; } catch { return ''; }
}

/* ================================================================ VISTA: MODIFICA / NUOVA */
VISTE.modifica = (vista, s) => {
  const p = s.id ? P(s.id) : null;
  if (s.id && !p) { vista.append(h('p', null, MESSAGGI.persona_non_trovata)); return; }
  const ctx = s.ctx || null;
  const rif = ctx ? P(ctx.rif) : null;
  const v = p ? { ...p } : { nome: '', cognome: (ctx && rif && ['figlio', 'fratello'].includes(ctx.tipo)) ? rif.cognome : '', sesso: '', data_nascita: '', luogo_nascita: '', deceduto: false, data_morte: '', note: '', miniatura: '' };
  let fotoNuova = null, miniNuova = null;   // null = non toccata, '' = tolta

  const campoTesto = (id, etichetta, valore, attrs = {}, aiuto = null) => {
    const input = h('input', { type: 'text', id, value: valore, ...attrs });
    const err = h('div', { class: 'messaggio-errore', hidden: true });
    const box = h('div', { class: 'campo' }, h('label', { for: id }, etichetta), aiuto ? h('div', { class: 'aiuto' }, aiuto) : null, input, err);
    box.errore = t => { box.classList.toggle('errore', !!t); err.hidden = !t; err.textContent = t || ''; };
    box.input = input;
    return box;
  };
  const cNome = campoTesto('f-nome', 'Nome', v.nome, { maxlength: 80, autocomplete: 'off' });
  const cCognome = campoTesto('f-cognome', 'Cognome', v.cognome, { maxlength: 80, autocomplete: 'off' }, 'Per le donne sposate, di solito il cognome da nubile.');
  const cNascita = campoTesto('f-nascita', 'Data di nascita', dataPerModulo(v.data_nascita), { inputmode: 'text', placeholder: 'es. 12/05/1948 oppure 1948' }, 'Giorno/mese/anno. Se non la sai tutta, basta l’anno.');
  const cLuogo = campoTesto('f-luogo', 'Luogo di nascita', v.luogo_nascita, { maxlength: 120, placeholder: 'es. Perugia' });
  const cMorte = campoTesto('f-morte', 'Data di morte', dataPerModulo(v.data_morte), { placeholder: 'es. 3/11/2010 oppure 2010' });
  const sesso = h('div', { class: 'scelta', role: 'radiogroup', 'aria-label': 'Sesso' },
    [['M', 'Uomo'], ['F', 'Donna'], ['', 'Non indicato']].map(([val, t]) => h('label', null, h('input', { type: 'radio', name: 'sesso', value: val, checked: v.sesso === val }), t)));
  const deceduto = h('input', { type: 'checkbox', id: 'f-deceduto', checked: v.deceduto });
  const boxMorte = h('div', { hidden: !v.deceduto }, cMorte);
  deceduto.addEventListener('change', () => { boxMorte.hidden = !deceduto.checked; });
  const note = h('textarea', { id: 'f-note', maxlength: 5000, placeholder: 'Mestiere, carattere, ricordi, dove ha vissuto…' }, v.note);

  // foto
  const anteprima = h('div', { class: 'foto-modulo' });
  const sceltaFile = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const disegnaFoto = () => {
    svuota(anteprima);
    const mostra = miniNuova !== null ? miniNuova : v.miniatura;
    anteprima.append(volto({ ...v, nome: cNome.input.value || v.nome || '?', cognome: cCognome.input.value, miniatura: mostra }, 96),
      h('div', { class: 'fila' },
        h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => sceltaFile.click() }, mostra ? 'Cambia foto' : 'Scegli o scatta una foto'),
        mostra ? h('button', { type: 'button', class: 'pulsante piccolo pericolo', onclick: () => { fotoNuova = ''; miniNuova = ''; disegnaFoto(); } }, 'Togli foto') : null),
      sceltaFile);
  };
  sceltaFile.addEventListener('change', () => {
    const file = sceltaFile.files && sceltaFile.files[0];
    sceltaFile.value = '';
    if (!file) return;
    ritagliaFoto(file).then(r => { if (r) { fotoNuova = r.grande; miniNuova = r.mini; disegnaFoto(); } });
  });
  disegnaFoto();

  const titolo = p ? 'Modifica ' + nomeCompleto(p) : ctx ? TITOLI_PARENTE[ctx.tipo] + ' di ' + nomeCompleto(rif) : 'Nuova persona';
  const salva = h('button', { type: 'submit', class: 'pulsante primario' }, 'Salva');
  const modulo = h('form', { class: 'modulo', novalidate: true },
    h('div', { class: 'riquadro modulo' },
      h('div', { class: 'campo' }, h('span', { class: 'etichetta-campo' }, 'Foto'), anteprima),
      h('div', { class: 'due-colonne' }, cNome, cCognome),
      h('div', { class: 'campo' }, h('span', { class: 'etichetta-campo' }, 'Sesso'), sesso),
      h('div', { class: 'due-colonne' }, cNascita, cLuogo),
      h('label', { class: 'casella' }, deceduto, 'Non è più in vita'),
      boxMorte,
      h('div', { class: 'campo' }, h('label', { for: 'f-note' }, 'Ricordi e note'), note)),
    h('div', { class: 'barra-salva' },
      h('button', { type: 'button', class: 'pulsante', onclick: () => history.back() }, 'Annulla'), salva));

  modulo.addEventListener('submit', async ev => {
    ev.preventDefault();
    [cNome, cNascita, cMorte].forEach(c => c.errore(null));
    const nome = cNome.input.value.trim();
    const dn = leggiData(cNascita.input.value);
    const dm = deceduto.checked ? leggiData(cMorte.input.value) : '';
    let ok = true;
    if (!nome) { cNome.errore('Scrivi almeno il nome.'); ok = false; }
    if (dn === null) { cNascita.errore('Data non valida. Scrivi ad esempio 12/05/1948, oppure 05/1948, oppure 1948.'); ok = false; }
    if (dm === null) { cMorte.errore('Data non valida. Scrivi ad esempio 3/11/2010, oppure 2010.'); ok = false; }
    if (ok && dn && dm && dm < dn.slice(0, dm.length)) { cMorte.errore('La data di morte viene prima di quella di nascita.'); ok = false; }
    if (!ok) { const e = modulo.querySelector('.errore input'); if (e) e.focus(); return; }
    const persona = {
      id: p ? p.id : null, nome, cognome: cCognome.input.value.trim(),
      sesso: (modulo.querySelector('input[name=sesso]:checked') || {}).value || '',
      data_nascita: dn, luogo_nascita: cLuogo.input.value.trim(), deceduto: deceduto.checked,
      data_morte: dm, note: note.value.trim()
    };
    salva.disabled = true;
    try {
      const id = await conAttesa(stato.api.salvaPersona(persona, fotoNuova, miniNuova));
      if (ctx) await collega(ctx, id); else await ricarica();
      avvisa(p ? 'Modifiche salvate' : 'Persona aggiunta');
      vai({ v: ctx ? 'albero' : 'scheda', id: ctx ? ctx.rif : id }, true);
    } catch (e) { salva.disabled = false; avvisa(messaggioErrore(e), true); }
  });

  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('h1', { style: 'margin-bottom:14px' }, titolo), modulo);
  if (!p && matchMedia('(pointer: fine)').matches) cNome.input.focus();
};

/* ---------------------------------------------------------------- ritaglio della foto */
function caricaImmagine(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('immagine')); };
    img.src = url;
  });
}
async function ritagliaFoto(file) {
  let img;
  try { img = await caricaImmagine(file); }
  catch { avvisa('Questo file non sembra un’immagine che il browser sa aprire. Prova con una foto JPG o PNG.', true); return null; }
  return new Promise(risolvi => {
    const LATO = 680;                         // risoluzione del riquadro di lavoro
    const tela = h('canvas', { width: LATO, height: LATO });
    const ctx = tela.getContext('2d');
    let rot = 0, zoom = 1, cx = 0, cy = 0;   // cx,cy = spostamento del centro immagine, in pixel del riquadro
    const dims = () => rot % 2 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight];
    const base = () => { const [w, hh] = dims(); return LATO / Math.min(w, hh); };   // scala che "riempie" il riquadro
    const limita = () => {
      const [w, hh] = dims(); const s = base() * zoom;
      const mx = Math.max(0, (w * s - LATO) / 2), my = Math.max(0, (hh * s - LATO) / 2);
      cx = Math.min(mx, Math.max(-mx, cx)); cy = Math.min(my, Math.max(-my, cy));
    };
    const disegnaSu = (c, lato) => {
      const k = lato / LATO, s = base() * zoom * k;
      c.save(); c.fillStyle = '#fff'; c.fillRect(0, 0, lato, lato);
      c.translate(lato / 2 + cx * k, lato / 2 + cy * k); c.rotate(rot * Math.PI / 2); c.scale(s, s);
      c.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2); c.restore();
    };
    const ridisegna = () => { limita(); disegnaSu(ctx, LATO); };

    const area = h('div', { class: 'ritaglio-area', 'aria-label': 'Trascina per spostare la foto' }, tela, h('div', { class: 'cornice' }));
    const cursore = h('input', { type: 'range', min: 1, max: 5, step: 0.01, value: 1, 'aria-label': 'Ingrandimento' });
    cursore.addEventListener('input', () => { zoom = +cursore.value; ridisegna(); });

    // trascinamento (dito o mouse) e pizzico con due dita
    const punti = new Map(); let distIniziale = 0, zoomIniziale = 1;
    const scala = () => LATO / area.getBoundingClientRect().width;
    area.addEventListener('pointerdown', e => { area.setPointerCapture(e.pointerId); punti.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (punti.size === 2) { const [a, b] = [...punti.values()]; distIniziale = Math.hypot(a.x - b.x, a.y - b.y); zoomIniziale = zoom; } });
    area.addEventListener('pointermove', e => {
      if (!punti.has(e.pointerId)) return;
      const prima = punti.get(e.pointerId); punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punti.size === 2) {
        const [a, b] = [...punti.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distIniziale > 0) { zoom = Math.min(5, Math.max(1, zoomIniziale * d / distIniziale)); cursore.value = zoom; }
      } else { cx += (e.clientX - prima.x) * scala(); cy += (e.clientY - prima.y) * scala(); }
      ridisegna();
    });
    const fine = e => { punti.delete(e.pointerId); if (punti.size < 2) distIniziale = 0; };
    area.addEventListener('pointerup', fine); area.addEventListener('pointercancel', fine);
    area.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.min(5, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); cursore.value = zoom; ridisegna(); }, { passive: false });

    let fatto = false;
    const esporta = (lato, qualita) => { const c = h('canvas', { width: lato, height: lato }); disegnaSu(c.getContext('2d'), lato); return c.toDataURL('image/jpeg', qualita); };
    const corpo = h('div', { class: 'ritaglio' },
      h('p', { class: 'tenue piccolo-testo', style: 'text-align:center' }, 'Sposta la foto col dito o col mouse e ingrandisci finché il viso sta dentro il cerchio. Verrà salvato tutto il quadrato.'),
      area,
      h('div', { class: 'zoom' }, h('span', { 'aria-hidden': 'true' }, '−'), cursore, h('span', { 'aria-hidden': 'true' }, '+')),
      h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => { rot = (rot + 1) % 4; cx = cy = 0; ridisegna(); } }, '↻ Ruota'));
    const chiudi = apriFinestra('Ritaglia la foto', corpo, [
      h('button', { type: 'button', class: 'pulsante', onclick: () => chiudi() }, 'Annulla'),
      h('button', { type: 'button', class: 'pulsante primario', onclick: () => {
        fatto = true;
        let grande = esporta(1000, .86);
        if (grande.length > 2300000) grande = esporta(800, .8);
        const mini = esporta(180, .82);
        URL.revokeObjectURL(img.src); chiudi(); risolvi({ grande, mini });
      } }, 'Usa questa parte')]);
    const osserva = new MutationObserver(() => { if (!document.contains(area)) { osserva.disconnect(); if (!fatto) { URL.revokeObjectURL(img.src); risolvi(null); } } });
    osserva.observe($('#finestre'), { childList: true, subtree: true });
    ridisegna();
  });
}

/* ================================================================ VISTA: NOVITA' (registro) */
VISTE.novita = async vista => {
  vista.append(h('h1', null, 'Novità'),
    h('p', { class: 'tenue', style: 'margin:6px 0 12px' }, 'Tutto quello che è stato aggiunto o cambiato, e da chi. Se qualcosa è stato fatto per sbaglio, si può annullare.'));
  const box = h('div', { class: 'riquadro' }, h('p', { class: 'tenue' }, 'Caricamento…'));
  vista.append(box,
    h('p', { class: 'tenue piccolo-testo', style: 'margin-top:14px' }, 'Serve tornare indietro di più giorni? ',
      h('button', { type: 'button', class: 'collegamento', onclick: () => vai({ v: 'copie' }) }, 'Vai alle copie serali')));
  let voci;
  try { voci = await conAttesa(stato.api.registro()); }
  catch (e) { svuota(box).append(h('p', null, messaggioErrore(e))); return; }
  svuota(box);
  if (!voci.length) { box.append(h('p', { class: 'tenue' }, 'Ancora nessuna modifica.')); return; }
  let giorno = null, contenitore = null;
  for (const v of voci) {
    const q = quando(v.quando);
    if (q.giorno !== giorno) {
      giorno = q.giorno;
      contenitore = h('div', { class: 'giorno-registro' }, h('h3', null, maiuscola(giorno)));
      box.append(contenitore);
    }
    contenitore.append(h('div', { class: 'voce' + (v.annullato ? ' annullata' : '') },
      h('div', { class: 'ora' }, q.ora),
      h('div', { class: 'testo' }, h('div', { class: 'descr' }, v.descrizione), h('div', { class: 'chi' }, v.chi ? 'da ' + v.chi : ''),
        v.annullato ? h('span', { class: 'etichetta grigia' }, 'annullata') : null),
      v.annullabile ? h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => serveNome(async () => {
        if (!await conferma('Annullare questa modifica?', `«${v.descrizione}». Si torna a com’era prima.`, 'Sì, annulla')) return;
        try { await conAttesa(stato.api.annulla(v.id)); await ricarica(); avvisa('Modifica annullata'); vai({ v: 'novita' }, true); }
        catch (e) { avvisa(messaggioErrore(e), true); }
      }) }, 'Annulla') : null));
  }
  box.firstChild.style.marginTop = '0';
};

/* ================================================================ VISTA: COPIE SERALI */
VISTE.copie = async vista => {
  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('h1', null, 'Copie serali'),
    h('p', { class: 'tenue', style: 'margin:6px 0 12px' }, 'Ogni sera alle 22 l’albero viene copiato. Si tengono le copie degli ultimi 30 giorni. Aprendone una vedi cosa è cambiato da allora e puoi rimettere a posto una persona.'));
  const box = h('div', { class: 'riquadro', style: 'padding:4px 12px' }, h('p', { class: 'tenue', style: 'padding:12px 0' }, 'Caricamento…'));
  vista.append(box);
  let copie;
  try { copie = await conAttesa(stato.api.copie()); }
  catch (e) { svuota(box).append(h('p', null, messaggioErrore(e))); return; }
  svuota(box);
  if (!copie.length) { box.append(h('p', { class: 'tenue', style: 'padding:12px 0' }, 'Non c’è ancora nessuna copia: la prima verrà fatta stasera.')); return; }
  for (const c of copie) {
    const q = quando(c.creata_il);
    box.append(h('button', { type: 'button', class: 'copia', onclick: () => vai({ v: 'copia', id: c.id, giorno: c.giorno, motivo: c.motivo }) },
      h('span', { class: 'testo' }, h('strong', { style: 'display:block' }, maiuscola(giornoEsteso(c.giorno))),
        h('span', { class: 'tenue piccolo-testo' }, `${c.persone} persone · copiata alle ${q.ora}`)),
      c.motivo !== 'serale' ? h('span', { class: 'etichetta grigia' }, c.motivo) : null,
      h('span', { class: 'freccia tenue', 'aria-hidden': 'true' }, '›')));
  }
};
const CAMPI_CONFRONTO = [['nome', 'nome'], ['cognome', 'cognome'], ['sesso', 'sesso'], ['data_nascita', 'data di nascita'], ['luogo_nascita', 'luogo di nascita'], ['deceduto', 'in vita / defunto'], ['data_morte', 'data di morte'], ['note', 'note'], ['foto_id', 'foto']];
VISTE.copia = async (vista, s) => {
  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('h1', null, 'Copia di ' + giornoEsteso(s.giorno)),
    s.motivo && s.motivo !== 'serale' ? h('p', { class: 'tenue' }, 'Copia fatta in automatico ' + s.motivo + '.') : '');
  const box = h('div', { class: 'spazio', style: 'margin-top:14px' }, h('p', { class: 'tenue' }, 'Confronto con oggi…'));
  vista.append(box);
  let dati;
  try { dati = await conAttesa(stato.api.copia(s.id)); }
  catch (e) { svuota(box).append(h('p', null, messaggioErrore(e))); return; }
  svuota(box);
  const allora = new Map(dati.persone.map(p => [p.id, p]));
  const sparite = [...allora.values()].filter(p => !stato.persone.has(p.id));
  const cambiate = [...allora.values()].filter(p => stato.persone.has(p.id)).map(p => ({ p, campi: CAMPI_CONFRONTO.filter(([k]) => String(p[k] ?? '') !== String(P(p.id)[k] ?? '')).map(([, t]) => t) })).filter(x => x.campi.length);
  const nuove = [...stato.persone.values()].filter(p => !allora.has(p.id));
  const chiaveLegame = r => r.tipo + r.da + r.a;
  const legamiOra = new Set(stato.relazioni.map(chiaveLegame));
  const legamiPersi = dati.relazioni.filter(r => !legamiOra.has(chiaveLegame(r)));

  const rimetti = (p, etichetta) => h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => serveNome(async () => {
    if (!await conferma('Rimettere com’era?', `${nomeCompleto(p)} torna com’era ${giornoEsteso(s.giorno)}, con i suoi collegamenti di allora. Il resto dell’albero non cambia.`, 'Sì, rimetti')) return;
    try { await conAttesa(stato.api.ripristinaPersona(s.id, p.id)); await ricarica(); avvisa('Fatto'); vai({ v: 'copia', id: s.id, giorno: s.giorno, motivo: s.motivo }, true); }
    catch (e) { avvisa(messaggioErrore(e), true); }
  }) }, etichetta);

  const sezione = (titolo, vuoto, elementi) => h('div', { class: 'riquadro' }, h('h2', { style: 'margin-bottom:6px' }, titolo), elementi.length ? elementi : h('p', { class: 'tenue' }, vuoto));
  box.append(
    sezione('Persone eliminate da allora', 'Nessuna.', sparite.map(p => h('div', { class: 'differenza' }, volto(p, 40), h('div', { class: 'testo' }, h('strong', null, nomeCompleto(p)), h('div', { class: 'tenue piccolo-testo' }, anniBreve(p))), rimetti(p, 'Recupera')))),
    sezione('Persone cambiate da allora', 'Nessuna.', cambiate.map(({ p, campi }) => h('div', { class: 'differenza' }, volto(P(p.id), 40), h('div', { class: 'testo' }, h('strong', null, nomeCompleto(P(p.id))), h('div', { class: 'tenue piccolo-testo' }, 'cambiato: ' + campi.join(', '))), rimetti(p, 'Rimetti com’era')))),
    h('p', { class: 'tenue piccolo-testo' }, `Aggiunte dopo quella sera: ${nuove.length} ${nuove.length === 1 ? 'persona' : 'persone'}. Collegamenti tolti da allora: ${legamiPersi.length}.`));

  if (stato.ruolo === 'referente') {
    box.append(h('div', { class: 'riquadro', style: 'border-color:var(--pericolo)' },
      h('h2', null, 'Rimettere tutto l’albero com’era'),
      h('p', { class: 'tenue', style: 'margin:6px 0 12px' }, `Tutto torna com’era ${giornoEsteso(s.giorno)}: ciò che è stato aggiunto dopo sparisce. Prima viene salvata in automatico una copia dello stato di adesso, così si può tornare indietro anche da questo.`),
      h('button', { type: 'button', class: 'pulsante pericolo-pieno', onclick: () => serveNome(async () => {
        if (!await conferma('Ripristinare tutto l’albero?', `L’albero torna com’era ${giornoEsteso(s.giorno)}. ${nuove.length} persone aggiunte dopo verranno tolte (resta comunque una copia di adesso).`, 'Sì, ripristina tutto', true)) return;
        try { await conAttesa(stato.api.ripristinaCopia(s.id)); await ricarica(); avvisa('Albero ripristinato'); vai({ v: 'albero' }, true); }
        catch (e) { avvisa(messaggioErrore(e), true); }
      }) }, 'Ripristina tutto l’albero')));
  }
};

/* ================================================================ VISTA: ALTRO */
VISTE.altro = vista => {
  const voce = (icona, titolo, testo, azione) => h('button', { type: 'button', class: 'opzione', onclick: azione },
    h('span', { class: 'icona', 'aria-hidden': 'true' }, icona), h('span', null, h('strong', null, titolo), h('span', null, testo)));
  vista.append(h('h1', { style: 'margin-bottom:14px' }, 'Altro'), h('div', { class: 'menu-altro' },
    voce('✉', 'Invita un familiare', 'Manda il link su WhatsApp, per mail o col codice QR', () => vai({ v: 'invita' })),
    voce('⎙', 'Stampa l’albero', 'Tutto l’albero su un foglio, in PDF o in SVG, a colori', () => vai({ v: 'stampa' })),
    voce('⟲', 'Copie serali', 'Torna a com’era l’albero una delle sere passate', () => vai({ v: 'copie' })),
    voce('☺', 'Cambia il tuo nome', stato.chi ? 'Ora risulti come: ' + stato.chi : 'Non l’hai ancora indicato', () => chiediNome()),
    stato.ruolo === 'referente' ? voce('✎', 'Nome della famiglia', 'Ora: ' + stato.famiglia.nome, rinominaFamiglia) : null,
    voce('?', 'Come si usa', 'Le istruzioni in breve', () => vai({ v: 'guida' }))));
};
function rinominaFamiglia() {
  const campo = h('input', { type: 'text', id: 'nome-fam', value: stato.famiglia.nome, maxlength: 80 });
  const chiudi = apriFinestra('Nome della famiglia', h('div', { class: 'campo' }, h('label', { for: 'nome-fam' }, 'Come si chiama questo albero'), campo), [
    h('button', { type: 'button', class: 'pulsante primario', onclick: async () => {
      if (!campo.value.trim()) return;
      try { await conAttesa(stato.api.rinomina(campo.value.trim())); await ricarica(); chiudi(); avvisa('Nome cambiato'); vai({ v: 'altro' }, true); }
      catch (e) { avvisa(messaggioErrore(e), true); }
    } }, 'Salva')]);
}

const linkDi = chiave => location.origin + location.pathname + (IN_PROVA && CFG.supabaseUrl ? '?prova' : '') + '#k=' + chiave;
function riquadroLink(titolo, spiegazione, url, testoCondivisione) {
  const qr = h('div', { class: 'qr', 'aria-label': 'Codice QR del link' });
  if (window.qrcode) {
    try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
    catch { qr.hidden = true; }
  } else qr.hidden = true;
  return h('div', { class: 'riquadro spazio' }, h('h2', null, titolo), h('p', { class: 'tenue' }, spiegazione), qr,
    h('div', { class: 'link-testo' }, url),
    h('div', { class: 'fila' },
      navigator.share ? h('button', { type: 'button', class: 'pulsante primario', onclick: () => navigator.share({ title: 'Albero di famiglia', text: testoCondivisione, url }).catch(() => {}) }, 'Condividi (WhatsApp, mail…)') : null,
      h('button', { type: 'button', class: 'pulsante', onclick: () => copia(url) }, 'Copia il link')));
}
async function copia(testo) {
  try { await navigator.clipboard.writeText(testo); avvisa('Link copiato'); }
  catch { apriFinestra('Copia il link', h('div', { class: 'link-testo' }, testo)); }
}
VISTE.invita = vista => {
  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'), h('h1', { style: 'margin-bottom:14px' }, 'Invita un familiare'));
  const box = h('div', { class: 'spazio' });
  vista.append(box);
  if (stato.invito) {
    box.append(riquadroLink('Link per i familiari', 'Chi apre questo link può vedere l’albero e aggiungere o correggere informazioni. Mandalo solo ai parenti.', linkDi(stato.invito), `Ecco il link per il nostro albero di famiglia (${stato.famiglia.nome}). Aggiungi anche tu foto e ricordi!`));
  }
  if (stato.ruolo === 'referente') {
    box.append(h('div', { class: 'riquadro spazio' }, h('h2', null, 'Il link è finito alla persona sbagliata?'),
      h('p', { class: 'tenue' }, 'Puoi crearne uno nuovo: quello vecchio smette subito di funzionare, e dovrai rimandare quello nuovo a tutti i familiari.'),
      h('button', { type: 'button', class: 'pulsante pericolo', onclick: async () => {
        if (!await conferma('Cambiare il link d’invito?', 'Il link attuale smetterà di funzionare per tutti. Dovrai mandare quello nuovo a ogni familiare.', 'Sì, cambialo', true)) return;
        try { stato.invito = await conAttesa(stato.api.nuovoInvito()); avvisa('Link cambiato'); vai({ v: 'invita' }, true); }
        catch (e) { avvisa(messaggioErrore(e), true); }
      } }, 'Crea un link nuovo')),
    h('div', { class: 'riquadro spazio' }, h('h2', null, 'Il tuo link da referente'),
      h('p', { class: 'tenue' }, 'Questo tienilo per te: in più permette di ripristinare tutto l’albero e di cambiare il link d’invito.'),
      h('button', { type: 'button', class: 'pulsante', onclick: () => copia(linkDi(stato.chiave)) }, 'Copia il mio link da referente')));
  }
};

VISTE.guida = vista => {
  const passo = (n, titolo, testo) => h('div', { class: 'riquadro', style: 'display:flex;gap:14px' },
    h('span', { class: 'volto', style: 'width:36px;height:36px;font-size:1rem' }, String(n)), h('div', null, h('h2', null, titolo), h('p', { class: 'tenue', style: 'margin-top:4px' }, testo)));
  vista.append(h('button', { type: 'button', class: 'indietro', onclick: () => history.back() }, '‹ Indietro'),
    h('h1', { style: 'margin-bottom:14px' }, 'Come si usa'), h('div', { class: 'spazio' },
      passo(1, 'Guarda l’albero', 'Nella scheda Albero c’è una persona al centro, con sopra genitori e nonni e sotto figli e nipoti. Tocca un parente per metterlo al centro; tocca quello al centro per aprire la sua scheda.'),
      passo(2, 'Aggiungi un parente', 'Tocca un riquadro con il “+” (per esempio “Aggiungi padre o madre”). Scegli se è una persona nuova o una già presente nell’albero.'),
      passo(3, 'Foto e date', 'Nella scheda di una persona tocca Modifica. Puoi scegliere una foto dal telefono o scattarla, e ritagliare solo il viso. Per le date basta anche il solo anno.'),
      passo(4, 'Se sbagli', 'Nella scheda Novità c’è tutto quello che è stato fatto, da chi e quando: ogni modifica si può annullare. Per tornare indietro di giorni ci sono le copie serali (Altro › Copie serali).'),
      passo(5, 'Invita gli altri', 'Da Altro › Invita un familiare mandi il link su WhatsApp o mostri il codice QR da inquadrare col telefono.'),
      passo(6, 'Stampa l’albero', 'Da Altro › Stampa l’albero (o dal pulsante Stampa sopra l’albero) scegli se stampare tutta la famiglia o solo un ramo e la grandezza del foglio. Chi è in vita è in verde, chi non c’è più in grigio con la croce. Si può salvare anche in PDF.'),
      passo(7, 'Sul telefono come un’app', 'Su iPhone: Condividi › Aggiungi alla schermata Home. Su Android: menu ⋮ › Aggiungi a schermata Home.')));
};

/* ================================================================ GESTORE */
VISTE.gestore = async vista => {
  vista.append(h('div', { class: 'fila', style: 'justify-content:space-between;margin-bottom:6px' }, h('h1', null, 'Famiglie'),
    h('button', { type: 'button', class: 'pulsante primario piccolo', onclick: nuovaFamiglia }, '+ Nuova famiglia')),
  h('p', { class: 'tenue', style: 'margin-bottom:12px' }, 'Sei il gestore: crei le famiglie e consegni i link. Ogni famiglia vede solo il proprio albero.'));
  const box = h('div', { class: 'spazio' }, h('p', { class: 'tenue' }, 'Caricamento…'));
  vista.append(box);
  let elenco;
  try { elenco = await conAttesa(stato.api.famiglie()); }
  catch (e) { svuota(box).append(h('p', null, messaggioErrore(e))); return; }
  svuota(box);
  if (!elenco.length) box.append(h('div', { class: 'riquadro vuoto' }, h('p', null, 'Nessuna famiglia ancora. Crea la prima.')));
  for (const f of elenco) {
    const ultima = f.ultima_modifica ? quando(f.ultima_modifica) : null;
    const copiaS = f.ultima_copia ? quando(f.ultima_copia) : null;
    box.append(h('div', { class: 'riquadro spazio' },
      h('div', null, h('h2', null, f.nome), h('p', { class: 'tenue piccolo-testo' },
        `${f.persone} persone, ${f.foto} con foto · ultima modifica: ${ultima ? ultima.giorno.toLowerCase() + ' ' + ultima.ora : 'nessuna'} · ultima copia serale: ${copiaS ? copiaS.giorno.toLowerCase() : 'nessuna'}`)),
      h('div', { class: 'fila' },
        h('button', { type: 'button', class: 'pulsante piccolo', onclick: () => copia(linkDi(f.chiave)) }, 'Copia link familiari'),
        h('a', { class: 'pulsante piccolo', href: linkDi(f.chiave), target: '_blank', rel: 'noopener' }, 'Apri l’albero'),
        h('button', { type: 'button', class: 'pulsante piccolo', onclick: async () => {
          if (!await conferma('Nuovo link per il referente?', `Il vecchio link da referente di «${f.nome}» smetterà di funzionare.`, 'Sì, crealo')) return;
          try { const k = await conAttesa(stato.api.nuovoReferente(f.id)); mostraLinkNuovi(f.nome, null, k); }
          catch (e) { avvisa(messaggioErrore(e), true); }
        } }, 'Nuovo link referente'),
        h('button', { type: 'button', class: 'pulsante piccolo pericolo', onclick: () => eliminaFamiglia(f) }, 'Elimina'))));
  }
};
function nuovaFamiglia() {
  const campo = h('input', { type: 'text', id: 'nuova-fam', maxlength: 80, placeholder: 'es. Famiglia Bianchi' });
  const chiudi = apriFinestra('Nuova famiglia', h('div', { class: 'campo' }, h('label', { for: 'nuova-fam' }, 'Nome della famiglia'), campo), [
    h('button', { type: 'button', class: 'pulsante primario', onclick: async () => {
      const nome = campo.value.trim(); if (!nome) { campo.focus(); return; }
      try { const r = await conAttesa(stato.api.creaFamiglia(nome)); chiudi(); mostraLinkNuovi(nome, r.chiave, r.chiave_referente); }
      catch (e) { avvisa(messaggioErrore(e), true); }
    } }, 'Crea')]);
}
function mostraLinkNuovi(nome, chiave, chiaveRef) {
  vai({ v: 'gestore' }, true);   // prima ridisegno l'elenco, poi apro la finestra sopra
  apriFinestra('Link di «' + nome + '»', h('div', { class: 'spazio' },
    h('p', { class: 'etichetta allarme' }, 'Il link del referente si vede solo adesso: copialo e consegnalo.'),
    chiave ? riquadroLink('Per i familiari', 'Vedono e modificano l’albero.', linkDi(chiave), `Il link per l’albero di famiglia ${nome}`) : null,
    riquadroLink('Per il referente', 'Tutto quello che fanno i familiari, più il ripristino completo e il cambio del link d’invito.', linkDi(chiaveRef), `Il tuo link da referente per l’albero ${nome}: tienilo per te`)));
}
function eliminaFamiglia(f) {
  const campo = h('input', { type: 'text', id: 'conf-elim', autocomplete: 'off' });
  const chiudi = apriFinestra('Eliminare «' + f.nome + '»?', h('div', { class: 'spazio' },
    h('p', null, `Si cancellano per sempre le ${f.persone} persone, le foto, le copie serali e il registro di questa famiglia. Non si può tornare indietro (resta solo l’eventuale copia sul PC).`),
    h('div', { class: 'campo' }, h('label', { for: 'conf-elim' }, 'Per confermare, scrivi il nome della famiglia: ' + f.nome), campo)), [
    h('button', { type: 'button', class: 'pulsante', onclick: () => chiudi() }, 'Lascia stare'),
    h('button', { type: 'button', class: 'pulsante pericolo-pieno', onclick: async () => {
      try { await conAttesa(stato.api.eliminaFamiglia(f.id, campo.value)); chiudi(); avvisa('Famiglia eliminata'); vai({ v: 'gestore' }, true); }
      catch (e) { avvisa(messaggioErrore(e), true); }
    } }, 'Elimina per sempre')]);
}

/* ================================================================ AVVIO */
function schermataIngresso(titolo, testo) {
  $('#schede').hidden = true;
  svuota($('#vista')).append(h('div', { class: 'ingresso riquadro' },
    $('.logo').cloneNode(true), h('h1', null, titolo), h('p', { class: 'tenue', style: 'margin-top:10px' }, testo)));
}
async function avvia() {
  // la chiave arriva nel link (#k=... o #g=...), poi la tolgo dalla barra dell'indirizzo
  const frammento = new URLSearchParams(location.hash.slice(1));
  if (frammento.get('k')) { memoria.scrivi(PREFISSO + 'chiave', frammento.get('k')); memoria.scrivi(PREFISSO + 'modo', 'famiglia'); }
  if (frammento.get('g')) { memoria.scrivi(PREFISSO + 'gestore', frammento.get('g')); memoria.scrivi(PREFISSO + 'modo', 'gestore'); }
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  if (IN_PROVA) {
    const avviso = $('#avviso-prova');
    avviso.hidden = false;
    avviso.textContent = 'Modalità prova: famiglia inventata, i dati restano solo su questo dispositivo.';
    if (!memoria.leggi(PREFISSO + 'modo')) { memoria.scrivi(PREFISSO + 'chiave', window.PROVA.chiavi.referente); memoria.scrivi(PREFISSO + 'modo', 'famiglia'); }
  }
  const crea = k => IN_PROVA ? window.PROVA.api(k) : backendRemoto(k);
  const modo = memoria.leggi(PREFISSO + 'modo');

  if (modo === 'gestore' && memoria.leggi(PREFISSO + 'gestore')) {
    stato.modo = 'gestore'; stato.chiave = memoria.leggi(PREFISSO + 'gestore'); stato.api = crea(stato.chiave);
    $('#nome-famiglia').textContent = 'Gestione famiglie';
    $('#sottotitolo').textContent = 'Albero di famiglia';
    aggiornaChiSono();
    vai({ v: 'gestore' }, true);
    return;
  }
  const chiave = memoria.leggi(PREFISSO + 'chiave');
  if (!chiave) { schermataIngresso('Serve il link d’invito', 'Per entrare nell’albero di famiglia apri il link che ti ha mandato un parente (su WhatsApp o per mail).'); return; }
  stato.modo = 'famiglia'; stato.chiave = chiave; stato.api = crea(chiave);
  try { await ricarica(); }
  catch (e) {
    if (String(e.message).includes('chiave_non_valida')) { memoria.scrivi(PREFISSO + 'chiave', null); schermataIngresso('Questo link non funziona più', MESSAGGI.chiave_non_valida); }
    else schermataIngresso('Non riesco a caricare l’albero', messaggioErrore(e));
    return;
  }
  $('#schede').hidden = false;
  aggiornaChiSono();
  vai({ v: 'albero' }, true);
  if (!stato.chi) chiediNome();
  // quando si torna sull'app, si aggiornano i dati (altri potrebbero aver aggiunto qualcosa)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || $('#finestre').childElementCount) return;
    const s = history.state || { v: 'albero' };
    if (s.v === 'modifica') return;
    try { await ricarica(); disegna(s); } catch { /* resta quel che c'è */ }
  });
}
// un link nuovo aperto mentre l'app e' gia' aperta nella stessa scheda: riparto da capo
window.addEventListener('hashchange', () => { if (/(^#|&)(k|g)=/.test(location.hash)) location.reload(); });
avvia();
