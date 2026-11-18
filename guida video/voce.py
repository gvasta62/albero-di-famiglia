"""Genera la voce narrante con ElevenLabs (voce "peppe02", modello v4), scena per scena.

Per ogni scena salva voce/<scena>.mp3 e voce/<scena>.json (testo, durata, istante di ogni parola).
Una scena già pronta con lo stesso testo non viene rigenerata (si risparmia credito).
La chiave sta nella variabile d'ambiente ELEVENLABS_API_KEY.

    python voce.py               tutte le scene
    python voce.py --ascolto     in più unisce tutto in voce/ascolto_completo.mp3 (per sentirla di fila)
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import imageio_ffmpeg

import copione as C

QUI = Path(__file__).resolve().parent
DEST = QUI / "voce"
FF = imageio_ffmpeg.get_ffmpeg_exe()


def sintetizza(testo):
    corpo = {"text": testo, "model_id": C.MODELLO, "language_code": "it", "voice_settings": C.IMPOSTAZIONI}
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{C.VOCE_ID}/with-timestamps?output_format=mp3_44100_192",
        data=json.dumps(corpo).encode(), method="POST",
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def parole(al):
    """istante di inizio e fine di ogni parola, dai tempi dei singoli caratteri"""
    out, cur, t0, t1 = [], "", None, None
    for ch, a, b in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if ch.isspace():
            if cur:
                out.append([round(t0, 3), round(t1, 3), cur])
            cur, t0 = "", None
        else:
            if t0 is None:
                t0 = a
            cur += ch
            t1 = b
    if cur:
        out.append([round(t0, 3), round(t1, 3), cur])
    return out


def main():
    DEST.mkdir(exist_ok=True)
    for chiave, _titolo, testo in C.SCENE:
        impronta = hashlib.sha1(json.dumps([C.VOCE_ID, C.MODELLO, C.IMPOSTAZIONI, testo]).encode()).hexdigest()[:12]
        mp3, meta = DEST / f"{chiave}.mp3", DEST / f"{chiave}.json"
        if mp3.exists() and meta.exists() and json.loads(meta.read_text("utf-8")).get("impronta") == impronta:
            print(f"  {chiave}: già pronta")
            continue
        for n in range(1, 6):
            try:
                d = sintetizza(testo)
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if isinstance(e, urllib.error.HTTPError) and e.code < 500 and e.code != 429:
                    sys.exit(f"ElevenLabs ha rifiutato '{chiave}': {e.code} {e.read().decode()[:300]}")
                print(f"  {chiave}: tentativo {n} non riuscito ({e}), riprovo")
                time.sleep(5 * n)
        else:
            sys.exit(f"Voce non generata per '{chiave}'.")
        mp3.write_bytes(base64.b64decode(d["audio_base64"]))
        al = d.get("normalized_alignment") or d["alignment"]
        p = parole(al)
        meta.write_text(json.dumps({"impronta": impronta, "testo": testo, "durata": al["character_end_times_seconds"][-1],
                                    "parole": p}, ensure_ascii=False, indent=1), "utf-8")
        print(f"  {chiave}: generata, {al['character_end_times_seconds'][-1]:.1f} s")

    if "--ascolto" in sys.argv:
        elenco = DEST / "elenco.txt"
        elenco.write_text("".join(f"file '{(DEST / (k + '.mp3')).as_posix()}'\n" for k, _, _ in C.SCENE), "utf-8")
        subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(elenco),
                        "-af", "apad=pad_dur=0.8", "-c:a", "libmp3lame", "-b:a", "192k",
                        str(DEST / "ascolto_completo.mp3")], check=True)
        elenco.unlink()
        print("  ascolto:", DEST / "ascolto_completo.mp3")


if __name__ == "__main__":
    main()
