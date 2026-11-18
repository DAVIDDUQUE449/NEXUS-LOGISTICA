/** Máquina de estados mínima y declarativa. */
export class StateMachine<S extends string> {
  constructor(private readonly name: string, private readonly transitions: Readonly<Record<S, readonly S[]>>) {}

  canTransition(from: S, to: S): boolean {
    return (this.transitions[from] ?? []).includes(to);
  }

  assertTransition(from: S, to: S): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidTransitionError(this.name, from, to);
    }
  }

  next(from: S): readonly S[] {
    return this.transitions[from] ?? [];
  }
}

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';
  constructor(readonly machine: string, readonly from: string, readonly to: string) {
    super(`Transición no permitida en ${machine}: ${from} → ${to}`);
  }
}

/** ADR-0009 §8 */
export type RecommendationStatus =
  | 'pending_approval' | 'approved' | 'rejected' | 'revision_requested' | 'expired' | 'executing' | 'executed' | 'failed';

export const recommendationMachine = new StateMachine<RecommendationStatus>('recommendation', {
  pending_approval: ['approved', 'rejected', 'revision_requested', 'expired'],
  approved: ['executing'],
  executing: ['executed', 'failed'],
  rejected: [],
  revision_requested: [],
  expired: [],
  executed: [],
  failed: [],
});

/** M.11 (subconjunto usado en Hito 2) */
export type TripStatus = 'planned' | 'assigned' | 'loading' | 'departed' | 'in_transit' | 'arrived' | 'closed' | 'cancelled';

export const tripMachine = new StateMachine<TripStatus>('trip', {
  planned: ['assigned', 'cancelled'],
  assigned: ['loading', 'cancelled'],
  loading: ['departed', 'cancelled'],
  departed: ['in_transit'],
  in_transit: ['arrived'],
  arrived: ['closed'],
  closed: [],
  cancelled: [],
});

/** O.03 — paquete en la red */
export type ParcelStatus =
  | 'LABEL_CREATED' | 'ACCEPTED' | 'AT_ORIGIN_HUB' | 'LINEHAUL_IN_TRANSIT' | 'AT_DESTINATION_HUB'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'DELIVERY_ATTEMPT_FAILED' | 'RETURN_TO_SENDER' | 'CANCELLED';

export const parcelMachine = new StateMachine<ParcelStatus>('parcel', {
  LABEL_CREATED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['AT_ORIGIN_HUB', 'CANCELLED'],
  AT_ORIGIN_HUB: ['LINEHAUL_IN_TRANSIT', 'OUT_FOR_DELIVERY'],
  LINEHAUL_IN_TRANSIT: ['AT_DESTINATION_HUB'],
  AT_DESTINATION_HUB: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPT_FAILED'],
  DELIVERY_ATTEMPT_FAILED: ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER'],
  DELIVERED: [],
  RETURN_TO_SENDER: [],
  CANCELLED: [],
});
