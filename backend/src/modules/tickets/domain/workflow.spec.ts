import {allowedTransitions, transitionError} from './workflow';

describe('ticket workflow', () => {
  it('requires assignment before work begins or is resolved', () => {
    expect(transitionError('OPEN', 'IN_PROGRESS', true, null)).toContain('Assign');
    expect(transitionError('IN_PROGRESS', 'RESOLVED', true, 'agent')).toBeNull();
  });
  it('rejects skipped and unchanged states', () => {
    expect(transitionError('OPEN', 'RESOLVED', true, 'agent')).toContain('Cannot');
    expect(transitionError('CLOSED', 'RESOLVED', true, 'agent')).toContain('Cannot');
    expect(transitionError('OPEN', 'OPEN', true, null)).toContain('Cannot');
  });
  it('lets requesters close and reopen without taking staff actions', () => {
    expect(allowedTransitions('OPEN', false)).toEqual(['CLOSED']);
    expect(allowedTransitions('IN_PROGRESS', false)).toEqual(['CLOSED']);
    expect(allowedTransitions('RESOLVED', false)).toEqual(['OPEN', 'CLOSED']);
    expect(allowedTransitions('CLOSED', false)).toEqual(['OPEN']);
    expect(transitionError('OPEN', 'IN_PROGRESS', false, 'agent')).toContain('Cannot');
  });
});
