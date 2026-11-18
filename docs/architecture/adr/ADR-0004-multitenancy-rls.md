# ADR-0004: Multiempresa con `tenant_id` + Row Level Security en PostgreSQL

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `L.3` (modo multiempresa), `D.1.4`, `D.4`, `N.05`, `U25`, `U26`, `U43`, `D.10` P0

## Contexto

La plataforma es SaaS multi-tenant. Cada tenant tiene clientes contractuales (`client_account`), sedes y operarios. La especificación exige que **ningún** usuario, token, worker, WebSocket, caché, informe, archivo o agente acceda a datos de otro tenant (`D.1.4`), y que el aislamiento se pruebe «en API y DB» (`U25`).

## Decisión

**Defensa en dos capas, ambas obligatorias:**

### Capa 1: aplicación

- Toda tabla de negocio tiene `tenant_id uuid NOT NULL`. Las tablas con datos de cliente cargador también tienen `client_account_id`.
- El `tenant_id` **nunca viene del cliente**. Se deriva de la sesión autenticada ([ADR-0005](ADR-0005-identidad-sesiones.md)) y del `membership` activo. Si llega un `tenant_id` en el cuerpo de la petición, se ignora y se registra.
- Un guard ABAC de NestJS valida `site_id`, `client_account_id`, la asignación y el estado antes de cada caso de uso (BOLA/BFLA).

### Capa 2: base de datos (RLS)

- La aplicación se conecta con el rol `nexus_app`, **sin** `BYPASSRLS` y sin ser dueño de las tablas.
- Cada petición abre una transacción y ejecuta:

  ```sql
  SELECT set_config('app.tenant_id', $1, true),
         set_config('app.user_id',   $2, true),
         set_config('app.client_account_ids', $3, true); -- vacío = sin restricción por cliente
  ```

  `true` = alcance local a la transacción. El valor no se filtra entre conexiones del *pool*.
- Política estándar en cada tabla de negocio:

  ```sql
  ALTER TABLE wms.inventory_ledger ENABLE ROW LEVEL SECURITY;
  ALTER TABLE wms.inventory_ledger FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON wms.inventory_ledger
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
  ```

- **Usuarios de portal de cliente** (`client_account_ids` no vacío): una política adicional restringe por `client_account_id = ANY(...)` en pedidos, guías, stock, POD y facturas (`U26`).
- Sin `app.tenant_id` definido, `current_setting` lanza un error y la consulta falla. Es el comportamiento deseado: *fail closed*.
- **Workers**: cada job lleva `tenant_id` en su carga, y el consumidor abre la transacción con el mismo `set_config`. No existen jobs «globales» que lean datos de negocio de varios tenants. Las tareas de plataforma (p. ej. métricas de uso) usan el rol `nexus_platform`, que solo ve vistas agregadas sin PII.
- **Superadmin SaaS** (`N.05`): no lee PII de tenants por defecto. El acceso de soporte excepcional usa *break-glass*: un ticket, una ventana temporal, un registro de auditoría y la notificación al administrador del tenant.
- **Cachés y canales**: las claves de Redis empiezan por `t:{tenant_id}:`. Los canales SSE/WS se nombran `tenant:{id}:site:{id}` y el servidor autoriza cada suscripción.
- **Archivos**: las claves S3 empiezan por `tenant/{tenant_id}/`. La URL firmada se emite solo después de autorizar el objeto.
- **Unicidad por tenant**: `UNIQUE (tenant_id, code)` en lugar de `UNIQUE (code)`, para que un tenant no pueda descubrir los códigos de otro.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Base de datos por tenant | El aislamiento es fuerte, pero el costo operativo es alto (migraciones ×N) y el DEMO multi-tenant se complica. Queda como opción de **despliegue privado** (`L.3`) con el mismo esquema. |
| Esquema PostgreSQL por tenant | Igual de costoso en migraciones y choca con la organización por esquema de dominio ([ADR-0001](ADR-0001-monolito-modular.md)). |
| Solo filtros en la aplicación | Un solo `WHERE` olvidado filtra datos. La especificación pide aislamiento también en la base de datos. |

## Consecuencias

- **Positivas:** un error de programación en un filtro no expone datos de otro tenant. Las pruebas de acceso cruzado se pueden hacer directamente en SQL.
- **Negativas:** cada petición abre una transacción, con un costo mínimo. Prisma necesita una extensión que envuelva las consultas en `$transaction` con `set_config`. Hay que incluir `tenant_id` en los índices compuestos.
- **Riesgos:** una migración que olvide habilitar RLS. Se mitiga con un **test de integración que recorre `pg_class`** y falla si alguna tabla de esquemas de negocio tiene `relrowsecurity = false` o carece de `tenant_id`.

## Verificación

- Test `rls-coverage.spec.ts`: todas las tablas de negocio tienen RLS habilitado y forzado.
- Tests `U25`, `U26`, `U43` a nivel API **y** a nivel SQL directo con el rol `nexus_app`.
- Prueba de IDs manipulados: se pide `GET /v1/shipments/{id_de_otro_tenant}` y la respuesta debe ser `404` (no `403`, para no confirmar que el recurso existe).
