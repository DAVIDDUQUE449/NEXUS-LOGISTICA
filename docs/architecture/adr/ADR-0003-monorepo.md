# ADR-0003: Monorepo pnpm + Turborepo y distribución de apps

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `Q.02`, `Q.01` (apps independientes por rol), `K.10`

## Contexto

`Q.02` sugiere un monorepo con 10 apps y 9 paquetes y aclara que es «sugerido, no dogma». `Q.01` exige apps operativas **independientes por rol** (Pick, Pack, Sort, Driver, Entregas, Points, Warehouse Mobile), además de Nexus Control, portal de clientes y rastreo público.

## Decisión

**pnpm workspaces + Turborepo** (caché de tareas, ejecución por grafo de dependencias).

```text
nexus-logistica/
├── apps/
│   ├── api/                       # NestJS: módulos de dominio + BFF de API (/v1)
│   ├── worker/                    # Consumidores outbox, proyecciones, simulador, jobs
│   ├── web-control-tower/         # Next.js: Command Center, WMS, OMS, Parcel, TMS, YMS,
│   │                              #   Fleet, Finanzas, CRM, IA, BI, 3D, Seguridad, Configuración
│   │                              #   (incluye Nexus Control para coordinadores)
│   ├── web-client-portal/         # Next.js: clientes empresariales
│   ├── web-public/                # Next.js: landing, legal, rastreo público mínimo (web-tracking)
│   ├── mobile-nexus-pick/         # Vite PWA
│   ├── mobile-nexus-pack/         # Vite PWA
│   ├── mobile-nexus-sort/         # Vite PWA
│   ├── mobile-nexus-driver/       # Vite PWA
│   ├── mobile-nexus-entregas/     # Vite PWA (prioritaria)
│   ├── mobile-nexus-points/       # Vite PWA
│   └── mobile-nexus-warehouse/    # Vite PWA (recepción, QC, montacargas)
├── packages/
│   ├── design-system/             # Tokens Aurora Glass, componentes accesibles, galería
│   ├── shared-contracts/          # Esquemas Zod, OpenAPI, eventos, códigos de error
│   ├── domain-core/               # Máquinas de estado, reglas puras, cálculos (volumétrico, KPI)
│   ├── api-client/                # Cliente HTTP tipado generado desde los contratos
│   ├── scanner-kit/               # Cámara, ZXing, wedge de teclado, feedback sonido/vibración
│   ├── offline-kit/               # Outbox de dispositivo, sync, conflictos, cifrado local
│   ├── mobile-shell/              # Login, turno, estado de sincronización, layout de una mano
│   ├── map-and-3d/                # MapLibre + escenas R3F + fallback 2D
│   ├── ai-agents/                 # Gateway, herramientas tipadas, políticas, motor de reglas DEMO
│   ├── integrations/              # Adaptadores (e-commerce, GPS, DIAN, mapas) con estado de conexión
│   ├── security-catalog-adapter/  # Índice del catálogo de skills (solo lectura)
│   ├── simulation/                # Generador determinista de datos y eventos DEMO
│   └── config/                    # tsconfig, eslint, prettier, dependency-cruiser compartidos
├── database/
│   ├── prisma/                    # schema.prisma
│   ├── migrations/                # Migraciones Prisma + SQL (RLS, checks, triggers)
│   ├── seeds/                     # NEXUS DEMO COLOMBIA
│   └── test-fixtures/
├── third_party/anthropic-cybersecurity-skills/   # Checkout fijado por SHA (Hito 9)
├── infra/{compose,observability,terraform}/      # terraform solo con cloud autorizado
├── tests/{e2e,integration,contract,mobile-offline,performance,security,a11y}/
├── docs/{especificacion,architecture,product,ux,operations,legal,security,videos}/
└── .github/workflows/
```

**Diferencias con `Q.02` y su justificación:**

1. **`apps/worker` separado**: está en la sección 21.1 y no en `Q.02`. Aísla la carga de jobs del tráfico HTTP.
2. **`web-tracking` se integra en `web-public`**: el rastreo público comparte dominio, SEO, páginas legales y *rate limit* con la landing (Apéndice J.7). Sigue siendo una app separada del Control Tower, sin sesión de empleados.
3. **`mobile-nexus-warehouse` se añade** porque `Q.01` y `M.17` la nombran aunque `Q.02` no la liste.
4. **Nexus Control vive en `web-control-tower`** como experiencia por rol (`M.15`), con una vista *responsive* para tablet. No necesita una PWA aparte.
5. **`packages/mobile-shell` y `packages/api-client`** evitan copiar pantallas entre las 7 PWA (`O.01`: «compartir contratos y lógica de dominio, no copiar pantallas»).
6. **`packages/simulation`** viene de la sección 21.1 (generador determinista).

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Una sola PWA móvil con módulos por rol | Más simple de mantener, pero contradice `Q.01` («apps independientes por rol»). Además, cada app debe instalarse con su propio ícono, permisos mínimos y *bundle* pequeño. |
| Nx en lugar de Turborepo | Más potente, pero también más pesado. Turborepo basta para este grafo. |
| Repos separados | Rompe los contratos compartidos y las pruebas cruzadas. |

## Consecuencias

- **Positivas:** contratos y reglas en un solo lugar. Cada PWA es pequeña e instalable por separado. La CI es incremental gracias a la caché de Turbo.
- **Negativas:** 7 PWA casi idénticas en su configuración. Se mitiga con una plantilla común en `packages/mobile-shell` y la configuración de Vite compartida.

## Verificación

- `pnpm turbo run build` construye todas las apps desde un clon limpio.
- El *bundle* de cada PWA tiene un presupuesto de tamaño medido en CI (Hito 10).
