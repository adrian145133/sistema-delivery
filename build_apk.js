const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, spawn } = require('child_process');

const sdkDir = 'C:\\Android\\Sdk';
const cmdlineZip = path.join(sdkDir, 'cmdline-tools.zip');
const javaHome = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastPct = 0;

      res.on('data', chunk => {
        downloaded += chunk.length;
        const pct = Math.floor((downloaded / total) * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          console.log(`Download: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  console.log('=== PREPARANDO AMBIENTE ANDROID SDK & COMPILAÇÃO DO APK ===\n');

  if (!fs.existsSync(sdkDir)) {
    fs.mkdirSync(sdkDir, { recursive: true });
  }

  const latestDir = path.join(sdkDir, 'cmdline-tools', 'latest');
  const sdkManagerBat = path.join(latestDir, 'bin', 'sdkmanager.bat');

  if (!fs.existsSync(sdkManagerBat)) {
    console.log('1. Baixando Android Command-line Tools do Google...');
    await downloadFile('https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip', cmdlineZip);
    console.log('Download concluído com sucesso!');

    console.log('2. Extraindo ferramentas do SDK...');
    const tempExtract = path.join(sdkDir, 'cmdline_temp');
    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
    fs.mkdirSync(tempExtract, { recursive: true });

    // PowerShell Expand-Archive
    execSync(`powershell -Command "Expand-Archive -Path '${cmdlineZip}' -DestinationPath '${tempExtract}' -Force"`);
    
    // Move cmdline-tools para cmdline-tools/latest
    fs.mkdirSync(path.join(sdkDir, 'cmdline-tools'), { recursive: true });
    if (fs.existsSync(latestDir)) fs.rmSync(latestDir, { recursive: true, force: true });

    const innerCmdline = path.join(tempExtract, 'cmdline-tools');
    fs.renameSync(innerCmdline, latestDir);
    fs.rmSync(tempExtract, { recursive: true, force: true });
    if (fs.existsSync(cmdlineZip)) fs.unlinkSync(cmdlineZip);
    console.log('Ferramentas do SDK extraídas em:', latestDir);
  } else {
    console.log('Android Command-line Tools já instalado em:', latestDir);
  }

  // Configura local.properties
  const localPropPath = 'C:\\Users\\admin5\\Desktop\\SistemaDelivery\\motoboy-android-app\\android\\local.properties';
  fs.writeFileSync(localPropPath, 'sdk.dir=C:\\\\Android\\\\Sdk\n', 'utf8');
  console.log('Arquivo local.properties configurado com sucesso.');

  // Aceita licenças e instala platforms;android-34 e build-tools;34.0.0
  console.log('3. Aceitando licenças e instalando Android SDK 34 (pode levar 1 a 2 minutos)...');
  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdkDir,
    PATH: `${path.join(javaHome, 'bin')};${path.join(latestDir, 'bin')};${process.env.PATH}`
  };

  try {
    execSync(`cmd.exe /c "echo y | \"${sdkManagerBat}\" --licenses"`, { env, stdio: 'inherit' });
  } catch (e) {}

  try {
    execSync(`cmd.exe /c "echo y | \"${sdkManagerBat}\" \"platforms;android-34\" \"build-tools;34.0.0\" \"platform-tools\""`, { env, stdio: 'inherit' });
    console.log('Android SDK 34 instalado com sucesso!');
  } catch (e) {
    console.error('Erro ao instalar SDK:', e.message);
  }

  // Compila o APK
  console.log('\n4. Executando compilação do APK do Motoboy (assembleDebug)...');
  const androidAppDir = 'C:\\Users\\admin5\\Desktop\\SistemaDelivery\\motoboy-android-app\\android';
  execSync(`cmd.exe /c "gradlew.bat assembleDebug"`, {
    cwd: androidAppDir,
    env,
    stdio: 'inherit'
  });

  // Localiza e copia o APK gerado
  const apkOutput = path.join(androidAppDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const finalApk = 'C:\\Users\\admin5\\Desktop\\SistemaDelivery\\App_Motoboy.apk';

  if (fs.existsSync(apkOutput)) {
    fs.copyFileSync(apkOutput, finalApk);
    const apkSize = (fs.statSync(finalApk).size / 1024 / 1024).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`🎉 APK GERADO COM SUCESSO!`);
    console.log(`Arquivo: ${finalApk}`);
    console.log(`Tamanho: ${apkSize} MB`);
    console.log(`======================================================\n`);
  } else {
    console.error('Erro: APK não foi encontrado no caminho de saída.');
  }
}

main().catch(err => {
  console.error('Falha geral:', err);
  process.exit(1);
});
