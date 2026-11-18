# ADR-0008: Apps operativas PWA offline-first con outbox de dispositivo

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `M.13` (offline-first confiable), `24.4`, `O.03` (POD), `U21`, `U22`, `U30`, `U44`, `U46`

## Contexto

El mensajero trabaja con 4G irregular en gama media. Tiene que poder confirmar entregas sin conexión y sincronizar sin duplicados. Si hay conflicto, el POD aceptado por el servidor gana y la operación local pasa a revisión. La app debe mostrar «En línea / Pendiente de sincronizar / Sincronizado / Error: requiere revisión» y permitir el borrado remoto.

## Decisión

1. **App shell** cacheado por Workbox (*precache* versionado). Los datos de trabajo (ruta del día, paradas, guías asignadas, catálogo de novedades) se descargan al **iniciar el turno** a **IndexedDB**.
2. **Cifrado local**: los datos sensibles de IndexedDB (direcciones, contactos, firmas, fotos) se cifran con AES-GCM mediante una clave no exportable de WebCrypto, derivada y ligada a la sesión del dispositivo. Al cerrar el turno o recibir una revocación remota se borran la clave y los datos.
3. **Outbox de dispositivo** (`packages/offline-kit`): cada comando del operario (`ScanParcel`, `RecordAttempt`, `SubmitPOD`, `CollectCOD`, `ConfirmRouteReceipt`, …) se guarda con:
   - `device_operation_id` (UUIDv7 generado en el dispositivo) = **clave de idempotencia**;
   - `occurred_at` (reloj del dispositivo) y el desfase de reloj estimado en la última sincronización;
   - `base_version` de la entidad que el dispositivo conocía;
   - una firma HMAC con la clave del dispositivo, emitida por el servidor al registrarlo.
4. **Sincronización**: `POST /v1/offline/sync` envía lotes ordenados. Por cada operación, el servidor:
   - revalida sesión, dispositivo (no revocado), turno y permisos **en el momento de sincronizar** y también según el estado en `occurred_at`;
   - comprueba idempotencia (`core.idempotency_record`): si ya se procesó, devuelve el mismo resultado sin efecto nuevo (`U21`);
   - aplica la máquina de estados de `domain-core`. Si `base_version` no coincide y la transición ya no es válida (p. ej. otro mensajero entregó la guía), la operación queda **`CONFLICT_REVIEW`** con ambos registros y se notifica al coordinador (`U22`). **Nunca hay sobrescritura silenciosa.**
5. **Regla de POD** (`O.03`): `capture_in_progress → queued_offline → server_received → validated → accepted | rejected`. Solo `accepted` emite `ParcelDelivered`, y como máximo una vez por unidad (índice único parcial en `lastmile.proof_of_delivery (tenant_id, delivery_task_id) WHERE status = 'accepted'`).
6. **UI honesta** (`24.4`): mientras la operación esté en cola, la app muestra «Guardado en el teléfono — pendiente de sincronizar», **nunca** «Entregado». El estado global aparece siempre en `OfflineSyncIndicator`.
7. **Evidencias pesadas** (fotos, firmas): se suben por separado con subida reanudable y se asocian por `evidence_asset_id`. El POD puede aceptarse con la evidencia en estado `pending_upload` solo si la política del servicio lo permite.
8. **Sin GPS** (`U46`): `geo = null` con `geo_unavailable_reason`. La política del servicio decide si exige evidencia alternativa (OTP, firma, foto). La geocerca es una señal y nunca la única autorización (`O.05`).
9. **Funciones que exigen conexión** (deshabilitadas offline, con explicación): reasignar ruta, cambiar el valor de un COD, consultar datos ajenos a la ruta y cualquier aprobación.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Sincronización CRDT/bidireccional general | Excesivo. Los operarios solo **emiten comandos**; el servidor es autoritativo. |
| Background Sync API como único mecanismo | No está disponible en iOS. Se usa cuando existe y, si no, se sincroniza al recuperar foco o conexión. |
| App nativa | Ver [ADR-0002](ADR-0002-stack-tecnologico.md). |

## Consecuencias

- **Positivas:** entregas sin duplicados, conflictos visibles y sin pérdida de datos al perder la conexión.
- **Negativas:** el almacenamiento en iOS se puede desalojar. Se mitiga pidiendo almacenamiento persistente (`navigator.storage.persist()`), avisando si se niega y sincronizando a menudo.
- **Riesgos:** relojes manipulados. Se registra la hora del dispositivo y la del servidor y se calcula el desfase; desfases grandes generan una alerta antifraude para revisión humana.

## Verificación

- `tests/mobile-offline`: Playwright con `context.setOffline(true)`, captura de POD, reconexión y aserción de un único `ParcelDelivered` (`U21`).
- Test `U22`: dos dispositivos envían estados contradictorios ⇒ uno aceptado y otro `CONFLICT_REVIEW`.
- Test `U44`: viewport 360 px y objetivos táctiles ≥ 48 px en acciones primarias.
