/**
 * Seed DEMO (ADR-0012, O.09): tenant NEXUS DEMO COLOMBIA (ficticio) + tenant DEMO-B para pruebas de aislamiento.
 * Todos los nombres, placas, teléfonos, clientes y cifras son FICTICIOS. No hay datos de Coordinadora Mercantil S. A.
 */
import { Client } from 'pg';
import { ROLES, uuidv7 } from '@nexus/domain-core';
import { DbService, type Tx } from '../db/db.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import { IdempotencyService } from '../events/idempotency.service';
import { RecommendationService } from '../ai/recommendation.service';
import { SimulatorService } from '../simulator/simulator.service';
import { hashPassword, randomToken } from '../common/crypto';
import { SCENARIOS, positionAlong } from '../simulator/scenarios';
import { insertStops } from '../operations/trip.repo';

export interface SeedCredential { tenant: string; email: string; password: string; role: string; displayName: string; sites: string }
export interface SeedResult { credentials: SeedCredential[]; tenants: Record<string, string> }

const MIN = 60000;

const SITES = [
  { code: 'CLO-HUB', name: 'Hub Cali', kind: 'hub', city: 'Cali', department: 'Valle del Cauca', lat: 3.4516, lon: -76.532 },
  { code: 'PAL-DC', name: 'Centro de distribución Palmira', kind: 'warehouse', city: 'Palmira', department: 'Valle del Cauca', lat: 3.5394, lon: -76.3036 },
  { code: 'YUM-XD', name: 'Cross-dock Yumbo', kind: 'warehouse', city: 'Yumbo', department: 'Valle del Cauca', lat: 3.5859, lon: -76.4946 },
  { code: 'BUN-TER', name: 'Terminal Buenaventura', kind: 'terminal', city: 'Buenaventura', department: 'Valle del Cauca', lat: 3.8801, lon: -77.0312 },
  { code: 'BOG-HUB', name: 'Hub Bogotá', kind: 'hub', city: 'Bogotá', department: 'Cundinamarca', lat: 4.711, lon: -74.0721 },
  { code: 'MDE-HUB', name: 'Hub Medellín', kind: 'hub', city: 'Medellín', department: 'Antioquia', lat: 6.2442, lon: -75.5812 },
  { code: 'BAQ-HUB', name: 'Hub Barranquilla', kind: 'hub', city: 'Barranquilla', department: 'Atlántico', lat: 10.9685, lon: -74.7813 },
] as const;

const CLIENTS = [
  { code: 'CLI-GRANOS', legal_name: 'Granos del Valle S.A.S. (ficticio)', id_number: '900000001', segment: 'Granos y abarrotes' },
  { code: 'CLI-TEXTIL', legal_name: 'Textiles Andinos Ltda. (ficticio)', id_number: '900000002', segment: 'Textiles' },
  { code: 'CLI-COSME', legal_name: 'Cosmética Aurora S.A.S. (ficticio)', id_number: '900000003', segment: 'Cosméticos' },
  { code: 'CLI-ECOM', legal_name: 'Mercado Digital Pacífico S.A.S. (ficticio)', id_number: '900000004', segment: 'Comercio electrónico' },
  { code: 'CLI-DOCS', legal_name: 'Documentos Express Jurídicos (ficticio)', id_number: '900000005', segment: 'Documentos' },
] as const;

const DRIVERS = ['Jhon Fredy Castaño', 'María Fernanda Ospina', 'Luis Alberto Mina', 'Diana Carolina Valencia', 'Óscar Iván Ruiz', 'Paola Andrea Cuero',
  'Héctor Fabio Lasso', 'Yuliana Restrepo', 'Wilmer Angulo', 'Sandra Milena Peña', 'Carlos Arturo Banguero', 'Natalia Sánchez', 'Edwin Riascos', 'Viviana Mosquera', 'Julián Otálora'];

