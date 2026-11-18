-- NEXUS LOGISTICS OS — 0001 Core: identidad, multiempresa, eventos, auditoría.
-- Se ejecuta como nexus_owner. La aplicación se conecta como nexus_app (sin BYPASSRLS).
-- Ver docs/architecture/adr/ADR-0004-multitenancy-rls.md y ADR-0006-eventos-outbox.md

CREATE SCHEMA IF NOT EXISTS core;
GRANT USAGE ON SCHEMA core TO nexus_app;

-- ---------------------------------------------------------------------------
-- Contexto de tenant (fail closed: sin app.tenant_id la consulta falla)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT current_setting('app.tenant_id')::uuid $$;

CREATE OR REPLACE FUNCTION core.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Aplica RLS estándar (ENABLE + FORCE + política por tenant) a una tabla de negocio.
CREATE OR REPLACE FUNCTION core.apply_tenant_rls(p_table regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', p_table);
  EXECUTE format($p$CREATE POLICY tenant_isolation ON %s TO nexus_app
      USING (tenant_id = core.current_tenant())
      WITH CHECK (tenant_id = core.current_tenant())$p$, p_table);
END $$;

-- Impide UPDATE/DELETE en tablas append-only.
CREATE OR REPLACE FUNCTION core.prevent_update_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % no admite % (historial inmutable)', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION core.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ---------------------------------------------------------------------------
-- Tenant
-- ---------------------------------------------------------------------------
CREATE TABLE core.tenant (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  legal_name       text NOT NULL,
  nit              text,
  data_mode        text NOT NULL CHECK (data_mode IN ('demo','real')),
  default_timezone text NOT NULL DEFAULT 'America/Bogota',
  default_currency char(3) NOT NULL DEFAULT 'COP',
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE core.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON core.tenant TO nexus_app USING (id = core.current_tenant());
CREATE POLICY definer_access ON core.tenant TO nexus_owner USING (true) WITH CHECK (true);
GRANT SELECT ON core.tenant TO nexus_app;

-- data_mode es inmutable (ADR-0012)
CREATE OR REPLACE FUNCTION core.tenant_mode_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_mode <> OLD.data_mode THEN RAISE EXCEPTION 'TENANT_DATA_MODE_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tenant_mode_immutable BEFORE UPDATE ON core.tenant
  FOR EACH ROW EXECUTE FUNCTION core.tenant_mode_immutable();

-- ---------------------------------------------------------------------------
-- Sedes y clientes contractuales
-- ---------------------------------------------------------------------------
CREATE TABLE core.site (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core.tenant(id),
  code        text NOT NULL,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('warehouse','hub','branch','store','terminal','pudo','yard')),
  city        text NOT NULL,
  department  text NOT NULL,
  lat         numeric(9,6) NOT NULL,
  lon         numeric(9,6) NOT NULL,
  timezone    text NOT NULL DEFAULT 'America/Bogota',
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
SELECT core.apply_tenant_rls('core.site');
GRANT SELECT, INSERT, UPDATE ON core.site TO nexus_app;

CREATE TABLE core.client_account (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core.tenant(id),
  code        text NOT NULL,
  legal_name  text NOT NULL,
  id_type     text NOT NULL CHECK (id_type IN ('NIT','CC','CE','PASAPORTE')),
  id_number   text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('natural','juridica')),
  segment     text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id_type, id_number)
);
SELECT core.apply_tenant_rls('core.client_account');
GRANT SELECT, INSERT, UPDATE ON core.client_account TO nexus_app;

CREATE TABLE core.module_activation (
  tenant_id  uuid NOT NULL REFERENCES core.tenant(id),
  module     text NOT NULL,
  enabled    boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module)
);
SELECT core.apply_tenant_rls('core.module_activation');
GRANT SELECT, INSERT, UPDATE ON core.module_activation TO nexus_app;

