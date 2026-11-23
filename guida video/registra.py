"""Registra l'app (modalità prova, famiglia Rossi inventata) come su un telefono, scena per scena.
Cattura lo schermo con lo screencast di Chrome a doppia risoluzione (780x1688).

Ogni azione parte quando la voce pronuncia la parola indicata (tempi presi da voce/<scena>.json),
così la registrazione è già allineata con la narrazione. Produce lavoro/registrazione.mp4 (30 fps) e
lavoro/tempi.json (istante in cui inizia ogni scena dentro la registrazione).
"""
import base64
import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

import copione as C

QUI = Path(__file__).resolve().parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
LAVORO = Path(tempfile.gettempdir()) / "albero_video_lavoro"   # fuori da OneDrive: la sincronizzazione blocca i file
APP = "https://gvasta62.github.io/albero-di-famiglia/"   # il sito vero, in modalità prova (famiglia inventata)
PAUSA = 0.9                       # silenzio fra una scena e l'altra (deve coincidere con monta.py)
ANTICIPO = 0.35                   # l'azione parte un attimo prima della parola

# tocchi ben visibili + nascondo l'avviso della modalità prova
INIZIO = r"""
(() => {
  const css = `#avviso-prova{display:none!important}
  .tocco{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;
    background:rgba(47,107,79,.30);border:3px solid rgba(47,107,79,.9);pointer-events:none;z-index:99999;
    animation:tocco .7s ease-out forwards}
  @keyframes tocco{0%{transform:scale(.4);opacity:1}70%{opacity:.9}100%{transform:scale(1.35);opacity:0}}
  html{scroll-behavior:smooth}`;
  const metti = () => {
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    addEventListener('pointerdown', e => {
      const d = document.createElement('div'); d.className = 'tocco';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      document.body.appendChild(d); setTimeout(() => d.remove(), 800);
    }, true);
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', metti) : metti();
})();
"""

CHAT = """<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width">
<style>body{margin:0;font-family:system-ui,Segoe UI,sans-serif;background:#ece5dc;height:100vh;display:flex;flex-direction:column}
header{background:#2f6b4f;color:#fff;padding:14px 16px;font-size:18px;font-weight:600;display:flex;gap:12px;align-items:center}
.av{width:38px;height:38px;border-radius:50%;background:#e2eee6;color:#234f3b;display:grid;place-items:center;font-weight:700}
main{flex:1;padding:18px 12px;display:flex;flex-direction:column;gap:10px}
.m{max-width:80%;background:#fff;border-radius:12px;padding:10px 12px;font-size:16px;line-height:1.35;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.m small{display:block;text-align:right;color:#8a8a8a;font-size:12px;margin-top:4px}
a{color:#1a5fb4;word-break:break-all}</style></head><body>
<header><div class=av>E</div>Elena (cugina)</header><main>
<div class=m>Ciao! Ho fatto l'albero della nostra famiglia 🌳 Entra e aggiungi quello che sai, soprattutto le foto dei nonni!<small>18:02</small></div>
<div class=m><a id=link href="LINK">https://gvasta62.github.io/albero-di-famiglia/#k=…</a><small>18:02</small></div>
</main></body></html>"""


