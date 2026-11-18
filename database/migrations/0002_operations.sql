-- NEXUS LOGISTICS OS — 0002 Operación mínima para la torre de control (Hito 2):
-- flota, viajes, envíos, novedades y recomendaciones de IA con aprobación humana.
-- Subconjunto del diseño de docs/architecture/ESQUEMA_BASE_DATOS.md; se amplía en los Hitos 3–8.

CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS tms;
CREATE SCHEMA IF NOT EXISTS parcel;
CREATE SCHEMA IF NOT EXISTS ai;
GRANT USAGE ON SCHEMA fleet, tms, parcel, ai TO nexus_app;

-- ---------------------------------------------------------------------------
-- Flota
-- ---------------------------------------------------------------------------
CREATE TABLE fleet.vehicle (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES core.tenant(id),
  site_id      uuid NOT NULL,
  plate        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('motorcycle','van','truck','tractor')),
  model        text NOT NULL,
  capacity_kg  numeric(10,2) NOT NULL CHECK (capacity_kg > 0),
  status       text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','inactive')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, plate),
  FOREIGN KEY (tenant_id, site_id) REFERENCES core.site (tenant_id, id)
);
SELECT core.apply_tenant_rls('fleet.vehicle');
GRANT SELECT, INSERT, UPDATE ON fleet.vehicle TO nexus_app;

CREATE TABLE fleet.driver (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core.tenant(id),
  site_id       uuid NOT NULL,
  full_name     text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('linehaul','courier')),
  phone_masked  text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, site_id) REFERENCES core.site (tenant_id, id)
);
SELECT core.apply_tenant_rls('fleet.driver');
GRANT SELECT, INSERT, UPDATE ON fleet.driver TO nexus_app;

-- ---------------------------------------------------------------------------
-- Viajes y paradas
-- ---------------------------------------------------------------------------
CREATE TABLE tms.trip (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES core.tenant(id),
  code                  text NOT NULL,
  kind                  text NOT NULL CHECK (kind IN ('linehaul','urban','pickup','b2b')),
  origin_site_id        uuid NOT NULL,
  destination_site_id   uuid,
  destination_label     text NOT NULL,
  vehicle_id            uuid REFERENCES fleet.vehicle(id),
  driver_id             uuid REFERENCES fleet.driver(id),
  status                text NOT NULL CHECK (status IN ('planned','assigned','loading','departed','in_transit','arrived','closed','cancelled')),
  planned_departure     timestamptz NOT NULL,
  planned_arrival       timestamptz NOT NULL,
  window_end            timestamptz NOT NULL,
  actual_departure      timestamptz,
  actual_arrival        timestamptz,
  eta                   timestamptz,
  eta_source            text NOT NULL DEFAULT 'simulator' CHECK (eta_source IN ('simulator','provider','manual')),
  eta_updated_at        timestamptz,
  route_label           text NOT NULL,
  route_version         int NOT NULL DEFAULT 1,
  distance_km           numeric(8,1) NOT NULL,
  units_on_board        int NOT NULL DEFAULT 0 CHECK (units_on_board >= 0),
  last_lat              numeric(9,6),
  last_lon              numeric(9,6),
  last_position_at      timestamptz,
  position_source       text CHECK (position_source IN ('simulator','device','telematics')),
  speed_kmh             numeric(5,1),
  fuel_pct              numeric(5,1),
  delay_minutes         int NOT NULL DEFAULT 0,
  delay_cause           text,
  risk_level            text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  version               int NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, origin_site_id) REFERENCES core.site (tenant_id, id),
  CHECK (planned_arrival > planned_departure)
);
CREATE INDEX trip_tenant_departure ON tms.trip (tenant_id, planned_departure);
SELECT core.apply_tenant_rls('tms.trip');
GRANT SELECT, INSERT, UPDATE ON tms.trip TO nexus_app;

CREATE TABLE tms.trip_stop (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core.tenant(id),
  trip_id     uuid NOT NULL REFERENCES tms.trip(id),
  seq         int NOT NULL,
  label       text NOT NULL,
  lat         numeric(9,6) NOT NULL,
  lon         numeric(9,6) NOT NULL,
  planned_at  timestamptz NOT NULL,
  actual_at   timestamptz,
  route_version int NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  UNIQUE (tenant_id, trip_id, route_version, seq)
);
SELECT core.apply_tenant_rls('tms.trip_stop');
GRANT SELECT, INSERT, UPDATE ON tms.trip_stop TO nexus_app;

