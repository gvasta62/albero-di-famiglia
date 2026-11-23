"""Mette al suo posto una voce generata fuori da voce.py (per esempio col connettore ElevenLabs,
quando sul PC manca la chiave ELEVENLABS_API_KEY).

    python voce_da_file.py <scena> <file.mp3>

Copia l'mp3 in voce/<scena>.mp3 e scrive voce/<scena>.json con la stessa impronta che calcola voce.py,
così voce.py la considera "già pronta". L'istante di ogni parola è stimato dall'audio: si trovano i tratti
in cui si parla (le pause restano pause) e le parole si distribuiscono lì dentro in proporzione alle lettere.
Basta per far partire le azioni della registrazione al momento giusto.
"""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

import copione as C

QUI = Path(__file__).resolve().parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 16000
PASSO = 0.01            # 10 ms
PAUSA_MIN = 0.14        # silenzi più corti non contano come pausa


def tratti_parlati(mp3):
    grezzo = subprocess.run([FF, "-loglevel", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                            capture_output=True, check=True).stdout
    a = np.frombuffer(grezzo, np.int16).astype(np.float32) / 32768
    n = int(SR * PASSO)
    rms = np.sqrt(np.mean(a[: len(a) // n * n].reshape(-1, n) ** 2, axis=1))
    soglia = max(0.01, np.percentile(rms, 95) * 0.08)
    voce = rms > soglia
    tratti, inizio, silenzio = [], None, 0
    for i, v in enumerate(voce):
        if v:
            if inizio is None:
                inizio = i
            silenzio = 0
        elif inizio is not None:
            silenzio += 1
            if silenzio * PASSO >= PAUSA_MIN:
                tratti.append((inizio * PASSO, (i - silenzio + 1) * PASSO))
                inizio, silenzio = None, 0
    if inizio is not None:
        tratti.append((inizio * PASSO, (len(voce) - silenzio) * PASSO))
    return tratti, len(a) / SR


def main():
    chiave, sorgente = sys.argv[1], Path(sys.argv[2])
    testo = next(t for k, _, t in C.SCENE if k == chiave)
    tratti, durata = tratti_parlati(sorgente)
    parlato = sum(b - a for a, b in tratti)
    parole = testo.split()
    pesi = [len(w) + 1 for w in parole]
    totale = sum(pesi)

    def istante(frazione):
        """dal tempo 'parlato' (senza pause) al tempo vero dell'audio"""
        resto = frazione * parlato
        for a, b in tratti:
            if resto <= b - a:
                return a + resto
            resto -= b - a
        return tratti[-1][1]

    out, cum = [], 0
    for w, p in zip(parole, pesi):
        out.append([round(istante(cum / totale), 3), round(istante((cum + p - 1) / totale), 3), w])
        cum += p
    impronta = hashlib.sha1(json.dumps([C.VOCE_ID, C.MODELLO, C.IMPOSTAZIONI, testo]).encode()).hexdigest()[:12]
    dest = QUI / "voce"
    shutil.copyfile(sorgente, dest / f"{chiave}.mp3")
    (dest / f"{chiave}.json").write_text(json.dumps({"impronta": impronta, "testo": testo, "durata": round(tratti[-1][1], 3),
                                                     "parole": out, "tempi": "stimati dall'audio"},
                                                    ensure_ascii=False, indent=1), "utf-8")
    print(f"  {chiave}: {len(tratti)} tratti parlati, voce {tratti[-1][1]:.1f} s su {durata:.1f} s di file")


if __name__ == "__main__":
    main()
