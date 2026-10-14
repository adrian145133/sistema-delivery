@echo off
cd /d "%~dp0"

:: Inicia o servidor Node.js 100% invisivel em segundo plano (sem janela preta)
powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c node server.js' -WindowStyle Hidden"

:: Aguarda 1 segundo em segundo plano
timeout /t 1 /nobreak >nul

:: Abre no modo aplicativo dedicado (sem barra de URL) e com impressao direta automatica
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3000/caixa.html" --kiosk-printing --user-data-dir="%~dp0edge_profile"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:3000/caixa.html" --kiosk-printing --user-data-dir="%~dp0chrome_profile"
) else (
    start "" "http://localhost:3000/caixa.html"
)

exit
