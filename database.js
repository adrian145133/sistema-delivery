// ======================================================================
// CAMADA DE BANCO DE DADOS HÍBRIDA (SUPABASE POSTGRESQL + FALLBACK LOCAL)
// Suporta alta escala com Supabase e opera 100% offline local se necessário
// ======================================================================

const fs = require('fs');
const path = require('path');

let createClient = null;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  // @supabase/supabase-js não instalado ou indisponível
}

// Arquivos locais para fallback
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const DRIVERS_FILE = path.join(__dirname, 'drivers.json');
const DRIVER_TOKENS_FILE = path.join(__dirname, 'driver_tokens.json');
const DRIVER_PHONE_CODES_FILE = path.join(__dirname, 'driver_phone_codes.json');
const CONFIG_FILE = path.join(__dirname, 'supabase_config.json');

// Carrega configurações do Supabase (.env ou supabase_config.json)
let supabaseUrl = process.env.SUPABASE_URL || '';
let supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if ((!supabaseUrl || !supabaseKey) && fs.existsSync(CONFIG_FILE)) {
  try {
    const rawCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (rawCfg.supabaseUrl) supabaseUrl = rawCfg.supabaseUrl;
    if (rawCfg.supabaseKey) supabaseKey = rawCfg.supabaseKey;
  } catch (e) {}
}

let supabaseClient = null;
if (createClient && supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    console.log('✅ [DATABASE] Conectado ao Supabase PostgreSQL na nuvem!');
  } catch (err) {
    console.warn('⚠️ [DATABASE] Falha ao iniciar cliente Supabase:', err.message);
  }
} else {
  console.log('ℹ️ [DATABASE] Modo Local Ativo (JSON). Para ativar o Supabase na nuvem, configure supabase_config.json ou variáveis de ambiente.');
}

function isSupabaseActive() {
  return Boolean(supabaseClient);
}

// ======================================================================
// HELPERS LOCAIS (JSON)
// ======================================================================
function readLocalJson(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf8');
      return defaultVal;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return defaultVal;
  }
}

function writeLocalJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Erro ao escrever arquivo local:', e);
    return false;
  }
}

// ======================================================================
// ENTREGADORES / MOTOBOYS
// ======================================================================
async function getDrivers(storeId = 'default_store') {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('drivers')
        .select('*')
        .eq('store_id', storeId);
      if (!error && Array.isArray(data)) {
        return data.map(d => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          vehicle: d.vehicle,
          rg: d.rg,
          shiftActive: d.shift_active,
          createdAt: d.created_at
        }));
      }
      console.warn('[Supabase] Erro ao buscar motoristas, usando fallback:', error?.message);
    } catch (e) {
      console.warn('[Supabase] Falha de conexão ao buscar motoristas:', e.message);
    }
  }
  return readLocalJson(DRIVERS_FILE, []);
}

async function saveDrivers(drivers, storeId = 'default_store') {
  writeLocalJson(DRIVERS_FILE, drivers);

  if (supabaseClient && Array.isArray(drivers)) {
    try {
      for (const d of drivers) {
        await supabaseClient.from('drivers').upsert({
          id: d.id,
          store_id: storeId,
          name: d.name,
          phone: d.phone || null,
          vehicle: d.vehicle || null,
          rg: d.rg || null,
          shift_active: d.shiftActive === true,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('[Supabase] Falha ao sincronizar motoristas:', e.message);
    }
  }
  return true;
}

async function upsertDriver(driver, storeId = 'default_store') {
  const localList = readLocalJson(DRIVERS_FILE, []);
  const idx = localList.findIndex(d => d.id === driver.id);
  if (idx >= 0) {
    localList[idx] = { ...localList[idx], ...driver };
  } else {
    localList.push(driver);
  }
  writeLocalJson(DRIVERS_FILE, localList);

  if (supabaseClient) {
    try {
      await supabaseClient.from('drivers').upsert({
        id: driver.id,
        store_id: storeId,
        name: driver.name,
        phone: driver.phone || null,
        vehicle: driver.vehicle || null,
        rg: driver.rg || null,
        shift_active: driver.shiftActive === true,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Supabase] Falha ao upsert motorista:', e.message);
    }
  }
  return driver;
}

async function deleteDriver(driverId, storeId = 'default_store') {
  const localList = readLocalJson(DRIVERS_FILE, []);
  const filtered = localList.filter(d => d.id !== driverId);
  writeLocalJson(DRIVERS_FILE, filtered);

  if (supabaseClient) {
    try {
      await supabaseClient.from('drivers').delete().eq('id', driverId).eq('store_id', storeId);
    } catch (e) {}
  }
  return true;
}

// ======================================================================
// PEDIDOS (ORDERS)
// ======================================================================
async function getOrders(storeId = 'default_store') {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          customer: o.customer,
          items: o.items,
          total: Number(o.total || 0),
          paymentMethod: o.payment_method,
          status: o.status,
          createdAt: o.created_at,
          deliveredAt: o.delivered_at
        }));
      }
    } catch (e) {
      console.warn('[Supabase] Falha de conexão ao buscar pedidos:', e.message);
    }
  }
  return readLocalJson(ORDERS_FILE, []);
}

