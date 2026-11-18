import { describe, it, expect } from 'vitest';
import { recommendationMachine, parcelMachine, tripMachine, InvalidTransitionError } from '../src';

describe('máquinas de estado', () => {
  it('recomendación: solo pending_approval admite decisión', () => {
    expect(recommendationMachine.canTransition('pending_approval', 'approved')).toBe(true);
    expect(recommendationMachine.canTransition('rejected', 'approved')).toBe(false);
    expect(recommendationMachine.canTransition('executed', 'executing')).toBe(false);
  });
  it('recomendación: aprobada → ejecutando → ejecutada', () => {
    expect(recommendationMachine.canTransition('approved', 'executing')).toBe(true);
    expect(recommendationMachine.canTransition('executing', 'executed')).toBe(true);
  });
  it('paquete entregado no vuelve a tránsito (O.03)', () => {
    expect(() => parcelMachine.assertTransition('DELIVERED', 'LINEHAUL_IN_TRANSIT')).toThrow(InvalidTransitionError);
  });
  it('paquete: intento fallido permite reintento o devolución', () => {
    expect(parcelMachine.next('DELIVERY_ATTEMPT_FAILED')).toEqual(['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER']);
  });
  it('viaje no salta de planned a in_transit', () => {
    expect(tripMachine.canTransition('planned', 'in_transit')).toBe(false);
  });
});
