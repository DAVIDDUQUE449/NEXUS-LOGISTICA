# NEXUS LOGISTICS OS

Sistema logístico multioperación **todo en uno**: WMS, OMS, HUB/Parcel, picking, packing, TMS, flota, última milla, apps operativas, PUDO, recaudo contra entrega (COD), CRM, BI, IA, seguridad y gemelo digital 3D.

> **Estado actual: Hitos 1 (Core) y 2 (Command Center) implementados y probados.** Los demás módulos (WMS, Parcel, última milla, TMS, OMS, 3D…) aparecen en el menú con su hito previsto y **no simulan funciones**. Detalle en el [reporte de los Hitos 1–2](docs/REPORTE_HITOS_1_2.md).

![Command Center](tests/e2e/screenshots/inicio-escritorio.png)

## Qué funciona hoy

- **Multiempresa segura:** aislamiento por empresa en la API **y** en PostgreSQL (Row Level Security forzado; la app se conecta con un rol sin `BYPASSRLS`).
- **Sesión:** login, cookie HttpOnly, CSRF, revocación inmediata, límite de intentos, selector de empresa y sede.
- **Permisos:** 23 roles con RBAC + ABAC por sede, validados en el servidor; las denegaciones quedan auditadas.
- **Auditoría y eventos:** registro *append-only* con cadena de hash verificable; eventos de dominio con outbox transaccional; tiempo real por SSE.
- **Command Center Aurora Glass Light:**
  - seis KPI con definición, denominador y fuente;
  - viaje en riesgo con camión, ETA original frente a la revisada y paradas;
  - Brief de operaciones IA;
  - mapa esquemático;
  - cronograma de despachos y próximas acciones;
  - responsive, con tema oscuro opcional y transparencia reducida.
- **IA gobernada (U23):** el Route Agent (motor de reglas, sin proveedor de IA) propone alternativas. Una persona autorizada decide y el servidor revalida el contexto y ejecuta una sola vez (idempotente). Rechazar exige motivo. Si el viaje cambió, la propuesta se invalida.
- **Simulador DEMO:** «Simular retraso» y «Restablecer escenario». Solo funciona en empresas DEMO.
- **Administración:** usuarios (alta, desactivación con revocación de sesiones), sedes y visor de auditoría con verificación de integridad.

## Requisitos

- Node.js 22+ y pnpm 10 (`corepack enable`)
- PostgreSQL 16 (local o con `infra/compose/docker-compose.yml`)

## Puesta en marcha

1. Instale las dependencias:

   ```bash
   pnpm install
   ```

2. Si no tiene PostgreSQL instalado, levántelo con Docker:

   ```bash
   docker compose -f infra/compose/docker-compose.yml up -d
   ```

3. Cree los roles `nexus_owner` y `nexus_app` y las bases `nexus` y `nexus_test`. El script escribe `.env` con contraseñas aleatorias:

   ```bash
   PG_SUPERUSER_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm db:setup
   ```

4. Aplique las migraciones y compile:

   ```bash
   pnpm db:migrate
   ```

   ```bash
   pnpm build
   ```

5. Cargue los datos DEMO. Las credenciales quedan en `.demo-credentials.local`, que no se sube al repositorio:

   ```bash
   pnpm db:seed
   ```

6. En dos terminales, arranque la API (puerto 4000) y la web (puerto 3000):

   ```bash
   pnpm start:api
   ```

   ```bash
   pnpm start:web
   ```

Abra http://localhost:3000 e inicie sesión con un usuario de `.demo-credentials.local`. Para la experiencia completa use `david@demo.nexus.local` (director de operaciones) o `transporte.cali@demo.nexus.local` (puede aprobar propuestas de las sedes del Valle).

Para regenerar los datos DEMO (por ejemplo, al día siguiente, para que los KPI de «hoy» tengan datos):

```bash
pnpm db:seed -- --reset
```

## Pruebas

Unitarias (domain-core) e integración contra PostgreSQL real (`nexus_test`):

```bash
pnpm test
```

E2E en el navegador, con la API y la web en ejecución. Arranque la API con `LOGIN_RATE_LIMIT_MAX=500` para que el límite de intentos de login no bloquee las pruebas:

```bash
pnpm test:e2e
```

| Suite | Pruebas | Qué cubre |
|---|---|---|
| `packages/domain-core` | 24 | Matriz RBAC/ABAC, SoD, máquinas de estado, motor de reglas del Route Agent, KPI |
| `apps/api/test` | 32 | RLS forzado en todas las tablas, *fail-closed*, U25 (API y SQL), U43, D.3, CSRF, revocación, cabeceras, errores sin filtración, U23 completo, idempotencia, cadena de auditoría, outbox por tenant, simulador solo DEMO |
| `tests/e2e` | 6 | Login, redirección, inicio N.02, U23 en la UI, RBAC del auditor, móvil a 360 px sin desbordamiento |

## Estructura

```text
apps/api                  API NestJS (BFF de sesión, módulos de dominio, outbox, SSE, seed)
apps/web-control-tower    Next.js: Command Center, aprobaciones IA, usuarios, sedes, auditoría
packages/domain-core      Roles y permisos, políticas ABAC, máquinas de estado, KPI, motor de reglas
packages/shared-contracts Esquemas Zod de entrada de la API
database/migrations       SQL: esquemas, RLS, funciones SECURITY DEFINER, triggers append-only
tests/e2e                 Playwright
docs/                     Especificación, ADR, arquitectura, roles, sitemap, plan, requisitos
```

## Documentación

| Documento | Descripción |
|---|---|
| [Prompt maestro V2.0](docs/especificacion/NEXUS_LOGISTICS_OS_PROMPT_MAESTRO_FINAL_V2_0_MULTIOPERACION.md) | Especificación maestra vigente (los Apéndices L–Q prevalecen). |
| [Reporte Hitos 1–2](docs/REPORTE_HITOS_1_2.md) | Qué se construyó, comandos y pruebas, qué está simulado y qué falta. |
| [Reporte Etapa 0](docs/REPORTE_ETAPA_0.md) | Fase de diseño. |
| [ADR](docs/architecture/adr/README.md) | Decisiones de arquitectura (incluye las desviaciones de implementación en ADR-0013). |
| [Arquitectura](docs/architecture/ARQUITECTURA.md) · [Esquema BD](docs/architecture/ESQUEMA_BASE_DATOS.md) | Diseño técnico. |
| [Roles](docs/product/MAPA_ROLES.md) · [Sitemap](docs/ux/SITEMAP.md) · [Plan](docs/product/PLAN_HITOS.md) · [Requisitos](docs/product/REGISTRO_REQUISITOS.md) | Producto. |
| [Casos de prueba](tests/CASOS_DE_PRUEBA.md) | U01–U50, seguridad y red-team. |

## Avisos

- **Entorno DEMO:** todos los datos son ficticios y se rotulan «ENTORNO DEMO — DATOS SIMULADOS». Las posiciones, ETA y telemetría salen del simulador, no de GPS.
- **No apto para producción todavía:** falta un proveedor OIDC con MFA ([ADR-0013](docs/architecture/adr/ADR-0013-ajustes-implementacion-hitos-1-2.md)), además de la revisión legal y de seguridad (Apéndice P).
- Coordinadora Mercantil S. A. se usa solo como referencia operativa pública. NEXUS LOGISTICS OS no tiene afiliación ni integración con ella.
