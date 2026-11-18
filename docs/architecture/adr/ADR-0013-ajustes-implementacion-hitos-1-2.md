# ADR-0013: Ajustes de implementación en los Hitos 1–2

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Modifica:** ADR-0002 (acceso a datos, UI), ADR-0005 (proveedor de identidad en DEMO), ADR-0006 (ubicación del publicador)

## Contexto

Al implementar el primer vertical slice (Core + Command Center) aparecieron restricciones concretas del entorno y del diseño de seguridad. Este ADR deja constancia de cada desviación, su motivo y cuándo se revisa. Ningún requisito se elimina.

## Decisiones

| # | ADR afectado | Previsto | Implementado | Motivo | Revisión |
|---|---|---|---|---|---|
| 1 | ADR-0002 | Prisma + SQL puntual | **`pg` (node-postgres) + migraciones SQL versionadas** (`database/migrations`, `database/migrate.mjs` con checksum) | El núcleo de seguridad (RLS forzado, `SECURITY DEFINER`, triggers *append-only*, bloqueos e índices parciales) es SQL. Prisma habría quedado como capa delgada sobre SQL crudo y además descarga binarios de motor en la instalación. | Hito 3: reevaluar un *query builder* tipado (Kysely) si crece el número de consultas. |
| 2 | ADR-0005 | Keycloak (OIDC + PKCE + MFA) en desarrollo | **Proveedor local de credenciales para DEMO**: contraseñas con scrypt, sesión opaca en servidor, cookie HttpOnly, CSRF *double-submit*, revocación inmediata y límite de intentos | Permite ejecutar la app sin contenedores pesados. El patrón BFF de sesión ya es el definitivo: solo cambia de dónde sale la identidad. | **Hito 10 (bloqueante para producción):** integrar un IdP OIDC y MFA obligatorio para los roles marcados. Hoy **no hay MFA**. |
| 3 | ADR-0006 | Publicador del outbox en `apps/worker` + Redis pub/sub | Publicador **dentro del proceso API** con `EventEmitter` hacia SSE | Un solo proceso en los Hitos 1–2; el outbox transaccional y la reclamación con `FOR UPDATE SKIP LOCKED` ya son los definitivos. | Hito 3: mover a `apps/worker` con Redis (necesario para escalar la API horizontalmente). |
| 4 | ADR-0002 | Tailwind + Radix | **CSS con tokens Aurora Glass** (`app/globals.css`) y componentes propios accesibles | Menos dependencias para el primer slice; los tokens centrales de K.2/N.01 son los mismos. | Hito 2+: extraer `packages/design-system` cuando lo consuman las PWA. |
| 5 | ADR-0010 | MapLibre con proveedor de teselas | **Mapa esquemático SVG** con posiciones proyectadas | No hay proveedor de mapas autorizado; la especificación prohíbe inventar trazados «en vivo». El mapa dice explícitamente que es esquemático y simulado. | Hito 6: MapLibre con proveedor configurable. |
| 6 | ADR-0012 | Escenarios `SF-48291` (EE. UU.) y `CAL-2026-0001` | Solo `CAL-2026-0001` (+ `BUN-CLO-0007`) | Priorizar el caso colombiano. | Hito 8: añadir `SF-48291` en millas, rotulado como referencia de EE. UU. |

## Consecuencias

- La app se ejecuta con PostgreSQL y Node, sin más servicios obligatorios.
- **Riesgo aceptado solo para DEMO:** autenticación sin MFA. Bloquea la salida a producción hasta resolver el punto 2.
