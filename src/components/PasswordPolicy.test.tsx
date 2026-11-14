// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { passwordOk } from './ui';

describe('deployed Cognito password policy', () => {
  it('accepts twelve characters without symbols and rejects short or incomplete passwords', () => {
    expect(passwordOk('Abcdefghij12')).toBe(true);
    for (const password of ['Abcd123!', 'Abcdefghi12', 'abcdefghij12', 'ABCDEFGHIJ12', 'Abcdefghijkl']) {
      expect(passwordOk(password)).toBe(false);
    }
  });
});
