@echo off
rem Programma la copia notturna su questo PC: ogni sera alle 23:30 (se il PC e' acceso;
rem se era spento, parte appena si riaccende). Basta lanciarlo una volta sola.
setlocal
set "SCRIPT=%~dp0copia_notturna.py"
for /f "delims=" %%P in ('where pythonw 2^>nul') do if not defined PYW set "PYW=%%P"
if not defined PYW (
  echo Python non trovato. Installarlo da python.org e riprovare.
  pause
  exit /b 1
)
powershell -NoProfile -Command ^
  "$a = New-ScheduledTaskAction -Execute '%PYW%' -Argument '\"%SCRIPT%\"';" ^
  "$t = New-ScheduledTaskTrigger -Daily -At 23:30;" ^
  "$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1);" ^
  "Register-ScheduledTask -TaskName 'Albero di famiglia - copia notturna' -Action $a -Trigger $t -Settings $s -Force | Out-Null"
if errorlevel 1 (
  echo Non sono riuscito a programmare la copia.
) else (
  echo Copia notturna programmata alle 23:30. Ora ne faccio subito una di prova...
  python "%SCRIPT%"
)
pause
