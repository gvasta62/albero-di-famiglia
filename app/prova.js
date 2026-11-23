/* =====================================================================
   Modalita' prova: imita il database vero dentro il browser, con
   famiglie inventate. Serve per provare l'app e per girare il video.
   Le regole sono le stesse di database/01_struttura.sql.
   ===================================================================== */
'use strict';
(function () {
  const CHIAVI = {
    familiare: 'prova-familiare-rossi-0001',
    referente: 'prova-referente-rossi-0001',
    gestore: 'prova-gestore-00000000001',
    esposito: 'prova-familiare-esposito-01'
  };
  const MEM = 'albero-prova-db-v3';   // v3: con la residenza
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  }));
  const clona = x => JSON.parse(JSON.stringify(x));
  const ora = () => new Date().toISOString();
  const nuovaChiave = () => Array.from({ length: 32 }, () => (Math.random() * 16 | 0).toString(16)).join('');
  const nomeP = p => (p.nome + ' ' + (p.cognome || '')).trim();
  const giornoRoma = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

  /* ------------------------------------------------------------ dati inventati */
  function semina() {
    const db = { gestore: CHIAVI.gestore, famiglie: [], persone: [], foto: {}, relazioni: [], registro: [], copie: [] };
    const fR = { id: uuid(), nome: 'Famiglia Rossi', chiave: CHIAVI.familiare, admin: CHIAVI.referente, creata_il: ora() };
    const fE = { id: uuid(), nome: 'Famiglia Esposito', chiave: CHIAVI.esposito, admin: 'prova-referente-esposito-1', creata_il: ora() };
    db.famiglie.push(fR, fE);
    const giorniFa = (n, h = 18) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 12, 0, 0); return d.toISOString(); };
    const P = {};
    const persona = (k, fid, nome, cognome, sesso, nascita, luogo, morte, note, chi, quando) => {
      const p = { id: uuid(), famiglia_id: fid, nome, cognome, sesso, data_nascita: nascita, luogo_nascita: luogo,
        deceduto: morte !== null, data_morte: morte || '', note: note || '', miniatura: '', foto_id: null, residenza_citta: '', residenza_indirizzo: '',
        creato_da: chi, creato_il: quando, aggiornato_da: chi, aggiornato_il: quando };
      db.persone.push(p); P[k] = p; return p;
    };
    const t = giorniFa(6);
    persona('giovanni', fR.id, 'Giovanni', 'Rossi', 'M', '1921-03-14', 'Perugia', '1995-01-08', 'Ferroviere, capostazione a Foligno per vent’anni. Suonava la fisarmonica alle feste del paese.', 'Marco Rossi', t);
    persona('maria', fR.id, 'Maria', 'Bianchi', 'F', '1924-07-02', 'Assisi', '2010-11-21', 'Sarta. Ha cucito l’abito da sposa di tutte le nipoti.', 'Marco Rossi', t);
    persona('pietro', fR.id, 'Pietro', 'Verdi', 'M', '1922', 'Spoleto', '1999', '', 'Elena Rossi', t);
    persona('anna', fR.id, 'Anna', 'Gallo', 'F', '1926-09', 'Spoleto', '2015-04-30', '', 'Elena Rossi', t);
    persona('antonio', fR.id, 'Antonio', 'Rossi', 'M', '1948-05-12', 'Perugia', null, 'Maestro elementare in pensione. Coltiva l’orto e i ricordi di famiglia.', 'Marco Rossi', t);
    persona('carla', fR.id, 'Carla', 'Verdi', 'F', '1950-10-03', 'Foligno', null, '', 'Marco Rossi', t);
    persona('lucia', fR.id, 'Lucia', 'Rossi', 'F', '1952-02-19', 'Perugia', null, 'Infermiera a Milano dal 1975.', 'Elena Rossi', t);
    persona('paolo', fR.id, 'Paolo', 'Ferri', 'M', '1949', 'Milano', null, '', 'Elena Rossi', t);
    persona('marco', fR.id, 'Marco', 'Rossi', 'M', '1975-06-21', 'Perugia', null, '', 'Marco Rossi', t);
    persona('sara', fR.id, 'Sara', 'Neri', 'F', '1977-01-30', 'Terni', null, '', 'Marco Rossi', t);
    persona('elena', fR.id, 'Elena', 'Rossi', 'F', '1979-08-09', 'Perugia', null, '', 'Elena Rossi', t);
    persona('luca', fR.id, 'Luca', 'Rossi', 'M', '2005-04-04', 'Perugia', null, '', 'Marco Rossi', t);
    persona('giulia', fR.id, 'Giulia', 'Rossi', 'F', '2008-12-15', 'Perugia', null, '', 'Marco Rossi', t);
    persona('chiara', fR.id, 'Chiara', 'Ferri', 'F', '1980', 'Milano', null, '', 'Elena Rossi', t);
    persona('gennaro', fE.id, 'Gennaro', 'Esposito', 'M', '1940', 'Napoli', null, '', 'Gestore', t);
    persona('rosa', fE.id, 'Rosa', 'Esposito', 'F', '1968', 'Napoli', null, '', 'Gestore', t);
    // dove vivono oggi (inventato), per la scheda e per la mappa
    const vive = { antonio: ['Perugia', 'via dei Priori 14'], carla: ['Perugia', 'via dei Priori 14'], lucia: ['Milano', ''], paolo: ['Milano', ''],
      marco: ['Perugia', 'via Settevalli 120'], sara: ['Perugia', 'via Settevalli 120'], elena: ['Roma', ''], luca: ['Bologna', ''],
      giulia: ['Perugia', ''], chiara: ['Londra', ''], rosa: ['Napoli', ''] };
    for (const [k, [c, i]] of Object.entries(vive)) { P[k].residenza_citta = c; P[k].residenza_indirizzo = i; }
    const gen = (a, b) => db.relazioni.push({ id: uuid(), famiglia_id: P[a].famiglia_id, tipo: 'genitore', da: P[a].id, a: P[b].id, dettaglio: '' });
    const cop = (a, b, d) => { const [x, y] = [P[a].id, P[b].id].sort(); db.relazioni.push({ id: uuid(), famiglia_id: P[a].famiglia_id, tipo: 'coppia', da: x, a: y, dettaglio: d }); };
    cop('giovanni', 'maria', 'sposati'); cop('pietro', 'anna', 'sposati'); cop('antonio', 'carla', 'sposati');
    cop('lucia', 'paolo', 'sposati'); cop('marco', 'sara', 'conviventi');
    for (const f of ['antonio', 'lucia']) { gen('giovanni', f); gen('maria', f); }
    gen('pietro', 'carla'); gen('anna', 'carla');
    for (const f of ['marco', 'elena']) { gen('antonio', f); gen('carla', f); }
    for (const f of ['luca', 'giulia']) { gen('marco', f); gen('sara', f); }
    gen('lucia', 'chiara'); gen('paolo', 'chiara');
    gen('gennaro', 'rosa');

    // le copie serali: tre sere fa c'era anche Teresa (poi eliminata), ieri Lucia aveva un'altra nota
    const istantanea = fid => ({ persone: clona(db.persone.filter(p => p.famiglia_id === fid)), relazioni: clona(db.relazioni.filter(r => r.famiglia_id === fid)) });
    const teresa = { ...clona(P.lucia), id: uuid(), nome: 'Teresa', cognome: 'Rossi', data_nascita: '1955', note: '', sesso: 'F' };
    for (let n = 5; n >= 1; n--) {
      const s = istantanea(fR.id);
      if (n >= 3) { s.persone.push(teresa); s.relazioni.push({ id: uuid(), famiglia_id: fR.id, tipo: 'genitore', da: P.giovanni.id, a: teresa.id, dettaglio: '' }); }
      if (n === 1) s.persone.find(p => p.id === P.lucia.id).note = 'Infermiera a Milano dal 1975. Due figli.';
      db.copie.push({ id: db.copie.length + 1, famiglia_id: fR.id, giorno: giornoRoma(giorniFa(n)), creata_il: giorniFa(n, 22), motivo: 'serale', dati: s });
      db.copie.push({ id: db.copie.length + 1, famiglia_id: fE.id, giorno: giornoRoma(giorniFa(n)), creata_il: giorniFa(n, 22), motivo: 'serale', dati: istantanea(fE.id) });
    }
    const reg = (chi, azione, descr, quando, prima = null) => db.registro.push({ id: db.registro.length + 1, famiglia_id: fR.id, quando, chi, azione, descrizione: descr, prima, ripristinato: false });
    reg('Marco Rossi', 'aggiunta_persona', 'Aggiunta Giovanni Rossi', giorniFa(6, 10));
    reg('Elena Rossi', 'aggiunta_persona', 'Aggiunta Chiara Ferri', giorniFa(4, 21));
    reg('Lucia Rossi', 'elimina_persona', 'Eliminata Teresa Rossi', giorniFa(2, 9), { persona: teresa, relazioni: [] });
    reg('Lucia Rossi', 'modifica_persona', 'Modificata Lucia Rossi', giorniFa(0, 8), { persona: { ...clona(P.lucia), note: 'Infermiera a Milano dal 1975. Due figli.' }, foto_cambiata: false });
    return db;
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(MEM) || 'null'); } catch { db = null; }
  if (!db) db = semina();
  let avvisato = false;
  const salva = () => {
    try { localStorage.setItem(MEM, JSON.stringify(db)); }
    catch { if (!avvisato) { avvisato = true; console.warn('Spazio del browser esaurito: in prova i dati restano solo finché la pagina è aperta.'); } }
  };
  salva();

  /* ------------------------------------------------------------ le stesse funzioni del database */
  const errore = c => { throw new Error(c); };
  function accesso(k) {
    let f = db.famiglie.find(x => x.admin === k);
    if (f) return { fid: f.id, ruolo: 'referente' };
    f = db.famiglie.find(x => x.chiave === k);
    if (f) return { fid: f.id, ruolo: 'familiare' };
    return errore('chiave_non_valida');
  }
  const gestore = k => { if (k !== db.gestore) errore('chiave_non_valida'); };
  const registra = (fid, chi, azione, descrizione, prima = null) => db.registro.push({ id: Math.max(0, ...db.registro.map(r => r.id)) + 1, famiglia_id: fid, quando: ora(), chi: (chi || '').slice(0, 60), azione, descrizione, prima: prima ? clona(prima) : null, ripristinato: false });
  const istantanea = fid => ({ persone: clona(db.persone.filter(p => p.famiglia_id === fid)), relazioni: clona(db.relazioni.filter(r => r.famiglia_id === fid)) });
  const senzaFid = x => { const y = clona(x); delete y.famiglia_id; return y; };
  const esiste = (fid, id) => db.persone.some(p => p.id === id && p.famiglia_id === fid);
  const fotoOk = (p, foto) => { if (p.foto_id && !db.foto[p.foto_id]) { p.foto_id = null; p.miniatura = ''; } return p; };
  const dmy = g => g.split('-').reverse().join('/');
  const inserisciLegami = (fid, lista, filtro = () => true) => {
    for (const r of lista) {
      if (!filtro(r) || !esiste(fid, r.da) || !esiste(fid, r.a)) continue;
      if (db.relazioni.some(x => x.id === r.id || (x.tipo === r.tipo && x.da === r.da && x.a === r.a))) continue;
      db.relazioni.push({ ...clona(r), famiglia_id: fid });
    }
  };

  const F = {
    albero_carica(a) {
      const x = accesso(a.p_chiave); const f = db.famiglie.find(y => y.id === x.fid);
      return { famiglia: { id: f.id, nome: f.nome }, ruolo: x.ruolo, invito: x.ruolo === 'referente' ? f.chiave : null,
        persone: db.persone.filter(p => p.famiglia_id === x.fid).map(senzaFid), relazioni: db.relazioni.filter(r => r.famiglia_id === x.fid).map(senzaFid) };
    },
    albero_foto(a) { const x = accesso(a.p_chiave); const f = db.foto[a.p_foto_id]; return f && f.famiglia_id === x.fid ? f.dati : ''; },
    albero_salva_persona(a) {
      const x = accesso(a.p_chiave); const v = a.p_persona;
      if (!(v.nome || '').trim()) errore('nome_mancante');
      let fotoId = null;
      if (a.p_foto) { fotoId = uuid(); db.foto[fotoId] = { famiglia_id: x.fid, dati: a.p_foto }; }
      const campi = { nome: v.nome.trim(), cognome: (v.cognome || '').trim(), sesso: v.sesso || '', data_nascita: v.data_nascita || '', luogo_nascita: (v.luogo_nascita || '').trim(), deceduto: !!v.deceduto, data_morte: v.data_morte || '', note: v.note || '', residenza_citta: (v.residenza_citta || '').trim(), residenza_indirizzo: (v.residenza_indirizzo || '').trim() };
      if (!v.id) {
        const p = { id: uuid(), famiglia_id: x.fid, ...campi, miniatura: a.p_foto ? (a.p_miniatura || '') : '', foto_id: fotoId, creato_da: a.p_chi, creato_il: ora(), aggiornato_da: a.p_chi, aggiornato_il: ora() };
        db.persone.push(p); registra(x.fid, a.p_chi, 'aggiunta_persona', 'Aggiunta ' + nomeP(p)); return p.id;
      }
      const p = db.persone.find(y => y.id === v.id && y.famiglia_id === x.fid) || errore('persona_non_trovata');
      const prima = clona(p);
      Object.assign(p, campi, { aggiornato_da: a.p_chi, aggiornato_il: ora() });
      if (a.p_foto === '') { p.miniatura = ''; p.foto_id = null; }
      else if (a.p_foto) { p.miniatura = a.p_miniatura || ''; p.foto_id = fotoId; }
      registra(x.fid, a.p_chi, 'modifica_persona', 'Modificata ' + nomeP(p) + (a.p_foto == null ? '' : a.p_foto === '' ? ' (tolta la foto)' : ' (nuova foto)'), { persona: prima, foto_cambiata: a.p_foto != null });
      return p.id;
    },
    albero_elimina_persona(a) {
      const x = accesso(a.p_chiave);
      const p = db.persone.find(y => y.id === a.p_id && y.famiglia_id === x.fid) || errore('persona_non_trovata');
      registra(x.fid, a.p_chi, 'elimina_persona', 'Eliminata ' + nomeP(p), { persona: p, relazioni: db.relazioni.filter(r => r.da === p.id || r.a === p.id) });
      db.persone = db.persone.filter(y => y.id !== p.id);
      db.relazioni = db.relazioni.filter(r => r.da !== p.id && r.a !== p.id);
    },
    albero_salva_relazione(a) {
      const x = accesso(a.p_chiave);
      if (!['genitore', 'coppia'].includes(a.p_tipo)) errore('tipo_non_valido');
      if (a.p_da === a.p_a) errore('stessa_persona');
      const p1 = db.persone.find(y => y.id === a.p_da && y.famiglia_id === x.fid), p2 = db.persone.find(y => y.id === a.p_a && y.famiglia_id === x.fid);
      if (!p1 || !p2) errore('persona_non_trovata');
      let [da, aa] = [a.p_da, a.p_a];
      if (a.p_tipo === 'coppia') [da, aa] = [da, aa].sort();
      else if (db.relazioni.some(r => r.tipo === 'genitore' && r.da === a.p_a && r.a === a.p_da)) errore('legame_circolare');
      let r = db.relazioni.find(y => y.tipo === a.p_tipo && y.da === da && y.a === aa);
      if (r) r.dettaglio = a.p_dettaglio || '';
      else { r = { id: uuid(), famiglia_id: x.fid, tipo: a.p_tipo, da, a: aa, dettaglio: a.p_dettaglio || '' }; db.relazioni.push(r); }
      registra(x.fid, a.p_chi, 'aggiunta_relazione', a.p_tipo === 'genitore' ? `${nomeP(p1)} indicato come genitore di ${nomeP(p2)}` : `${nomeP(p1)} e ${nomeP(p2)} indicati come coppia`);
      return r.id;
    },
    albero_elimina_relazione(a) {
      const x = accesso(a.p_chiave);
      const r = db.relazioni.find(y => y.id === a.p_id && y.famiglia_id === x.fid) || errore('legame_non_trovato');
      const n1 = nomeP(db.persone.find(p => p.id === r.da)), n2 = nomeP(db.persone.find(p => p.id === r.a));
      registra(x.fid, a.p_chi, 'elimina_relazione', r.tipo === 'genitore' ? `Tolto il legame: ${n1} genitore di ${n2}` : `Tolto il legame di coppia tra ${n1} e ${n2}`, r);
      db.relazioni = db.relazioni.filter(y => y.id !== r.id);
    },
    albero_registro(a) {
      const x = accesso(a.p_chiave);
      return db.registro.filter(r => r.famiglia_id === x.fid).sort((p, q) => q.id - p.id).slice(0, 300)
        .map(r => ({ id: r.id, quando: r.quando, chi: r.chi, azione: r.azione, descrizione: r.descrizione, annullabile: !!r.prima && !r.ripristinato, annullato: r.ripristinato }));
    },
    albero_ripristina(a) {
      const x = accesso(a.p_chiave);
      const v = db.registro.find(r => r.id === a.p_id && r.famiglia_id === x.fid);
      if (!v || !v.prima || v.ripristinato) errore('non_annullabile');
      if (v.azione === 'elimina_persona') {
        const p = fotoOk({ ...clona(v.prima.persona), famiglia_id: x.fid });
        if (!db.persone.some(y => y.id === p.id)) db.persone.push(p);
        inserisciLegami(x.fid, v.prima.relazioni || []);
      } else if (v.azione === 'modifica_persona') {
        const vp = fotoOk(clona(v.prima.persona));
        const p = db.persone.find(y => y.id === vp.id && y.famiglia_id === x.fid) || errore('persona_non_trovata');
        for (const k of ['nome', 'cognome', 'sesso', 'data_nascita', 'luogo_nascita', 'deceduto', 'data_morte', 'note', 'residenza_citta', 'residenza_indirizzo']) p[k] = vp[k] ?? (k.startsWith('residenza') ? '' : vp[k]);
        if (v.prima.foto_cambiata) { p.miniatura = vp.miniatura; p.foto_id = vp.foto_id; }
        p.aggiornato_da = a.p_chi; p.aggiornato_il = ora();
      } else if (v.azione === 'elimina_relazione') {
        if (!esiste(x.fid, v.prima.da) || !esiste(x.fid, v.prima.a)) errore('persona_non_trovata');
        inserisciLegami(x.fid, [v.prima]);
      } else errore('non_annullabile');
      v.ripristinato = true;
      registra(x.fid, a.p_chi, 'annullamento', 'Annullato: ' + v.descrizione);
    },
    albero_copie(a) {
      const x = accesso(a.p_chiave);
      return db.copie.filter(c => c.famiglia_id === x.fid).sort((p, q) => q.creata_il.localeCompare(p.creata_il))
        .map(c => ({ id: c.id, giorno: c.giorno, creata_il: c.creata_il, motivo: c.motivo, persone: c.dati.persone.length }));
    },
    albero_copia(a) { const x = accesso(a.p_chiave); const c = db.copie.find(y => y.id === a.p_copia_id && y.famiglia_id === x.fid) || errore('copia_non_trovata'); return clona(c.dati); },
    albero_ripristina_persona(a) {
      const x = accesso(a.p_chiave);
      const c = db.copie.find(y => y.id === a.p_copia_id && y.famiglia_id === x.fid) || errore('copia_non_trovata');
      const vp = fotoOk({ ...clona(c.dati.persone.find(p => p.id === a.p_persona_id) || errore('persona_non_trovata')), famiglia_id: x.fid });
      const ora_ = db.persone.find(p => p.id === vp.id);
      if (ora_) {
        registra(x.fid, a.p_chi, 'modifica_persona', `Rimessa com'era il ${dmy(c.giorno)}: ${nomeP(ora_)}`, { persona: ora_, foto_cambiata: true });
        Object.assign(ora_, vp, { aggiornato_da: a.p_chi, aggiornato_il: ora() });
      } else {
        db.persone.push(vp);
        registra(x.fid, a.p_chi, 'aggiunta_persona', `Recuperata dalla copia del ${dmy(c.giorno)}: ${nomeP(vp)}`);
      }
      inserisciLegami(x.fid, c.dati.relazioni, r => r.da === vp.id || r.a === vp.id);
    },
    albero_ripristina_copia(a) {
      const x = accesso(a.p_chiave);
      if (x.ruolo !== 'referente') errore('serve_referente');
      const c = db.copie.find(y => y.id === a.p_copia_id && y.famiglia_id === x.fid) || errore('copia_non_trovata');
      db.copie.push({ id: Math.max(...db.copie.map(y => y.id)) + 1, famiglia_id: x.fid, giorno: giornoRoma(new Date()), creata_il: ora(), motivo: 'prima del ripristino', dati: istantanea(x.fid) });
      db.persone = db.persone.filter(p => p.famiglia_id !== x.fid).concat(clona(c.dati.persone).map(p => fotoOk({ ...p, famiglia_id: x.fid })));
      db.relazioni = db.relazioni.filter(r => r.famiglia_id !== x.fid);
      inserisciLegami(x.fid, c.dati.relazioni);
      registra(x.fid, a.p_chi, 'ripristino_completo', `Albero rimesso com'era il ${dmy(c.giorno)}`);
    },
    albero_rinomina(a) { const x = accesso(a.p_chiave); if (x.ruolo !== 'referente') errore('serve_referente'); db.famiglie.find(f => f.id === x.fid).nome = a.p_nome.trim().slice(0, 80); },
    albero_nuovo_invito(a) { const x = accesso(a.p_chiave); if (x.ruolo !== 'referente') errore('serve_referente'); const k = nuovaChiave(); db.famiglie.find(f => f.id === x.fid).chiave = k; return k; },
    gestore_famiglie(a) {
      gestore(a.p_chiave);
      return db.famiglie.map(f => {
        const ps = db.persone.filter(p => p.famiglia_id === f.id);
        const reg = db.registro.filter(r => r.famiglia_id === f.id).map(r => r.quando).sort();
        const cs = db.copie.filter(c => c.famiglia_id === f.id && c.motivo === 'serale').map(c => c.creata_il).sort();
        return { id: f.id, nome: f.nome, creata_il: f.creata_il, chiave: f.chiave, persone: ps.length, foto: ps.filter(p => p.foto_id).length, ultima_modifica: reg.pop() || null, ultima_copia: cs.pop() || null };
      }).sort((p, q) => p.nome.localeCompare(q.nome));
    },
    gestore_crea_famiglia(a) {
      gestore(a.p_chiave); if (!(a.p_nome || '').trim()) errore('nome_mancante');
      const f = { id: uuid(), nome: a.p_nome.trim().slice(0, 80), chiave: nuovaChiave(), admin: nuovaChiave(), creata_il: ora() };
      db.famiglie.push(f); return { id: f.id, chiave: f.chiave, chiave_referente: f.admin };
    },
    gestore_nuovo_referente(a) { gestore(a.p_chiave); const f = db.famiglie.find(y => y.id === a.p_famiglia) || errore('famiglia_non_trovata'); f.admin = nuovaChiave(); return f.admin; },
    gestore_elimina_famiglia(a) {
      gestore(a.p_chiave);
      const f = db.famiglie.find(y => y.id === a.p_famiglia && y.nome === (a.p_conferma || '').trim()) || errore('conferma_errata');
      const via = x => x.famiglia_id !== f.id;
      db.famiglie = db.famiglie.filter(y => y.id !== f.id); db.persone = db.persone.filter(via); db.relazioni = db.relazioni.filter(via);
      db.registro = db.registro.filter(via); db.copie = db.copie.filter(via);
      for (const [k, v] of Object.entries(db.foto)) if (v.famiglia_id === f.id) delete db.foto[k];
    }
  };

  function rpcLocale(chiave) {
    return async (fn, args = {}) => {
      await new Promise(r => setTimeout(r, 120));   // un'attesa realistica, per vedere la barra che si muove
      if (!F[fn]) throw new Error('funzione sconosciuta ' + fn);
      const risultato = F[fn]({ p_chiave: chiave, ...clona(args) });
      salva();
      return risultato === undefined ? null : clona(risultato);
    };
  }

  window.PROVA = {
    chiavi: CHIAVI,
    api: chiave => window.creaApi(rpcLocale(chiave)),
    azzera: () => { try { localStorage.removeItem(MEM); } catch { /* niente */ } }
  };
})();
