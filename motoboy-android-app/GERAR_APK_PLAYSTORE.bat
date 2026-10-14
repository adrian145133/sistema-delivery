@echo off
chcp 65001 >nul
echo ===================================================
echo   COMPILADOR DO APP DO MOTOBOY - GOOGLE PLAY STORE
echo ===================================================
echo.
echo 1. Sincronizando tela e recursos mais recentes...
call npx cap sync android

echo.
echo 2. Abrindo projeto no Android Studio para gerar o .AAB / .APK...
echo Se você tiver o Android Studio instalado, ele será aberto agora:
call npx cap open android

echo.
echo ===================================================
echo   COMO GERAR O ARQUIVO PARA A PLAY STORE:
echo ===================================================
echo 1. No Android Studio, clique no menu:
echo    "Build" -> "Generate Signed Bundle / APK"
echo 2. Selecione "Android App Bundle" (.aab) para a Play Store.
echo 3. Siga o assistente de assinatura (Keystore).
echo 4. O arquivo .aab gerado estará pronto para subir no Google Play Console!
echo ===================================================
pause
