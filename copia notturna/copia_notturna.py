"""Copia notturna di TUTTE le famiglie (dati + foto + registro) nel OneDrive aziendale.

Seconda difesa oltre alle copie serali dentro il database: se il servizio online
avesse un problema, qui c'e' tutto. Usa la chiave del gestore.

Configurazione: ..\\segreti\\collegamento.json  (escluso da git)
    { "supabaseUrl": "https://....supabase.co",
      "supabaseKey": "chiave anon/publishable",
      "chiaveGestore": "..." }

Uscita: ..\\copie su OneDrive\\AAAA-MM-GG\\<nome famiglia>.json  - si tengono 60 giorni.
Il registro di ogni esecuzione va in copia_notturna.log accanto a questo file.
"""
import datetime as dt
import json
import pathlib
import re
import shutil
import sys
import time
import urllib.error
import urllib.request

QUI = pathlib.Path(__file__).resolve().parent
RADICE = QUI.parent
CONFIG = RADICE / "segreti" / "collegamento.json"
DESTINAZIONE = RADICE / "copie su OneDrive"
LOG = QUI / "copia_notturna.log"
GIORNI_DA_TENERE = 60


def scrivi_log(testo):
    riga = f"{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {testo}"
    print(riga)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(riga + "\n")


def rpc(cfg, funzione, argomenti, tentativi=4):
    """Chiama una funzione del database; ritenta se la rete o il servizio sono momentaneamente giu'."""
    url = cfg["supabaseUrl"].rstrip("/") + "/rest/v1/rpc/" + funzione
    corpo = json.dumps(argomenti).encode("utf-8")
    for n in range(1, tentativi + 1):
        req = urllib.request.Request(url, data=corpo, method="POST", headers={
            "apikey": cfg["supabaseKey"], "Content-Type": "application/json", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            messaggio = e.read().decode("utf-8", "replace")[:300]
            if e.code < 500 or n == tentativi:
                raise RuntimeError(f"{funzione}: errore {e.code} {messaggio}")
        except (urllib.error.URLError, TimeoutError) as e:
            if n == tentativi:
                raise RuntimeError(f"{funzione}: rete non raggiungibile ({e})")
        time.sleep(30 * n)   # il progetto gratuito puo' essere "addormentato": gli do tempo


def nome_file(testo):
    return re.sub(r'[<>:"/\\|?*]+', "_", testo).strip() or "famiglia"


def main():
    if not CONFIG.exists():
        scrivi_log(f"MANCA la configurazione {CONFIG}")
        return 2
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    oggi = dt.date.today().isoformat()
    cartella = DESTINAZIONE / oggi
    cartella.mkdir(parents=True, exist_ok=True)

    famiglie = rpc(cfg, "gestore_famiglie", {"p_chiave": cfg["chiaveGestore"]})
    errori = 0
    for f in famiglie:
        try:
            dati = rpc(cfg, "gestore_esporta", {"p_chiave": cfg["chiaveGestore"], "p_famiglia": f["id"]})
            file = cartella / (nome_file(f["nome"]) + ".json")
            temporaneo = file.with_suffix(".tmp")
            temporaneo.write_text(json.dumps(dati, ensure_ascii=False), encoding="utf-8")
            temporaneo.replace(file)
            scrivi_log(f"OK  {f['nome']}: {len(dati['dati']['persone'])} persone, {len(dati['foto'])} foto, "
                       f"{file.stat().st_size / 1e6:.1f} MB")
        except Exception as e:  # una famiglia che fallisce non ferma le altre
            errori += 1
            scrivi_log(f"ERRORE  {f['nome']}: {e}")

    # pulizia: via le cartelle piu' vecchie di 60 giorni
    limite = dt.date.today() - dt.timedelta(days=GIORNI_DA_TENERE)
    for c in DESTINAZIONE.iterdir():
        try:
            if c.is_dir() and dt.date.fromisoformat(c.name) < limite:
                shutil.rmtree(c)
                scrivi_log(f"tolta la copia vecchia {c.name}")
        except ValueError:
            pass
    scrivi_log(f"fine: {len(famiglie)} famiglie, {errori} errori")
    return 1 if errori else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        scrivi_log(f"ERRORE GENERALE: {e}")
        sys.exit(1)
