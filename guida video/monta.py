"""Monta il video-guida: registrazione dell'app dentro un telefono, titolo del passo, sottotitoli,
voce narrante (ElevenLabs) e musica di sottofondo.

    python monta.py                       video completo (cartella superiore)
    python monta.py --anteprima 20,75     solo i fotogrammi a 20 s e 75 s (PNG nella cartella di lavoro)

Prima servono voce.py (voce) e registra.py (registrazione).
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import copione as C

QUI = Path(__file__).resolve().parent
LAVORO = Path(tempfile.gettempdir()) / "albero_video_lavoro"
FF = imageio_ffmpeg.get_ffmpeg_exe()
CARTELLA_MUSICA = Path(r"C:\Users\Peppe\OneDrive - Gruppo Ferrovie Dello Stato\Musica\adobe stock acquisti")
USCITA = QUI.parent / ("Albero di famiglia - Video guida (bozza).mp4" if "--bozza" in sys.argv else "Albero di famiglia - Video guida.mp4")
W, H, FPS = 1920, 1080, 30
SW, SH = 780, 1688                      # registrazione
PAUSA = 0.9                             # come in registra.py
PRIMA, DOPO = 1.0, 2.5                  # secondi prima della prima scena e dopo l'ultima
VOLUME_MUSICA = 0.16

# colori dell'app (RGB)
SFONDO = (246, 243, 236)
INCH = (30, 38, 32)
TENUE = (91, 102, 94)
ACCENTO = (47, 107, 79)
ACC_TENUE = (226, 238, 230)

F = "C:/Windows/Fonts/"
def font(nome, px): return ImageFont.truetype(F + nome, px)
SERIF_B, SERIF = "palab.ttf", "pala.ttf"
SANS, SANS_SB = "segoeui.ttf", "seguisb.ttf"

# telefono
PH_H = 940
PH_W = round(SW * PH_H / SH)            # 434
BEZEL = 14
PH_X = 1260
PH_Y = (H - PH_H) // 2
COL_X, COL_W = 130, 900                 # colonna dei testi


def a_capo(d, testo, f, larghezza):
    righe, riga = [], ""
    for w in testo.split():
        prova = (riga + " " + w).strip()
        if d.textlength(prova, font=f) <= larghezza:
            riga = prova
        else:
            righe.append(riga)
            riga = w
    if riga:
        righe.append(riga)
    return righe


def frasi(meta):
    """divide il testo letto in frasi brevi, con l'istante di inizio di ciascuna"""
    out, cur, t0 = [], [], None
    for a, b, w in meta["parole"]:
        if t0 is None:
            t0 = a
        cur.append(w)
        if re.search(r"[.!?:]$", w) or (len(cur) >= 14 and w.endswith(",")):
            out.append((t0, " ".join(cur)))
            cur, t0 = [], None
    if cur:
        out.append((t0, " ".join(cur)))
    # una frase di due o tre parole ("Ciao!") si unisce alla successiva
    unite = []
    for t, testo in out:
        if unite and len(unite[-1][1].split()) <= 3:
            unite[-1] = (unite[-1][0], unite[-1][1] + " " + testo)
        else:
            unite.append((t, testo))
    return unite


def sfondo(numero, titolo, sottotitolo=None):
    im = Image.new("RGB", (W, H), SFONDO)
    d = ImageDraw.Draw(im)
    # piccolo albero stilizzato in alto a sinistra
    d.ellipse([COL_X, 70, COL_X + 22, 92], fill=ACCENTO)
    d.ellipse([COL_X + 34, 58, COL_X + 56, 80], fill=ACCENTO)
    d.ellipse([COL_X + 68, 70, COL_X + 90, 92], fill=ACCENTO)
    d.text((COL_X + 112, 62), "Albero di famiglia", font=font(SERIF_B, 32), fill=INCH)
    # telefono: ombra e cornice
    ombra = Image.new("L", (W, H), 0)
    ImageDraw.Draw(ombra).rounded_rectangle([PH_X - BEZEL + 6, PH_Y - BEZEL + 16, PH_X + PH_W + BEZEL + 6, PH_Y + PH_H + BEZEL + 16],
                                            radius=58, fill=70)
    ombra = Image.fromarray(cv2.GaussianBlur(np.array(ombra), (0, 0), 18))
    im.paste((120, 110, 95), mask=ombra)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([PH_X - BEZEL, PH_Y - BEZEL, PH_X + PH_W + BEZEL, PH_Y + PH_H + BEZEL], radius=56, fill=(28, 30, 29))
    if numero:
        d.rounded_rectangle([COL_X, 300, COL_X + 64, 364], radius=32, fill=ACCENTO)
        f = font(SANS_SB, 34)
        tw = d.textlength(str(numero), font=f)
        d.text((COL_X + 32 - tw / 2, 307), str(numero), font=f, fill=(255, 255, 255))
        y = 390
    else:
        y = 330
    f = font(SERIF_B, 76 if not numero else 64)
    for r in a_capo(d, titolo, f, COL_W):
        d.text((COL_X, y), r, font=f, fill=INCH)
        y += f.size + 14
    if sottotitolo:
        f = font(SERIF, 40)
        d.text((COL_X, y + 10), sottotitolo, font=f, fill=TENUE)
    return np.array(im)


