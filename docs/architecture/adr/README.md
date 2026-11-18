# Registro de decisiones de arquitectura (ADR)

Cada ADR documenta una decisión, el contexto que la motivó, las alternativas consideradas y sus consecuencias. Un ADR **aceptado** no se edita para cambiar la decisión: se crea uno nuevo que lo reemplace y se marca el anterior como `Reemplazado por ADR-XXXX`.

| ID | Título | Estado | Fecha |
|---|---|---|---|
| [ADR-0001](ADR-0001-monolito-modular.md) | Monolito modular con límites de dominio explícitos | Propuesto | 2026-11-18 |
| [ADR-0002](ADR-0002-stack-tecnologico.md) | Stack tecnológico base (TypeScript de punta a punta) | Propuesto | 2026-11-18 |
| [ADR-0003](ADR-0003-monorepo.md) | Monorepo pnpm + Turborepo y distribución de apps | Propuesto | 2026-11-18 |
| [ADR-0004](ADR-0004-multitenancy-rls.md) | Multiempresa con `tenant_id` + Row Level Security en PostgreSQL | Propuesto | 2026-11-18 |
| [ADR-0005](ADR-0005-identidad-sesiones.md) | Identidad OIDC + BFF con cookies HttpOnly, RBAC + ABAC en servidor | Propuesto | 2026-11-18 |
| [ADR-0006](ADR-0006-eventos-outbox.md) | Eventos de dominio append-only + transactional outbox | Propuesto | 2026-11-18 |
| [ADR-0007](ADR-0007-inventario-ledger.md) | Inventario como libro mayor (ledger) con proyección de saldos | Propuesto | 2026-11-18 |
| [ADR-0008](ADR-0008-offline-first-pwa.md) | Apps operativas PWA offline-first con outbox de dispositivo | Propuesto | 2026-11-18 |
| [ADR-0009](ADR-0009-ia-gobernada.md) | IA gobernada: agentes que proponen, servidor que valida y ejecuta | Propuesto | 2026-11-18 |
| [ADR-0010](ADR-0010-3d-mapas-proyecciones.md) | Gemelo 3D y mapas como proyecciones de solo lectura | Propuesto | 2026-11-18 |
| [ADR-0011](ADR-0011-catalogo-skills-seguridad.md) | Catálogo de skills de ciberseguridad como inventario consultable, nunca ejecutable | Propuesto | 2026-11-18 |
| [ADR-0012](ADR-0012-modo-demo.md) | Modo DEMO aislado por tenant y etiquetado obligatorio | Propuesto | 2026-11-18 |

**Estado `Propuesto`:** pendiente de aprobación del propietario del producto. Pasan a `Aceptado` cuando el propietario los valida o cuando el Hito 1 los implementa sin objeciones.

Plantilla: [ADR-0000-plantilla.md](ADR-0000-plantilla.md).
