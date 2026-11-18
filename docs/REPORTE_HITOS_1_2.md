# Reporte de fase — Hitos 1 (Core) y 2 (Command Center)

> Formato `J.2`. Fecha: 2026-11-18. Rama `main` de `DAVIDDUQUE449/NEXUS-LOGISTICA`.

## 1. Qué se construyó

| Área | Entregado |
|---|---|
| Monorepo | pnpm workspaces: `apps/api`, `apps/web-control-tower`, `packages/domain-core`, `packages/shared-contracts`; TypeScript estricto |
| Base de datos | `database/migrations/0001_core.sql` y `0002_operations.sql`; ejecutor con checksum (`database/migrate.mjs`); roles `nexus_owner` y `nexus_app` (sin BYPASSRLS) |
| Aislamiento | RLS `ENABLE` + `FORCE` con política de tenant en todas las tablas de negocio; política adicional por cliente en envíos; *fail-closed* sin `app.tenant_id` |
| Identidad | Login con scrypt, sesión opaca en servidor (solo vía funciones `SECURITY DEFINER`), cookie HttpOnly, CSRF *double-submit* + verificación de Origin, límite de intentos, revocación inmediata |
| Autorización | 23 roles y 11 permisos; política RBAC + ABAC pura (`domain-core`) usada por el guard; SoD-02, 05, 06 y 07; denegaciones auditadas |
| Auditoría y eventos | `core.audit_entry` y `core.domain_event` *append-only* (trigger) con cadena de hash; verificación en `/v1/audit/verify`; outbox transaccional reclamado con `FOR UPDATE SKIP LOCKED`; SSE por tenant y sede |
| Idempotencia | `Idempotency-Key` obligatoria en decisiones; repetir la clave devuelve la misma respuesta; cuerpo distinto ⇒ 409 |
| Operación mínima | Flota, viajes con paradas versionadas, envíos y novedades deduplicadas; 12 viajes, 73 envíos, 15 vehículos y 15 conductores ficticios |
| IA gobernada | Route Agent y Exception Agent con motor de reglas determinista; propuesta → aprobación humana → revalidación en servidor → ejecución única → eventos → auditoría; invalidación si el contexto cambia |
| Simulador DEMO | Simular retraso y restablecer escenario; bloqueado en empresas REAL |
| Web | Login; Command Center (orden de N.02); centro de aprobaciones con comparador antes/después; usuarios; sedes; auditoría; páginas de módulos pendientes; tema oscuro y transparencia reducida; responsive |
| Infraestructura | `infra/compose/docker-compose.yml`, `scripts/db-setup.sh`, `.env.example`, `.github/workflows/ci.yml` (build, tipos, pruebas, E2E y Gitleaks) |

## 2. Comandos ejecutados y resultados

Entorno: Linux, Node 22.23, PostgreSQL 16.15 local, Chromium (Playwright 1.63).

| Comando | Resultado |
|---|---|
| `bash scripts/db-setup.sh` | Roles y bases `nexus` / `nexus_test` creados |
| `node database/migrate.mjs` y `--test` | 2 migraciones aplicadas en cada base |
| `node apps/api/dist/seed/run-seed.js` | 10 usuarios DEMO; escenario CAL-2026-0001 con propuesta pendiente |
| `pnpm --filter @nexus/domain-core test` | **24/24** aprobadas |
| `pnpm --filter @nexus/api test` | **32/32** aprobadas (PostgreSQL real) |
| `pnpm test:e2e` | **6/6** aprobadas (navegador real contra API + web) |
| `pnpm typecheck` | Sin errores |
| `pnpm --filter @nexus/web-control-tower build` | Compilación de producción correcta |

Capturas: `tests/e2e/screenshots/` (escritorio 1440 px, aprobación y móvil 360 px).

## 3. Requisitos

- **PROBADO:** U23, U25, U43, S-P0-01 (endpoints existentes), S-P0-06, S-P0-07, S-RLS-01, S-APP-01, S-CSRF-01, S-HDR-01, S-ERR-01, S-IDEM-01.
- **EN DESARROLLO:** M.01, U24, U35, U40, U44, U47, S-P0-05.
- **Pendientes:** el resto, según el [plan por hitos](product/PLAN_HITOS.md). El detalle está en el [registro de requisitos](product/REGISTRO_REQUISITOS.md).

## 4. Datos reales vs DEMO

| Elemento | Origen |
|---|---|
| Empresas, sedes, clientes, vehículos, conductores, envíos | Seed DEMO ficticio, rotulado en la UI |
| Posición, velocidad, combustible y ETA de viajes | **Simulador** (`source = simulator`), declarado en la UI |
| Mapa | Esquemático SVG; **no hay proveedor de mapas** |
| Recomendaciones IA | Motor de reglas determinista; **no hay proveedor LLM** |
| KPI | Calculados en vivo desde las tablas del tenant, con definición y denominador |

## 5. Integraciones

Ninguna externa configurada: ni IdP OIDC, ni mapas, ni GPS, ni LLM, ni facturación, ni e-commerce. No hay integración con Coordinadora Mercantil S. A.

## 6. Riesgos y deuda conocida

| ID | Descripción | Mitigación / cuándo |
|---|---|---|
| R-01 | **Sin MFA ni IdP OIDC** (credenciales locales solo DEMO) | Bloqueante para producción; Hito 10 ([ADR-0013](architecture/adr/ADR-0013-ajustes-implementacion-hitos-1-2.md)) |
| R-02 | Outbox y SSE en el proceso API, lo que impide escalar horizontalmente | Hito 3: `apps/worker` + Redis |
| R-03 | El límite de intentos de login vive en memoria | Hito 10: gateway o Redis |
| R-04 | La CI usa acciones por *tag*, no fijadas por SHA (exigencia `D.6`) | Fijar por SHA en el Hito 10 |
| R-05 | Los KPI muestran «sin base comparable»: no hay histórico de días anteriores | Hito 10 (`bi.kpi_snapshot`) |
| R-06 | Los datos DEMO son relativos a la hora del seed; al día siguiente los KPI de «hoy» quedan vacíos | `pnpm db:seed -- --reset` |
| R-07 | Búsqueda universal y «Nueva guía / orden» deshabilitadas con explicación | Hitos 4 y 7 |
| R-08 | La CI se ejecuta por primera vez con este push; su resultado está por confirmar | Revisar la pestaña Actions |

## 7. Siguiente paso

**Hito 3 — WMS:**
- ASN, recibo, QC y putaway;
- ledger de inventario sin stock negativo;
- olas de picking y packing;
- PWA Nexus Pick y Nexus Pack con escaneo;
- `apps/worker` con Redis.

Casos de cierre: U01, U05–U08, U36, U37 y U38.