def sottotitolo(testo):
    """riquadro con la frase pronunciata, in basso nella colonna dei testi (RGBA)"""
    f = font(SANS, 38)
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    righe = a_capo(tmp, testo, f, COL_W - 60)
    alto = len(righe) * 52 + 44
    im = Image.new("RGBA", (COL_W, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, COL_W, alto], radius=22, fill=(255, 255, 255, 235), outline=(220, 213, 198, 255), width=2)
    d.rectangle([0, 18, 6, alto - 18], fill=ACCENTO + (255,))
    for i, r in enumerate(righe):
        d.text((32, 20 + i * 52), r, font=f, fill=INCH + (255,))
    return np.array(im)


def incolla_rgba(dst, src, x, y, alfa=1.0):
    h, w = src.shape[:2]
    a = src[:, :, 3:4].astype(np.float32) / 255 * alfa
    zona = dst[y:y + h, x:x + w].astype(np.float32)
    dst[y:y + h, x:x + w] = (zona * (1 - a) + src[:, :, :3].astype(np.float32) * a).astype(np.uint8)


def maschera_schermo():
    m = Image.new("L", (PH_W, PH_H), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, PH_W - 1, PH_H - 1], radius=44, fill=255)
    return (np.array(m).astype(np.float32) / 255)[:, :, None]


