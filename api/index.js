// ======================================================================
// API SERVERLESS NATIVA PARA VERCEL (SUPABASE POSTGRESQL)
// Suporta alta escala com Supabase e respostas instantâneas
// ======================================================================

const db = require('../database');
const DEFAULT_MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-3981041992629702-072910-09ef1f4ba21b41a0eafbe24dcc1c7456-2469694673';
const MP_CLIENT_ID = process.env.MERCADO_PAGO_CLIENT_ID || '3981041992629702';
const MP_CLIENT_SECRET = process.env.MERCADO_PAGO_CLIENT_SECRET || '';

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined) {
      if (typeof req.body === 'object') return resolve(req.body);
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        return resolve({});
      }
    }
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  // Trata CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  try {
    const searchParams = url.searchParams;
    const storeId = (searchParams.get('loja') || searchParams.get('storeId') || searchParams.get('store') || 'default_store').toLowerCase().trim();

    // 0. GET & POST /api/store (Dados e Cardápio da Loja Estilo Yooga)
    if (pathname === '/api/store' || pathname.endsWith('/store')) {
      if (req.method === 'GET') {
        const ownerEmail = searchParams.get('ownerEmail');
        if (ownerEmail) {
          const store = await db.getStoreByEmail(ownerEmail);
          return sendJson(res, 200, store || { notFound: true });
        }
        const store = await db.getStore(storeId);
        return sendJson(res, 200, store);
      }
      if (req.method === 'POST') {
        const payload = await parseBody(req);
        const toSave = { ...payload, id: payload.id || storeId };
        const saved = await db.saveStore(toSave);
        return sendJson(res, 200, saved);
      }
    }

    // 1. GET & POST & DELETE /api/drivers
    if (pathname === '/api/drivers' || pathname.endsWith('/drivers')) {
      if (req.method === 'GET') {
        const drivers = await db.getDrivers(storeId);
        return sendJson(res, 200, drivers);
      }
      if (req.method === 'POST') {
        const payload = await parseBody(req);
        if (!payload.name) {
          return sendJson(res, 400, { error: 'Nome do motoboy é obrigatório' });
        }
        const driver = {
          id: payload.id || `driver_${Date.now()}`,
          name: payload.name.trim(),
          phone: payload.phone || null,
          vehicle: payload.vehicle || null,
          rg: payload.rg || null,
          shiftActive: Boolean(payload.shiftActive),
          createdAt: payload.createdAt || new Date().toISOString()
        };
        await db.upsertDriver(driver, storeId);
        return sendJson(res, 200, driver);
      }
      if (req.method === 'DELETE') {
        const payload = await parseBody(req);
        const driverId = payload.id || searchParams.get('id');
        if (!driverId) {
          return sendJson(res, 400, { error: 'ID do motoboy é obrigatório' });
        }
        await db.deleteDriver(driverId, storeId);
        return sendJson(res, 200, { success: true });
      }
    }

    // 2. GET & POST /api/orders
    if (pathname === '/api/orders' || pathname.endsWith('/orders')) {
      if (req.method === 'GET') {
        const orders = await db.getOrders(storeId);
        return sendJson(res, 200, orders);
      }
      if (req.method === 'POST') {
        const payload = await parseBody(req);
        if (Array.isArray(payload)) {
          await db.saveOrders(payload, storeId);
          return sendJson(res, 200, payload);
        } else if (payload && payload.id) {
          await db.upsertOrder({ ...payload, store_id: payload.store_id || storeId }, storeId);
          return sendJson(res, 200, payload);
        }
        return sendJson(res, 400, { error: 'Formato de pedido inválido' });
      }
      if (req.method === 'DELETE') {
        const payload = await parseBody(req);
        const orderId = payload?.id || searchParams.get('id');
        if (!orderId) {
          return sendJson(res, 400, { error: 'ID do pedido é obrigatório' });
        }
        await db.deleteOrder(orderId, storeId);
        return sendJson(res, 200, { success: true, deletedId: orderId });
      }
    }

    // 3. POST /api/driver-send-phone-code (Envio do Código 6 Dígitos)
    if (pathname === '/api/driver-send-phone-code' || pathname.endsWith('/driver-send-phone-code')) {
      const payload = await parseBody(req);
      const cleanPhone = String(payload.phone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) {
        return sendJson(res, 400, { error: 'Número de telefone / WhatsApp inválido' });
      }
      const drivers = await db.getDrivers();
      const driver = drivers.find(d => {
        const dPhone = String(d.phone || '').replace(/\D/g, '');
        return dPhone && (dPhone === cleanPhone || dPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dPhone));
      });
      if (!driver) {
        return sendJson(res, 404, {
          error: 'Telefone não cadastrado. Peça o link de cadastro temporário ao restaurante.'
        });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const formattedCode = `${code.substring(0, 3)}-${code.substring(3)}`;
      const phoneCodes = await db.getDriverPhoneCodes();
      phoneCodes[cleanPhone] = {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        createdAt: Date.now()
      };
      await db.saveDriverPhoneCodes(phoneCodes);
      return sendJson(res, 200, {
        success: true,
        message: 'Código de acesso gerado com sucesso!',
        code: formattedCode,
        phone: cleanPhone,
        driverName: driver.name
      });
    }

    // 4. POST /api/driver-phone-login
    if (pathname === '/api/driver-phone-login' || pathname.endsWith('/driver-phone-login')) {
      const payload = await parseBody(req);
      const cleanPhone = String(payload.phone || '').replace(/\D/g, '');
      const inputCode = String(payload.code || '').replace(/\D/g, '');
      const phoneCodes = await db.getDriverPhoneCodes();
      const codeData = phoneCodes[cleanPhone];
      if (!codeData || codeData.code !== inputCode) {
        return sendJson(res, 400, { error: 'Código de acesso incorreto.' });
      }
      if (Date.now() > codeData.expiresAt) {
        return sendJson(res, 400, { error: 'Código de acesso expirado. Solicite um novo código.' });
      }
      delete phoneCodes[cleanPhone];
      await db.saveDriverPhoneCodes(phoneCodes);

      const drivers = await db.getDrivers();
      let driver = drivers.find(d => {
        const dPhone = String(d.phone || '').replace(/\D/g, '');
        return dPhone && (dPhone === cleanPhone || dPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dPhone));
      });
      if (driver) {
        driver.shiftActive = true;
        await db.upsertDriver(driver);
      }
      return sendJson(res, 200, {
        success: true,
        driver: {
          id: driver ? driver.id : `driver_${cleanPhone}`,
          name: driver ? driver.name : 'Entregador',
          phone: cleanPhone,
          vehicle: driver ? driver.vehicle : 'Moto',
          shiftActive: true
        }
      });
    }

    // 5. POST & GET /api/driver-invite (Tokens Descartáveis de 5 Minutos)
    if (pathname === '/api/driver-invite' || pathname.endsWith('/driver-invite')) {
      if (req.method === 'POST') {
        const payload = await parseBody(req);
        const token = 'drv_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const tokens = await db.getDriverTokens();
        tokens[token] = {
          code,
          createdAt: Date.now(),
          expiresAt: Date.now() + 5 * 60 * 1000,
          used: false
        };
        await db.saveDriverTokens(tokens);
        return sendJson(res, 200, {
          token,
          code: `${code.substring(0, 3)}-${code.substring(3)}`,
          expiresIn: 300,
          inviteUrl: `/cadastro-motoboy.html?token=${token}`
        });
      }
      if (req.method === 'GET') {
        const token = searchParams.get('token');
        const tokens = await db.getDriverTokens();
        const tokenData = tokens[token];
        if (!tokenData) {
          return sendJson(res, 404, { valid: false, error: 'Token não encontrado ou expirado.' });
        }
        if (tokenData.used) {
          return sendJson(res, 200, { valid: false, used: true, error: 'Este link já foi utilizado e queimado.' });
        }
        if (Date.now() > tokenData.expiresAt) {
          return sendJson(res, 200, { valid: false, expired: true, error: 'Este link expirou (limite de 5 minutos excedido).' });
        }
        return sendJson(res, 200, { valid: true, expiresIn: Math.max(0, Math.floor((tokenData.expiresAt - Date.now()) / 1000)) });
      }
    }

    // 6. POST /api/driver-burn-invite
    if (pathname === '/api/driver-burn-invite' || pathname.endsWith('/driver-burn-invite')) {
      const payload = await parseBody(req);
      const token = payload.token;
      const tokens = await db.getDriverTokens();
      if (tokens[token]) {
        tokens[token].used = true;
        tokens[token].usedAt = Date.now();
        tokens[token].claimedBy = payload.driverName || 'Novo Motoboy';
        await db.saveDriverTokens(tokens);
      }
      return sendJson(res, 200, { success: true });
    }

    // 7. GET /api/network-info
    if (pathname === '/api/network-info' || pathname.endsWith('/network-info')) {
      return sendJson(res, 200, {
        status: 'online',
        database: db.isSupabaseActive() ? 'Supabase PostgreSQL' : 'Local Fallback',
        timestamp: new Date().toISOString()
      });
    }

    // 8. POST /api/create-pix (Criação de PIX dinâmico com baixa automática)
    if (pathname === '/api/create-pix' || pathname.endsWith('/create-pix')) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido' });
      const payload = await parseBody(req);
      const amount = Number(payload.total);
      if (!amount || amount <= 0) {
        return sendJson(res, 400, { error: 'Valor total inválido' });
      }

      const store = await db.getStore(storeId);
      const token = store?.settings?.mpAccessToken || DEFAULT_MP_ACCESS_TOKEN;

      const mpPayload = {
        transaction_amount: Number(amount.toFixed(2)),
        description: `Pedido #${payload.orderNumber || 'Delivery'} - ${store?.name || 'Fast Delivery'}`,
        payment_method_id: 'pix',
        payer: {
          email: payload.customer?.email || 'cliente@deliveryrapido.com.br',
          first_name: payload.customer?.name || 'Cliente'
        }
      };

      try {
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Idempotency-Key': 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
          },
          body: JSON.stringify(mpPayload)
        });
        const mpData = await mpResponse.json();
        if (!mpResponse.ok) {
          console.error('Mercado Pago Error:', mpData);
          return sendJson(res, 400, { error: 'Erro ao gerar PIX no Mercado Pago', details: mpData });
        }
        const pointData = mpData.point_of_interaction?.transaction_data || {};
        return sendJson(res, 200, {
          paymentId: mpData.id,
          status: mpData.status,
          qrCode: pointData.qr_code,
          qrCodeBase64: pointData.qr_code_base64 ? `data:image/png;base64,${pointData.qr_code_base64}` : null,
          ticketUrl: pointData.ticket_url,
          total: amount
        });
      } catch (err) {
        console.error('Erro em /api/create-pix:', err);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 9. GET /api/check-pix (Verificação de status do PIX para baixa instantânea)
    if (pathname === '/api/check-pix' || pathname.endsWith('/check-pix')) {
      const paymentId = searchParams.get('paymentId');
      if (!paymentId) {
        return sendJson(res, 400, { error: 'paymentId obrigatório' });
      }
      const store = await db.getStore(storeId);
      const token = store?.settings?.mpAccessToken || DEFAULT_MP_ACCESS_TOKEN;
      try {
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const mpData = await mpResponse.json();
        return sendJson(res, 200, {
          paymentId: mpData.id,
          status: mpData.status,
          isApproved: mpData.status === 'approved',
          transactionAmount: mpData.transaction_amount
        });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 10. GET /api/mercadopago-auth-url (Gera URL oficial de autorização OAuth)
    if (pathname === '/api/mercadopago-auth-url' || pathname.endsWith('/mercadopago-auth-url')) {
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.curriculorapidofacil.com.br';
      const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
      const redirectUri = `${proto}://${host}/api/mercadopago-callback`;
      const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${encodeURIComponent(storeId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return sendJson(res, 200, {
        url: authUrl,
        clientId: MP_CLIENT_ID,
        redirectUri: redirectUri,
        hasClientSecret: Boolean(MP_CLIENT_SECRET)
      });
    }

    // 11. GET /api/mercadopago-callback (Callback oficial do Mercado Pago)
    if (pathname === '/api/mercadopago-callback' || pathname.endsWith('/mercadopago-callback')) {
      const code = searchParams.get('code');
      const state = searchParams.get('state') || 'default_store';
      if (!code) {
        res.writeHead(302, { Location: `/pedidos.html?loja=${encodeURIComponent(state)}&mp_error=no_code` });
        return res.end();
      }
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.curriculorapidofacil.com.br';
      const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
      const redirectUri = `${proto}://${host}/api/mercadopago-callback`;

      try {
        const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_secret: MP_CLIENT_SECRET,
            client_id: MP_CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
          })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          console.error('Erro na troca de token Mercado Pago:', tokenData);
          res.writeHead(302, { Location: `/pedidos.html?loja=${encodeURIComponent(state)}&mp_error=token_failed` });
          return res.end();
        }

        const store = await db.getStore(state);
        store.settings = store.settings || {};
        store.settings.mpConnected = true;
        store.settings.mpAccessToken = tokenData.access_token;
        store.settings.mpPublicKey = tokenData.public_key || null;
        store.settings.mpUserId = tokenData.user_id || null;
        store.settings.mpConnectedAt = new Date().toISOString();
        await db.saveStore(store);

        res.writeHead(302, { Location: `/pedidos.html?loja=${encodeURIComponent(state)}&mp_connected=1` });
        return res.end();
      } catch (err) {
        console.error('Erro em mercadopago-callback:', err);
        res.writeHead(302, { Location: `/pedidos.html?loja=${encodeURIComponent(state)}&mp_error=${encodeURIComponent(err.message)}` });
        return res.end();
      }
    }

    // 12. POST /api/mercadopago-save-token (Salvar token manual, desconectar ou ligar cartão de crédito)
    if (pathname === '/api/mercadopago-save-token' || pathname.endsWith('/mercadopago-save-token')) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido' });
      const payload = await parseBody(req);
      const store = await db.getStore(storeId);
      store.settings = store.settings || {};
      if (payload.token) {
        store.settings.mpConnected = true;
        store.settings.mpAccessToken = payload.token.trim();
      }
      if (payload.disconnect) {
        store.settings.mpConnected = false;
        delete store.settings.mpAccessToken;
        delete store.settings.mpUserId;
        delete store.settings.mpPublicKey;
      }
      if (payload.acceptCreditCard !== undefined) {
        store.settings.acceptCreditCard = Boolean(payload.acceptCreditCard);
      }
      await db.saveStore(store);
      return sendJson(res, 200, { success: true, settings: store.settings });
    }

    // 13. POST /api/create-card-preference (Criação de Checkout Transparente Mercado Pago para Cartão)
    if (pathname === '/api/create-card-preference' || pathname.endsWith('/create-card-preference')) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido' });
      const payload = await parseBody(req);
      const amount = Number(payload.total);
      if (!amount || amount <= 0) {
        return sendJson(res, 400, { error: 'Valor total inválido' });
      }

      const store = await db.getStore(storeId);
      const token = store?.settings?.mpAccessToken || DEFAULT_MP_ACCESS_TOKEN;

      const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.curriculorapidofacil.com.br';
      const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
      const origin = `${proto}://${host}`;

      const prefPayload = {
        items: [
          {
            id: String(payload.orderNumber || 'PEDIDO'),
            title: `Pedido ${payload.orderNumber || 'Delivery'} - ${store?.name || 'Fast Delivery'}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(amount.toFixed(2))
          }
        ],
        payer: {
          name: payload.customer?.name || 'Cliente',
          email: payload.customer?.email || 'cliente@deliveryrapido.com.br',
          phone: {
            number: payload.customer?.phone || '11999999999'
          }
        },
        back_urls: {
          success: `${origin}/index.html?loja=${encodeURIComponent(storeId)}&card_success=1&order_ref=${encodeURIComponent(payload.orderNumber || '')}`,
          pending: `${origin}/index.html?loja=${encodeURIComponent(storeId)}&card_pending=1`,
          failure: `${origin}/index.html?loja=${encodeURIComponent(storeId)}&card_failure=1`
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' } // Exclui boleto bancário (somente cartão de crédito e débito online)
          ]
        },
        statement_descriptor: (store?.name || 'DELIVERY').substring(0, 16)
      };

      try {
        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(prefPayload)
        });
        const prefData = await mpRes.json();
        if (!mpRes.ok) {
          console.error('Mercado Pago Preferences Error:', prefData);
          return sendJson(res, 400, { error: 'Erro ao gerar checkout com cartão', details: prefData });
        }
        return sendJson(res, 200, {
          preferenceId: prefData.id,
          initPoint: prefData.init_point,
          sandboxInitPoint: prefData.sandbox_init_point
        });
      } catch (err) {
        console.error('Erro em create-card-preference:', err);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // Rota padrão para requisições de API não mapeadas
    return sendJson(res, 200, {
      status: 'online',
      message: 'Sistema Delivery API Ativa na Vercel',
      database: db.isSupabaseActive() ? 'Supabase PostgreSQL (São Paulo)' : 'Local Fallback'
    });
  } catch (error) {
    console.error('Erro na API Serverless:', error);
    return sendJson(res, 500, { error: error.message });
  }
};
