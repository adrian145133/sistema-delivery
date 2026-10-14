const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./database');
let selfsigned = null;
try {
  selfsigned = require('selfsigned');
} catch (e) {}

const PORT = 3000;
const HTTPS_PORT = 3443;
const PUBLIC_DIR = __dirname;
const PROFITS_FILE = path.join(__dirname, 'profits.json');

// Chave API Mercado Pago oficial
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-3981041992629702-072910-09ef1f4ba21b41a0eafbe24dcc1c7456-2469694673';
const PLATFORM_FEE = 1.00; // Taxa de R$ 1,00 por pedido pago

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive'
};

function getProfitsData() {
  try {
    if (fs.existsSync(PROFITS_FILE)) {
      return JSON.parse(fs.readFileSync(PROFITS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { orders: [] };
}

function saveProfitsData(data) {
  try {
    fs.writeFileSync(PROFITS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar profits.json:', e);
  }
}

const DRIVER_TOKENS_FILE = path.join(__dirname, 'driver_tokens.json');

function getDriverTokens() {
  try {
    if (fs.existsSync(DRIVER_TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(DRIVER_TOKENS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveDriverTokens(data) {
  try {
    fs.writeFileSync(DRIVER_TOKENS_FILE, JSON.stringify(data, null, 2), 'utf8');
    db.saveDriverTokens(data).catch(() => {});
  } catch (e) {
    console.error('Erro ao salvar driver_tokens.json:', e);
  }
}

const DRIVERS_FILE = path.join(__dirname, 'drivers.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

function getDriversData() {
  try {
    if (fs.existsSync(DRIVERS_FILE)) {
      return JSON.parse(fs.readFileSync(DRIVERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveDriversData(data) {
  try {
    fs.writeFileSync(DRIVERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    db.saveDrivers(data).catch(() => {});
  } catch (e) {
    console.error('Erro ao salvar drivers.json:', e);
  }
}

const DRIVER_EMAIL_CODES_FILE = path.join(__dirname, 'driver_email_codes.json');

function getDriverEmailCodes() {
  try {
    if (fs.existsSync(DRIVER_EMAIL_CODES_FILE)) {
      return JSON.parse(fs.readFileSync(DRIVER_EMAIL_CODES_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveDriverEmailCodes(data) {
  try {
    fs.writeFileSync(DRIVER_EMAIL_CODES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar driver_email_codes.json:', e);
  }
}

const DRIVER_PHONE_CODES_FILE = path.join(__dirname, 'driver_phone_codes.json');
function getDriverPhoneCodes() {
  try {
    if (fs.existsSync(DRIVER_PHONE_CODES_FILE)) {
      return JSON.parse(fs.readFileSync(DRIVER_PHONE_CODES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao ler driver_phone_codes.json:', e);
  }
  return {};
}

function saveDriverPhoneCodes(data) {
  try {
    fs.writeFileSync(DRIVER_PHONE_CODES_FILE, JSON.stringify(data, null, 2), 'utf8');
    db.saveDriverPhoneCodes(data).catch(() => {});
  } catch (e) {
    console.error('Erro ao salvar driver_phone_codes.json:', e);
  }
}

function getOrdersData() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveOrdersData(data) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    db.saveOrders(data).catch(() => {});
  } catch (e) {
    console.error('Erro ao salvar orders.json:', e);
  }
}

async function handleRequest(req, res) {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];
  const queryParams = new URLSearchParams(urlParts[1] || '');

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const storeId = (queryParams.get('loja') || queryParams.get('storeId') || queryParams.get('store') || 'default_store').toLowerCase().trim();

  // API: Dados e Cardápio da Loja (Multi-tenancy Estilo Yooga)
  if (pathname === '/api/store') {
    if (req.method === 'GET') {
      const store = await db.getStore(storeId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(store));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const saved = await db.saveStore({ ...payload, id: payload.id || storeId });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(saved));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // API: Listar Motoboys Cadastrados no Restaurante
  if (req.method === 'GET' && pathname === '/api/drivers') {
    const list = await db.getDrivers(storeId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // API: Salvar / Cadastrar Motoboy (enviado pelo celular ou lojista)
  if (req.method === 'POST' && pathname === '/api/drivers') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nome do motoboy é obrigatório' }));
          return;
        }
        const saved = await db.upsertDriver(payload, storeId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, driver: saved }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Excluir Motoboy (quando o lojista confirma digitando 'sim')
  if (req.method === 'DELETE' && pathname === '/api/drivers') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const driverId = payload.id || queryParams.get('id');
        await db.deleteDriver(driverId, storeId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedId: driverId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Enviar/Gerar Código de 6 Dígitos para o E-mail do Motoboy
  if (req.method === 'POST' && pathname === '/api/driver-send-email-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = String(payload.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Informe um e-mail válido.' }));
          return;
        }

        const drivers = getDriversData();
        const driver = drivers.find(d => String(d.email || '').toLowerCase() === email);
        if (!driver) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'E-mail não encontrado na equipe de entregadores. Peça o link de cadastro ao lojista.' }));
          return;
        }

        // Gera código de 6 dígitos
        const codeNum = Math.floor(100000 + Math.random() * 900000);
        const code = String(codeNum);
        const formattedCode = code.slice(0, 3) + '-' + code.slice(3);

        const emailCodes = getDriverEmailCodes();
        emailCodes[email] = {
          code,
          formattedCode,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos
          used: false,
          createdAt: Date.now()
        };
        saveDriverEmailCodes(emailCodes);

        console.log(`[EMAIL 2FA MOTOBOY] Código enviado para ${email}: ${formattedCode}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Código de segurança enviado para seu e-mail!',
          devCode: formattedCode
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Login do Motoboy com E-mail, Código de E-mail e Senha
  if (req.method === 'POST' && pathname === '/api/driver-login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '').trim();
        const inputCode = String(payload.code || '').replace(/\D/g, '');

        if (!email || !password || !inputCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Preencha seu e-mail, senha e o código enviado ao e-mail.' }));
          return;
        }

        const drivers = getDriversData();
        const driver = drivers.find(d => String(d.email || '').toLowerCase() === email);
        if (!driver) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Entregador não encontrado com este e-mail.' }));
          return;
        }

        // Valida senha cadastrada
        if (driver.password && driver.password !== password) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Senha incorreta. Tente novamente.' }));
          return;
        }

        // Valida código do e-mail
        const emailCodes = getDriverEmailCodes();
        const codeData = emailCodes[email];
        if (!codeData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nenhum código gerado para este e-mail. Clique em "Enviar Código".' }));
          return;
        }

        if (codeData.used) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Este código já foi utilizado. Solicite um novo código.' }));
          return;
        }

        if (Date.now() > codeData.expiresAt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Este código expirou (válido por 10 minutos). Solicite um novo código.' }));
          return;
        }

        if (String(codeData.code).replace(/\D/g, '') !== inputCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Código de e-mail incorreto. Verifique o número recebido.' }));
          return;
        }

        // Queima o código de e-mail (uso único)
        codeData.used = true;
        codeData.usedAt = Date.now();
        saveDriverEmailCodes(emailCodes);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, driver }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Enviar/Gerar Código de Verificação para o Telefone do Motoboy
  if (req.method === 'POST' && pathname === '/api/driver-send-phone-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawPhone = String(payload.phone || '').trim();
        const cleanPhone = rawPhone.replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Informe um número de WhatsApp/telefone válido com DDD.' }));
          return;
        }

        const drivers = getDriversData();
        const driver = drivers.find(d => {
          const dPhone = String(d.phone || '').replace(/\D/g, '');
          if (!dPhone) return false;
          return dPhone === cleanPhone ||
                 (cleanPhone.length >= 8 && dPhone.endsWith(cleanPhone.slice(-8))) ||
                 (dPhone.length >= 8 && cleanPhone.endsWith(dPhone.slice(-8)));
        });

        if (!driver) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Telefone não cadastrado na equipe de motoboys. Peça o link de cadastro de 5 minutos ao lojista.' }));
          return;
        }

        // Gera código de 6 dígitos
        const codeNum = Math.floor(100000 + Math.random() * 900000);
        const code = String(codeNum);
        const formattedCode = code.slice(0, 3) + '-' + code.slice(3);

        const phoneCodes = getDriverPhoneCodes();
        phoneCodes[cleanPhone] = {
          code,
          formattedCode,
          driverId: driver.id,
          driverName: driver.name,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos
          used: false,
          createdAt: Date.now()
        };
        saveDriverPhoneCodes(phoneCodes);

        console.log(`[WHATSAPP/SMS 2FA MOTOBOY] Código enviado para ${driver.name} (${cleanPhone}): ${formattedCode}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Código de segurança enviado para seu celular/WhatsApp!',
          code: formattedCode,
          driverName: driver.name,
          phone: driver.phone
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Login do Motoboy com Telefone e Código de Verificação
  if (req.method === 'POST' && pathname === '/api/driver-phone-login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawPhone = String(payload.phone || '').trim();
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const inputCode = String(payload.code || '').replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Informe um número de telefone válido.' }));
          return;
        }

        if (!inputCode || inputCode.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Digite o código de 6 dígitos recebido no seu telefone.' }));
          return;
        }

        const phoneCodes = getDriverPhoneCodes();
        let codeData = phoneCodes[cleanPhone];
        if (!codeData) {
          for (const [k, v] of Object.entries(phoneCodes)) {
            if (cleanPhone.endsWith(k.slice(-8)) || k.endsWith(cleanPhone.slice(-8))) {
              codeData = v;
              break;
            }
          }
        }

        if (!codeData) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nenhum código gerado para este telefone. Clique em "Enviar Código".' }));
          return;
        }

        if (codeData.used) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Este código já foi utilizado. Solicite um novo código.' }));
          return;
        }

        if (Date.now() > codeData.expiresAt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Este código expirou (válido por 10 minutos). Solicite um novo código.' }));
          return;
        }

        if (String(codeData.code).replace(/\D/g, '') !== inputCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Código de verificação incorreto. Verifique o número digitado.' }));
          return;
        }

        // Marca como usado
        codeData.used = true;
        codeData.usedAt = Date.now();
        saveDriverPhoneCodes(phoneCodes);

        const drivers = getDriversData();
        const driver = drivers.find(d => d.id === codeData.driverId) ||
                       drivers.find(d => {
                         const dPhone = String(d.phone || '').replace(/\D/g, '');
                         return dPhone === cleanPhone || dPhone.endsWith(cleanPhone.slice(-8));
                       });

        if (!driver) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Cadastro do entregador não localizado.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, driver }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Listar Pedidos da Loja (sincronizados com o celular do motoboy)
  if (req.method === 'GET' && pathname === '/api/orders') {
    const list = await db.getOrders(storeId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // API: Salvar / Atualizar Pedido da Loja
  if (req.method === 'POST' && pathname === '/api/orders') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (Array.isArray(payload)) {
          await db.saveOrders(payload, storeId);
        } else if (payload.id) {
          await db.upsertOrder(payload, storeId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Descobrir IP Local da Rede Wi-Fi/Ethernet para gerar o QR Code correto
  if (req.method === 'GET' && pathname === '/api/network-info') {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = '192.168.0.238';
    for (const name of Object.keys(interfaces)) {
      if (/tailscale|virtual|loopback/i.test(name)) continue;
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: localIp, port: PORT, httpsPort: HTTPS_PORT }));
    return;
  }

  // API: Criar/Registrar Token Único de Pareamento de Motoboy
  if (req.method === 'POST' && pathname === '/api/driver-invite') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const token = payload.token || ('tok_' + Math.random().toString(36).substring(2, 9));
        const tokens = getDriverTokens();
        tokens[token] = {
          token: token,
          code: payload.code || '',
          expiresAt: payload.expiresAt || (Date.now() + 5 * 60 * 1000),
          used: false,
          createdAt: Date.now()
        };
        saveDriverTokens(tokens);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token: token }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Verificar Validade do Token de Convite de Uso Único
  if (req.method === 'GET' && pathname === '/api/driver-invite') {
    const token = queryParams.get('token');
    const tokens = getDriverTokens();
    const tokenData = tokens ? tokens[token] : null;

    if (!tokenData) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, reason: 'not_found' }));
      return;
    }

    if (tokenData.used) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, reason: 'used', usedAt: tokenData.usedAt, driverName: tokenData.driverName }));
      return;
    }

    if (Date.now() > tokenData.expiresAt) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, reason: 'expired' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ valid: true, expiresAt: tokenData.expiresAt }));
    return;
  }

  // API: Queimar/Inutilizar Token após o motoboy finalizar com a selfie
  if (req.method === 'POST' && pathname === '/api/driver-burn-invite') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const token = payload.token;
        const tokens = getDriverTokens();
        if (tokens && tokens[token]) {
          tokens[token].used = true;
          tokens[token].usedAt = Date.now();
          tokens[token].driverName = payload.driverName || 'Motoboy';
          saveDriverTokens(tokens);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, burned: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Validar e Queimar Código de 6 Dígitos de Autorização de Cadastro de Motoboy
  if (req.method === 'POST' && pathname === '/api/driver-verify-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const inputCode = String(payload.code || '').replace(/\D/g, '');
        if (!inputCode || inputCode.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, reason: 'invalid_format', message: 'O código deve conter 6 dígitos.' }));
          return;
        }

        const tokens = getDriverTokens();
        let foundTokenKey = null;
        let tokenData = null;

        // Prioriza tokens mais recentes primeiro (reverse)
        const tokenEntries = Object.entries(tokens).reverse();

        // 1. Procura primeiro se existe o código ativo, não usado e dentro dos 5 minutos
        for (const [key, t] of tokenEntries) {
          const cleanStoredCode = String(t.code || '').replace(/\D/g, '');
          if (cleanStoredCode === inputCode && !t.used && Date.now() <= t.expiresAt) {
            foundTokenKey = key;
            tokenData = t;
            break;
          }
        }

        // 2. Se não achou ativo, verifica se existe registro usado ou expirado para diagnóstico amigável
        if (!tokenData) {
          for (const [key, t] of tokenEntries) {
            const cleanStoredCode = String(t.code || '').replace(/\D/g, '');
            if (cleanStoredCode === inputCode) {
              if (t.used) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ valid: false, reason: 'used', message: 'Este código já foi utilizado anteriormente (código de uso único).' }));
                return;
              }
              if (Date.now() > t.expiresAt) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ valid: false, reason: 'expired', message: 'Este código expirou (válido por apenas 5 minutos). Peça um novo ao lojista.' }));
                return;
              }
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, reason: 'not_found', message: 'Código não encontrado. Peça ao lojista para gerar um novo código.' }));
          return;
        }

        // Código válido! Queima imediatamente tornando de uso único
        tokenData.used = true;
        tokenData.usedAt = Date.now();
        tokenData.claimedBy = payload.driverName || 'Novo Motoboy';
        saveDriverTokens(tokens);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: true, success: true, token: foundTokenKey, message: 'Código validado com sucesso! Cadastro liberado.' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Validar ou Queimar Código de Pareamento de Cadastro (/api/driver-pair-code)
  if (pathname === '/api/driver-pair-code') {
    if (req.method === 'GET') {
      const inputCode = String(queryParams.get('code') || '').replace(/\D/g, '');
      const tokens = getDriverTokens();
      const tokenEntries = Object.entries(tokens).reverse();
      let found = null;
      for (const [key, t] of tokenEntries) {
        const cleanStored = String(t.code || '').replace(/\D/g, '');
        if (cleanStored === inputCode) {
          found = { key, ...t };
          break;
        }
      }

      if (!found) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'Código não encontrado. Peça ao lojista para gerar um novo código.' }));
        return;
      }

      if (found.used) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'Este código já foi utilizado anteriormente (uso único).' }));
        return;
      }

      if (Date.now() > found.expiresAt) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'Este código expirou (válido por apenas 5 minutos). Peça um novo ao lojista.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: true, code: found.code, token: found.key }));
      return;
    }

    if (req.method === 'DELETE') {
      const inputCode = String(queryParams.get('code') || '').replace(/\D/g, '');
      const tokens = getDriverTokens();
      for (const [key, t] of Object.entries(tokens)) {
        const cleanStored = String(t.code || '').replace(/\D/g, '');
        if (cleanStored === inputCode) {
          t.used = true;
          t.usedAt = Date.now();
          saveDriverTokens(tokens);
          break;
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
  }

  // API: Criar Cobrança PIX Real no Mercado Pago
  if (req.method === 'POST' && pathname === '/api/create-pix') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const amount = Number(payload.total);
        if (!amount || amount <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Valor total inválido' }));
          return;
        }

        const mpPayload = {
          transaction_amount: Number(amount.toFixed(2)),
          description: `Pedido #${payload.orderNumber || 'Delivery'} - Fast Delivery`,
          payment_method_id: 'pix',
          payer: {
            email: payload.customer?.email || 'cliente@deliveryrapido.com.br',
            first_name: payload.customer?.name || 'Cliente'
          }
        };

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'X-Idempotency-Key': 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
          },
          body: JSON.stringify(mpPayload)
        });

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
          console.error('Mercado Pago Error:', mpData);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao gerar PIX no Mercado Pago', details: mpData }));
          return;
        }

        const pointData = mpData.point_of_interaction?.transaction_data || {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          paymentId: mpData.id,
          status: mpData.status,
          qrCode: pointData.qr_code,
          qrCodeBase64: pointData.qr_code_base64 ? `data:image/png;base64,${pointData.qr_code_base64}` : null,
          ticketUrl: pointData.ticket_url,
          total: amount
        }));
      } catch (err) {
        console.error('Erro em /api/create-pix:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Checar Status do Pagamento no Mercado Pago
  if (req.method === 'GET' && pathname === '/api/check-pix') {
    const paymentId = queryParams.get('paymentId');
    if (!paymentId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'paymentId obrigatório' }));
      return;
    }

    try {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });

      const mpData = await mpResponse.json();
      const isApproved = mpData.status === 'approved';

      // Se foi aprovado, registra nos lucros do lojista se ainda não foi registrado
      if (isApproved) {
        const profits = getProfitsData();
        const exists = profits.orders.find(o => o.paymentId == paymentId);
        if (!exists) {
          const totalAmount = Number(mpData.transaction_amount || 0);
          const platformFee = PLATFORM_FEE;
          const netProfit = Math.max(0, totalAmount - platformFee);

          profits.orders.unshift({
            paymentId: mpData.id,
            orderNumber: queryParams.get('orderNumber') || `#${mpData.id}`,
            date: new Date().toISOString(),
            grossAmount: totalAmount,
            platformFee: platformFee,
            netProfit: netProfit,
            status: 'pago'
          });
          saveProfitsData(profits);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: mpData.status,
        approved: isApproved,
        dateApproved: mpData.date_approved,
        amount: mpData.transaction_amount
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Extrato de Lucros Exclusivo do Lojista
  if (req.method === 'GET' && pathname === '/api/store-profits') {
    const profits = getProfitsData();
    const totalOrders = profits.orders.length;
    const totalGross = profits.orders.reduce((acc, o) => acc + (o.grossAmount || 0), 0);
    const totalPlatformFee = profits.orders.reduce((acc, o) => acc + (o.platformFee || 0), 0);
    const totalNetProfit = profits.orders.reduce((acc, o) => acc + (o.netProfit || 0), 0);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalOrders,
      totalGross,
      totalPlatformFee,
      totalNetProfit,
      platformFeeRate: PLATFORM_FEE,
      orders: profits.orders
    }));
    return;
  }

  // Servidor Estático de Arquivos
  let parsedUrl = pathname;
  if (parsedUrl === '/' || parsedUrl === '') {
    parsedUrl = '/index.html';
  } else if (parsedUrl.startsWith('/loja/')) {
    parsedUrl = '/index.html';
  } else if (parsedUrl.startsWith('/pedidos/') || parsedUrl.startsWith('/painel/')) {
    parsedUrl = '/pedidos.html';
  }

  const filePath = path.join(PUBLIC_DIR, decodeURIComponent(parsedUrl));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Arquivo não encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const httpServer = http.createServer(handleRequest);

