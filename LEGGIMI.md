# Albero di famiglia

Applicazione web per costruire insieme l'albero genealogico di una famiglia, da PC e da
smartphone. Ogni familiare entra con un link: aggiunge persone, foto (ritagliate), date,
luoghi e legami di parentela. Più famiglie convivono separate sullo stesso servizio.

## Come è fatta

| Parte | Dove | Cosa fa |
|---|---|---|
| `app/` | GitHub Pages: https://gvasta62.github.io/albero-di-famiglia/ (si ripubblica da sola a ogni push) | l'app vera e propria: HTML, CSS e JavaScript senza compilazione |
| `database/01_struttura.sql` | Supabase (PostgreSQL gratuito) | tabelle chiuse a internet, funzioni con controllo della chiave, copia serale con pg_cron |
| `copia notturna/` | il PC del gestore | ogni notte salva tutte le famiglie, foto comprese, in `copie su OneDrive/` |
| `guida video/` | il PC | video-guida e istruzioni PDF: testi in `copione.py`, tutto si rifà con `Rigenera_video.bat`; l'edizione (oggi v2) è in `monta.py` e `istruzioni.py`; senza chiave ElevenLabs una voce fatta altrove si inserisce con `voce_da_file.py` |
| `segreti/` | solo OneDrive, **mai su git** | chiave del gestore e collegamento al database |

### Chiavi e ruoli
Il link contiene una chiave (`#k=...`): decide la famiglia e il ruolo.

- **familiare**: vede e modifica tutto l'albero della propria famiglia, annulla modifiche, recupera una persona da una copia serale;
- **referente** (uno per famiglia): in più ripristina l'intero albero da una copia serale, cambia il link d'invito, rinomina la famiglia;
- **gestore** (link `#g=...`): crea ed elimina famiglie, rigenera il link del referente. Nessuno può crearsi una famiglia da solo.

### Difese contro gli errori
1. **Registro (Novità)**: ogni modifica con autore e ora; quelle di modifica ed eliminazione si annullano con un tocco.
2. **Copie serali nel database**: ogni sera alle 21:00 UTC (22:00 ora solare, 23:00 legale), 30 giorni. Si recupera una persona, o (referente) tutto l'albero; prima di un ripristino completo viene salvato lo stato di quel momento.
3. **Copia notturna su OneDrive**: tutte le famiglie con le foto, 60 giorni, dal PC del gestore.

### Foto
Si sceglie o si scatta, si ritaglia un quadrato (trascinare, ingrandire con cursore, rotella o due dita, ruotare).
Si salvano due versioni: 1000x1000 per la scheda, 180x180 per l'albero. Le foto vecchie restano finché
compaiono in una copia serale o nel registro degli ultimi 90 giorni, poi la copia serale le pulisce.

### Stampa dell'albero
Altro › **Stampa l'albero** (o il pulsante Stampa sopra l'albero), codice in `app/stampa.js`. Disegna l'albero in **SVG**
(vettoriale): si stampa dal browser, si salva in PDF scegliendo "Salva come PDF" nella finestra di stampa (resta
vettoriale), oppure si scarica il file `.svg`. In vita = verde, defunti = grigio con †; in bianco e nero i defunti hanno
il bordo tratteggiato. Scelte: tutta la famiglia / discendenti / antenati di una persona; foglio A4-A0 (orientamento
automatico); disposizione dall'alto in basso o da sinistra a destra ("la più leggibile" sceglie quella con i nomi più
grandi: per le famiglie larghe vince quasi sempre sinistra-destra); con o senza foto. L'anteprima avvisa se sul foglio
scelto i nomi verrebbero sotto i 7 punti.
Disposizione: generazioni calcolate dai legami, coniugi affiancati, ordine con baricentri e posizioni con regressione
isotona (niente sovrapposizioni); le linee orizzontali di gruppi diversi vanno su corsie diverse.

### Mappa della famiglia e residenza
Altro › **Mappa della famiglia**, codice in `app/mappa.js`: cartina vettoriale (SVG) con i luoghi di nascita oppure le
città dove vivono oggi, cerchi grandi secondo il numero di persone, frecce dal luogo di nascita dei genitori a quello dei
figli. I luoghi si cercano su OpenStreetMap (Nominatim), un nome alla volta: si manda solo il nome del luogo, mai quello
delle persone. Si stampa, si salva in PDF o in `.svg` come l'albero.
Nella scheda di chi è in vita, "Dove vive oggi": via o piazza, numero civico, CAP, città, provincia (all'estero lo Stato).
Colonne `residenza_citta`, `residenza_indirizzo` (la via), `residenza_civico`, `residenza_cap`, `residenza_provincia`;
per la mappa conta solo la città.

## Provarla subito
Aprire `app/index.html?prova` nel browser (o `index.html` senza collegamento al database): parte in **modalità prova**
con una famiglia inventata (Rossi). Link di prova: `index.html#g=prova-gestore-00000000001` per il gestore,
`#k=prova-familiare-rossi-0001` per un familiare. Per ripartire da zero: console del browser, `PROVA.azzera()`.

## Messa in linea (una volta sola)
1. Creare un progetto gratuito su supabase.com (regione Europa).
2. SQL Editor → incollare ed eseguire `database/01_struttura.sql` (deve comparire "Copia serale programmata").
3. Eseguire `segreti/02_chiave_gestore.sql` (generato per il gestore, contiene l'impronta della sua chiave).
4. Settings → API: copiare URL e chiave anon/publishable in `app/config.js` e in `segreti/collegamento.json`.
5. Pubblicare la cartella `app/`.
6. Lanciare `copia notturna/Attiva_copia_notturna.bat`.
7. Aprire il link del gestore e creare la prima famiglia.

## Limiti da conoscere
- Supabase gratuito: 500 MB di database (circa 3.000 foto) e il progetto si "addormenta" dopo 7 giorni senza visite; la copia notturna dal PC lo tiene sveglio.
- Chi ha il link familiare può modificare tutto: è la scelta fatta. Se il link finisce alla persona sbagliata, il referente lo cambia.
