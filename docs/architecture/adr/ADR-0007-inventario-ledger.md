# ADR-0007: Inventario como libro mayor (ledger) con proyección de saldos

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `M.05`, `20.2`, `O.03` (stock), `U01`, `U06`, `U20`, `U36`, `U37`

## Contexto

La especificación exige: sin stock negativo, `available = on_hand - reserved - blocked`, que dos procesos no reserven la misma cantidad, ledger y balance actualizados en una sola transacción, transferencias con dos comprobantes, y estados de stock: disponible, reservado, en picking, comprometido, cuarentena, tránsito interno, dañado, retornado y auditoría.

## Decisión

1. **`wms.inventory_ledger`** (*append-only*): cada movimiento es una fila con `sku_id`, `owner_client_account_id`, `bin_location_id`, `lot_id`, `serial_id`, `stock_status` origen y destino, `quantity` (siempre positiva), `uom`, `reason_code`, `reference_type/id` (recepción, picking, ajuste, …), `operator_id` y `correlation_id`.
2. **`wms.stock_balance`** (proyección **síncrona**, misma transacción): una fila por `(tenant, owner, sku, bin, lot, serial, stock_status)` con `quantity >= 0` (`CHECK`). El saldo se actualiza con `UPDATE … SET quantity = quantity ± $q WHERE … AND quantity >= $q`. Si afecta 0 filas, la operación se rechaza con `409 INSUFFICIENT_STOCK`. No hay lectura previa ni carrera.
3. **Estados de stock** como enumeración (`stock_status`): `expected`, `received`, `quarantine`, `available`, `reserved`, `picking`, `picked`, `packed`, `in_transit_internal`, `damaged`, `returned_pending_inspection`, `audit_hold`, `shipped`. Un movimiento cambia cantidades **entre estados** o **entre ubicaciones**; nunca crea ni destruye unidades, salvo con códigos de razón explícitos (`RECEIPT`, `SHIPMENT`, `ADJUSTMENT_GAIN`, `ADJUSTMENT_LOSS`, `DISPOSAL`), que requieren permisos específicos.
4. **Reservas** (`wms.reservation`): pasan cantidad de `available` a `reserved` vinculada a `order_line`. Se liberan con el movimiento inverso. Las asignaciones FEFO/FIFO las calcula `packages/domain-core/allocation` según la regla del SKU (`M.05`: no sustituir FEFO de perecederos).
5. **Concurrencia**: el `UPDATE` condicional y la restricción `CHECK` bastan para el saldo. Para tareas (pick/putaway) se usa bloqueo optimista (`version`) y `SELECT … FOR UPDATE SKIP LOCKED` al asignar.
6. **Transferencias interbodega** (`M.05`, `U37`): dos documentos, `transfer_out` (origen → `in_transit_internal`) y `transfer_in` (`in_transit_internal` → destino), cada uno con su propio comprobante. Una diferencia abre `inventory_discrepancy`.
7. **Devoluciones** (`M.22`, `U20`): entran en `returned_pending_inspection`. Solo una inspección aprobada las pasa a `available` o `damaged`.
8. **Cross-docking** (`M.10`): **no** usa el ledger comercial. Los bultos viven en `parcel.parcel_unit` y `parcel.container`, con ubicaciones físicas compartidas a través de `core.physical_location`.
9. **Ajustes** (`M.05`): `inventory_adjustment_request`, aprobación (doble control por encima de un umbral configurable) y, al aprobarse, el movimiento en el ledger.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Solo tabla de saldos con `UPDATE` | Pierde la historia y la auditoría, e impide reconstruir saldos. |
| Saldos calculados al vuelo (`SUM` del ledger) | Lento a escala y propenso a carreras al reservar. |
| Saldo como proyección asíncrona | Permitiría reservar stock que ya no existe; inaceptable para U06 y U36. |

## Consecuencias

- **Positivas:** stock negativo imposible por diseño, auditoría total y reconciliación verificable (`SUM(ledger)` = `balance`).
- **Negativas:** más filas y más esfuerzo al escribir, y los índices compuestos deben diseñarse con cuidado.

## Verificación

- Test de propiedad (*property-based*, fast-check): secuencias aleatorias de movimientos ⇒ `balance` = `fold(ledger)` y ningún saldo < 0.
- Test de concurrencia: 50 reservas paralelas sobre 10 unidades ⇒ exactamente 10 aceptadas.
- Job nocturno `inventory:reconcile` que compara ledger y balance y alerta ante cualquier diferencia.
