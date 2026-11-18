import { z } from 'zod';

/** Esquemas de entrada de la API /v1 (validación estricta en servidor; ADR-0002). */
export const LoginRequest = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
}).strict();
export type LoginRequest = z.infer<typeof LoginRequest>;

export const ContextRequest = z.object({
  tenantId: z.string().uuid(),
  siteId: z.string().uuid().nullable().optional(),
}).strict();
export type ContextRequest = z.infer<typeof ContextRequest>;

export const CreateUserRequest = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  displayName: z.string().trim().min(2).max(120),
  roleCode: z.string().min(2).max(60),
  siteIds: z.array(z.string().uuid()).max(50).default([]),
  initialPassword: z.string().min(12).max(200),
}).strict();
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const DecideRecommendationRequest = z.object({
  version: z.number().int().positive(),
  decision: z.enum(['approved', 'rejected', 'revision_requested']),
  optionKey: z.string().min(1).max(80).optional(),
  comment: z.string().trim().max(1000).optional(),
}).strict().refine((v) => v.decision !== 'approved' || !!v.optionKey, {
  message: 'Para aprobar se debe elegir una opción', path: ['optionKey'],
}).refine((v) => v.decision === 'approved' || (v.comment?.length ?? 0) >= 3, {
  message: 'Rechazar o pedir revisión exige un motivo', path: ['comment'],
});
export type DecideRecommendationRequest = z.infer<typeof DecideRecommendationRequest>;

export const SimulateDelayRequest = z.object({
  tripCode: z.string().min(3).max(40).optional(),
  minutes: z.number().int().min(5).max(240).default(47),
}).strict();
export type SimulateDelayRequest = z.infer<typeof SimulateDelayRequest>;

/** Códigos de error estandarizados (ARQUITECTURA §4). */
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'CONFLICT' | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION' | 'IDEMPOTENCY_MISMATCH' | 'IDEMPOTENCY_KEY_REQUIRED' | 'CSRF_FAILED' | 'RATE_LIMITED'
  | 'RECOMMENDATION_EXPIRED' | 'CONTEXT_REQUIRED' | 'DEMO_ONLY' | 'INTERNAL';

export interface ApiError {
  code: ErrorCode;
  message_es: string;
  details?: unknown;
  correlation_id: string;
}
