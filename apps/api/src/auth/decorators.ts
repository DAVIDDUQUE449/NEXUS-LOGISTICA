import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@nexus/domain-core';

export const PUBLIC_KEY = 'nexus:public';
export const PERMISSION_KEY = 'nexus:permission';
export const NO_CONTEXT_KEY = 'nexus:no-context';

/** Ruta sin sesión (login, health, rastreo público). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Requiere el permiso indicado en el tenant activo (validado en servidor). */
export const RequirePermission = (p: Permission) => SetMetadata(PERMISSION_KEY, p);
/** Requiere sesión pero no empresa seleccionada (p. ej. /auth/me, /auth/context). */
export const NoTenantContext = () => SetMetadata(NO_CONTEXT_KEY, true);