async function saveOrders(orders, storeId = 'default_store') {
  writeLocalJson(ORDERS_FILE, orders);

  if (supabaseClient && Array.isArray(orders)) {
    try {
      for (const o of orders) {
        await supabaseClient.from('orders').upsert({
          id: o.id,
          store_id: storeId,
          order_number: o.orderNumber || o.id,
          customer: o.customer || {},
          items: o.items || [],
          total: o.total || 0,
          payment_method: o.paymentMethod || o.formaPagamento || 'Pix',
          status: o.status || 'novo',
          delivered_at: o.deliveredAt || null
        });
      }
    } catch (e) {
      console.warn('[Supabase] Falha ao salvar pedidos em lote:', e.message);
    }
  }
  return true;
}

async function upsertOrder(order, storeId = 'default_store') {
  const localList = readLocalJson(ORDERS_FILE, []);
  const idx = localList.findIndex(o => o.id === order.id);
  if (idx >= 0) {
    localList[idx] = { ...localList[idx], ...order };
  } else {
    localList.unshift(order);
  }
  writeLocalJson(ORDERS_FILE, localList);

  if (supabaseClient) {
    try {
      await supabaseClient.from('orders').upsert({
        id: order.id,
        store_id: storeId,
        order_number: order.orderNumber || order.id,
        customer: order.customer || {},
        items: order.items || [],
        total: order.total || 0,
        payment_method: order.paymentMethod || 'Pix',
        status: order.status || 'novo',
        delivered_at: order.deliveredAt || null
      });
    } catch (e) {
      console.warn('[Supabase] Falha ao upsert pedido:', e.message);
    }
  }
  return order;
}

// ======================================================================
// TOKENS DE CADASTRO DESCARTÁVEIS (5 MINUTOS)
// ======================================================================
async function getDriverTokens(storeId = 'default_store') {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('driver_tokens')
        .select('*')
        .eq('store_id', storeId);
      if (!error && Array.isArray(data)) {
        const result = {};
        data.forEach(t => {
          result[t.token] = {
            code: t.code,
            createdAt: Number(t.created_at),
            expiresAt: Number(t.expires_at),
            used: t.used,
            usedAt: t.used_at ? Number(t.used_at) : null,
            claimedBy: t.claimed_by || null
          };
        });
        return result;
      }
    } catch (e) {}
  }
  return readLocalJson(DRIVER_TOKENS_FILE, {});
}

async function saveDriverTokens(tokens, storeId = 'default_store') {
  writeLocalJson(DRIVER_TOKENS_FILE, tokens);

  if (supabaseClient && typeof tokens === 'object') {
    try {
      for (const [token, data] of Object.entries(tokens)) {
        await supabaseClient.from('driver_tokens').upsert({
          token,
          store_id: storeId,
          code: data.code,
          created_at: data.createdAt,
          expires_at: data.expiresAt,
          used: Boolean(data.used),
          used_at: data.usedAt || null,
          claimed_by: data.claimedBy || null
        });
      }
    } catch (e) {}
  }
  return true;
}

// ======================================================================
// CÓDIGOS DE LOGIN DE MOTOBOY (TELEFONE 6 DÍGITOS)
// ======================================================================
async function getDriverPhoneCodes() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('driver_phone_codes').select('*');
      if (!error && Array.isArray(data)) {
        const result = {};
        data.forEach(c => {
          result[c.phone] = {
            code: c.code,
            expiresAt: Number(c.expires_at),
            createdAt: Number(c.created_at)
          };
        });
        return result;
      }
    } catch (e) {}
  }
  return readLocalJson(DRIVER_PHONE_CODES_FILE, {});
}

async function saveDriverPhoneCodes(codes) {
  writeLocalJson(DRIVER_PHONE_CODES_FILE, codes);

  if (supabaseClient && typeof codes === 'object') {
    try {
      for (const [phone, data] of Object.entries(codes)) {
        await supabaseClient.from('driver_phone_codes').upsert({
          phone,
          code: data.code,
          expires_at: data.expiresAt,
          created_at: data.createdAt
        });
      }
    } catch (e) {}
  }
  return true;
}

// ======================================================================
// LOJAS (STORES / MULTI-TENANCY ESTILO YOOGA)
// ======================================================================
async function getStore(storeId = 'default_store') {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();
      if (!error && data) {
        return data;
      }
    } catch (e) {}
  }
  const localFile = path.join(__dirname, 'store_config.json');
  const localConfig = readLocalJson(localFile, {});
  return localConfig[storeId] || {
    id: storeId,
    name: storeId === 'default_store' ? 'Delivery Express' : storeId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    settings: {}
  };
}

async function saveStore(storeData) {
  const storeId = storeData.id || 'default_store';
  if (supabaseClient) {
    try {
      await supabaseClient.from('stores').upsert({
        id: storeId,
        name: storeData.name || 'Restaurante',
        phone: storeData.phone || null,
        cnpj_cpf: storeData.cnpj_cpf || null,
        address: storeData.address || null,
        settings: storeData.settings || {}
      });
    } catch (e) {
      console.warn('[Supabase] Erro ao salvar loja:', e.message);
    }
  }
  const localFile = path.join(__dirname, 'store_config.json');
  const localConfig = readLocalJson(localFile, {});
  localConfig[storeId] = storeData;
  writeLocalJson(localFile, localConfig);
  return storeData;
}

module.exports = {
  isSupabaseActive,
  getStore,
  saveStore,
  getDrivers,
  saveDrivers,
  upsertDriver,
  deleteDriver,
  getOrders,
  saveOrders,
  upsertOrder,
  getDriverTokens,
  saveDriverTokens,
  getDriverPhoneCodes,
  saveDriverPhoneCodes
};