-- ---------------------------------------------------------------------------
-- Envíos (vista agregada para la torre de control) y novedades
-- ---------------------------------------------------------------------------
CREATE TABLE parcel.shipment (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core.tenant(id),
  client_account_id  uuid NOT NULL REFERENCES core.client_account(id),
  code               text NOT NULL,
  waybill_number     text NOT NULL,
  service_code       text NOT NULL,
  origin_site_id     uuid NOT NULL,
  destination_city   text NOT NULL,
  status             text NOT NULL CHECK (status IN ('LABEL_CREATED','ACCEPTED','AT_ORIGIN_HUB','LINEHAUL_IN_TRANSIT','AT_DESTINATION_HUB','OUT_FOR_DELIVERY','DELIVERED','DELIVERY_ATTEMPT_FAILED','RETURN_TO_SENDER','CANCELLED')),
  units              int NOT NULL CHECK (units > 0),
  promised_by        timestamptz NOT NULL,
  delivered_at       timestamptz,
  trip_id            uuid REFERENCES tms.trip(id),
  at_risk            boolean NOT NULL DEFAULT false,
  version            int NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, waybill_number),
  FOREIGN KEY (tenant_id, origin_site_id) REFERENCES core.site (tenant_id, id)
);
CREATE INDEX shipment_tenant_status ON parcel.shipment (tenant_id, status);
SELECT core.apply_tenant_rls('parcel.shipment');
-- Restricción adicional para usuarios de portal de cliente (ADR-0004)
CREATE POLICY client_scope ON parcel.shipment AS RESTRICTIVE TO nexus_app
  USING (coalesce(current_setting('app.client_account_ids', true), '') = ''
         OR client_account_id = ANY (string_to_array(current_setting('app.client_account_ids', true), ',')::uuid[]));
GRANT SELECT, INSERT, UPDATE ON parcel.shipment TO nexus_app;

CREATE TABLE parcel.exception_case (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core.tenant(id),
  site_id       uuid NOT NULL,
  trip_id       uuid REFERENCES tms.trip(id),
  shipment_id   uuid REFERENCES parcel.shipment(id),
  kind          text NOT NULL CHECK (kind IN ('delay','address_issue','damage','missing_scan','failed_delivery','vehicle_issue','temperature')),
  severity      text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  title         text NOT NULL,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_progress','resolved','closed')),
  dedupe_key    text NOT NULL,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
-- Deduplicación de alertas (sección 16.2): una novedad abierta por clave
CREATE UNIQUE INDEX exception_open_dedupe ON parcel.exception_case (tenant_id, dedupe_key)
  WHERE status IN ('open','acknowledged','in_progress');
SELECT core.apply_tenant_rls('parcel.exception_case');
GRANT SELECT, INSERT, UPDATE ON parcel.exception_case TO nexus_app;

-- ---------------------------------------------------------------------------
-- IA gobernada (ADR-0009)
-- ---------------------------------------------------------------------------
CREATE TABLE ai.recommendation (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core.tenant(id),
  site_id            uuid NOT NULL,
  code               text NOT NULL,
  version            int NOT NULL DEFAULT 1,
  agent              text NOT NULL CHECK (agent IN ('dispatch','route','exception','customer','fleet','reporting')),
  engine             text NOT NULL,
  mode               text NOT NULL CHECK (mode IN ('demo','real')),
  entity_type        text NOT NULL,
  entity_id          uuid NOT NULL,
  entity_version     int NOT NULL,
  severity           text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  summary            text NOT NULL,
  causes             jsonb NOT NULL DEFAULT '[]',
  evidence           jsonb NOT NULL DEFAULT '[]',
  options            jsonb NOT NULL,
  confidence         numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  data_quality       text NOT NULL CHECK (data_quality IN ('sufficient','degraded','insufficient')),
  requires_approval  boolean NOT NULL DEFAULT true,
  status             text NOT NULL CHECK (status IN ('pending_approval','approved','rejected','revision_requested','expired','executing','executed','failed')),
  expires_at         timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  decided_at         timestamptz,
  UNIQUE (tenant_id, code)
);
CREATE INDEX recommendation_tenant_status ON ai.recommendation (tenant_id, status, created_at DESC);
-- Una propuesta pendiente por entidad y agente
CREATE UNIQUE INDEX recommendation_one_pending ON ai.recommendation (tenant_id, agent, entity_type, entity_id)
  WHERE status = 'pending_approval';
SELECT core.apply_tenant_rls('ai.recommendation');
GRANT SELECT, INSERT, UPDATE ON ai.recommendation TO nexus_app;

CREATE TABLE ai.approval (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES core.tenant(id),
  recommendation_id       uuid NOT NULL REFERENCES ai.recommendation(id),
  recommendation_version  int NOT NULL,
  option_key              text,
  decision                text NOT NULL CHECK (decision IN ('approved','rejected','revision_requested')),
  approver_id             uuid NOT NULL,
  approver_name           text NOT NULL,
  comment                 text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recommendation_id, recommendation_version)
);
SELECT core.apply_tenant_rls('ai.approval');
GRANT SELECT, INSERT ON ai.approval TO nexus_app;
CREATE TRIGGER approval_append_only BEFORE UPDATE OR DELETE ON ai.approval
  FOR EACH ROW EXECUTE FUNCTION core.prevent_update_delete();

CREATE TABLE ai.execution_result (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES core.tenant(id),
  approval_id      uuid NOT NULL REFERENCES ai.approval(id),
  idempotency_key  text NOT NULL,
  status           text NOT NULL CHECK (status IN ('executed','failed')),
  result           jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
SELECT core.apply_tenant_rls('ai.execution_result');
GRANT SELECT, INSERT ON ai.execution_result TO nexus_app;
