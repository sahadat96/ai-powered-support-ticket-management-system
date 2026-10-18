import { Actor } from '../../users/domain/user';
import {
  assertTransition,
  canAccess,
  STATUSES,
  TicketRuleError,
  TRANSITIONS,
} from './ticket';

describe('Ticket workflow policy', () => {
  const staff: Actor = { id: 'agent', role: 'AGENT' };
  const customer: Actor = { id: 'owner', role: 'CUSTOMER' };
  it('checks every staff transition against the workflow graph', () => {
    for (const from of STATUSES)
      for (const to of STATUSES) {
        if (from === to || TRANSITIONS[from].includes(to))
          expect(() => assertTransition(from, to, staff)).not.toThrow();
        else
          expect(() => assertTransition(from, to, staff)).toThrow(
            TicketRuleError,
          );
      }
  });
  it('only lets customers close or reopen resolved tickets', () => {
    expect(() => assertTransition('RESOLVED', 'OPEN', customer)).not.toThrow();
    expect(() =>
      assertTransition('RESOLVED', 'CLOSED', customer),
    ).not.toThrow();
    expect(() => assertTransition('OPEN', 'IN_PROGRESS', customer)).toThrow(
      TicketRuleError,
    );
    expect(() => assertTransition('CLOSED', 'OPEN', customer)).toThrow(
      TicketRuleError,
    );
  });
  it('isolates customer data while staff can access the queue', () => {
    expect(canAccess({ requesterId: 'owner' }, customer)).toBe(true);
    expect(canAccess({ requesterId: 'someone-else' }, customer)).toBe(false);
    expect(canAccess({ requesterId: 'someone-else' }, staff)).toBe(true);
  });
});
