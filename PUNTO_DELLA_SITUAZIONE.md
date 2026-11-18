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
- [x] `database/01_struttura.sql` scritto. **NON ancora eseguito su un PostgreSQL vero**: il controllo automatico
      di Claude Code ha bloccato l'avvio di un PostgreSQL portatile sul PC. Va verificato su Supabase al primo
      caricamento (eseguire, poi provare i link).
- [x] Copia notturna su OneDrive scritta (`copia notturna/`), non ancora provata (manca il database).
- [ ] Progetto Supabase da creare (serve l'account dell'utente).
- [ ] Pubblicazione della pagina: GitHub Pages richiede repository **pubblico** con l'account gratuito
      (nel codice non ci sono segreti né dati); in alternativa Netlify/Cloudflare Pages. Da decidere con l'utente.
- [ ] Video-guida (dopo la messa in linea, oppure girato in modalità prova con la famiglia inventata).

## Punti aperti
- Importazione da una copia OneDrive in caso di perdita totale del progetto Supabase: non c'è ancora
  una funzione `gestore_importa`. I file JSON contengono tutto il necessario.
- Verificare che pg_cron sia attivabile dallo SQL Editor sul piano gratuito (di solito sì).
