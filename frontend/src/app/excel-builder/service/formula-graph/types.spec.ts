import { makeCellKey, parseCellKey } from './types';

describe('formula-graph/types', () => {
  describe('makeCellKey', () => {
    it('combines rowCode + field with pipe separator', () => {
      expect(makeCellKey('r9', 'CPSCLSL')).toBe('r9|CPSCLSL');
    });

    it('PRESERVES original case (regression: rdvpt vs rDvPT must be distinct keys)', () => {
      // BUG REGRESSION: 2 rows có rowCode khác case từng bị collapse vào 1 key
      // → row sau overwrite formula của row trước → false cycle.
      expect(makeCellKey('rdvpt', 'X')).not.toBe(makeCellKey('rDvPT', 'X'));
      expect(makeCellKey('rdvpt', 'X')).toBe('rdvpt|X');
      expect(makeCellKey('rDvPT', 'X')).toBe('rDvPT|X');
    });

    it('handles null/undefined safely', () => {
      expect(makeCellKey(null as any, undefined as any)).toBe('|');
      expect(makeCellKey('r9', undefined as any)).toBe('r9|');
    });
  });

  describe('parseCellKey', () => {
    it('round-trips makeCellKey output', () => {
      const k = makeCellKey('r9', 'CPSCLSL');
      expect(parseCellKey(k)).toEqual({ rowCode: 'r9', field: 'CPSCLSL' });
    });

    it('handles fields containing underscores correctly', () => {
      const k = makeCellKey('rng', 'SUM_NGHAI_BON');
      expect(parseCellKey(k)).toEqual({ rowCode: 'rng', field: 'SUM_NGHAI_BON' });
    });
  });
});
