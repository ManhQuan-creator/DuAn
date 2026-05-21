import {
  expandSum,
  expandSumAll,
  expandSumIf,
  expandCountIf,
  expandColRange,
  expandVlookup,
  expandAggregate,
  RangeExpanderContext,
} from './range-expander';

const ctx = (overrides?: Partial<RangeExpanderContext>): RangeExpanderContext => ({
  rowOrder: ['r9', 'r10', 'r11', 'r12'],
  allFields: ['SLDIENTP', 'CPSCLSL', 'CPVAT', 'CPND'],
  currentRowCode: 'r9',
  ...overrides,
});

describe('formula-graph/range-expander', () => {
  describe('expandSum', () => {
    it('expands inclusive range', () => {
      const { deps } = expandSum('CPSCLSL, r10, r12', ctx());
      expect(deps).toEqual([
        { rowCode: 'r10', field: 'CPSCLSL' },
        { rowCode: 'r11', field: 'CPSCLSL' },
        { rowCode: 'r12', field: 'CPSCLSL' },
      ]);
    });

    it('normalizes reverse range (toRow < fromRow) to [min, max]', () => {
      const { deps } = expandSum('CPSCLSL, r12, r10', ctx());
      expect(deps.length).toBe(3);
      expect(deps[0].rowCode).toBe('r10');
      expect(deps[2].rowCode).toBe('r12');
    });

    it('returns empty when fromRow not found', () => {
      const { deps } = expandSum('CPSCLSL, rXXX, r12', ctx());
      expect(deps).toEqual([]);
    });

    it('CI lookup: lowercase row token resolves to original case', () => {
      const { deps } = expandSum('cpsclsl, R10, R12', ctx());
      // Field/rowCode resolved to ORIGINAL CASE từ allFields/rowOrder
      expect(deps[0].field).toBe('CPSCLSL');
      expect(deps[0].rowCode).toBe('r10');
    });
  });

  describe('expandSumAll', () => {
    it('returns all rows × field', () => {
      const { deps } = expandSumAll('CPSCLSL', ctx());
      expect(deps.length).toBe(4);
      expect(deps.every(d => d.field === 'CPSCLSL')).toBe(true);
    });
  });

  describe('expandSumIf', () => {
    it('emits both sumField AND condField for every row', () => {
      const { deps } = expandSumIf('CPSCLSL, CPVAT, "X"', ctx());
      // 4 rows × 2 fields = 8 deps
      expect(deps.length).toBe(8);
      expect(deps.filter(d => d.field === 'CPSCLSL').length).toBe(4);
      expect(deps.filter(d => d.field === 'CPVAT').length).toBe(4);
    });

    it('avoids duplicate when sumField === condField (CI)', () => {
      const { deps } = expandSumIf('CPSCLSL, cpsclsl, "X"', ctx());
      expect(deps.length).toBe(4); // not 8
    });
  });

  describe('expandCountIf', () => {
    it('returns all rows × field', () => {
      const { deps } = expandCountIf('CPSCLSL, "match"', ctx());
      expect(deps.length).toBe(4);
    });
  });

  describe('expandColRange', () => {
    it('SUMCOL with explicit rowCode → 1 row × cols range', () => {
      const { deps } = expandColRange('CPSCLSL, CPVAT, r10', ctx());
      expect(deps).toEqual([
        { rowCode: 'r10', field: 'CPSCLSL' },
        { rowCode: 'r10', field: 'CPVAT' },
      ]);
    });

    it('SUMCOL without rowCode → uses currentRowCode', () => {
      const { deps } = expandColRange('CPSCLSL, CPVAT', ctx({ currentRowCode: 'r11' }));
      expect(deps[0].rowCode).toBe('r11');
    });

    it('normalizes reverse col range', () => {
      const { deps } = expandColRange('CPND, CPSCLSL, r10', ctx());
      // Reversed → [min=CPSCLSL idx 1, max=CPND idx 3] = [CPSCLSL, CPVAT, CPND]
      expect(deps.length).toBe(3);
      expect(deps[0].field).toBe('CPSCLSL');
      expect(deps[2].field).toBe('CPND');
    });
  });

  describe('expandVlookup', () => {
    it('returns single cell ref', () => {
      const { deps } = expandVlookup('r10, CPSCLSL', ctx());
      expect(deps).toEqual([{ rowCode: 'r10', field: 'CPSCLSL' }]);
    });
  });

  describe('expandAggregate dispatcher', () => {
    it('dispatches by function name (CI)', () => {
      const c = ctx();
      expect(expandAggregate('SUM', 'CPSCLSL, r10, r12', c).length).toBe(3);
      expect(expandAggregate('sum', 'CPSCLSL, r10, r12', c).length).toBe(3);
      expect(expandAggregate('SUMALL', 'CPSCLSL', c).length).toBe(4);
      expect(expandAggregate('UNKNOWN', '', c)).toEqual([]);
    });
  });
});
