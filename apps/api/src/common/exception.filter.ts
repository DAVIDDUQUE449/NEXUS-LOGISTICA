import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { InvalidTransitionError } from '@nexus/domain-core';
import { AppError } from './errors';

/**
 * Respuestas de error estandarizadas { code, message_es, details?, correlation_id }.
 * Nunca expone trazas, SQL ni datos de otros tenants (S-ERR-01).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('ApiError');

  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    const correlation_id = (req as Request & { correlationId?: string }).correlationId ?? 'n/a';
    let status = 500;
    let body: Record<string, unknown> = { code: 'INTERNAL', message_es: 'Error interno. Intente de nuevo o contacte soporte.' };

    if (err instanceof AppError) {
      status = err.status;
      body = { code: err.code, message_es: err.message, ...(err.details !== undefined ? { details: err.details } : {}) };
    } else if (err instanceof ZodError) {
      status = 422;
      body = { code: 'VALIDATION_FAILED', message_es: 'Datos inválidos', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
    } else if (err instanceof InvalidTransitionError) {
      status = 409;
      body = { code: 'INVALID_TRANSITION', message_es: err.message };
    } else if (err instanceof HttpException) {
      status = err.getStatus();
      body = { code: status === 404 ? 'NOT_FOUND' : status === 413 ? 'VALIDATION_FAILED' : 'INTERNAL', message_es: status === 404 ? 'Ruta no encontrada' : err.message };
    } else if (isPgError(err)) {
      if (err.code === '23505') { status = 409; body = { code: 'CONFLICT', message_es: 'El registro ya existe o entra en conflicto con otro.' }; }
      else if (err.code === '23514') { status = 422; body = { code: 'VALIDATION_FAILED', message_es: 'Los datos violan una regla de integridad.' }; }
      else if (err.code === 'P0001' && String(err.message).startsWith('APPEND_ONLY')) { status = 409; body = { code: 'CONFLICT', message_es: 'El historial es inmutable.' }; }
      else if (err.code === '42501') { status = 403; body = { code: 'FORBIDDEN', message_es: 'Operación no permitida.' }; }
    }
    if (status >= 500) this.log.error(`[${correlation_id}] ${(err as Error)?.stack ?? String(err)}`);
    res.status(status).json({ ...body, correlation_id });
  }
}

function isPgError(e: unknown): e is { code: string; message: string } {
  return typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string' && 'severity' in e;
}
