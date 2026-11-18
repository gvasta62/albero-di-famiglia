# Punto della situazione - Albero di famiglia

Aggiornato: 18/11/2026

## Richieste dell'utente (tutte nella prima sessione)
1. Albero con foto, data di nascita, eventuale data di morte, luogo di nascita, tipo di parentela.
2. Web, con accesso tramite link per i familiari, che arricchiscono le informazioni.
3. Usabile da PC e da smartphone.
4. Ritaglio di una parte della foto al caricamento.
5. Backup ogni sera, per rimediare agli errori di immissione.
6. Multi-famiglia: la sua più altre famiglie separate.
7. Istruzioni visuali, meglio un video: con musica da `OneDrive\Musica\adobe stock acquisti`
   e voce dell'utente "peppe02 v4" su ElevenLabs.

## Scelte decise dall'utente
- Sito autonomo (non Artifact claude.ai): si entra col solo link, senza account.
- Tutti i familiari possono modificare tutto.

## Scelte mie (da confermare se servisse)
- Le famiglie le crea solo il gestore (l'utente); niente iscrizione libera.
- Tre ruoli: familiare, referente, gestore.
- Legami memorizzati solo come "genitore di" e "coppia" (sposati / conviventi / separati); fratelli, nonni,
  zii, cugini, suoceri, cognati, generi/nuore sono dedotti.
- Date anche parziali (solo anno, o mese/anno).
- Foto ritagliate quadrate.

## Stato
- [x] App completa in `app/`, provata in automatico (telefono 390x844 e PC 1280x860) in modalità prova:
      nome, albero, scheda, modifica con foto e ritaglio, errore data, aggiunta figlio (collegato a entrambi
      i genitori), elenco, Novità con annullamento, copie serali con "rimetti com'era", invito con QR,
      gestore con creazione di una famiglia nuova (vuota e separata). Nessun errore nella pagina.
- [x] Supabase: progetto `elmvqzftepsvharujrms` (https://elmvqzftepsvharujrms.supabase.co), creato dall'utente.
      `01_struttura.sql` e `segreti/02_chiave_gestore.sql` eseguiti dall'utente nello SQL Editor (18/11/2026).
      URL e chiave publishable in `app/config.js` e `segreti/collegamento.json`.
- [x] Prova dal vivo di tutte le funzioni (39 controlli): famiglie, chiavi e ruoli, persone con foto, date parziali,
      legami e rifiuti (circolare, stessa persona), registro e annullamenti, rinomina, nuovo invito e nuovo referente,
      esportazione, copie serali, recupero di una persona, ripristino completo con copia "prima del ripristino",
      eliminazione della famiglia. Trovato e corretto un errore: la variabile `a` era ambigua con la colonna `a`
      di `relazioni` (rinominata `acc` in tutte le funzioni).
- [x] pg_cron attivo: lavoro `albero-copia-serale` alle `0 21 * * *` (UTC).
- [x] Copia notturna su OneDrive provata a mano: funziona. **Manca la programmazione**: l'utente deve lanciare
      `copia notturna/Attiva_copia_notturna.bat`.
- [x] App vera collegata al database aperta col link del gestore: nessuna famiglia ancora, nessun errore.
- [x] Pubblicata su GitHub Pages: **https://gvasta62.github.io/albero-di-famiglia/** (18/11/2026). Repository reso
      pubblico con l'assenso dell'utente; `.github/workflows/pubblica.yml` ripubblica `app/` a ogni push su master.
      Link del gestore in `segreti/link_gestore.txt` e collegamento `segreti/Albero di famiglia - gestore.url`.
- [ ] Prima famiglia vera da creare dal link del gestore (dopo la pubblicazione, così i link sono quelli giusti).
- [x] Video-guida definitivo: `Albero di famiglia - Video guida.mp4` (2 min 53 s, 1920x1080), voce ElevenLabs
      "peppe02" modello eleven_v4, musica Carefree Happy Piano (prova 1, scelta dall'utente il 18/11/2026).
      Registrazione del sito vero in modalità prova (famiglia Rossi inventata). Resta accanto la bozza.
- [x] Istruzioni illustrate: `Albero di famiglia - Istruzioni.pdf` (2 pagine A4, 10 passi con schermate).

## Punti aperti
- Importazione da una copia OneDrive in caso di perdita totale del progetto Supabase: non c'è ancora
  una funzione `gestore_importa`. I file JSON contengono tutto il necessario.

## Note per chi riprende
- Senza access token Supabase: ogni modifica a `database/01_struttura.sql` va rieseguita dall'utente nello SQL Editor
  (lo script si può rieseguire: non cancella dati). Lo copio negli appunti con PowerShell `Set-Clipboard`.
- Per provare la parte copie serali senza aspettare la sera: `select public._copia_serale();` nello SQL Editor.
- Con l'URL valorizzato l'app non è più in modalità prova: per la famiglia inventata aprire `index.html?prova`.
- Video: script in `guida video/` (copione.py testi, voce.py, registra.py, monta.py, istruzioni.py; Rigenera_video.bat fa tutto).
  Il lavoro intermedio sta in %TEMP%lbero_video_lavoro (fuori da OneDrive). La registrazione usa lo screencast
  CDP di Chrome a 780x1688: `record_video` di Playwright riprendeva solo l'angolo a 1x.