const VEHICLES: { plate: string; kind: 'motorcycle' | 'van' | 'truck' | 'tractor'; model: string; capacity: number }[] = [
  { plate: 'NXA-101', kind: 'truck', model: 'Furgón 8 t (ficticio)', capacity: 8000 },
  { plate: 'NXA-102', kind: 'tractor', model: 'Tractocamión 34 t (ficticio)', capacity: 34000 },
  { plate: 'NXA-103', kind: 'van', model: 'Van 1,5 t (ficticio)', capacity: 1500 },
  { plate: 'NXA-104', kind: 'van', model: 'Van 1,5 t (ficticio)', capacity: 1500 },
  { plate: 'NXA-105', kind: 'truck', model: 'Furgón 5 t (ficticio)', capacity: 5000 },
  { plate: 'NXA-106', kind: 'motorcycle', model: 'Moto de reparto (ficticio)', capacity: 40 },
  { plate: 'NXA-107', kind: 'motorcycle', model: 'Moto de reparto (ficticio)', capacity: 40 },
  { plate: 'NXA-108', kind: 'van', model: 'Van refrigerada 1 t (ficticio)', capacity: 1000 },
  { plate: 'NXA-109', kind: 'tractor', model: 'Tractocamión 34 t (ficticio)', capacity: 34000 },
  { plate: 'NXA-110', kind: 'truck', model: 'Furgón 8 t (ficticio)', capacity: 8000 },
  { plate: 'NXA-111', kind: 'van', model: 'Van 1,5 t (ficticio)', capacity: 1500 },
  { plate: 'NXA-112', kind: 'motorcycle', model: 'Moto de reparto (ficticio)', capacity: 40 },
  { plate: 'NXA-113', kind: 'truck', model: 'Furgón 5 t (ficticio)', capacity: 5000 },
  { plate: 'NXA-114', kind: 'van', model: 'Van 1,5 t (ficticio)', capacity: 1500 },
  { plate: 'NXA-115', kind: 'truck', model: 'Furgón 8 t (ficticio)', capacity: 8000 },
];

const USERS: { email: string; displayName: string; role: string; sites: string[] | 'all'; tenant: 'DEMO-CO' | 'DEMO-B' }[] = [
  { email: 'admin@demo.nexus.local', displayName: 'Laura Gómez', role: 'tenant_admin', sites: 'all', tenant: 'DEMO-CO' },
  { email: 'david@demo.nexus.local', displayName: 'David', role: 'ops_director', sites: 'all', tenant: 'DEMO-CO' },
  { email: 'transporte.cali@demo.nexus.local', displayName: 'Andrés Muñoz', role: 'transport_coordinator', sites: ['CLO-HUB', 'YUM-XD', 'PAL-DC', 'BUN-TER'], tenant: 'DEMO-CO' },
  { email: 'transporte.bogota@demo.nexus.local', displayName: 'Camila Torres', role: 'transport_coordinator', sites: ['BOG-HUB'], tenant: 'DEMO-CO' },
  { email: 'almacen@demo.nexus.local', displayName: 'Carolina Ríos', role: 'warehouse_coordinator', sites: ['PAL-DC'], tenant: 'DEMO-CO' },
  { email: 'gerencia@demo.nexus.local', displayName: 'Ricardo Salazar', role: 'executive', sites: 'all', tenant: 'DEMO-CO' },
  { email: 'auditor@demo.nexus.local', displayName: 'Mónica Herrera', role: 'auditor', sites: 'all', tenant: 'DEMO-CO' },
  { email: 'analista@demo.nexus.local', displayName: 'Felipe Cárdenas', role: 'data_analyst', sites: 'all', tenant: 'DEMO-CO' },
  { email: 'servicio@demo.nexus.local', displayName: 'Daniela Pérez', role: 'customer_service', sites: 'all', tenant: 'DEMO-CO' },
  { email: 'admin.b@demo-b.nexus.local', displayName: 'Admin Operador B', role: 'tenant_admin', sites: 'all', tenant: 'DEMO-B' },
];

/** Inicio del día actual en America/Bogota (UTC−5, sin horario de verano). */
function bogotaDayStart(now: Date): Date {
  const shifted = now.getTime() - 5 * 60 * MIN;
  return new Date(Math.floor(shifted / (24 * 60 * MIN)) * 24 * 60 * MIN + 5 * 60 * MIN);
}

