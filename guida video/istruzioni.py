"""Istruzioni illustrate in PDF (A4), con le schermate prese dalla registrazione del video.

    python istruzioni.py      ->  ..\\Albero di famiglia - Istruzioni.pdf

Serve prima registra.py (usa lavoro/registrazione.mp4 e lavoro/tempi.json).
"""
import json
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

QUI = Path(__file__).resolve().parent
LAVORO = Path(tempfile.gettempdir()) / "albero_video_lavoro"
FF = imageio_ffmpeg.get_ffmpeg_exe()
EDIZIONE = "v2"   # v2 (23/11/2026): aggiunta la stampa dell'albero; la prima edizione resta accanto
USCITA = QUI.parent / f"Albero di famiglia - Istruzioni {EDIZIONE}.pdf"

DPI = 150
PW, PH = 1240, 1754                     # A4 a 150 dpi
M = 80
SFONDO = (255, 255, 255)
INCH = (30, 38, 32)
TENUE = (91, 102, 94)
ACCENTO = (47, 107, 79)
LINEA = (220, 213, 198)
F = "C:/Windows/Fonts/"
def font(n, px): return ImageFont.truetype(F + n, px)

# (scena, frazione della scena da fotografare, titolo, testo)
PASSI = [
    ("entra", 0.80, "Entra con il link",
     "Tocca il link che ti hanno mandato. La prima volta scrivi il tuo nome: così tutti sanno chi ha fatto ogni modifica."),
    ("albero", 0.20, "Muoviti nell'albero",
     "Al centro c'è una persona: sopra genitori e nonni, sotto figli e nipoti. Tocca un parente per metterlo al centro."),
    ("scheda", 0.40, "Apri la scheda",
     "Tocca la persona al centro: vedi foto, date, luogo, ricordi e tutti i parenti, anche zii, cugini e suoceri."),
    ("modifica", 0.72, "Correggi e completa",
     "Tocca Modifica, scrivi luogo, date e ricordi, poi Salva. Se non sai la data precisa, basta l'anno."),
    ("foto", 0.80, "Aggiungi una foto",
     "Scegli o scatta una foto, sposta il viso dentro il cerchio, ingrandisci, poi tocca Usa questa parte."),
    ("aggiungi", 0.33, "Aggiungi un parente",
     "Tocca un riquadro con il + (per esempio Aggiungi figlio o figlia), poi Persona nuova: si collega da solo."),
    ("persone", 0.95, "Cerca una persona",
     "Nella scheda Persone scrivi un nome, un cognome o un paese e trovi subito chi cerchi."),
    ("novita", 0.95, "Se qualcuno sbaglia",
     "In Novità vedi chi ha cambiato cosa e quando. Tocca Annulla e tutto torna com'era."),
    ("copie", 0.80, "Le copie di ogni sera",
     "Ogni sera l'albero si salva da solo (per un mese). Da Altro › Copie serali recuperi una persona com'era."),
    ("invita", 0.55, "Invita gli altri",
     "Da Altro › Invita un familiare mandi il link su WhatsApp o mostri il codice QR. Mandalo solo ai familiari."),
    ("stampa", 0.62, "Stampa l'albero",
     "Da Altro › Stampa l'albero scegli tutta la famiglia o un ramo e il foglio. In vita in verde, defunti in grigio "
     "con la croce. Si salva anche in PDF."),
]


def schermata(scena, frazione, tempi, durate):
    out = LAVORO / f"istr_{scena}.png"
    t = tempi[scena] + durate[scena] * frazione
    subprocess.run([FF, "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(LAVORO / "registrazione.mp4"),
                    "-frames:v", "1", str(out)], check=True)
    return Image.open(out).convert("RGB")


def a_capo(d, testo, f, larg):
    righe, r = [], ""
    for w in testo.split():
        p = (r + " " + w).strip()
        if d.textlength(p, font=f) <= larg:
            r = p
        else:
            righe.append(r)
            r = w
    return righe + ([r] if r else [])


