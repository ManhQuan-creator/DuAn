import { extractDependencies, ExtractContext } from './dependency-extractor';

const ctx = (overrides?: Partial<ExtractContext>): ExtractContext => ({
  currentRowCode: 'r9',
  currentField: 'CPSCLSL',
  rowOrder: ['r9', 'r10', 'rdvpt', 'rDvPT'], // duplicate-case rows (regression case)
  allFields: ['SLDIENTP', 'CPSCLSL', 'CPVAT'],
  colMap: { J: 'CPSCLSL', K: 'CPVAT' },
  ...overrides,
});

describe('formula-graph/dependency-extractor', () => {
  describe('4-tier token resolution', () => {
    it('Tier 1: ROW_COL `{rowCode}_{field}` (CI)', () => {
      const { cellDeps } = extractDependencies('r10_CPVAT + 5', ctx());
      expect(cellDeps).toEqual([{ rowCode: 'r10', field: 'CPVAT' }]);
    });

    it('Tier 1: lowercase token resolves to ORIGINAL CASE deps', () => {
      const { cellDeps } = extractDependencies('r10_cpvat', ctx());
      expect(cellDeps[0].field).toBe('CPVAT'); // original case from allFields
      expect(cellDeps[0].rowCode).toBe('r10');
    });

    it('Tier 2: COL only → uses currentRowCode', () => {
      const { cellDeps } = extractDependencies('CPVAT + 1', ctx());
      expect(cellDeps).toEqual([{ rowCode: 'r9', field: 'CPVAT' }]);
    });

    it('Tier 3: ROW only → uses currentField', () => {
      const { cellDeps } = extractDependencies('r10', ctx());
      expect(cellDeps).toEqual([{ rowCode: 'r10', field: 'CPSCLSL' }]);
    });

    it('Tier 4: Excel coord `J` → currentRow × colMap[J]', () => {
      const { cellDeps } = extractDependencies('J', ctx());
      expect(cellDeps).toEqual([{ rowCode: 'r9', field: 'CPSCLSL' }]);
    });

    it('Tier 4: Excel coord `J2` → row at index 1 × colMap[J]', () => {
      const { cellDeps } = extractDependencies('J2', ctx());
      expect(cellDeps[0].rowCode).toBe('r10');
    });

    it('unresolved token reported in unresolvedTokens', () => {
      const { unresolvedTokens } = extractDependencies('xyz_unknown', ctx());
      expect(unresolvedTokens).toContain('xyz_unknown');
    });
  });

  describe('case-sensitivity (regression: rdvpt vs rDvPT)', () => {
    it('CI lookup with first-wins: token `rdvpt_X` resolves to FIRST matching original case', () => {
      // rdvpt comes before rDvPT in rowOrder → first wins
      const { cellDeps } = extractDependencies('rdvpt_CPVAT', ctx());
      expect(cellDeps[0].rowCode).toBe('rdvpt'); // not rDvPT
    });

    it('CI lookup applies even when token differs in case from both rows', () => {
      const { cellDeps } = extractDependencies('RDVPT_CPVAT', ctx());
      expect(cellDeps[0].rowCode).toBe('rdvpt'); // first-wins still applies
    });
  });

  describe('aggregate functions', () => {
    it('SUM(field, fromRow, toRow) expands to range cells', () => {
      const { cellDeps } = extractDependencies(
        'SUM(CPVAT, r9, r10)',
        ctx({ rowOrder: ['r9', 'r10'] }),
      );
      expect(cellDeps).toEqual([
        { rowCode: 'r9', field: 'CPVAT' },
        { rowCode: 'r10', field: 'CPVAT' },
      ]);
    });

    it('aggregate name (SUM/SUMALL/...) is NOT included as residue token', () => {
      const { unresolvedTokens } = extractDependencies(
        'SUM(CPVAT, r9, r10)',
        ctx({ rowOrder: ['r9', 'r10'] }),
      );
      expect(unresolvedTokens).not.toContain('SUM');
    });

    it('SUMIF(sumField, condField, condValue) — quoted condValue stripped, both fields tracked', () => {
      // currentRowCode='r9', currentField='CPSCLSL' (default ctx). SUMIF references
      // CPVAT (sum) + CPSCLSL (cond). For 2 rows × 2 fields = 4 deps; nhưng
      // (r9, CPSCLSL) là self-dep → filter → còn 3.
      const c = ctx({ rowOrder: ['r9', 'r10'] });
      const { cellDeps } = extractDependencies('SUMIF(CPVAT, CPSCLSL, "match")', c);
      expect(cellDeps.length).toBe(3);
      expect(cellDeps).toContain(jasmine.objectContaining({ rowCode: 'r9', field: 'CPVAT' }));
      expect(cellDeps).toContain(jasmine.objectContaining({ rowCode: 'r10', field: 'CPVAT' }));
      expect(cellDeps).toContain(jasmine.objectContaining({ rowCode: 'r10', field: 'CPSCLSL' }));
      // Self-dep filtered:
      expect(cellDeps).not.toContain(jasmine.objectContaining({ rowCode: 'r9', field: 'CPSCLSL' }));
    });

    it('aggregates metadata recorded', () => {
      const { aggregates } = extractDependencies(
        'SUM(CPVAT, r9, r10) + SUMALL(CPSCLSL)',
        ctx({ rowOrder: ['r9', 'r10'] }),
      );
      expect(aggregates.map(a => a.fn).sort()).toEqual(['SUM', 'SUMALL']);
    });
  });

  describe('external refs (GETDATA / LOOKUP / MYORG)', () => {
    it('GETDATA records template + column + offsets, NOT in cellDeps', () => {
      const { cellDeps, externalDeps } = extractDependencies(
        'GETDATA("VAT2024", "CPSCLSL", "N-1")',
        ctx(),
      );
      expect(cellDeps).toEqual([]);
      expect(externalDeps.length).toBe(1);
      expect(externalDeps[0]).toEqual({
        templateCode: 'VAT2024',
        column: 'CPSCLSL',
        yearOffset: 'N-1',
        monthOffset: undefined,
      });
    });

    it('LOOKUP includes rowCode (4th arg distinguishes from GETDATA)', () => {
      const { externalDeps } = extractDependencies(
        'LOOKUP("VAT2024", "rOWN", "CPSCLSL", "N")',
        ctx(),
      );
      expect(externalDeps[0].rowCode).toBe('rOWN');
    });

    it('MYORG records template + column + year, KHÔNG có rowCode (resolve runtime từ AuthService)', () => {
      const { cellDeps, externalDeps } = extractDependencies(
        'MYORG("BC01", "amount", "N")',
        ctx(),
      );
      expect(cellDeps).toEqual([]);
      expect(externalDeps.length).toBe(1);
      expect(externalDeps[0]).toEqual({
        templateCode: 'BC01',
        column: 'amount',
        yearOffset: 'N',
        monthOffset: undefined,
      });
      expect(externalDeps[0].rowCode).toBeUndefined();
    });

    it('MYORG with month offset records monthOffset', () => {
      const { externalDeps } = extractDependencies(
        'MYORG("BC01", "amount", "N-1", "M-3")',
        ctx(),
      );
      expect(externalDeps[0]).toEqual({
        templateCode: 'BC01',
        column: 'amount',
        yearOffset: 'N-1',
        monthOffset: 'M-3',
      });
    });

    it('MYORG year token N KHÔNG bị nhầm thành Excel coord — không record vào cellDeps', () => {
      // Regression: trước fix, 'N' rơi xuống tier-4 scan vì MYORG không strip → nếu
      // colMap có 'N' thì record nhầm cellDep. Sau fix, MYORG strip thành ' 0 '.
      const customCtx = ctx({ colMap: { J: 'CPSCLSL', K: 'CPVAT', N: 'CPVAT' } });
      const { cellDeps } = extractDependencies('MYORG("BC01", "amount", "N")', customCtx);
      expect(cellDeps).toEqual([]); // 'N' không bị nhầm thành coord
    });

    it('MYORG combined với expression — chỉ record external dep, không nhầm operand', () => {
      const { cellDeps, externalDeps } = extractDependencies(
        'MYORG("BC01", "amount", "N") + CPVAT * 10%',
        ctx(),
      );
      expect(externalDeps.length).toBe(1);
      // CPVAT vẫn được resolve qua tier-2 (current row)
      expect(cellDeps).toContain(jasmine.objectContaining({ field: 'CPVAT', rowCode: 'r9' }));
    });

    it('LOOKUP regex word boundary: KHÔNG match LOOKUP bên trong VLOOKUP', () => {
      // Regression: trước fix dùng /LOOKUP/ thiếu \b → match cả LOOKUP trong VLOOKUP
      // → strip nhầm args VLOOKUP, false #REF! ở runtime. Dep extractor mirror behavior.
      const c = ctx({ rowOrder: ['r4', 'r9'], allFields: ['revenue', 'CPSCLSL', 'CPVAT'] });
      const { externalDeps, cellDeps } = extractDependencies('VLOOKUP(r4, revenue)', c);
      expect(externalDeps).toEqual([]); // không nhầm thành LOOKUP external
      expect(cellDeps).toContain(jasmine.objectContaining({ rowCode: 'r4', field: 'revenue' }));
    });

    it('MYORG cùng formula với GETDATA + LOOKUP — cả 3 đều record', () => {
      const { externalDeps } = extractDependencies(
        'GETDATA("A","x","N") + LOOKUP("B","r1","y","N") + MYORG("C","z","N")',
        ctx(),
      );
      expect(externalDeps.length).toBe(3);
      expect(externalDeps.map(d => d.templateCode).sort()).toEqual(['A', 'B', 'C']);
    });

    it('LOOKUPENTRY records template + column + year, KHÔNG có rowCode (resolve runtime từ entry.orgCode)', () => {
      const { cellDeps, externalDeps } = extractDependencies(
        'LOOKUPENTRY("BC01", "amount", "N")',
        ctx(),
      );
      expect(cellDeps).toEqual([]);
      expect(externalDeps.length).toBe(1);
      expect(externalDeps[0]).toEqual({
        templateCode: 'BC01',
        column: 'amount',
        yearOffset: 'N',
        monthOffset: undefined,
      });
      expect(externalDeps[0].rowCode).toBeUndefined();
    });

    it('LOOKUPENTRY with month offset records monthOffset', () => {
      const { externalDeps } = extractDependencies(
        'LOOKUPENTRY("BC01", "amount", "N-1", "M-3")',
        ctx(),
      );
      expect(externalDeps[0]).toEqual({
        templateCode: 'BC01',
        column: 'amount',
        yearOffset: 'N-1',
        monthOffset: 'M-3',
      });
    });

    it('LOOKUPENTRY year token N KHÔNG bị nhầm thành Excel coord', () => {
      // Mirror MYORG regression: nếu LOOKUPENTRY không strip → 'N' rơi xuống tier-4
      // scan, colMap có 'N' → record nhầm cellDep.
      const customCtx = ctx({ colMap: { J: 'CPSCLSL', N: 'CPVAT' } });
      const { cellDeps } = extractDependencies('LOOKUPENTRY("BC01", "amount", "N")', customCtx);
      expect(cellDeps).toEqual([]);
    });

    it('LOOKUPENTRY KHÔNG match nhầm LOOKUP regex (no `\\bLOOKUP\\s*\\(` collision)', () => {
      // Regression: nếu `\bLOOKUP\s*\(` strip args của LOOKUPENTRY, externalDeps sẽ
      // record sai (LOOKUP layout = 4 args, fail check → external miss).
      const { externalDeps } = extractDependencies(
        'LOOKUPENTRY("BC01", "amount", "N")',
        ctx(),
      );
      expect(externalDeps.length).toBe(1);
      expect(externalDeps[0].templateCode).toBe('BC01');
      expect(externalDeps[0].column).toBe('amount'); // KHÔNG phải 'r1' (LOOKUP layout idx 2)
    });

    it('LOOKUPENTRY cùng formula với GETDATA + LOOKUP + MYORG — cả 4 đều record', () => {
      const { externalDeps } = extractDependencies(
        'GETDATA("A","x","N") + LOOKUP("B","r1","y","N") + MYORG("C","z","N") + LOOKUPENTRY("D","w","N")',
        ctx(),
      );
      expect(externalDeps.length).toBe(4);
      expect(externalDeps.map(d => d.templateCode).sort()).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('aggregate self-dep filtering (regression: SUMIF #CIRCULAR! at calling cell)', () => {
    // BUG: aggregate generate dep cho mọi rows × field, bao gồm calling cell →
    // Tarjan SCC mark self-loop → false #CIRCULAR!. Runtime read self qua shadow trả
    // undefined → fallback raw=0, semantic well-defined. Skip self-dep cho aggregates.

    it('SUMIF tại (currentRow, sumField) does NOT register (currentRow, sumField) as dep', () => {
      const c = ctx({
        currentRowCode: 'rTier',
        currentField: 'qty',
        rowOrder: ['r1', 'r2', 'rTier'],
        allFields: ['qty', 'tier'],
      });
      const { cellDeps } = extractDependencies('SUMIF(qty, tier, "A")', c);
      const selfDep = cellDeps.find(d => d.rowCode === 'rTier' && d.field === 'qty');
      expect(selfDep).toBeUndefined();
      // Other rows still tracked
      expect(cellDeps.find(d => d.rowCode === 'r1' && d.field === 'qty')).toBeDefined();
      // condField at non-self rows tracked
      expect(cellDeps.find(d => d.rowCode === 'r1' && d.field === 'tier')).toBeDefined();
    });

    it('SUMALL skips self-dep at calling cell', () => {
      const c = ctx({
        currentRowCode: 'rMath',
        currentField: 'qty',
        rowOrder: ['r1', 'r2', 'rMath'],
        allFields: ['qty'],
      });
      const { cellDeps } = extractDependencies('SUMALL(qty)', c);
      expect(cellDeps.find(d => d.rowCode === 'rMath' && d.field === 'qty')).toBeUndefined();
      expect(cellDeps.length).toBe(2); // r1, r2 only
    });

    it('SUM with explicit range INCLUDING calling cell skips self', () => {
      const c = ctx({
        currentRowCode: 'r2',
        currentField: 'qty',
        rowOrder: ['r1', 'r2', 'r3'],
        allFields: ['qty'],
      });
      const { cellDeps } = extractDependencies('SUM(qty, r1, r3)', c);
      expect(cellDeps.find(d => d.rowCode === 'r2' && d.field === 'qty')).toBeUndefined();
      expect(cellDeps.length).toBe(2); // r1, r3 only
    });

    it('VLOOKUP at OWN cell still flagged as self-dep cycle (skipped)', () => {
      const c = ctx({
        currentRowCode: 'r1',
        currentField: 'qty',
        rowOrder: ['r1'],
        allFields: ['qty'],
      });
      const { cellDeps } = extractDependencies('VLOOKUP(r1, qty)', c);
      expect(cellDeps.length).toBe(0); // self-VLOOKUP filtered
    });

    it('SUMIF with sumField === currentField but condField !== currentField: only sumField self skipped', () => {
      const c = ctx({
        currentRowCode: 'rTier',
        currentField: 'qty',
        rowOrder: ['r1', 'rTier'],
        allFields: ['qty', 'tier'],
      });
      const { cellDeps } = extractDependencies('SUMIF(qty, tier, "A")', c);
      // (rTier, qty) self → skip. (rTier, tier) NOT self (different field) → keep.
      expect(cellDeps.find(d => d.rowCode === 'rTier' && d.field === 'qty')).toBeUndefined();
      expect(cellDeps.find(d => d.rowCode === 'rTier' && d.field === 'tier')).toBeDefined();
    });

    it('DIRECT self-ref via token (not aggregate) STILL creates self-dep — should be cycle', () => {
      // NOT filtered by aggregate self-skip; user-written `r1_qty + 1` at r1.qty is
      // an actual circular reference user error — preserve cycle detection for that.
      const c = ctx({
        currentRowCode: 'r1',
        currentField: 'qty',
        rowOrder: ['r1'],
        allFields: ['qty'],
      });
      const { cellDeps } = extractDependencies('r1_qty + 1', c);
      expect(cellDeps).toContain(jasmine.objectContaining({ rowCode: 'r1', field: 'qty' }));
    });
  });

  describe('reserved keywords', () => {
    it('skips reserved keywords (IF, AND, OR, ...)', () => {
      const { cellDeps, unresolvedTokens } = extractDependencies(
        'IF(CPVAT > 0, CPSCLSL, 0)',
        ctx(),
      );
      expect(unresolvedTokens).not.toContain('IF');
      // CPVAT + CPSCLSL = 2 deps (current row)
      expect(cellDeps.length).toBe(2);
    });
  });

  describe('dedup', () => {
    it('duplicate refs collapsed', () => {
      const { cellDeps } = extractDependencies('CPVAT + CPVAT', ctx());
      expect(cellDeps.length).toBe(1);
    });
  });
});
