-- ======================================================================
-- ESQUEMA DO BANCO DE DADOS SUPABASE (POSTGRESQL) - SISTEMA DE DELIVERY
-- Pronto para suportar milhões de lojistas, pedidos e motoboys simultâneos
-- ======================================================================

-- 1. TABELA DE LOJAS / RESTAURANTES (Multi-tenancy com isolamento total)
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  cnpj_cpf TEXT,
  address TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insere uma loja padrão caso não exista
INSERT INTO stores (id, name) 
VALUES ('default_store', 'Delivery Express')
ON CONFLICT (id) DO NOTHING;

-- 2. TABELA DE PEDIDOS (Indexada para busca ultra-rápida por loja e status)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default_store' REFERENCES stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer JSONB NOT NULL DEFAULT '{}'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 3. TABELA DE ENTREGADORES / MOTOBOYS
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default_store' REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle TEXT,
  rg TEXT,
  shift_active BOOLEAN DEFAULT FALSE,
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_store_id ON drivers(store_id);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);

-- 4. TABELA DE TOKENS DE CADASTRO DESCARTÁVEIS (Uso Único - 5 Minutos)
CREATE TABLE IF NOT EXISTS driver_tokens (
  token TEXT PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default_store' REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at BIGINT,
  claimed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tokens_code ON driver_tokens(code);
CREATE INDEX IF NOT EXISTS idx_tokens_store_id ON driver_tokens(store_id);

-- 5. TABELA DE CÓDIGOS DE LOGIN DE MOTOBOY (6 Dígitos por Telefone)
CREATE TABLE IF NOT EXISTS driver_phone_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

-- ======================================================================
-- ATIVAÇÃO DO REALTIME (WebSockets instantâneos para Lojistas e Motoboys)
-- ======================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
  END IF;
END $$;
