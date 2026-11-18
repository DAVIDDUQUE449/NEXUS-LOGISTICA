# ADR-0010: Gemelo 3D y mapas como proyecciones de solo lectura

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** sección 8, `O.07`, `K.6`, `N.01`, `N.02.10`, `M.11` (GPS), `U33`, `Q.05` (3D)

## Contexto

El gemelo digital 3D es un módulo propio y no la pantalla de inicio (`N.02.10`). Debe reflejar estados de WMS/YMS sin inventar inventario, con fallback 2D y buen rendimiento. Los mapas deben mostrar «sin señal» cuando no haya GPS y nunca rutas ficticias si cae el proveedor.

## Decisión

1. **Fuente**: `GET /v1/digital-twin/sites/:id/snapshot` devuelve la geometría (layout de zonas, racks y muelles desde `wms.*` y `yms.*`) y el estado (ocupación por `bin_location`, pallets o *handling units*, muelles, camiones en patio) **leídos de proyecciones**. Después llegan cambios incrementales por SSE (`twin:site:{id}`) derivados de eventos de dominio.
2. **Solo lectura**: la escena no tiene endpoints de escritura. Seleccionar un objeto abre el inspector, que consulta el registro real. Una acción (p. ej. mover un pallet) **navega** a la pantalla de dominio correspondiente.
3. **Coherencia**: cada objeto 3D lleva `entity_type`, `entity_id` y `entity_version`. El inspector compara la versión con la API y muestra «actualizando…» si hay desfase.
4. **Rendimiento** (`O.07`): `InstancedMesh` para racks y cajas, LOD por distancia, *frustum culling*, geometrías procedurales en lugar de modelos pesados y carga diferida del módulo (`next/dynamic` sin SSR). Presupuesto inicial: < 150 *draw calls* en la escena tipo y 60 fps en hardware de referencia, como objetivo y no como garantía.
5. **Fallback 2D**: plano SVG/Canvas con los mismos datos. Se activa automáticamente si no hay WebGL2, si el dispositivo es modesto o si el usuario activa `prefers-reduced-motion`, y siempre en móvil < 768 px (`24.3`).
6. **Mapas**: `gps_observation` guarda `captured_at`, `source` y `accuracy_m`. La UI muestra la **antigüedad** de cada posición; si es mayor que el umbral, aparece «Sin señal desde HH:MM». En DEMO, el simulador genera las posiciones con `source = simulator` y la etiqueta lo dice (`M.11`).
7. **Privacidad de mapas** (`M.19`, `D.9`): el cliente y el destinatario solo ven el estado de su envío, nunca la posición de vehículos u otros paquetes. Un coordinador ve posiciones de su sede y su turno.

## Consecuencias

- **Positivas:** no hay una segunda fuente de verdad (`D.7`), y el 3D puede fallar sin afectar a la operación (`26.3`).
- **Negativas:** el layout físico (coordenadas de racks) se tiene que mantener como datos maestros en `wms.zone`, `wms.rack` y `wms.bin_location` (`x, y, z, w, h, d`).

## Verificación

- `U33`: ocupar un muelle en YMS ⇒ el muelle aparece ocupado en 3D tras el evento.
- Test: con WebGL deshabilitado, el plano 2D muestra los mismos conteos.
