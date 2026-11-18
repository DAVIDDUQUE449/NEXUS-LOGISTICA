import type { ErrorCode } from '@nexus/shared-contracts';

export class AppError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string, readonly details?: unknown) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new AppError(404, 'NOT_FOUND', `${what} no encontrado`);
export const forbidden = (msg = 'No tiene permiso para esta acción') => new AppError(403, 'FORBIDDEN', msg);
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Sesión no válida o expirada. Inicie sesión nuevamente.');
