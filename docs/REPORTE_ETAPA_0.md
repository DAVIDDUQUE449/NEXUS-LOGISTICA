# Reporte de fase — Etapa 0: Descubrimiento

> Formato `J.2`. Fecha: 2026-11-18.

## Versión

- Repositorio: `DAVIDDUQUE449/NEXUS-LOGISTICA`, rama `main`.
- Especificación base: `docs/especificacion/NEXUS_LOGISTICS_OS_PROMPT_MAESTRO_FINAL_V2_0_MULTIOPERACION.md` (V2.0 FINAL, 3.749 líneas).
- Catálogo GitHub de skills: **no descargado** (Hito 9).

## Qué se creó (solo documentación; no hay código)

| Archivo | Contenido |
|---|---|
| `docs/architecture/adr/README.md` + `ADR-0000` … `ADR-0012` | Plantilla y 12 decisiones: monolito modular, stack, monorepo, RLS multi-tenant, OIDC+BFF, eventos+outbox, ledger de inventario, PWA offline-first, IA gobernada, 3D como proyección, catálogo de skills no ejecutable y modo DEMO |
| `docs/architecture/ARQUITECTURA.md` | C4 niveles 1–3, propiedad de datos, pipeline de comandos, plantillas de proceso, seguridad, observabilidad, entornos y riesgos |
| `docs/architecture/ESQUEMA_BASE_DATOS.md` | Diseño lógico de 14 esquemas (unas 165 tablas), restricciones, RLS e invariantes verificadas en base de datos |
| `docs/product/MAPA_ROLES.md` | 25 roles, atributos ABAC, niveles de riesgo R0–R4, matriz de permisos por módulo y 8 reglas SoD |
| `docs/ux/SITEMAP.md` | Rutas de `web-control-tower`, 7 PWA, portal de clientes y web pública, con su hito |
| `docs/product/PLAN_HITOS.md` | Hitos 0–10 con alcance, dependencias y criterio de cierre; Hito 1 detallado |
| `docs/product/REGISTRO_REQUISITOS.md` | 25 requisitos M, 50 casos U, 13 controles D.10, 98 requisitos H y 20 entregables Q.04, todos con estado |
| `tests/CASOS_DE_PRUEBA.md` | U01–U50 con precondiciones, pasos y resultado verificable; 16 pruebas de la sección 27.1; 15 de seguridad; 6 de red-team |

## Requisitos

| Grupo | Total | Pendiente | En desarrollo | Implementado | Probado | Bloqueado |
|---|---|---|---|---|---|---|
| Funcionales M.01–M.25 | 25 | 25 | 0 | 0 | 0 | 0 |
| Casos U01–U50 | 50 | 50 | 0 | 0 | 0 | 0 |
| Seguridad D.10 | 13 | 13 | 0 | 0 | 0 | 0 |
| Videos H-* | 98 | 98 (sin clasificar) | 0 | 0 | 0 | 0 |
| Entregables Q.04 | 20 | 18 | 2 | 0 | 0 | 0 |

## Pruebas

**No se ejecutó ninguna prueba**: todavía no hay código que probar. Los casos están diseñados en `tests/CASOS_DE_PRUEBA.md`.

## Riesgos y bloqueos

| ID | Descripción | Mitigación / siguiente insumo |
|---|---|---|
| AR-01 | El alcance total excede una sola iteración | Vertical slices por hito; reporte `J.2` en cada cierre |
| AR-05 | La normativa colombiana (Ley 1369, RNDC, DIAN, Ley 1581) requiere interpretación profesional | **Se necesita un asesor legal humano** antes de producción; NEXUS no emite documentos oficiales sin un proveedor habilitado |
| AR-06 | El catálogo `mukul975/Anthropic-Cybersecurity-Skills` no es accesible desde esta sesión, que está limitada al repositorio del proyecto | Se necesita acceso de red a ese repositorio en el Hito 9 y verificar su licencia |
| AR-07 | Hay 98 requisitos H-* sin clasificar | Clasificación en el Hito 1 con revisión del propietario |
| AR-08 | Prototipos Figma (`Q.04.3`) | Sin acceso a Figma en esta sesión; las pantallas estrella se construyen como componentes reales en el Hito 2 |
| AR-09 | Los ADR están en estado «Propuesto» | **Se necesita la aprobación del propietario** para pasarlos a «Aceptado» |

## Datos reales vs DEMO

No existen datos todavía. Todo dato futuro del tenant NEXUS DEMO COLOMBIA llevará la etiqueta «ENTORNO DEMO — DATOS SIMULADOS» ([ADR-0012](architecture/adr/ADR-0012-modo-demo.md)).

## Integraciones

Ninguna configurada. **No hay integración con Coordinadora Mercantil S. A.**, que se usa solo como referencia funcional pública (`L.2`, `P.03`).

## Siguiente paso

**Hito 1 — Core** ([PLAN_HITOS §Hito 1](product/PLAN_HITOS.md#hito-1--core)): inicializar el monorepo, Docker Compose, el esquema `core` con RLS, la API NestJS con BFF OIDC, autorización y auditoría, el shell web con selector de empresa y sede, el seed DEMO mínimo y la CI con controles de seguridad. El hito se cierra con las pruebas U25, U35, U43, `rls-coverage` y la matriz de autorización del Core.
