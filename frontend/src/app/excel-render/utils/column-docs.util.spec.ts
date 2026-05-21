import {
  buildColumnDocsText,
  dataTypeLabel,
  extractReferencedTemplateCodes,
  extractTemplateCodesFromFormula,
  translateBareFields,
  translateFormulaForDocs,
  walkLeafColumnsInVisualOrder,
  type ColumnConfigShape,
  type ColumnGroupShape,
  type RowDataLike,
  type TargetTemplateInfo,
} from './column-docs.util';

describe('column-docs.util', () => {
  describe('dataTypeLabel', () => {
    it('number → Cho phép nhập số', () => expect(dataTypeLabel('number')).toBe('Cho phép nhập số'));
    it('text → Cho phép nhập văn bản', () => expect(dataTypeLabel('text')).toBe('Cho phép nhập văn bản'));
    it('date → Cho phép nhập ngày tháng', () => expect(dataTypeLabel('date')).toBe('Cho phép nhập ngày tháng'));
    it('undefined → Cho phép nhập văn bản', () => expect(dataTypeLabel(undefined)).toBe('Cho phép nhập văn bản'));
  });

  describe('translateBareFields', () => {
    const map = new Map([
      ['qty', 'Số lượng'],
      ['amount', 'Thành tiền'],
    ]);

    it('thay token bare → quoted headerName', () => {
      expect(translateBareFields('=SUM(qty)', map)).toBe('=SUM("Số lượng")');
    });

    it('quoted literal `"field"` → swap content, giữ outer quote', () => {
      expect(
        translateBareFields('=GETDATA("TPL","qty",0,1) + amount', map),
      ).toBe('=GETDATA("TPL","Số lượng",0,1) + "Thành tiền"');
    });

    it('Excel coord (A1) không thay', () => {
      expect(translateBareFields('=A1 + qty', map)).toBe('=A1 + "Số lượng"');
    });

    it('field không có trong map → giữ nguyên', () => {
      expect(translateBareFields('=foo + qty', map)).toBe('=foo + "Số lượng"');
    });

    it('rỗng → trả nguyên', () => {
      expect(translateBareFields('', map)).toBe('');
    });

    it('map rỗng → trả nguyên', () => {
      expect(translateBareFields('=qty+1', new Map())).toBe('=qty+1');
    });

    it('match field dài trước (tránh prefix collision)', () => {
      const m = new Map([['qty', 'Sl'], ['qtyAdj', 'SlĐC']]);
      expect(translateBareFields('=qtyAdj + qty', m)).toBe('="SlĐC" + "Sl"');
    });

    it('escape dấu nháy kép trong headerName', () => {
      const m = new Map([['qty', 'Số "lượng"']]);
      expect(translateBareFields('=qty', m)).toBe('="Số \\"lượng\\""');
    });
  });

  describe('translateFormulaForDocs — cross-entry enrichment', () => {
    const currentMap = new Map([['qty', 'Số lượng']]);
    const tplInfo: TargetTemplateInfo = {
      name: 'Kế hoạch SXKD năm',
      fieldToHeader: new Map([['DIEN_TP', 'Điện thương phẩm']]),
      rowCodeToName: new Map([['R001', 'Doanh thu']]),
    };
    const targetTemplates = new Map([['KH_SXKD_NAM', tplInfo]]);

    it('LOOKUP 4 args → enrich template+row+field', () => {
      const out = translateFormulaForDocs({
        formula: '=LOOKUP("KH_SXKD_NAM","R001","DIEN_TP",0)',
        currentFieldToHeader: currentMap,
        targetTemplates,
      });
      expect(out).toBe(
        '=LOOKUP("Kế hoạch SXKD năm (KH_SXKD_NAM)", "Dòng \\"Doanh thu\\" (R001)", "Cột \\"Điện thương phẩm\\" (DIEN_TP)", 0)',
      );
    });

    it('GETDATA 3 args → enrich template+field (skip rowCode)', () => {
      const out = translateFormulaForDocs({
        formula: '=GETDATA("KH_SXKD_NAM","DIEN_TP",0,1)',
        currentFieldToHeader: currentMap,
        targetTemplates,
      });
      expect(out).toBe(
        '=GETDATA("Kế hoạch SXKD năm (KH_SXKD_NAM)", "Cột \\"Điện thương phẩm\\" (DIEN_TP)", 0, 1)',
      );
    });

    it('LOOKUPENTRY → enrich template+field', () => {
      const out = translateFormulaForDocs({
        formula: '=LOOKUPENTRY("KH_SXKD_NAM","DIEN_TP",0)',
        currentFieldToHeader: currentMap,
        targetTemplates,
      });
      expect(out).toBe(
        '=LOOKUPENTRY("Kế hoạch SXKD năm (KH_SXKD_NAM)", "Cột \\"Điện thương phẩm\\" (DIEN_TP)", 0)',
      );
    });

    it('MYORG → enrich template+field', () => {
      const out = translateFormulaForDocs({
        formula: '=MYORG("KH_SXKD_NAM","DIEN_TP",-1)',
        currentFieldToHeader: currentMap,
        targetTemplates,
      });
      expect(out).toBe(
        '=MYORG("Kế hoạch SXKD năm (KH_SXKD_NAM)", "Cột \\"Điện thương phẩm\\" (DIEN_TP)", -1)',
      );
    });

    it('targetTemplates không có code → giữ nguyên args', () => {
      const out = translateFormulaForDocs({
        formula: '=LOOKUP("UNKNOWN_TPL","R001","f",0)',
        currentFieldToHeader: currentMap,
        targetTemplates,
      });
      expect(out).toBe('=LOOKUP("UNKNOWN_TPL", "R001", "f", 0)');
    });

    it('formula compound — cross-entry + bare field cùng tồn tại', () => {
      const out = translateFormulaForDocs({
        formula: '=LOOKUP("KH_SXKD_NAM","R001","DIEN_TP",0) + qty',
        currentFieldToHeader: currentMap,
        targetTemplates,
      });
      expect(out).toContain('=LOOKUP("Kế hoạch SXKD năm (KH_SXKD_NAM)"');
      expect(out).toContain(' + "Số lượng"');
    });
  });

  describe('extractTemplateCodesFromFormula', () => {
    it('LOOKUP + GETDATA → trả 2 codes', () => {
      const codes = extractTemplateCodesFromFormula(
        '=LOOKUP("TPL_A","r","f",0) + GETDATA("TPL_B","f",0)',
      );
      expect(codes).toEqual(['TPL_A', 'TPL_B']);
    });
    it('formula không có cross-entry → empty', () => {
      expect(extractTemplateCodesFromFormula('=SUM(qty)+1')).toEqual([]);
    });
  });

  describe('extractReferencedTemplateCodes', () => {
    it('quét cả column-level + cell-level → dedupe', () => {
      const columnConfigs: ColumnConfigShape[] = [
        { field: 'a', headerName: 'A', formula: '=LOOKUP("TPL_X","r","f",0)' },
        { field: 'b', headerName: 'B' },
      ];
      const rowData: RowDataLike[] = [
        { row_code: 'R1', _cellConfig: { b: { formula: '=GETDATA("TPL_Y","f",0)' } } },
        { row_code: 'R2', _cellConfig: { b: { formula: '=LOOKUP("TPL_X","r2","f",0)' } } },
      ];
      const codes = extractReferencedTemplateCodes({ columnConfigs, rowData });
      expect(codes.size).toBe(2);
      expect(codes.has('TPL_X')).toBe(true);
      expect(codes.has('TPL_Y')).toBe(true);
    });
  });

  describe('walkLeafColumnsInVisualOrder', () => {
    it('flat columns không group', () => {
      const cols: ColumnConfigShape[] = [
        { field: 'a', headerName: 'Cột A' },
        { field: 'b', headerName: 'Cột B' },
      ];
      const out = walkLeafColumnsInVisualOrder(cols, []);
      expect(out).toEqual([
        { field: 'a', pathHeaders: ['Cột A'] },
        { field: 'b', pathHeaders: ['Cột B'] },
      ]);
    });

    it('3-level nested', () => {
      const cols: ColumnConfigShape[] = [
        { field: 'a', headerName: 'A' },
      ];
      const groups: ColumnGroupShape[] = [
        {
          groupId: 'root',
          headerName: 'Cha',
          columnFields: [],
          children: [
            {
              groupId: 'sub',
              headerName: 'Con',
              columnFields: ['a'],
              items: [{ type: 'field', field: 'a' }],
            },
          ],
          items: [{ type: 'group', groupId: 'sub' }],
        },
      ];
      expect(walkLeafColumnsInVisualOrder(cols, groups)).toEqual([
        { field: 'a', pathHeaders: ['Cha', 'Con', 'A'] },
      ]);
    });

    it('group thiếu items → fallback derive', () => {
      const cols: ColumnConfigShape[] = [
        { field: 'a', headerName: 'A' },
        { field: 'b', headerName: 'B' },
      ];
      const groups: ColumnGroupShape[] = [
        { groupId: 'g', headerName: 'G', columnFields: ['a', 'b'] },
      ];
      expect(walkLeafColumnsInVisualOrder(cols, groups)).toEqual([
        { field: 'a', pathHeaders: ['G', 'A'] },
        { field: 'b', pathHeaders: ['G', 'B'] },
      ]);
    });
  });

  describe('buildColumnDocsText', () => {
    it('empty columnConfigs → chỉ dòng header', () => {
      const text = buildColumnDocsText({
        templateName: 'Lập kế hoạch tạm tính',
        columnConfigs: [],
        columnGroups: [],
      });
      expect(text).toBe(
        'Hệ thống hiển thị chi tiết biểu mẫu "Lập kế hoạch tạm tính" bao gồm các trường sau:',
      );
    });

    it('flat columns + dataType "Cho phép nhập ..." labels', () => {
      const text = buildColumnDocsText({
        templateName: 'T',
        columnConfigs: [
          { field: 'a', headerName: 'Mã', dataType: 'text' },
          { field: 'b', headerName: 'Số tiền', dataType: 'number' },
          { field: 'c', headerName: 'Ngày lập', dataType: 'date' },
        ],
        columnGroups: [],
      });
      const lines = text.split('\n');
      expect(lines[1]).toBe('1. Mã - Cho phép nhập văn bản');
      expect(lines[2]).toBe('2. Số tiền - Cho phép nhập số');
      expect(lines[3]).toBe('3. Ngày lập - Cho phép nhập ngày tháng');
    });

    it('placeholder ${N}/${M-1} trong templateName + headerName → strip braces', () => {
      const text = buildColumnDocsText({
        templateName: 'Kế hoạch năm ${N}',
        columnConfigs: [
          { field: 'a', headerName: 'Năm ${N - 1}', dataType: 'number' },
          { field: 'b', headerName: 'Năm ${N+1}', dataType: 'number' },
        ],
        columnGroups: [],
      });
      const lines = text.split('\n');
      expect(lines[0]).toContain('"Kế hoạch năm N"');
      expect(lines[1]).toBe('1. Năm N - 1 - Cho phép nhập số');
      expect(lines[2]).toBe('2. Năm N+1 - Cho phép nhập số');
    });

    it('column-level formula → emit dòng "Công thức (mặc định cả cột)"', () => {
      const text = buildColumnDocsText({
        templateName: 'F',
        columnConfigs: [
          { field: 'qty', headerName: 'Số lượng', dataType: 'number' },
          {
            field: 'total',
            headerName: 'Tổng',
            dataType: 'number',
            formula: '=qty * 2',
          },
        ],
        columnGroups: [],
      });
      expect(text).toContain('2. Tổng - Cho phép nhập số');
      expect(text).toContain('    - Công thức (mặc định cả cột): ="Số lượng" * 2');
    });

    it('cell-level formula grouped theo formula trùng nhau', () => {
      const text = buildColumnDocsText({
        templateName: 'F',
        columnConfigs: [
          { field: 'qty', headerName: 'Số lượng', dataType: 'number' },
          { field: 'total', headerName: 'Tổng', dataType: 'number' },
        ],
        columnGroups: [],
        rowData: [
          { row_code: 'R001', _cellConfig: { total: { formula: '=qty * 2' } } },
          { row_code: 'R002', _cellConfig: { total: { formula: '=qty * 2' } } },
          { row_code: 'R003', _cellConfig: { total: { formula: '=qty * 3' } } },
        ],
      });
      expect(text).toContain('    - Công thức tại ô (R001, R002): ="Số lượng" * 2');
      expect(text).toContain('    - Công thức tại ô (R003): ="Số lượng" * 3');
    });

    it('skip row có _isTypeHeader', () => {
      const text = buildColumnDocsText({
        templateName: 'F',
        columnConfigs: [
          { field: 'qty', headerName: 'Số lượng', dataType: 'number' },
        ],
        columnGroups: [],
        rowData: [
          {
            row_code: 'HDR',
            _isTypeHeader: true,
            _cellConfig: { qty: { formula: '=1' } },
          },
          { row_code: 'R1', _cellConfig: { qty: { formula: '=qty' } } },
        ],
      });
      expect(text).not.toContain('HDR');
      expect(text).toContain('R1');
    });

    it('cell formula với LOOKUP + targetTemplates → enrich', () => {
      const targetTemplates = new Map<string, TargetTemplateInfo>([
        ['KH_SXKD_NAM', {
          name: 'Kế hoạch SXKD năm',
          fieldToHeader: new Map([['giaTri', 'Giá trị']]),
          rowCodeToName: new Map([['DIEN_TP', 'Điện thương phẩm']]),
        }],
      ]);
      const text = buildColumnDocsText({
        templateName: 'F',
        columnConfigs: [
          { field: 'val', headerName: 'Giá trị', dataType: 'number' },
        ],
        columnGroups: [],
        rowData: [
          {
            row_code: 'R1',
            _cellConfig: {
              val: { formula: '=LOOKUP("KH_SXKD_NAM","DIEN_TP","giaTri",0)' },
            },
          },
        ],
        targetTemplates,
      });
      expect(text).toContain('"Kế hoạch SXKD năm (KH_SXKD_NAM)"');
      expect(text).toContain('"Dòng \\"Điện thương phẩm\\" (DIEN_TP)"');
      expect(text).toContain('"Cột \\"Giá trị\\" (giaTri)"');
    });
  });
});
