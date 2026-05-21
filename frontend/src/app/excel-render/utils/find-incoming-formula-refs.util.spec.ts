import { findIncomingFormulaRefs } from './find-incoming-formula-refs.util';

describe('findIncomingFormulaRefs', () => {
  const colMap = { A: 'amount', B: 'qty' };
  const columnConfigs = [
    { field: 'amount' },
    { field: 'qty' },
    { field: 'total' },
  ];

  it('cell-level formula reference target row → 1 hit', () => {
    const rowData = [
      { row_code: 'R1', _cellConfig: { total: { formula: 'r3_amount + r5_amount' } } },
      { row_code: 'R3' },
      { row_code: 'R5' },
    ];
    const hits = findIncomingFormulaRefs('R3', rowData, columnConfigs, colMap);
    expect(hits.length).toBe(1);
    expect(hits[0]).toEqual({ rowCode: 'R1', field: 'total', formula: 'r3_amount + r5_amount' });
  });

  it('column-level formula trong row khác → hit per row (trừ row có cell-override)', () => {
    const cols = [
      { field: 'amount' },
      { field: 'qty' },
      { field: 'total', formula: 'r3_amount + 1' },
    ];
    const rowData = [
      { row_code: 'R1' },
      { row_code: 'R2' },
      { row_code: 'R3' },
    ];
    const hits = findIncomingFormulaRefs('R3', rowData, cols, colMap);
    // Mỗi row đều có column-level formula → 3 hits (R1, R2, R3 self-ref)
    expect(hits.length).toBe(3);
    const codes = hits.map((h) => h.rowCode).sort();
    expect(codes).toEqual(['R1', 'R2', 'R3']);
  });

  it('cell-override block column-level scan ở row đó', () => {
    const cols = [
      { field: 'amount' },
      { field: 'qty' },
      { field: 'total', formula: 'r3_amount + 1' },
    ];
    const rowData = [
      { row_code: 'R1', _cellConfig: { total: { formula: 'qty * 2' } } }, // override → KHÔNG ref R3
      { row_code: 'R3' },
    ];
    const hits = findIncomingFormulaRefs('R3', rowData, cols, colMap);
    expect(hits.length).toBe(1); // chỉ R3 với column formula, R1 đã override
    expect(hits[0].rowCode).toBe('R3');
  });

  it('aggregate SUM range bao trùm target → all rows in range hit (column-level)', () => {
    const cols = [
      { field: 'amount' },
      { field: 'total', formula: 'SUM(amount, R1, R3)' },
    ];
    const rowData = [
      { row_code: 'R1' },
      { row_code: 'R2' },
      { row_code: 'R3' },
    ];
    const hits = findIncomingFormulaRefs('R2', rowData, cols, colMap);
    // SUM range expand → R1.amount + R2.amount + R3.amount → 3 rows hit (mỗi row có column formula)
    expect(hits.length).toBe(3);
  });

  it('formula KHÔNG reference target → 0 hits', () => {
    const rowData = [
      { row_code: 'R1', _cellConfig: { total: { formula: 'amount + qty' } } },
      { row_code: 'R5' },
    ];
    const hits = findIncomingFormulaRefs('R5', rowData, columnConfigs, colMap);
    expect(hits.length).toBe(0);
  });

  it('targetRowCode rỗng/null → 0 hits', () => {
    const rowData = [{ row_code: 'R1', _cellConfig: { total: { formula: 'r3_amount' } } }];
    expect(findIncomingFormulaRefs('', rowData, columnConfigs, colMap).length).toBe(0);
  });

  it('dropdown override không có formula → KHÔNG scan column formula ở row đó', () => {
    const cols = [
      { field: 'amount' },
      { field: 'category', formula: 'r3_amount + 1' },
    ];
    const rowData = [
      { row_code: 'R1', _cellConfig: { category: { dropdown: { catalogType: 'X' } } } },
      { row_code: 'R3' },
    ];
    const hits = findIncomingFormulaRefs('R3', rowData, cols, colMap);
    // R1 có dropdown override → skip column formula. R3 vẫn hit (column formula self-ref).
    expect(hits.length).toBe(1);
    expect(hits[0].rowCode).toBe('R3');
  });

  it('dedupe: nếu cùng rowCode + field xuất hiện 2 lần (không xảy ra trong scan thường), vẫn chỉ 1 hit', () => {
    // Scan thường KHÔNG duplicate, nhưng test seen-set safety.
    const rowData = [
      { row_code: 'R1', _cellConfig: { total: { formula: 'r5_amount + r5_amount' } } },
      { row_code: 'R5' },
    ];
    const hits = findIncomingFormulaRefs('R5', rowData, columnConfigs, colMap);
    expect(hits.length).toBe(1);
  });

  it('row thiếu row_code → skip an toàn', () => {
    const rowData = [
      {},
      { row_code: 'R1', _cellConfig: { total: { formula: 'r5_amount' } } },
      { row_code: 'R5' },
    ];
    const hits = findIncomingFormulaRefs('R5', rowData, columnConfigs, colMap);
    expect(hits.length).toBe(1);
  });
});
