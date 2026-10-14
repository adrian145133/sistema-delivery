@echo off
chcp 65001 >nul
title SISTEMA DELIVERY ONLINE - PAINEL DO LOJISTA E APP ENTREGADOR
color 0A

echo ========================================================
echo       INICIANDO SISTEMA DE DELIVERY ONLINE (HTTPS)
echo ========================================================
echo.

:: Fecha instâncias anteriores se houver
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1

:: Inicia o servidor Node.js em segundo plano
start /b "" node server.js > server_output.log 2>&1
echo [1/2] Servidor Node.js iniciado com sucesso na porta 3000!
echo.

:: Inicia o Cloudflare Tunnel
echo [2/2] Conectando ao Cloudflare Tunnel para gerar o dominio HTTPS...
echo.

:: Executa o cloudflared e exibe a URL gerada
cloudflared.exe tunnel --url http://localhost:3000
pause
