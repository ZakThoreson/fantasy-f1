import { describe, expect, it } from 'vitest';
import { decodeF1String, firstNameOf } from '../src/fetchLeague.js';

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
