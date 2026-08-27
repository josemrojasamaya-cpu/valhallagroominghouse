-- ============================================================
--  Valhalla Grooming House — esquema de base de datos
--
--  Recrea la estructura completa en cualquier PostgreSQL vacío.
--  Es idempotente: se puede correr varias veces sin romper nada.
--
--    psql "$DATABASE_URL" -f db/schema.sql
--  o bien:  node db/setup.js
-- ============================================================

-- ── Catálogo ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS services (
    id        SERIAL PRIMARY KEY,
    nombre    VARCHAR(100),
    precio    INTEGER,
    puesto    VARCHAR(50),
    activo    BOOLEAN DEFAULT TRUE,
    duracion  INTEGER,
    categoria VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS employees (
    id       SERIAL PRIMARY KEY,
    nombre   VARCHAR(100),
    puesto   VARCHAR(50),
    telefono VARCHAR(20),
    activo   BOOLEAN DEFAULT TRUE
);

-- ── Operación ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointments (
    id               SERIAL PRIMARY KEY,
    cliente_nombre   VARCHAR(100),
    cliente_telefono VARCHAR(20),
    empleado_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    servicio_id      INTEGER REFERENCES services(id)  ON DELETE SET NULL,
    fecha            DATE,
    hora             TIME
);

-- El índice que impide dos citas del mismo profesional a la misma hora se
-- crea desde db/setup.js, no acá: si la base ya tiene solapamientos, este
-- archivo fallaría entero y no se aplicaría el resto del esquema.

-- Consultas frecuentes: agenda por profesional y por día.
CREATE INDEX IF NOT EXISTS idx_appointments_empleado ON appointments (empleado_id);
CREATE INDEX IF NOT EXISTS idx_appointments_fecha    ON appointments (fecha);

-- ── Acceso ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id       SERIAL PRIMARY KEY,
    username VARCHAR(50)  NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    role     VARCHAR(20)  NOT NULL
);

-- ── Metas y comisiones ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS goals (
    id          SERIAL PRIMARY KEY,
    empleado_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    cantidad    INTEGER NOT NULL,
    mes         INTEGER NOT NULL,
    anio        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS salaries (
    id           SERIAL PRIMARY KEY,
    empleado_id  INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    monto_fijo   NUMERIC NOT NULL,
    periodicidad VARCHAR(50) DEFAULT 'Mensual'
);

-- ── Finanzas ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fixed_expenses (
    id         SERIAL PRIMARY KEY,
    nombre     VARCHAR(255) NOT NULL,
    monto      NUMERIC      NOT NULL,
    categoria  VARCHAR(100),
    frecuencia VARCHAR(50) DEFAULT 'Mensual',
    dia_pago   INTEGER      NOT NULL,
    active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS loans (
    id                 SERIAL PRIMARY KEY,
    descripcion        VARCHAR(255) NOT NULL,
    monto_inicial      NUMERIC      NOT NULL,
    monto_actual       NUMERIC      NOT NULL,
    tasa_interes_anual NUMERIC      NOT NULL,
    plazo_meses        INTEGER      NOT NULL,
    cuota_mensual      NUMERIC      NOT NULL,
    dia_pago           INTEGER      NOT NULL,
    active             BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS loan_payments (
    id                SERIAL PRIMARY KEY,
    loan_id           INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    monto_pagado      NUMERIC NOT NULL,
    monto_capital     NUMERIC NOT NULL,
    monto_interes     NUMERIC NOT NULL,
    es_extraordinario BOOLEAN DEFAULT FALSE,
    fecha_pago        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_funds (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(255) NOT NULL UNIQUE,
    balance_actual  NUMERIC DEFAULT 0,
    tasa_asignacion NUMERIC NOT NULL,
    tipo            VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS tax_profiles (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(255) NOT NULL,
    porcentaje   NUMERIC      NOT NULL,
    tipo_calculo VARCHAR(50) DEFAULT 'SOBRE_BRUTO',
    active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
    id          SERIAL PRIMARY KEY,
    tipo        VARCHAR(50) NOT NULL,
    monto       NUMERIC     NOT NULL,
    descripcion VARCHAR(255),
    fecha       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_fecha ON ledger_transactions (fecha DESC);

-- ── Columnas agregadas después de la creación original ──────
-- Se declaran aparte para que una base ya existente también las reciba.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS puesto   VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS activo   BOOLEAN DEFAULT TRUE;
ALTER TABLE services  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);
ALTER TABLE services  ADD COLUMN IF NOT EXISTS duracion  INTEGER;
ALTER TABLE services  ADD COLUMN IF NOT EXISTS activo    BOOLEAN DEFAULT TRUE;

-- Un profesional sin puesto no aparece en ninguna área al reservar.
UPDATE employees SET puesto = 'barbero' WHERE puesto IS NULL OR puesto = '';

-- La categoría es lo que usa el formulario de reserva; si falta, se toma
-- del puesto, que es como se clasificaban los servicios antes.
UPDATE services SET categoria = puesto WHERE (categoria IS NULL OR categoria = '') AND puesto IS NOT NULL;
