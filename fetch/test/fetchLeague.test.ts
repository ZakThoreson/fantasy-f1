import { describe, expect, it } from 'vitest';
import { computeTeamValue, decodeF1String, firstNameOf } from '../src/fetchLeague.js';

describe('decodeF1String', () => {
  it('decodes URL-encoded team names', () => {
    expect(decodeF1String('Forza%20Cavallino%20Rampante')).toBe('Forza Cavallino Rampante');
  });

  it('returns the original string if decoding fails', () => {
    expect(decodeF1String('50% off')).toBe('50% off');
  });
});

describe('firstNameOf', () => {
  it('takes the first word of a full name', () => {
    expect(firstNameOf('Zachary Thoreson')).toBe('Zachary');
  });

  it('handles a single-word name', () => {
    expect(firstNameOf('Cher')).toBe('Cher');
  });

  it('trims surrounding whitespace', () => {
    expect(firstNameOf('  Ada Lovelace  ')).toBe('Ada');
  });
});

describe('computeTeamValue', () => {
  it('sums the price of every player on the roster', () => {
    const prices = new Map([
      ['11051', 8.0],
      ['111', 3.6],
      ['28', 32.9],
    ]);
    expect(computeTeamValue(['11051', '111', '28'], prices)).toBe(44.5);
  });

  it('treats an unknown player id as worth 0 rather than throwing', () => {
    const prices = new Map([['11051', 8.0]]);
    expect(computeTeamValue(['11051', 'not-a-real-id'], prices)).toBe(8.0);
  });

  it('rounds away floating-point noise to one decimal place', () => {
    const prices = new Map([
      ['a', 0.1],
      ['b', 0.2],
    ]);
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE 754 — this must come out as 0.3.
    expect(computeTeamValue(['a', 'b'], prices)).toBe(0.3);
  });
});
