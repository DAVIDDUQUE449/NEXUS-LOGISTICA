# ADR-0006: Eventos de dominio append-only + transactional outbox

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `O.01` (mensajería), `O.04`, sección 22.2, `D.7`, `U32`, `U34`, `U36`

## Contexto

La trazabilidad completa (cadena de custodia, timeline público, auditoría, KPI, 3D e IA) depende de eventos fiables. La especificación pide: outbox transaccional, consumidores idempotentes, DLQ, reintento exponencial, eventos *append-only*, orden por entidad y versión, tolerancia a eventos tardíos y reconstrucción de proyecciones.

## Decisión

1. **Contrato de evento único** (`O.04`), definido en `packages/shared-contracts/events`:

   ```ts
   interface DomainEvent<T> {
     event_id: string;            // UUIDv7
     event_type: string;          // PascalCase, p. ej. "ParcelScanned"
     schema_version: number;
     entity_type: string;         // "parcel_unit"
     entity_id: string;
     entity_version: number;      // versión del agregado tras el cambio
     tenant_id: string;
     site_id: string | null;
     operator_id: string | null;  // sujeto autenticado o "agent:<id>" o "system"
     device_id: string | null;
     source: 'api' | 'device' | 'worker' | 'simulator' | 'integration';
     occurred_at: string;         // hora del hecho (dispositivo si offline)
     recorded_at: string;         // hora del servidor
     correlation_id: string;
     causation_id: string | null;
     idempotency_key: string;
     geo: { lat: number; lon: number; accuracy_m: number; source: string } | null;
     payload: T;                  // validado con Zod por event_type + schema_version
     integrity_hash: string;      // sha256(prev_hash || canonical(evento)) por entidad sensible
   }
   ```

2. **Escritura**: el caso de uso modifica el agregado **e inserta** en `core.domain_event` (histórico, *append-only*) **y** en `core.outbox_event` (pendientes de publicar) **en la misma transacción**.
3. **Inmutabilidad**: el rol `nexus_app` solo tiene `INSERT` y `SELECT` en `core.domain_event` y `core.audit_entry`. Un *trigger* rechaza `UPDATE` y `DELETE`. Para eventos de custodia, POD, COD y ajustes de stock se mantiene una cadena de hash por entidad, que permite **detectar manipulación** (`D.7`), no impedirla al 100 %.
4. **Publicación**: `apps/worker` lee `outbox_event` con `FOR UPDATE SKIP LOCKED`, publica en BullMQ (una cola por familia de consumidores) y marca `published_at`.
5. **Consumidores idempotentes**: `core.event_consumer_checkpoint (consumer, event_id)` con clave única. Si un evento llega dos veces, la segunda no produce efecto.
6. **Orden**: dentro de una entidad, los consumidores aplican eventos por `entity_version`. Un evento con versión ≤ última aplicada se ignora. Si falta una versión intermedia, el consumidor espera con reintento; tras N intentos, el evento va a DLQ con alerta.
7. **Eventos tardíos** (offline): `occurred_at` puede ser anterior a `recorded_at`. Las proyecciones ordenan el timeline por `occurred_at` y muestran ambas horas, pero **nunca reescriben eventos ya registrados** (`O.04`).
8. **DLQ**: reintento exponencial con *jitter*; al agotarse, `core.dead_letter` y una alerta en el Security & Trust Center o la torre de control.
9. **Proyecciones** reconstruibles desde `domain_event`: timeline de guía, saldos WMS ([ADR-0007](ADR-0007-inventario-ledger.md)), tablero de KPI, escena 3D y Operations Brief. Comando `pnpm projections:rebuild --name <p> --tenant <t>`.
10. **Nombres**: `PascalCase` en pasado, según la lista de `O.04`. Los nombres en minúscula con puntos de la sección 22.2 (`inventory.received`, …) se mapean como alias en la documentación de webhooks externos.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Event sourcing completo (el estado se deriva solo de eventos) | Mayor complejidad en consultas y migraciones. Se aplica **solo** al inventario ([ADR-0007](ADR-0007-inventario-ledger.md)), donde aporta valor real. |
| Kafka/NATS desde el inicio | Infraestructura adicional sin necesidad hoy. El outbox permite migrar a un broker sin cambiar a los productores (`O.01`: «evolución a broker si escala»). |
| Publicar en Redis directamente desde el caso de uso | Si la transacción hace *rollback* después de publicar, quedan eventos fantasma. El outbox lo evita. |

## Consecuencias

- **Positivas:** trazabilidad completa, KPI y 3D derivados de la misma fuente (`U32`) y auditoría verificable (`U34`).
- **Negativas:** consistencia eventual en las proyecciones. La UI muestra «Última actualización» (`U47`). Las tablas `domain_event` crecen: se particionan por mes con una política de retención y archivo.

## Verificación

- Test: *rollback* del caso de uso ⇒ ni evento ni outbox.
- Test `U36`: dos escaneos concurrentes del mismo paquete producen un solo movimiento.
- Test: reconstruir una proyección desde cero da el mismo resultado que la proyección incremental.
