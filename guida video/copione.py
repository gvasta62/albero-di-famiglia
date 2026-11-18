"""Testi del video-guida: voce narrante e scritte a schermo.

Per cambiare cosa dice la voce o cosa compare a schermo si tocca solo questo file,
poi si rilancia Rigenera_video.bat (la voce si rigenera solo per le scene cambiate).
"""

VOCE_ID = "vsCRUc02ddcl96KTjfTQ"      # "peppe02" su ElevenLabs (voce clonata dell'utente)
MODELLO = "eleven_v4"                  # "v4"
IMPOSTAZIONI = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True, "speed": 1.0}

MUSICA = "Carefree---Happy-Piano-Kids-Playful-Fun_AdobeStock_372203894.wav"   # scelta dall'utente (prova 1)

TITOLO = "Albero di famiglia"
SOTTOTITOLO = "Come si usa, passo per passo"

# (chiave, titolo a schermo, testo letto dalla voce)
SCENE = [
    ("intro", "Albero di famiglia",
     "Ciao! In questo video ti mostro come usare l'albero di famiglia: un sito dove tutta la famiglia, "
     "insieme, raccoglie nomi, foto, date e ricordi. Funziona dal telefono e dal computer, "
     "e non serve installare niente."),
    ("entra", "Entrare con il link",
     "Per entrare basta il link che ti hanno mandato, per esempio su WhatsApp. Toccalo: la prima volta "
     "l'albero ti chiede come ti chiami. Scrivi il tuo nome, così tutti sapranno chi ha fatto ogni modifica."),
    ("albero", "Muoversi nell'albero",
     "Questo è l'albero. Al centro c'è una persona: sopra trovi i genitori e i nonni, accanto il marito "
     "o la moglie e i fratelli, sotto i figli e i nipoti. Tocca un parente, e diventa lui il centro "
     "dell'albero. Così ti sposti di ramo in ramo."),
    ("scheda", "La scheda di una persona",
     "Se tocchi la persona che sta al centro, si apre la sua scheda: foto, data e luogo di nascita, età, "
     "ricordi. Più in basso ci sono tutti i suoi parenti, anche zii, cugini, suoceri e cognati: "
     "questi l'albero li ricava da solo."),
    ("modifica", "Correggere e completare",
     "Manca qualcosa? Tocca Modifica. Puoi scrivere il luogo di nascita, le date e i ricordi. "
     "Se non conosci la data precisa, va bene anche solo l'anno. Poi tocca Salva."),
    ("foto", "Aggiungere una foto",
     "Per la foto, tocca Scegli o scatta una foto. Dal telefono puoi prenderla dalla galleria o "
     "scattarla al momento. Poi trascini la foto per centrare il viso nel cerchio e la ingrandisci con "
     "il cursore, o allargando due dita. Quando va bene, tocca Usa questa parte."),
    ("aggiungi", "Aggiungere un parente",
     "Per aggiungere qualcuno, usa i riquadri con il più: per esempio Aggiungi figlio o figlia, "
     "poi Persona nuova. Scrivi il nome e salva: il nuovo parente è già collegato al posto giusto, "
     "anche all'altro genitore."),
    ("persone", "Cercare una persona",
     "Nella scheda Persone c'è l'elenco di tutti. Scrivi un nome, un cognome o un paese, "
     "e trovi subito chi cerchi."),
    ("novita", "Novità e annullare",
     "Nella scheda Novità vedi ogni modifica: chi l'ha fatta e quando. Se qualcuno ha sbagliato, "
     "tocca Annulla, e tutto torna com'era prima."),
    ("copie", "Le copie di ogni sera",
     "E c'è una sicurezza in più: ogni sera l'albero fa una copia di se stesso, e la conserva per un mese. "
     "Da Altro, Copie serali, puoi vedere cosa è cambiato da quel giorno e recuperare una persona "
     "com'era."),
    ("invita", "Invitare gli altri",
     "Per far entrare un altro parente, vai su Altro, Invita un familiare. Puoi mandare il link su "
     "WhatsApp o per mail, oppure fargli inquadrare il codice QR. Chi ha il link può aggiungere e "
     "correggere: mandalo solo ai familiari."),
    ("fine", "Buon divertimento!",
     "Ultimo consiglio: dal telefono, aggiungi il sito alla schermata Home, così lo apri come un'app. "
     "E adesso tocca a te: aggiungi le persone che conosci e chiedi ai parenti di completare il resto. "
     "Buon divertimento!"),
]
