# ADR-0001: Monolito modular con límites de dominio explícitos

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `O.01`, `L.1` (regla de interoperabilidad y de configuración), `L.3`, sección 21.1

## Contexto

NEXUS LOGISTICS OS cubre 16 capas de producto (Core, OMS, Parcel, WMS, TMS, YMS, Fleet, Last Mile, PUDO, Finance, CRM, Digital Twin, AI, BI, Trust, Launch). Los flujos de negocio cruzan varios dominios en una misma operación. Por ejemplo, un picking confirmado reserva stock en WMS y la reserva tiene que ser coherente con la orden OMS. La especificación (`O.01`) recomienda empezar con un monolito modular y prohíbe crear microservicios solo por apariencia.

El equipo es pequeño y el producto empieza en DEMO. Necesitamos transacciones ACID entre agregados vecinos y un despliegue sencillo.

## Decisión

1. Un único proceso **`apps/api`** (NestJS) que contiene un **módulo por dominio**: `core`, `oms`, `wms`, `parcel`, `tms`, `yms`, `fleet`, `lastmile`, `pudo`, `finance`, `crm`, `ai`, `bi`, `twin`, `trust`, `integrations`.
2. Un proceso **`apps/worker`** (mismo código y otro *entrypoint*) para consumidores de eventos, proyecciones, importaciones, notificaciones, simulador y jobs programados.
3. **Propiedad de datos por dominio** (`O.01`, tabla «Límites y propiedad de agregados»). Cada módulo es dueño de su esquema PostgreSQL (`wms.*`, `parcel.*`, …). Solo el módulo dueño escribe en sus tablas.
4. **Comunicación entre módulos:**
   - Una **llamada síncrona** pasa por la *fachada pública* del módulo (`WmsFacade.reserveStock(...)`) cuando la operación tiene que ser atómica. Las dos escrituras se hacen en la misma transacción de base de datos.
   - Un **evento de dominio** vía outbox ([ADR-0006](ADR-0006-eventos-outbox.md)) sirve para reacciones que pueden ser eventualmente consistentes (KPI, notificaciones, 3D, IA, CRM).
   - Está **prohibido** importar repositorios, entidades o tablas internas de otro módulo. Lo verifica una regla de lint (`eslint-plugin-boundaries` o `dependency-cruiser`) en CI.
5. **Módulos activables** por tenant, contrato y sede (`L.1`, regla de configuración) mediante `core.module_activation`. Un módulo desactivado responde `403 MODULE_DISABLED` y desaparece del menú.
6. **`ProcessTemplate`** (`L.5`) define qué pasos son obligatorios u opcionales según `ServiceOffering`. Así no se fuerza picking/packing en un paquete ya preparado ni una guía postal en un movimiento de estibas.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Microservicios por dominio desde el día 1 | Transacciones distribuidas (sagas) en flujos que hoy pueden ser ACID; más infraestructura que equipo; la especificación lo desaconseja. |
| Monolito sin límites (un solo esquema, servicios que se llaman libremente) | Se vuelve inseparable; impide extraer servicios cuando la escala lo exija y facilita violar la propiedad de datos. |
| Módulos como paquetes npm independientes desplegados juntos | Complejidad de versionado sin beneficio real en esta etapa. |

## Consecuencias

- **Positivas:** transacciones simples, un solo despliegue, refactorización barata y depuración local fácil. Los límites quedan listos para extraer servicios en el futuro (empezando por `parcel` o `lastmile`, que concentran el volumen de escaneos).
- **Negativas:** el escalado es por proceso completo y no por dominio. Un fallo grave en un módulo puede afectar a todo el proceso, lo que se mitiga con *bulkheads* en workers y límites de recursos.
- **Riesgos:** la erosión de límites se mitiga con lint de dependencias en CI y revisión de PR.

## Verificación

- Regla `dependency-cruiser` en CI: `apps/api/src/modules/<a>/**` no puede importar `apps/api/src/modules/<b>/internal/**`.
- Test U49 (módulos activables): WMS y Parcel operan juntos y por separado.
