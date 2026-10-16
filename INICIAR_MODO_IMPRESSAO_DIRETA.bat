@echo off
title PAINEL DELIVERY - IMPRESSAO 100%% AUTOMATICA
color 0A

echo ========================================================
echo   INICIANDO PAINEL DE PEDIDOS COM IMPRESSAO AUTOMATICA
echo   (IMPRESSAO DIRETA SEM PRECISAR CLICAR EM IMPRIMIR)
echo ========================================================
echo.

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="https://sistema-delivery-xi.vercel.app/pedidos.html" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DeliveryKioskProfile"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="https://sistema-delivery-xi.vercel.app/pedidos.html" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DeliveryKioskProfile"
) else (
    start "" "https://sistema-delivery-xi.vercel.app/pedidos.html"
)

exit
