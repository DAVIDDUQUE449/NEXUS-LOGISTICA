# ADR-0002: Stack tecnológico base (TypeScript de punta a punta)

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** sección 21, `O.01`, `K.10`, `24.x`

## Contexto

La especificación propone Next.js + NestJS + PostgreSQL + Prisma + Redis/BullMQ, con Three.js/R3F para 3D y MapLibre para mapas. Se busca un solo lenguaje para compartir contratos (Zod/OpenAPI) y reglas de dominio puras entre servidor, web y apps offline (`packages/domain-core`, `packages/shared-contracts`).

> **Las versiones exactas se fijan en el Hito 1** con el *lockfile*, después de comprobar el soporte LTS vigente de cada una. Este ADR fija tecnologías, no números de versión.

## Decisión

| Capa | Tecnología | Motivo |
|---|---|---|
| Lenguaje | **TypeScript** estricto (`strict`, `noUncheckedIndexedAccess`) | Un solo lenguaje; tipos compartidos entre servidor, web y apps offline. |
| Runtime | **Node.js LTS** | Soporte largo y ecosistema maduro. |
| Backend | **NestJS** (módulos, guards, interceptors) | Encaja con el monolito modular ([ADR-0001](ADR-0001-monolito-modular.md)); los guards centralizan RBAC/ABAC. |
| Contratos | **Zod** como fuente → OpenAPI 3.1 generado | Validación de entrada y salida en runtime; documentación sin duplicar. |
| Base de datos | **PostgreSQL** + **PostGIS** | ACID, RLS ([ADR-0004](ADR-0004-multitenancy-rls.md)), índices parciales, `SELECT … FOR UPDATE`, geodatos. |
| Acceso a datos | **Prisma** (esquema, migraciones, cliente tipado) + **SQL parametrizado** (`$queryRaw` con *tagged templates*) para bloqueos, RLS y consultas analíticas | Prisma es la recomendación de la especificación. El SQL explícito cubre lo que Prisma no expresa: `FOR UPDATE SKIP LOCKED`, políticas RLS y *checks*. |
| Caché / colas | **Redis** + **BullMQ** | Colas con reintento, DLQ y planificación. Redis **no** es fuente de verdad. |
| Tiempo real | **SSE** para tableros; **WebSocket** (socket.io con adaptador Redis) solo donde haga falta bidireccionalidad | El servidor emite por canal `tenant:site`, autorizado en el *handshake* y en cada suscripción (`D.4`). |
| Web escritorio | **Next.js** (App Router) + React | SSR para el portal público y SEO (H-SEO); BFF integrado ([ADR-0005](ADR-0005-identidad-sesiones.md)). |
| Apps operativas | **Vite + React PWA** (Workbox) | Arranque rápido en gama media; *service worker* controlado; sin SSR innecesario ([ADR-0008](ADR-0008-offline-first-pwa.md)). |
| UI | **Tailwind CSS** con tokens CSS de Aurora Glass + **Radix UI** primitives | Accesibilidad de base (foco, ARIA, teclado) y tokens centrales (`K.10`). |
| Estado cliente | **TanStack Query** (servidor) + **Zustand** (UI local) | Caché e invalidación coherentes. |
| Gráficos | **Apache ECharts** | Sankey, mapas de calor y series largas con buen rendimiento. |
| Mapas | **MapLibre GL** con proveedor de teselas configurable | Sin dependencia de una licencia propietaria. Proveedor caído ⇒ estado «Mapa no disponible», nunca rutas inventadas (`26.3`). |
| 3D | **Three.js + React Three Fiber + Drei** con fallback 2D | Indicado por la especificación (`O.07`, `K.6`). |
| Escaneo | `BarcodeDetector` nativo cuando exista + **ZXing** (WASM) como fallback + modo *wedge* de teclado para escáneres industriales | Cubre cámara de móvil y escáneres dedicados (`M.04`, `M.06`). |
| Identidad | **Keycloak** en desarrollo (OIDC + PKCE + MFA/TOTP/WebAuthn); en producción, cualquier IdP OIDC compatible | Evita implementar criptografía de autenticación propia. |
| Archivos | API **S3-compatible** (MinIO en desarrollo) con URLs firmadas de vida corta | POD, firmas, fotos y documentos (`D.3`). |
| IA | Gateway propio `packages/ai-agents` con adaptadores de proveedor + **motor determinista de reglas** para DEMO | Funciona sin llaves (`14.1`); proveedor intercambiable ([ADR-0009](ADR-0009-ia-gobernada.md)). |
| Observabilidad | **OpenTelemetry** (trazas, métricas, logs), **pino** para logs JSON | Correlación `trace_id` ↔ `correlation_id` (`O.01`). |
| Pruebas | **Vitest** (unidad), **Testcontainers** (PostgreSQL/Redis reales en integración), **Playwright** (E2E web y PWA móvil emulada), **axe-core** (a11y), **k6** (carga), **Lighthouse CI** | Bases temporales reales en lugar de *mocks* para probar RLS y concurrencia. |
| Infraestructura local | **Docker Compose** (postgres+postgis, redis, keycloak, minio, otel-collector, mailpit) | Arranque reproducible con un comando (sección 28). |
| CI/CD | **GitHub Actions** con acciones fijadas por SHA; Gitleaks, Semgrep, Trivy, SBOM CycloneDX | Apéndice `D.6`. |

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| FastAPI/Python en backend | Rompe el uso compartido de contratos y reglas con las PWA offline; dos *toolchains*. |
| Drizzle/Kysely en lugar de Prisma | Opciones válidas y más cercanas a SQL. Se prefiere seguir la recomendación explícita de la especificación y cubrir los huecos con SQL parametrizado. Se puede revisar en un ADR futuro. |
| React Native/Expo para móvil | Solo se justifica si el hardware exige APIs nativas (`O.01`). Las PWA cubren cámara, vibración, almacenamiento e instalación. Queda como opción si un escáner industrial lo requiere. |
| Implementar autenticación propia | Riesgo alto y sin beneficio; MFA y WebAuthn ya los resuelve un IdP probado. |
| GraphQL general | Superficie de autorización más difícil de auditar (BOLA/BFLA). REST versionado primero; GraphQL selectivo solo si se justifica (`O.01`). |

## Consecuencias

- **Positivas:** un lenguaje, contratos únicos y herramientas maduras. El entorno local se reproduce con Docker Compose.
- **Negativas:** Prisma no expresa RLS ni bloqueos, así que convive con SQL explícito (se documenta en `database/README.md`). Keycloak añade un contenedor pesado en desarrollo.
- **Riesgos:** cambios de versiones mayores. Se mitigan con Renovate, *lockfile* y CI.

## Verificación

- `pnpm typecheck` y `pnpm lint` sin errores en CI.
- El OpenAPI generado se publica como artefacto y lo validan las pruebas de contrato.
