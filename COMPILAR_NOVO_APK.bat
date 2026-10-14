@echo off
chcp 65001 >nul
title COMPILADOR DO APK DO MOTOBOY - SISTEMA DELIVERY
color 0A

echo ========================================================
echo       COMPILADOR DO APK NATIVO DO MOTOBOY
echo ========================================================
echo.

set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot
set ANDROID_HOME=C:\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

echo [1/3] Sincronizando tela e código mais recente...
cd /d "%~dp0motoboy-android-app"
call npx cap sync android

echo.
echo [2/3] Compilando APK nativo Android com Gradle...
cd /d "%~dp0motoboy-android-app\android"
call gradlew.bat assembleDebug

echo.
echo [3/3] Copiando APK gerado para a pasta principal...
copy /y "%~dp0motoboy-android-app\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0App_Motoboy.apk" >nul

echo.
echo ========================================================
echo 🎉 APK GERADO COM SUCESSO!
echo Arquivo: %~dp0App_Motoboy.apk
echo.
echo Você pode:
echo 1. Enviar o arquivo "App_Motoboy.apk" direto pelo WhatsApp para os motoboys.
echo 2. Ou pedir para eles baixarem pelo link: http://[SEU-IP]:3000/App_Motoboy.apk
echo ========================================================
echo.
pause
