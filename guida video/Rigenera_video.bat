@echo off
rem Rifà voce (solo le scene cambiate), registrazione dell'app, video e istruzioni PDF.
rem I testi stanno in copione.py. Serve Internet (ElevenLabs e il sito).
cd /d "%~dp0"
python voce.py || goto errore
python registra.py || goto errore
python monta.py || goto errore
python istruzioni.py || goto errore
echo.
echo Fatto: video e istruzioni sono nella cartella "albero genealogico".
pause
exit /b 0
:errore
echo Qualcosa non ha funzionato: leggi il messaggio qui sopra.
pause
exit /b 1