def main():
    tempi = json.loads((LAVORO / "tempi.json").read_text("utf-8"))
    voce = {k: json.loads((QUI / "voce" / f"{k}.json").read_text("utf-8")) for k, _, _ in C.SCENE}
    inizio_reg = tempi[C.SCENE[0][0]] - PRIMA
    ultima = C.SCENE[-1][0]
    durata = tempi[ultima] - inizio_reg + voce[ultima]["durata"] + PAUSA + DOPO

    # sfondi e sottotitoli per scena: (t_inizio_scena, sfondo, [(t, sottotitolo)])
    scene = []
    passi = [k for k, _, _ in C.SCENE if k not in ("intro", "fine")]
    for k, titolo, _ in C.SCENE:
        t0 = tempi[k] - inizio_reg
        if k == "intro":
            bg = sfondo(None, C.TITOLO, C.SOTTOTITOLO)
        elif k == "fine":
            bg = sfondo(None, titolo, "Tocca a te: buon albero!")
        else:
            bg = sfondo(passi.index(k) + 1, titolo)
        subs = [(t0 + a, sottotitolo(testo)) for a, testo in frasi(voce[k])]
        scene.append((t0, bg, subs, t0 + voce[k]["durata"] + 0.3))
    maschera = maschera_schermo()

    def fotogramma(t, schermo):
        idx = max(i for i, s in enumerate(scene) if s[0] <= t or i == 0)
        t0, bg, subs, fine_voce = scene[idx]
        img = bg.copy()
        # dissolvenza dello sfondo all'inizio della scena
        if idx > 0 and t - t0 < 0.35:
            u = (t - t0) / 0.35
            img = (scene[idx - 1][1].astype(np.float32) * (1 - u) + img.astype(np.float32) * u).astype(np.uint8)
        piccolo = cv2.resize(schermo, (PH_W, PH_H), interpolation=cv2.INTER_AREA)
        zona = img[PH_Y:PH_Y + PH_H, PH_X:PH_X + PH_W].astype(np.float32)
        img[PH_Y:PH_Y + PH_H, PH_X:PH_X + PH_W] = (zona * (1 - maschera) + piccolo.astype(np.float32) * maschera).astype(np.uint8)
        attivi = [s for s in subs if s[0] <= t + 0.05]
        if attivi and t < fine_voce:
            ts, sub = attivi[-1]
            alfa = min(1.0, (t - ts + 0.05) / 0.2)
            incolla_rgba(img, sub, COL_X, H - 120 - sub.shape[0], alfa)
        # dissolvenza dal nero all'inizio e al nero alla fine
        if t < 0.6:
            img = (img.astype(np.float32) * (t / 0.6)).astype(np.uint8)
        if t > durata - 1.0:
            img = (img.astype(np.float32) * max(0.0, (durata - t) / 1.0)).astype(np.uint8)
        return img

    lettore = subprocess.Popen([FF, "-loglevel", "error", "-ss", f"{inizio_reg:.3f}", "-i", str(LAVORO / "registrazione.mp4"),
                                "-f", "rawvideo", "-pix_fmt", "rgb24", "-r", str(FPS), "-"], stdout=subprocess.PIPE)

    def leggi():
        buf = lettore.stdout.read(SW * SH * 3)
        return np.frombuffer(buf, np.uint8).reshape(SH, SW, 3) if len(buf) == SW * SH * 3 else None

    if "--anteprima" in sys.argv:
        istanti = sorted(float(x) for x in sys.argv[sys.argv.index("--anteprima") + 1].split(","))
        n, schermo = 0, leggi()
        for t in istanti:
            while n < int(t * FPS):
                nuovo = leggi()
                schermo = nuovo if nuovo is not None else schermo
                n += 1
            Image.fromarray(fotogramma(t, schermo)).save(LAVORO / f"anteprima_{t:.0f}.png")
            print("  ", LAVORO / f"anteprima_{t:.0f}.png")
        lettore.kill()
        return

    # ---------------------------------------------------------- audio: voce al suo posto + musica
    ingressi, filtri, etichette = [], [], []
    for i, (k, _, _) in enumerate(C.SCENE):
        ingressi += ["-i", str(QUI / "voce" / f"{k}.mp3")]
        ms = int((tempi[k] - inizio_reg) * 1000)
        filtri.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms}[v{i}]")
        etichette.append(f"[v{i}]")
    filtri.append(f"{''.join(etichette)}amix=inputs={len(etichette)}:normalize=0,apad=whole_dur={durata:.3f}[voce]")
    if C.MUSICA:
        n = len(C.SCENE)
        ingressi += ["-stream_loop", "-1", "-i", str(CARTELLA_MUSICA / C.MUSICA)]
        filtri.append(f"[{n}:a]aresample=48000,atrim=0:{durata:.3f},volume={VOLUME_MUSICA},"
                      f"afade=t=in:d=1.5,afade=t=out:st={durata - 3.5:.3f}:d=3.5[mus]")
        filtri.append("[voce][mus]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]")
    else:
        filtri.append("[voce]anull[a]")
    audio = LAVORO / "audio.wav"
    subprocess.run([FF, "-y", "-loglevel", "error", *ingressi, "-filter_complex", ";".join(filtri),
                    "-map", "[a]", "-t", f"{durata:.3f}", "-ac", "2", str(audio)], check=True)

    # ---------------------------------------------------------- video
    scrittore = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                                  "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(audio),
                                  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
                                  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
                                  str(LAVORO / "video.mp4")], stdin=subprocess.PIPE)
    totale = int(durata * FPS)
    schermo = leggi()
    for n in range(totale):
        nuovo = leggi() if n else schermo
        schermo = nuovo if nuovo is not None else schermo
        scrittore.stdin.write(fotogramma(n / FPS, schermo).tobytes())
        if n % (FPS * 20) == 0:
            print(f"  {n / FPS:5.0f} s di {durata:.0f}")
    scrittore.stdin.close()
    scrittore.wait()
    lettore.kill()
    USCITA.write_bytes((LAVORO / "video.mp4").read_bytes())
    print("  video pronto:", USCITA, f"({durata:.0f} s)")


if __name__ == "__main__":
    main()