def telefono(img, alto):
    largo = round(img.width * alto / img.height)
    sc = img.resize((largo, alto), Image.LANCZOS)
    b = 9
    tel = Image.new("RGBA", (largo + 2 * b, alto + 2 * b), (0, 0, 0, 0))
    d = ImageDraw.Draw(tel)
    d.rounded_rectangle([0, 0, largo + 2 * b - 1, alto + 2 * b - 1], radius=34, fill=(28, 30, 29, 255))
    m = Image.new("L", (largo, alto), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, largo - 1, alto - 1], radius=26, fill=255)
    tel.paste(sc, (b, b), m)
    return tel


def intestazione(d, pagina, totale):
    for x, y in ((0, 12), (34, 0), (68, 12)):
        d.ellipse([M + x, 70 + y, M + x + 22, 92 + y], fill=ACCENTO)
    d.text((M + 112, 60), "Albero di famiglia", font=font("palab.ttf", 44), fill=INCH)
    d.text((M + 112, 116), "Come si usa, passo per passo", font=font("pala.ttf", 30), fill=TENUE)
    d.text((PW - M, 75), f"{pagina} / {totale}", font=font("segoeui.ttf", 26), fill=TENUE, anchor="ra")
    d.line([M, 175, PW - M, 175], fill=LINEA, width=2)


def main():
    tempi = json.loads((LAVORO / "tempi.json").read_text("utf-8"))
    durate = {k: json.loads((QUI / "voce" / f"{k}.json").read_text("utf-8"))["durata"] for k in tempi}
    per_pagina, colonne = 6, 2
    pagine = []
    blocchi = [PASSI[i:i + per_pagina] for i in range(0, len(PASSI), per_pagina)]
    cella_w = (PW - 2 * M - 40) // colonne
    cella_h = 505
    for np_, blocco in enumerate(blocchi):
        pg = Image.new("RGB", (PW, PH), SFONDO)
        d = ImageDraw.Draw(pg)
        intestazione(d, np_ + 1, len(blocchi))
        for i, (scena, fr, titolo, testo) in enumerate(blocco):
            n = np_ * per_pagina + i + 1
            x = M + (i % colonne) * (cella_w + 40)
            y = 205 + (i // colonne) * cella_h
            tel = telefono(schermata(scena, fr, tempi, durate), 460)
            pg.paste(tel, (x, y), tel)
            tx = x + tel.width + 26
            tw = cella_w - tel.width - 26
            d.ellipse([tx, y + 8, tx + 52, y + 60], fill=ACCENTO)
            d.text((tx + 26, y + 34), str(n), font=font("seguisb.ttf", 28), fill=(255, 255, 255), anchor="mm")
            f_t = font("palab.ttf", 33)
            yy = y + 78
            for r in a_capo(d, titolo, f_t, tw):
                d.text((tx, yy), r, font=f_t, fill=INCH)
                yy += 40
            yy += 10
            f = font("segoeui.ttf", 25)
            for r in a_capo(d, testo, f, tw):
                d.text((tx, yy), r, font=f, fill=INCH)
                yy += 34
        if np_ == len(blocchi) - 1:
            consiglio = ("Dal telefono aggiungi il sito alla schermata Home: su iPhone Condividi › Aggiungi alla "
                         "schermata Home; su Android menu (i tre puntini) › Aggiungi a schermata Home. Così si apre come un'app.")
            f = font("segoeui.ttf", 26)
            if len(blocco) % 2:      # casella libera accanto all'ultimo passo
                x0, y0, larg = M + cella_w + 40, 205 + (len(blocco) // colonne) * cella_h, cella_w
            else:                    # sotto, a tutta larghezza
                x0, y0, larg = M, 205 + (len(blocco) // colonne) * cella_h + 10, PW - 2 * M
            righe = a_capo(d, consiglio, f, larg - 72)
            d.rounded_rectangle([x0, y0, x0 + larg, y0 + 110 + len(righe) * 34], radius=22, fill=(226, 238, 230))
            d.text((x0 + 36, y0 + 30), "Consiglio", font=font("palab.ttf", 34), fill=(35, 79, 59))
            yy = y0 + 82
            for r in righe:
                d.text((x0 + 36, yy), r, font=f, fill=INCH)
                yy += 34
        pagine.append(pg)
    pagine[0].save(USCITA, save_all=True, append_images=pagine[1:], resolution=DPI)
    for i, p in enumerate(pagine):
        p.save(LAVORO / f"istruzioni_{i + 1}.png")
    print("  istruzioni pronte:", USCITA)


if __name__ == "__main__":
    main()