-- ---------------------------------------------------------------------------
-- Usuarios (plataforma), roles (catálogo) y membresías (tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE core.role (
  code          text PRIMARY KEY,
  name          text NOT NULL,
  mfa_required  boolean NOT NULL DEFAULT false
);
GRANT SELECT ON core.role TO nexus_app;

CREATE TABLE core.app_user (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  display_name   text NOT NULL,
  password_hash  text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  mfa_enrolled   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_user_email_uq ON core.app_user (lower(email));
CREATE TRIGGER app_user_touch BEFORE UPDATE ON core.app_user FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

CREATE TABLE core.membership (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core.tenant(id),
  user_id            uuid NOT NULL REFERENCES core.app_user(id),
  role_code          text NOT NULL REFERENCES core.role(code),
  site_ids           uuid[] NOT NULL DEFAULT '{}',          -- vacío = todas las sedes del tenant
  client_account_ids uuid[] NOT NULL DEFAULT '{}',          -- vacío = sin restricción por cliente
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  UNIQUE (tenant_id, user_id, role_code)
);
SELECT core.apply_tenant_rls('core.membership');
CREATE POLICY definer_access ON core.membership TO nexus_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON core.membership TO nexus_app;

-- app_user: visible solo si es el propio usuario o tiene membresía en el tenant actual.
ALTER TABLE core.app_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_visibility ON core.app_user TO nexus_app
  USING (id = core.current_user_id()
         OR EXISTS (SELECT 1 FROM core.membership m WHERE m.user_id = app_user.id));
GRANT SELECT ON core.app_user TO nexus_app;
GRANT UPDATE (display_name, status) ON core.app_user TO nexus_app;

-- ---------------------------------------------------------------------------
-- Sesiones (solo accesibles mediante funciones SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE TABLE core.session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    text NOT NULL UNIQUE,
  csrf_hash     text NOT NULL,
  user_id       uuid NOT NULL REFERENCES core.app_user(id),
  tenant_id     uuid REFERENCES core.tenant(id),
  site_id       uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  user_agent    text,
  ip_hash       text
);
ALTER TABLE core.session ENABLE ROW LEVEL SECURITY; -- sin políticas para nexus_app => sin acceso directo
REVOKE ALL ON core.session FROM nexus_app;

CREATE OR REPLACE FUNCTION core.auth_lookup(p_email text)
RETURNS TABLE (user_id uuid, password_hash text, status text, display_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT id, password_hash, status, display_name FROM core.app_user WHERE lower(email) = lower(p_email)
$$;

CREATE OR REPLACE FUNCTION core.session_create(p_token_hash text, p_csrf_hash text, p_user uuid, p_ttl_minutes int, p_user_agent text, p_ip_hash text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  INSERT INTO core.session (token_hash, csrf_hash, user_id, expires_at, user_agent, ip_hash)
  VALUES (p_token_hash, p_csrf_hash, p_user, now() + make_interval(mins => p_ttl_minutes), left(p_user_agent, 300), p_ip_hash)
  RETURNING id
$$;

CREATE OR REPLACE FUNCTION core.session_resolve(p_token_hash text)
RETURNS TABLE (session_id uuid, user_id uuid, tenant_id uuid, site_id uuid, csrf_hash text, display_name text, email text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
BEGIN
  RETURN QUERY
  UPDATE core.session s SET last_seen_at = now()
    FROM core.app_user u
   WHERE s.token_hash = p_token_hash AND u.id = s.user_id
     AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'
     AND (s.tenant_id IS NULL OR EXISTS (
          SELECT 1 FROM core.membership m JOIN core.tenant t ON t.id = m.tenant_id
           WHERE m.user_id = s.user_id AND m.tenant_id = s.tenant_id AND m.status = 'active' AND t.status = 'active'))
  RETURNING s.id, s.user_id, s.tenant_id, s.site_id, s.csrf_hash, u.display_name, u.email, s.expires_at;
END $$;

CREATE OR REPLACE FUNCTION core.session_set_context(p_session uuid, p_tenant uuid, p_site uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE v_user uuid; v_ok boolean;
BEGIN
  SELECT user_id INTO v_user FROM core.session WHERE id = p_session AND revoked_at IS NULL AND expires_at > now();
  IF v_user IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (
    SELECT 1 FROM core.membership m JOIN core.tenant t ON t.id = m.tenant_id
     WHERE m.user_id = v_user AND m.tenant_id = p_tenant AND m.status = 'active' AND t.status = 'active'
       AND (p_site IS NULL OR cardinality(m.site_ids) = 0 OR p_site = ANY (m.site_ids))
  ) INTO v_ok;
  IF NOT v_ok THEN RETURN false; END IF;
  UPDATE core.session SET tenant_id = p_tenant, site_id = p_site WHERE id = p_session;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION core.session_revoke(p_session uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  UPDATE core.session SET revoked_at = now() WHERE id = p_session AND revoked_at IS NULL
$$;

-- Revoca todas las sesiones de un usuario que pertenece al tenant del contexto actual.
CREATE OR REPLACE FUNCTION core.revoke_user_sessions(p_user uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.membership WHERE user_id = p_user AND tenant_id = core.current_tenant()) THEN
    RAISE EXCEPTION 'USER_NOT_IN_TENANT';
  END IF;
  UPDATE core.session SET revoked_at = now() WHERE user_id = p_user AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION core.user_memberships(p_user uuid)
RETURNS TABLE (tenant_id uuid, tenant_code text, tenant_name text, data_mode text, role_code text, site_ids uuid[])
LANGUAGE sql SECURITY DEFINER SET search_path = core, pg_temp AS $$
  SELECT t.id, t.code, t.legal_name, t.data_mode, m.role_code, m.site_ids
    FROM core.membership m JOIN core.tenant t ON t.id = m.tenant_id
   WHERE m.user_id = p_user AND m.status = 'active' AND t.status = 'active'
   ORDER BY t.legal_name, m.role_code
$$;

-- Alta de usuario de plataforma (si el correo existe, devuelve el id sin cambiar su contraseña).
CREATE OR REPLACE FUNCTION core.provision_user(p_email text, p_display_name text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM core.app_user WHERE lower(email) = lower(p_email);
  IF v_id IS NULL THEN
    INSERT INTO core.app_user (email, display_name, password_hash) VALUES (lower(p_email), p_display_name, p_password_hash)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION core.auth_lookup(text), core.session_create(text,text,uuid,int,text,text), core.session_resolve(text),
  core.session_set_context(uuid,uuid,uuid), core.session_revoke(uuid), core.revoke_user_sessions(uuid),
  core.user_memberships(uuid), core.provision_user(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.auth_lookup(text), core.session_create(text,text,uuid,int,text,text), core.session_resolve(text),
  core.session_set_context(uuid,uuid,uuid), core.session_revoke(uuid), core.revoke_user_sessions(uuid),
  core.user_memberships(uuid), core.provision_user(text,text,text) TO nexus_app;

-- ---------------------------------------------------------------------------
-- Eventos de dominio (append-only) + outbox
-- ---------------------------------------------------------------------------
CREATE TABLE core.domain_event (
  seq             bigserial,
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES core.tenant(id),
  event_type      text NOT NULL,
  schema_version  int  NOT NULL DEFAULT 1,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  entity_version  int  NOT NULL,
  site_id         uuid,
  operator_id     text,
  source          text NOT NULL CHECK (source IN ('api','device','worker','simulator','integration','seed')),
  occurred_at     timestamptz NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  correlation_id  uuid NOT NULL,
  causation_id    uuid,
  idempotency_key text,
  payload         jsonb NOT NULL,
  prev_hash       text,
  integrity_hash  text NOT NULL,
  UNIQUE (tenant_id, entity_type, entity_id, entity_version)
);
CREATE INDEX domain_event_tenant_seq ON core.domain_event (tenant_id, seq DESC);
SELECT core.apply_tenant_rls('core.domain_event');
GRANT SELECT, INSERT ON core.domain_event TO nexus_app;
GRANT USAGE ON SEQUENCE core.domain_event_seq_seq TO nexus_app;
CREATE TRIGGER domain_event_append_only BEFORE UPDATE OR DELETE ON core.domain_event
  FOR EACH ROW EXECUTE FUNCTION core.prevent_update_delete();

CREATE TABLE core.outbox_event (
  id              uuid PRIMARY KEY REFERENCES core.domain_event(id),
  tenant_id       uuid NOT NULL REFERENCES core.tenant(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  attempts        int NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending ON core.outbox_event (created_at) WHERE published_at IS NULL;
SELECT core.apply_tenant_rls('core.outbox_event');
CREATE POLICY definer_access ON core.outbox_event TO nexus_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON core.outbox_event TO nexus_app;

-- Publicador del outbox: reclama pendientes de TODOS los tenants (solo vía esta función).
CREATE OR REPLACE FUNCTION core.outbox_claim(p_limit int)
RETURNS TABLE (event_id uuid, tenant_id uuid, event_type text, entity_type text, entity_id uuid, site_id uuid, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_temp AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT o.id FROM core.outbox_event o WHERE o.published_at IS NULL
     ORDER BY o.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE core.outbox_event o SET published_at = now(), attempts = o.attempts + 1 FROM c WHERE o.id = c.id RETURNING o.id
  )
  SELECT e.id, e.tenant_id, e.event_type, e.entity_type, e.entity_id, e.site_id, e.recorded_at
    FROM core.domain_event e JOIN u ON u.id = e.id ORDER BY e.seq;
END $$;
-- domain_event necesita lectura por el definer para el JOIN
CREATE POLICY definer_access ON core.domain_event TO nexus_owner USING (true);
REVOKE ALL ON FUNCTION core.outbox_claim(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.outbox_claim(int) TO nexus_app;

-- ---------------------------------------------------------------------------
-- Idempotencia
-- ---------------------------------------------------------------------------
CREATE TABLE core.idempotency_record (
  tenant_id        uuid NOT NULL REFERENCES core.tenant(id),
  scope            text NOT NULL,
  key              text NOT NULL,
  request_hash     text NOT NULL,
  response_status  int  NOT NULL,
  response_body    jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scope, key)
);
SELECT core.apply_tenant_rls('core.idempotency_record');
GRANT SELECT, INSERT ON core.idempotency_record TO nexus_app;

-- ---------------------------------------------------------------------------
-- Auditoría (append-only, cadena de hash por tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE core.audit_entry (
  seq            bigserial,
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES core.tenant(id),
  actor_id       text NOT NULL,
  actor_kind     text NOT NULL CHECK (actor_kind IN ('user','agent','system','support')),
  actor_name     text,
  action         text NOT NULL,
  resource_type  text NOT NULL,
  resource_id    text,
  decision       text NOT NULL CHECK (decision IN ('allow','deny')),
  reason         text,
  before_redacted jsonb,
  after_redacted  jsonb,
  correlation_id uuid NOT NULL,
  ip_hash        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  prev_hash      text,
  integrity_hash text NOT NULL
);
CREATE INDEX audit_entry_tenant_seq ON core.audit_entry (tenant_id, seq DESC);
SELECT core.apply_tenant_rls('core.audit_entry');
GRANT SELECT, INSERT ON core.audit_entry TO nexus_app;
GRANT USAGE ON SEQUENCE core.audit_entry_seq_seq TO nexus_app;
CREATE TRIGGER audit_entry_append_only BEFORE UPDATE OR DELETE ON core.audit_entry
  FOR EACH ROW EXECUTE FUNCTION core.prevent_update_delete();
