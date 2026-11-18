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