export async function seedDemo(opts: { ownerUrl: string; appUrl: string; reset?: boolean; fixedPasswords?: string; now?: Date; /** solo base de pruebas */ allowRealReset?: boolean }): Promise<SeedResult> {
  const now = opts.now ?? new Date();
  const dayStart = bogotaDayStart(now);
  const clampToday = (d: Date) => new Date(Math.max(d.getTime(), dayStart.getTime() + MIN));

  // 1) Como dueño: catálogo de roles y tenants (la app no puede crear tenants).
  const owner = new Client({ connectionString: opts.ownerUrl });
  await owner.connect();
  try {
    if (opts.reset) {
      const real = await owner.query(`SELECT count(*)::int AS n FROM core.tenant WHERE data_mode = 'real'`);
      if (real.rows[0].n > 0 && !opts.allowRealReset) throw new Error('Hay tenants REALES: el reset DEMO está bloqueado.');
      await owner.query(`TRUNCATE ai.execution_result, ai.approval, ai.recommendation, parcel.exception_case, parcel.shipment, tms.trip_stop, tms.trip,
        fleet.driver, fleet.vehicle, core.audit_entry, core.idempotency_record, core.outbox_event, core.domain_event, core.session, core.membership,
        core.app_user, core.module_activation, core.client_account, core.site, core.tenant CASCADE`);
    }
    const existing = await owner.query(`SELECT code FROM core.tenant WHERE code IN ('DEMO-CO','DEMO-B')`);
    if (existing.rowCount) throw new Error('El seed DEMO ya existe. Use: pnpm db:seed -- --reset');
    for (const r of ROLES) {
      await owner.query(`INSERT INTO core.role (code, name, mfa_required) VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, mfa_required = EXCLUDED.mfa_required`,
        [r.code, r.name, r.mfaRequired]);
    }
    await owner.query(`INSERT INTO core.tenant (code, legal_name, nit, data_mode) VALUES
      ('DEMO-CO', 'NEXUS DEMO COLOMBIA S.A.S. (ficticia)', '900999001', 'demo'),
      ('DEMO-B', 'Operador DEMO B (aislamiento)', '900999002', 'demo')`);
  } finally {
    await owner.end();
  }

  // 2) Como nexus_app con contexto de tenant (RLS activo).
  const db = new DbService(opts.appUrl);
  const audit = new AuditService(db);
  const events = new EventService();
  const recs = new RecommendationService(db, audit, events, new IdempotencyService());
  const sim = new SimulatorService(db, audit, events, recs);
  const credentials: SeedCredential[] = [];
  const tenants: Record<string, string> = {};

  try {
    // El rol de la app solo ve su propio tenant: los ids se leen con el dueño.
    const ownerLookup = new Client({ connectionString: opts.ownerUrl });
    await ownerLookup.connect();
    for (const row of (await ownerLookup.query(`SELECT id, code FROM core.tenant WHERE code IN ('DEMO-CO','DEMO-B')`)).rows) tenants[row.code] = row.id;
    await ownerLookup.end();

    const sys = (tenantId: string) => ({
      tenant: { tenantId, userId: null, clientAccountIds: [] as string[] },
      actor: { id: 'seed', kind: 'system' as const, name: 'Seed DEMO' },
      correlationId: uuidv7(),
      dataMode: 'demo' as const,
    });

    for (const [code, tenantId] of Object.entries(tenants)) {
      const ctx = sys(tenantId);
      await db.withTenant(ctx.tenant, async (tx) => {
        const siteIds: Record<string, string> = {};
        const siteDefs = code === 'DEMO-CO' ? SITES : [{ code: 'B-HUB', name: 'Hub Operador B', kind: 'hub', city: 'Pereira', department: 'Risaralda', lat: 4.8133, lon: -75.6961 } as const];
        for (const s of siteDefs) {
          siteIds[s.code] = (await tx.query(`INSERT INTO core.site (tenant_id, code, name, kind, city, department, lat, lon) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [tenantId, s.code, s.name, s.kind, s.city, s.department, s.lat, s.lon])).rows[0].id;
        }
        for (const m of ['core', 'control_tower', 'ai']) {
          await tx.query('INSERT INTO core.module_activation (tenant_id, module, enabled) VALUES ($1,$2,true)', [tenantId, m]);
        }
        const clientIds: string[] = [];
        for (const c of code === 'DEMO-CO' ? CLIENTS : [{ code: 'CLI-B1', legal_name: 'Cliente B1 (ficticio)', id_number: '900000099', segment: 'General' }]) {
          clientIds.push((await tx.query(`INSERT INTO core.client_account (tenant_id, code, legal_name, id_type, id_number, kind, segment) VALUES ($1,$2,$3,'NIT',$4,'juridica',$5) RETURNING id`,
            [tenantId, c.code, c.legal_name, c.id_number, c.segment])).rows[0].id);
        }

        for (const u of USERS.filter((x) => x.tenant === code)) {
          const password = opts.fixedPasswords ?? randomToken(12);
          const userId = (await tx.query('SELECT core.provision_user($1,$2,$3) AS id', [u.email, u.displayName, await hashPassword(password)])).rows[0].id;
          const sites = u.sites === 'all' ? [] : u.sites.map((s) => siteIds[s]!);
          await tx.query('INSERT INTO core.membership (tenant_id, user_id, role_code, site_ids) VALUES ($1,$2,$3,$4)', [tenantId, userId, u.role, sites]);
          credentials.push({ tenant: code, email: u.email, password, role: u.role, displayName: u.displayName, sites: u.sites === 'all' ? 'todas' : u.sites.join(', ') });
        }

        if (code === 'DEMO-CO') await seedOperations(tx, ctx, siteIds, clientIds, events, now, clampToday);
        else await seedTenantB(tx, ctx, siteIds, clientIds, now);
        await audit.record(tx, ctx, { action: 'seed.demo', resourceType: 'tenant', resourceId: tenantId, decision: 'allow', after: { tenant: code } });
      });
    }

    // 3) Escenario de reencaminamiento (sección 15.3) generado por el simulador y el Route Agent.
    const co = sys(tenants['DEMO-CO']!);
    await sim.simulateDelay(co, 'CAL-2026-0001', 47, now);
  } finally {
    await db.close();
  }
  return { credentials, tenants };
}

async function seedOperations(tx: Tx, ctx: Parameters<EventService['append']>[1], site: Record<string, string>, clients: string[], events: EventService, now: Date, clampToday: (d: Date) => Date) {
  const tenantId = ctx.tenant.tenantId;
  const vehicleIds: string[] = [];
  for (const [i, v] of VEHICLES.entries()) {
    const siteCode = i < 9 ? 'CLO-HUB' : i < 12 ? 'BOG-HUB' : 'MDE-HUB';
    vehicleIds.push((await tx.query(`INSERT INTO fleet.vehicle (tenant_id, site_id, plate, kind, model, capacity_kg, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [tenantId, site[siteCode], v.plate, v.kind, v.model, v.capacity, i < 8 ? 'in_use' : i === 13 ? 'maintenance' : 'available'])).rows[0].id);
  }
  const driverIds: string[] = [];
  for (const [i, name] of DRIVERS.entries()) {
    const siteCode = i < 9 ? 'CLO-HUB' : i < 12 ? 'BOG-HUB' : 'MDE-HUB';
    driverIds.push((await tx.query(`INSERT INTO fleet.driver (tenant_id, site_id, full_name, kind, phone_masked) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantId, site[siteCode], `${name} (ficticio)`, i % 3 === 1 ? 'linehaul' : 'courier', `+57 3** *** **${String(10 + i).slice(-2)}`])).rows[0].id);
  }

  interface TripSeed { code: string; kind: string; origin: string; dest: string | null; destLabel: string; vehicle: number; driver: number; status: string;
    depMin: number; durMin: number; route: string; km: number; units: number; risk?: string; scenario?: string; progress?: number }
  const trips: TripSeed[] = [
    { code: 'CAL-2026-0001', kind: 'urban', origin: 'CLO-HUB', dest: 'PAL-DC', destLabel: 'Palmira', vehicle: 0, driver: 0, status: 'in_transit', depMin: -45, durMin: 105, route: '', km: 0, units: 34, scenario: 'CAL-2026-0001' },
    { code: 'BUN-CLO-0007', kind: 'linehaul', origin: 'BUN-TER', dest: 'CLO-HUB', destLabel: 'Cali', vehicle: 1, driver: 1, status: 'in_transit', depMin: -120, durMin: 190, route: '', km: 0, units: 120, risk: 'medium', scenario: 'BUN-CLO-0007' },
    { code: 'CLO-BOG-0012', kind: 'linehaul', origin: 'CLO-HUB', dest: 'BOG-HUB', destLabel: 'Bogotá', vehicle: 8, driver: 4, status: 'in_transit', depMin: -200, durMin: 600, route: 'Cali → Buga → Ibagué → Bogotá', km: 462, units: 210 },
    { code: 'CLO-URB-0101', kind: 'urban', origin: 'CLO-HUB', dest: null, destLabel: 'Cali Sur (ruta urbana)', vehicle: 2, driver: 2, status: 'in_transit', depMin: -90, durMin: 300, route: 'Ruta urbana Cali Sur', km: 38, units: 42 },
    { code: 'CLO-URB-0102', kind: 'urban', origin: 'CLO-HUB', dest: null, destLabel: 'Cali Norte (ruta urbana)', vehicle: 3, driver: 3, status: 'in_transit', depMin: -70, durMin: 280, route: 'Ruta urbana Cali Norte', km: 31, units: 37 },
    { code: 'CLO-URB-0103', kind: 'urban', origin: 'CLO-HUB', dest: null, destLabel: 'Jamundí', vehicle: 5, driver: 5, status: 'arrived', depMin: -240, durMin: 150, route: 'Cali → Jamundí', km: 24, units: 18 },
    { code: 'PAL-B2B-0004', kind: 'b2b', origin: 'PAL-DC', dest: null, destLabel: 'Tuluá (tiendas)', vehicle: 4, driver: 6, status: 'loading', depMin: 50, durMin: 120, route: 'Palmira → Buga → Tuluá', km: 88, units: 60 },
    { code: 'YUM-XD-0009', kind: 'b2b', origin: 'YUM-XD', dest: 'CLO-HUB', destLabel: 'Cali', vehicle: 9, driver: 7, status: 'planned', depMin: 140, durMin: 60, route: 'Yumbo → Cali', km: 14, units: 24 },
    { code: 'CLO-URB-0104', kind: 'pickup', origin: 'CLO-HUB', dest: null, destLabel: 'Recogidas Acopi', vehicle: 6, driver: 8, status: 'assigned', depMin: 30, durMin: 180, route: 'Recogidas zona Acopi', km: 27, units: 0 },
    { code: 'BOG-URB-0201', kind: 'urban', origin: 'BOG-HUB', dest: null, destLabel: 'Bogotá Chapinero', vehicle: 10, driver: 9, status: 'in_transit', depMin: -60, durMin: 240, route: 'Ruta urbana Chapinero', km: 29, units: 33 },
    { code: 'BOG-MDE-0003', kind: 'linehaul', origin: 'BOG-HUB', dest: 'MDE-HUB', destLabel: 'Medellín', vehicle: 11, driver: 10, status: 'planned', depMin: 180, durMin: 540, route: 'Bogotá → Honda → Medellín', km: 415, units: 180 },
    { code: 'MDE-URB-0301', kind: 'urban', origin: 'MDE-HUB', dest: null, destLabel: 'Medellín El Poblado', vehicle: 12, driver: 12, status: 'in_transit', depMin: -50, durMin: 220, route: 'Ruta urbana El Poblado', km: 26, units: 28 },
  ];
  const tripIds: Record<string, string> = {};
  for (const t of trips) {
    const dep = new Date(now.getTime() + t.depMin * MIN);
    const arr = new Date(dep.getTime() + t.durMin * MIN);
    const scenario = t.scenario ? SCENARIOS[t.scenario] : undefined;
    const route = scenario?.base.label ?? t.route;
    const km = scenario?.base.distanceKm ?? t.km;
    const inTransit = t.status === 'in_transit';
    const progress = inTransit ? Math.min(0.9, -t.depMin / t.durMin) : 0;
    const originSite = SITES.find((s) => s.code === t.origin)!;
    const pos = scenario ? positionAlong(scenario.base.stops, progress) : { lat: originSite.lat + (inTransit ? 0.03 * progress : 0), lon: originSite.lon + (inTransit ? 0.04 * progress : 0) };
    const eta = t.status === 'arrived' ? null : new Date(arr.getTime() + (t.risk === 'medium' ? 8 : -5) * MIN);
    const id = (await tx.query(
      `INSERT INTO tms.trip (tenant_id, code, kind, origin_site_id, destination_site_id, destination_label, vehicle_id, driver_id, status, planned_departure,
         planned_arrival, window_end, actual_departure, actual_arrival, eta, eta_source, eta_updated_at, route_label, distance_km, units_on_board,
         last_lat, last_lon, last_position_at, position_source, speed_kmh, fuel_pct, risk_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'simulator',$16,$17,$18,$19,$20,$21,$22,'simulator',$23,$24,$25) RETURNING id`,
      [tenantId, t.code, t.kind, site[t.origin], t.dest ? site[t.dest] : null, t.destLabel, vehicleIds[t.vehicle], driverIds[t.driver], t.status, dep, arr,
       new Date(arr.getTime() + 15 * MIN), ['in_transit', 'arrived'].includes(t.status) ? dep : null, t.status === 'arrived' ? new Date(arr.getTime() - 4 * MIN) : null,
       eta, inTransit ? new Date(now.getTime() - 2 * MIN) : null, route, km, t.units,
       inTransit || t.status === 'arrived' ? pos.lat : null, inTransit || t.status === 'arrived' ? pos.lon : null, inTransit ? new Date(now.getTime() - 2 * MIN) : null,
       inTransit ? 42 + (t.units % 20) : null, inTransit ? 55 + (t.units % 35) : null, t.risk ?? 'low'])).rows[0].id as string;
    tripIds[t.code] = id;
    if (scenario) await insertStops(tx, tenantId, id, 1, scenario.base, dep, -t.depMin);
    else {
      const o = originSite;
      const destSite = t.dest ? SITES.find((s) => s.code === t.dest)! : { lat: o.lat + 0.06, lon: o.lon + 0.05, name: t.destLabel };
      await insertStops(tx, tenantId, id, 1, { label: route, distanceKm: km, stops: [
        { label: o.name, lat: o.lat, lon: o.lon, offsetMin: 0 },
        { label: 'name' in destSite ? destSite.name : t.destLabel, lat: destSite.lat, lon: destSite.lon, offsetMin: t.durMin },
      ] }, dep, Math.max(0, -t.depMin));
    }
    await events.append(tx, ctx, { eventType: 'TripPlanned', entityType: 'trip', entityId: id, entityVersion: 1, siteId: site[t.origin], source: 'seed',
      payload: { code: t.code, status: t.status, route } });
  }

  // Envíos (guías) en distintos estados. Códigos y guías ficticios.
  let n = 0;
  const mk = async (s: { status: string; trip?: string; origin: string; city: string; units: number; promisedMin: number; deliveredMin?: number; service?: string }) => {
    n++;
    const code = `ENV-2026-${String(n).padStart(5, '0')}`;
    const waybill = `NX${String(70000000 + n * 37).padStart(10, '0')}`;
    const promised = new Date(now.getTime() + s.promisedMin * MIN);
    const delivered = s.deliveredMin !== undefined ? clampToday(new Date(now.getTime() + s.deliveredMin * MIN)) : null;
    const id = (await tx.query(
      `INSERT INTO parcel.shipment (tenant_id, client_account_id, code, waybill_number, service_code, origin_site_id, destination_city, status, units, promised_by, delivered_at, trip_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [tenantId, clients[n % clients.length], code, waybill, s.service ?? (n % 5 === 4 ? 'DOC_EXPRESS' : n % 3 === 0 ? 'PARCEL_EXPRESS' : 'PARCEL_STD'), site[s.origin], s.city,
       s.status, s.units, promised, delivered, s.trip ? tripIds[s.trip] : null])).rows[0].id;
    await events.append(tx, ctx, { eventType: 'ParcelLabelGenerated', entityType: 'shipment', entityId: id, entityVersion: 1, siteId: site[s.origin], source: 'seed',
      payload: { code, waybill, status: s.status } });
    return id as string;
  };
  for (let i = 0; i < 14; i++) await mk({ status: 'LINEHAUL_IN_TRANSIT', trip: 'CAL-2026-0001', origin: 'CLO-HUB', city: i % 3 === 0 ? 'Yumbo' : 'Palmira', units: [2, 3, 2, 4, 1, 3, 2, 2, 3, 2, 3, 2, 3, 2][i]!, promisedMin: 75 + i });
  for (let i = 0; i < 8; i++) await mk({ status: 'LINEHAUL_IN_TRANSIT', trip: 'BUN-CLO-0007', origin: 'BUN-TER', city: 'Cali', units: 15, promisedMin: 110 + i * 5 });
  for (let i = 0; i < 6; i++) await mk({ status: 'LINEHAUL_IN_TRANSIT', trip: 'CLO-BOG-0012', origin: 'CLO-HUB', city: 'Bogotá', units: 35, promisedMin: 480 + i * 10 });
  for (let i = 0; i < 10; i++) await mk({ status: 'OUT_FOR_DELIVERY', trip: i < 5 ? 'CLO-URB-0101' : 'CLO-URB-0102', origin: 'CLO-HUB', city: 'Cali', units: 1 + (i % 3), promisedMin: 60 + i * 15 });
  for (let i = 0; i < 4; i++) await mk({ status: 'OUT_FOR_DELIVERY', trip: 'BOG-URB-0201', origin: 'BOG-HUB', city: 'Bogotá', units: 2, promisedMin: 90 + i * 20 });
  for (let i = 0; i < 3; i++) await mk({ status: 'OUT_FOR_DELIVERY', trip: 'MDE-URB-0301', origin: 'MDE-HUB', city: 'Medellín', units: 1, promisedMin: 100 + i * 20 });
  for (let i = 0; i < 12; i++) await mk({ status: 'DELIVERED', trip: i < 6 ? 'CLO-URB-0103' : undefined, origin: i < 9 ? 'CLO-HUB' : 'BOG-HUB', city: i < 6 ? 'Jamundí' : 'Cali', units: 1 + (i % 2), promisedMin: -30 + i * 10, deliveredMin: -200 + i * 14 });
  for (let i = 0; i < 6; i++) await mk({ status: 'AT_ORIGIN_HUB', origin: i < 4 ? 'PAL-DC' : 'YUM-XD', city: 'Tuluá', units: 10, promisedMin: 300 + i * 30 });
  for (let i = 0; i < 4; i++) await mk({ status: 'AT_DESTINATION_HUB', origin: i < 2 ? 'CLO-HUB' : 'MDE-HUB', city: i < 2 ? 'Cali' : 'Envigado', units: 2, promisedMin: -40 - i * 25 });
  for (let i = 0; i < 3; i++) await mk({ status: 'DELIVERY_ATTEMPT_FAILED', origin: 'CLO-HUB', city: 'Cali', units: 1, promisedMin: 240 });
  for (let i = 0; i < 3; i++) await mk({ status: 'LABEL_CREATED', origin: 'CLO-HUB', city: 'Popayán', units: 1, promisedMin: 1440, service: 'DOC_EXPRESS' });

  const ex = [
    { site: 'CLO-HUB', trip: 'CLO-URB-0101', kind: 'address_issue', severity: 'medium', title: 'Dirección incompleta en guía de Cali Sur (barrio sin nomenclatura)' },
    { site: 'CLO-HUB', trip: null, kind: 'failed_delivery', severity: 'medium', title: '3 entregas fallidas: destinatario ausente' },
    { site: 'CLO-HUB', trip: 'CLO-BOG-0012', kind: 'missing_scan', severity: 'high', title: '2 unidades sin lectura de custodia al cargue (CLO-BOG-0012)' },
    { site: 'BOG-HUB', trip: 'BOG-URB-0201', kind: 'vehicle_issue', severity: 'low', title: 'Alerta de mantenimiento preventivo en NXA-111' },
    { site: 'BUN-TER', trip: 'BUN-CLO-0007', kind: 'delay', severity: 'medium', title: 'BUN-CLO-0007 con 8 min sobre la ventana estimada' },
  ];
  for (const e of ex) {
    const id = (await tx.query(`INSERT INTO parcel.exception_case (tenant_id, site_id, trip_id, kind, severity, title, dedupe_key, opened_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [tenantId, site[e.site], e.trip ? tripIds[e.trip] : null, e.kind, e.severity, e.title, `${e.kind}:${e.trip ?? e.site}`, new Date(now.getTime() - 35 * MIN)])).rows[0].id;
    await events.append(tx, ctx, { eventType: 'ExceptionOpened', entityType: 'exception_case', entityId: id, entityVersion: 1, siteId: site[e.site], source: 'seed', payload: { kind: e.kind } });
  }
}

async function seedTenantB(tx: Tx, ctx: Parameters<EventService['append']>[1], site: Record<string, string>, clients: string[], now: Date) {
  for (let i = 0; i < 5; i++) {
    const id = (await tx.query(
      `INSERT INTO parcel.shipment (tenant_id, client_account_id, code, waybill_number, service_code, origin_site_id, destination_city, status, units, promised_by)
       VALUES ($1,$2,$3,$4,'PARCEL_STD',$5,'Pereira','AT_ORIGIN_HUB',1,$6) RETURNING id`,
      [ctx.tenant.tenantId, clients[0], `B-ENV-${i + 1}`, `BX${1000 + i}`, site['B-HUB'], new Date(now.getTime() + 600 * MIN)])).rows[0].id;
    await new EventService().append(tx, ctx, { eventType: 'ParcelLabelGenerated', entityType: 'shipment', entityId: id, entityVersion: 1, source: 'seed', payload: { code: `B-ENV-${i + 1}` } });
  }
}