def main():
    voce = {k: json.loads((QUI / "voce" / f"{k}.json").read_text("utf-8")) for k, _, _ in C.SCENE}
    if LAVORO.exists():
        shutil.rmtree(LAVORO)
    LAVORO.mkdir()
    link = APP + "?prova#k=prova-familiare-rossi-0001"
    (LAVORO / "chat.html").write_text(CHAT.replace("LINK", link), "utf-8")

    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                            has_touch=True, locale="it-IT", color_scheme="light")
        ctx.add_init_script(INIZIO)
        pg = ctx.new_page()
        pg.goto((LAVORO / "chat.html").as_uri())
        cartella = LAVORO / "fotogrammi"
        cartella.mkdir()
        fotogrammi = []
        cdp = ctx.new_cdp_session(pg)

        def arrivato(ev):
            n = len(fotogrammi)
            (cartella / f"{n:06d}.jpg").write_bytes(base64.b64decode(ev["data"]))
            fotogrammi.append(ev["metadata"]["timestamp"])
            cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})

        cdp.on("Page.screencastFrame", arrivato)
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 780, "maxHeight": 1688})
        pg.wait_for_timeout(1500)
        t_video = None                                 # = istante del primo fotogramma

        def dorme(s):
            if s > 0:
                pg.wait_for_timeout(int(s * 1000))     # attesa che intanto riceve i fotogrammi

        stato = {}

        def scena(k):
            stato["k"], stato["t0"] = k, time.time()
            stato.setdefault("inizi", {})[k] = stato["t0"]
            stato["dopo"] = 0

        def parola(pezzo, n=1):
            """attende il momento in cui la voce dice la n-esima parola che contiene 'pezzo'"""
            trovate = 0
            for i, (a, _b, w) in enumerate(voce[stato["k"]]["parole"]):
                if i >= stato["dopo"] and pezzo.lower() in w.lower():
                    trovate += 1
                    if trovate == n:
                        stato["dopo"] = i + 1
                        dorme(stato["t0"] + a - ANTICIPO - time.time())
                        return
            raise SystemExit(f"parola '{pezzo}' non trovata nella scena {stato['k']}")

        def fine_scena():
            attesa = stato["t0"] + voce[stato["k"]]["durata"] + PAUSA - time.time()
            if attesa < 0:
                print(f"  attenzione: la scena {stato['k']} è in ritardo di {-attesa:.1f} s")
            else:
                dorme(attesa)

        def tocca(sel, **kw):
            loc = pg.locator(sel, **kw).first if isinstance(sel, str) else sel
            loc.scroll_into_view_if_needed()
            pg.wait_for_timeout(150)
            loc.click()

        def scorri(y):
            pg.evaluate(f"window.scrollTo({{top:{y},behavior:'smooth'}})")

        # ------------------------------------------------------------ intro
        scena("intro")
        fine_scena()

        # ------------------------------------------------------------ entra
        scena("entra")
        parola("Toccalo")
        tocca("#link")
        pg.wait_for_selector("#campo-chi")
        parola("Scrivi")
        pg.locator("#campo-chi").type("Peppe", delay=110)
        parola("modifica")
        tocca("text=Fatto")
        fine_scena()

        # ------------------------------------------------------------ albero
        scena("albero")
        parola("sotto")
        scorri(620)
        parola("Tocca")
        scorri(0)
        pg.wait_for_timeout(500)
        tocca(".carta-persona:not(.centro):has-text('Antonio')")
        parola("ramo")
        tocca(".carta-persona:not(.centro):has-text('Marco')")
        fine_scena()

        # ------------------------------------------------------------ scheda
        scena("scheda")
        parola("tocchi")
        scorri(0)
        pg.wait_for_timeout(400)
        tocca(".carta-persona.centro")
        parola("basso")
        scorri(560)
        parola("ricava")
        scorri(900)
        fine_scena()

        # ------------------------------------------------------------ modifica
        scena("modifica")
        scorri(0)
        parola("Modifica")
        tocca("button:has-text('Modifica')")
        parola("ricordi")
        tocca("#f-note")
        pg.locator("#f-note").type("Appassionato di fotografia: le foto di famiglia le fa sempre lui.", delay=35)
        parola("anno")
        pg.locator("#f-nascita").scroll_into_view_if_needed()
        parola("Salva")
        tocca("button[type=submit]")
        fine_scena()

        # ------------------------------------------------------------ foto
        scena("foto")
        scorri(0)
        pg.wait_for_timeout(300)
        tocca("button:has-text('Modifica')")
        parola("Scegli")
        with pg.expect_file_chooser() as fc:
            tocca("text=Scegli o scatta una foto")
        parola("galleria")
        fc.value.set_files(str(QUI / "materiale" / "foto_esempio.jpg"))
        pg.wait_for_selector(".ritaglio-area")
        parola("trascini")
        box = pg.locator(".ritaglio-area").bounding_box()
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        pg.mouse.move(cx, cy)
        pg.mouse.down()
        pg.mouse.move(cx - 70, cy + 25, steps=25)
        pg.mouse.up()
        parola("cursore")
        for z in (1.2, 1.4, 1.6, 1.8, 2.0):
            pg.eval_on_selector(".zoom input", f"e => {{ e.value = {z}; e.dispatchEvent(new Event('input')); }}")
            pg.wait_for_timeout(120)
        parola("dita")
        pg.mouse.move(cx, cy)
        pg.mouse.down()
        pg.mouse.move(cx - 25, cy + 30, steps=15)
        pg.mouse.up()
        parola("Usa")
        tocca("text=Usa questa parte")
        fine_scena()
        tocca("button[type=submit]")          # salva la foto nella pausa fra le scene

        # ------------------------------------------------------------ aggiungi
        scena("aggiungi")
        pg.wait_for_timeout(500)
        tocca("text=Vedi nell’albero")
        parola("Aggiungi")
        tocca("text=Aggiungi figlio o figlia")
        parola("Persona")
        tocca("text=Persona nuova")
        parola("nome")
        pg.locator("#f-nome").type("Matteo", delay=110)
        parola("salva")
        tocca("button[type=submit]")
        fine_scena()

        # ------------------------------------------------------------ persone
        scena("persone")
        scorri(0)
        parola("Persone")
        tocca(".schede button[data-vista=persone]")
        parola("Scrivi")
        pg.locator(".campo-cerca").type("Ferri", delay=150)
        fine_scena()

        # ------------------------------------------------------------ novità
        scena("novita")
        parola("Novità")
        tocca(".schede button[data-vista=novita]")
        parola("sbagliato")
        tocca(pg.locator(".voce:has-text('Eliminata Teresa') button:has-text('Annulla')").first)
        parola("tutto")
        tocca("text=Sì, annulla")
        fine_scena()

        # ------------------------------------------------------------ copie
        scena("copie")
        parola("Altro")
        tocca(".schede button[data-vista=altro]")
        parola("serali")
        tocca("text=Copie serali")
        parola("cambiato")
        tocca(pg.locator(".copia").nth(0))
        parola("recuperare")
        tocca(pg.locator(".differenza:has-text('Lucia') button").first)
        pg.wait_for_timeout(900)
        tocca("text=Sì, rimetti")
        fine_scena()

        # ------------------------------------------------------------ invita
        scena("invita")
        parola("Altro")
        tocca(".schede button[data-vista=altro]")
        parola("Invita")
        tocca("text=Invita un familiare")
        parola("QR")
        pg.evaluate("window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})")
        parola("familiari")
        scorri(0)
        fine_scena()

        # ------------------------------------------------------------ stampa
        scena("stampa")
        parola("Altro")
        tocca(".schede button[data-vista=altro]")
        parola("Stampa")
        tocca(".opzione:has-text('Stampa')")
        parola("ramo")
        tocca("label:has-text('I discendenti di una persona')")
        parola("foglio")
        tocca("label:has-text('A4')")
        parola("verde")
        pg.locator(".anteprima-stampa").scroll_into_view_if_needed()
        parola("Stampa")
        bottone = pg.locator("button:has-text('Stampa o salva in PDF')")
        bottone.scroll_into_view_if_needed()
        parola("PDF")
        # solo il cerchio del tocco: la finestra di stampa vera non si apre durante la registrazione
        r = bottone.bounding_box()
        pg.evaluate(f"dispatchEvent(new PointerEvent('pointerdown', {{clientX: {r['x'] + r['width'] / 2}, clientY: {r['y'] + r['height'] / 2}}}))")
        parola("nitido")
        pg.locator(".anteprima-stampa").scroll_into_view_if_needed()
        fine_scena()

        # ------------------------------------------------------------ fine
        scena("fine")
        tocca(".schede button[data-vista=altro]")
        parola("Home")
        tocca("text=Come si usa")
        pg.wait_for_timeout(600)
        pg.evaluate("window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})")
        parola("adesso")
        tocca(".schede button[data-vista=albero]")
        fine_scena()
        pg.wait_for_timeout(1500)

        t_fine = time.time()
        cdp.send("Page.stopScreencast")
        ctx.close()
        b.close()

    # i fotogrammi arrivano solo quando lo schermo cambia: ognuno dura fino al successivo
    t_video = fotogrammi[0]
    righe = []
    for i, t in enumerate(fotogrammi):
        dur = (fotogrammi[i + 1] if i + 1 < len(fotogrammi) else t_fine) - t
        nome = (cartella / f"{i:06d}.jpg").as_posix()
        righe.append(f"file '{nome}'" + chr(10) + f"duration {max(dur, 0.001):.4f}" + chr(10))
    ultimo = (cartella / f"{len(fotogrammi) - 1:06d}.jpg").as_posix()
    righe.append(f"file '{ultimo}'" + chr(10))
    (LAVORO / "fotogrammi.txt").write_text("".join(righe), "utf-8")
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(LAVORO / "fotogrammi.txt"),
                    "-vf", "fps=30,scale=780:1688:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", "14",
                    "-preset", "medium", str(LAVORO / "registrazione.mp4")], check=True)
    inizi = {k: round(t - t_video, 3) for k, t in stato["inizi"].items()}
    (LAVORO / "tempi.json").write_text(json.dumps(inizi, indent=1), "utf-8")
    print(f"  registrazione pronta: {len(fotogrammi)} fotogrammi,", LAVORO / "registrazione.mp4")


if __name__ == "__main__":
    main()
