# NEXUS LOGISTICS OS

Sistema logístico multioperación **todo en uno**: WMS, OMS, HUB/Parcel, picking, packing, TMS, flota, última milla, apps operativas, PUDO, recaudo contra entrega (COD), CRM, BI, IA, seguridad y gemelo digital 3D.

> **Estado actual:** Etapa 0 (descubrimiento) documentada. **Todavía no hay código implementado.** Siguiente paso: Hito 1 — Core.

## Documentación

### Especificación

| Documento | Descripción |
|---|---|
| [Prompt maestro V2.0 multioperación](docs/especificacion/NEXUS_LOGISTICS_OS_PROMPT_MAESTRO_FINAL_V2_0_MULTIOPERACION.md) | Especificación maestra vigente. Los Apéndices L–Q prevalecen en caso de conflicto. |
| [Instrucciones de uso en Claude](docs/especificacion/INSTRUCCIONES_PARA_USAR_EN_CLAUDE_V2_0.md) | Cómo usar la especificación con una IA de programación. |

### Etapa 0 — Diseño

| Documento | Descripción |
|---|---|
| [Reporte de la Etapa 0](docs/REPORTE_ETAPA_0.md) | Qué se hizo, estado de los requisitos, riesgos y siguiente paso. |
| [Decisiones de arquitectura (ADR)](docs/architecture/adr/README.md) | 12 decisiones con contexto, alternativas y consecuencias. |
| [Arquitectura técnica](docs/architecture/ARQUITECTURA.md) | Vistas C4, módulos, flujos, seguridad y observabilidad. |
| [Esquema de base de datos](docs/architecture/ESQUEMA_BASE_DATOS.md) | Modelo lógico por dominio, RLS e invariantes. |
| [Mapa de roles](docs/product/MAPA_ROLES.md) | Roles, matriz de permisos, ABAC y separación de funciones. |
| [Sitemap](docs/ux/SITEMAP.md) | Rutas de cada app y en qué hito se activan. |
| [Plan por hitos](docs/product/PLAN_HITOS.md) | Hitos 0–10 con criterios de cierre. |
| [Registro de requisitos](docs/product/REGISTRO_REQUISITOS.md) | Estado de cada requisito M, U, D.10, H y Q.04. |
| [Casos de prueba](tests/CASOS_DE_PRUEBA.md) | U01–U50, E2E de la sección 27.1, seguridad P0 y red-team de IA. |

## Stack previsto

TypeScript · NestJS · Next.js · PWA (Vite) · PostgreSQL + PostGIS con RLS · Prisma · Redis + BullMQ · Three.js / React Three Fiber · MapLibre · OpenTelemetry · Playwright. Justificación en [ADR-0002](docs/architecture/adr/ADR-0002-stack-tecnologico.md).

## Aviso

Coordinadora Mercantil S. A. se usa solo como referencia operativa documentada. NEXUS LOGISTICS OS no tiene afiliación con ella ni ninguna integración existente. Los datos de demostración son ficticios y se rotulan como tales.
