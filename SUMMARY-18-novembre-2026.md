# Summary della sessione del 18 novembre 2026 - Albero di famiglia

## Cosa è stato chiesto
1. App web per l'albero genealogico: foto, data di nascita, eventuale data di morte, luogo di nascita, parentele.
2. Accesso dei familiari tramite link, per arricchire le informazioni.
3. Usabile da PC e da smartphone.
4. Ritaglio della foto al caricamento.
5. Una copia ogni sera, per rimediare agli errori di immissione.
6. Multi-famiglia: quella dell'utente più altre famiglie separate.
7. Istruzioni visuali e video, con musica da `Musica\adobe stock acquisti` e voce dell'utente "peppe02 v4" su ElevenLabs.

Scelte dell'utente: sito autonomo (si entra senza account); tutti i familiari possono modificare tutto;
GitHub Pages con repository pubblico; musica "Carefree Happy Piano" (prova 1).

## Cosa è stato fatto
| Parte | Stato |
|---|---|
| App (`app/`) | Completa, provata in automatico su telefono e PC |
| Online | **https://gvasta62.github.io/albero-di-famiglia/** (si ripubblica da sola a ogni push) |
| Database | Supabase, progetto `elmvqzftepsvharujrms`; SQL caricato dall'utente nello SQL Editor |
| Prova dal vivo | 39 controlli su tutte le funzioni: tutti riusciti dopo una correzione |
| Copia serale | pg_cron alle 21:00 UTC, 30 giorni: attiva e provata |
| Copia notturna OneDrive | Script provato a mano: funziona |
| Famiglia dell'utente | Creata dall'utente con il link del gestore |
| Video-guida | `Albero di famiglia - Video guida.mp4`, 2 min 53 s, voce peppe02 (eleven_v4), sottotitoli |
| Istruzioni PDF | `Albero di famiglia - Istruzioni.pdf`, 2 pagine A4, 10 passi con schermate |

## Problemi incontrati e soluzioni
- **PostgreSQL locale bloccato** dal controllo automatico: l'SQL è stato verificato direttamente su Supabase.
- **Access token Supabase** non disponibile: l'utente ha mandato la chiave publishable. Gli script SQL
  li ha eseguiti lui, copiati negli appunti da me.
- **Errore SQL "column reference a is ambiguous"**: la variabile `a` si confondeva con la colonna `a` di `relazioni`.
  Rinominata `acc` in tutte le funzioni.
- **Registrazione video a bassa risoluzione**: `record_video` di Playwright riprendeva solo l'angolo a 1x.
  Sostituito con lo screencast di Chrome (CDP) a 780x1688.
- **Nel video compariva il percorso del PC** nel link d'invito: la registrazione ora usa il sito online in modalità prova.
- **Testi della voce allineati ai pulsanti veri** dell'app: "Usa questa parte", "Persona nuova".

## Dove stanno le cose
- Link del gestore: `segreti\link_gestore.txt` e `segreti\Albero di famiglia - gestore.url` (mai su GitHub).
- Video e PDF: rifare tutto con `guida video\Rigenera_video.bat`; i testi stanno in `guida video\copione.py`.
- Stato aggiornato e note per chi riprende: `PUNTO_DELLA_SITUAZIONE.md`.

## Cosa resta da fare
- [ ] Lanciare `copia notturna\Attiva_copia_notturna.bat` (lo fa l'utente) per la copia di ogni sera su OneDrive.
- [ ] Facoltativo: nei commit pubblici compare l'indirizzo gmail dell'utente. Si può sostituire con l'indirizzo
      anonimo di GitHub, se l'utente lo chiede.
- [ ] Facoltativo: funzione `gestore_importa` per ricaricare una copia OneDrive in caso di perdita totale di Supabase.
- [ ] Facoltativo: versione verticale del video, per il telefono.