async function startServers() {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`SISTEMA DE DELIVERY ATIVO!`);
    console.log(`- HTTP:              http://localhost:${PORT}`);
    console.log(`- IP Local HTTP:     http://192.168.0.238:${PORT}/pedidos.html`);
  });

  if (selfsigned) {
    try {
      const keyFile = path.join(__dirname, 'ssl_key.pem');
      const certFile = path.join(__dirname, 'ssl_cert.pem');
      let pems = null;

      if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
        pems = {
          private: fs.readFileSync(keyFile, 'utf8'),
          cert: fs.readFileSync(certFile, 'utf8')
        };
      } else {
        pems = await selfsigned.generate([
          { name: 'commonName', value: '192.168.0.238' }
        ], {
          days: 365,
          algorithm: 'sha256',
          keySize: 2048,
          extensions: [
            {
              name: 'subjectAltName',
              altNames: [
                { type: 2, value: 'localhost' },
                { type: 7, ip: '127.0.0.1' },
                { type: 7, ip: '192.168.0.238' }
              ]
            }
          ]
        });
        fs.writeFileSync(keyFile, pems.private, 'utf8');
        fs.writeFileSync(certFile, pems.cert, 'utf8');
      }

      const httpsServer = https.createServer({
        key: pems.private,
        cert: pems.cert
      }, handleRequest);

      httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`- HTTPS (Câmera ao Vivo): https://192.168.0.238:${HTTPS_PORT}/motoboy.html`);
        console.log(`=======================================================`);
      });
    } catch (sslErr) {
      console.warn('Servidor HTTPS opcional não pôde ser iniciado:', sslErr.message);
    }
  }
}

if (require.main === module) {
  startServers();
}

module.exports = { handleRequest };
