/**
 * Regression tests cho 2 bugs:
 *
 * Bug 1: Mã báo cáo SAI trong GETDATA/LOOKUP phải trả `#NOTEMPLATE!`, không phải `#NODATA!`.
 *        `#NODATA!` chỉ dành cho mã đúng nhưng chưa có entry data.
 *
 * Bug 2: Cache lookup phải refetch khi columns request thay đổi (vd user sửa formula
 *        từ `wrongCol` → `correctCol`). Cache cũ chỉ có `row_code` (BE filter chỉ giữ
 *        keys tồn tại) → eval `correctCol in row` = false → false `#NOCOL!`.
 */

import { TestBed } from '@angular/core/testing';
import { FormulaService, FormulaEntryContext, LookupData } from './formula.service';
import { AuthService } from '../../auth/auth.service';
import { makeAuthMock } from '../../auth/auth.mock';

describe('FormulaService — Bug 1: #NOTEMPLATE! vs #NODATA!', () => {
  let service: FormulaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: makeAuthMock() }],
    });
    service = TestBed.inject(FormulaService);
  });

  function makeContext(getData: FormulaEntryContext['getLookupData']): FormulaEntryContext {
    return { year: 2026, month: null, getLookupData: getData };
  }

  /**
   * Helper: gọi `evaluateForGraph` với synthetic params + minimal mock GridApi.
   * Pure GETDATA path bypass tokenizer (early return FormulaResult) — không cần api.
   * LOOKUP đi qua tokenizer (resolveLookup chỉ substitute string, error capture qua closure)
   * → cần `api.getColumns()` + `forEachNode()` để buildFieldLookup/buildRowLookup không crash.
   */
  function evalPureGetdata(formula: string, ctx: FormulaEntryContext, rowCode = 'r1') {
    service.setEntryContext(ctx);
    const mockApi = {
      getColumns: () => [],
      forEachNode: (_cb: any) => {},
    } as any;
    return service.evaluateForGraph(
      formula,
      {
        data: { row_code: rowCode },
        node: null as any,
        api: mockApi,
        colDef: { field: 'mockField' } as any,
        column: null as any,
        context: null,
        getValue: () => null,
      } as any,
      {},
      () => undefined,
    );
  }

  it('Pure GETDATA: templateExists=false → #NOTEMPLATE!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'WRONG',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [],
      templateExists: false,
    } as LookupData));
    const result = evalPureGetdata('GETDATA("WRONG","colX","N")', ctx);
    expect(result.error).toBe('#NOTEMPLATE!');
  });

  it('Pure GETDATA: templateExists=true + rows empty → #NODATA!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'BC01',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [],
      templateExists: true,
    } as LookupData));
    const result = evalPureGetdata('GETDATA("BC01","colX","N")', ctx);
    expect(result.error).toBe('#NODATA!');
  });

  it('Pure GETDATA: getLookupData returns undefined (cache miss) → #NODATA!', () => {
    const ctx = makeContext(() => undefined);
    const result = evalPureGetdata('GETDATA("BC01","colX","N")', ctx);
    expect(result.error).toBe('#NODATA!');
  });

  it('Compound GETDATA in expression: wrong template → #NOTEMPLATE!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'WRONG',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [],
      templateExists: false,
    } as LookupData));
    const result = evalPureGetdata('GETDATA("WRONG","colX","N") + 100', ctx);
    expect(result.error).toBe('#NOTEMPLATE!');
  });

  it('LOOKUP: templateExists=false → #NOTEMPLATE!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'WRONG',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [],
      templateExists: false,
    } as LookupData));
    const result = evalPureGetdata('LOOKUP("WRONG","r1","colX","N")', ctx);
    expect(result.error).toBe('#NOTEMPLATE!');
  });

  it('LOOKUP: templateExists=true + rows empty → #NODATA!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'BC01',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [],
      templateExists: true,
    } as LookupData));
    const result = evalPureGetdata('LOOKUP("BC01","r1","colX","N")', ctx);
    expect(result.error).toBe('#NODATA!');
  });

  it('LOOKUP: rowCode missing trên data tồn tại → #NOROW!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'BC01',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [{ row_code: 'r2', colX: 100 }],
      templateExists: true,
    } as LookupData));
    const result = evalPureGetdata('LOOKUP("BC01","r1","colX","N")', ctx);
    expect(result.error).toBe('#NOROW!');
  });

  it('LOOKUP: column not in matched row → #NOCOL!', () => {
    const ctx = makeContext(() => ({
      templateCode: 'BC01',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [{ row_code: 'r1', someOtherCol: 100 }],
      templateExists: true,
    } as LookupData));
    const result = evalPureGetdata('LOOKUP("BC01","r1","colX","N")', ctx);
    expect(result.error).toBe('#NOCOL!');
  });

  it('LOOKUP: full success → no error', () => {
    const ctx = makeContext(() => ({
      templateCode: 'BC01',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [{ row_code: 'r1', colX: 42 }],
      templateExists: true,
    } as LookupData));
    const result = evalPureGetdata('LOOKUP("BC01","r1","colX","N")', ctx);
    expect(result.error).toBeFalsy();
    expect(result.value).toBe(42);
  });

  it('Backward compat: templateExists=undefined treated as exists=true (rows present) → no error', () => {
    const ctx = makeContext(() => ({
      templateCode: 'BC01',
      year: 2026,
      month: null,
      orgCode: null,
      rows: [{ row_code: 'r1', colX: 7 }],
      // templateExists omitted (BE cũ chưa có flag)
    } as LookupData));
    const result = evalPureGetdata('LOOKUP("BC01","r1","colX","N")', ctx);
    expect(result.error).toBeFalsy();
    expect(result.value).toBe(7);
  });
});

describe('FormulaService — Bug 3: pure LOOKUP returns raw text', () => {
  let service: FormulaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: makeAuthMock() }],
    });
    service = TestBed.inject(FormulaService);
  });

  function evalLookup(formula: string, rows: Record<string, any>[], rowCode = 'r1') {
    service.setEntryContext({
      year: 2026,
      month: null,
      getLookupData: () =>
        ({
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          rows,
          templateExists: true,
        } as LookupData),
    });
    const mockApi = { getColumns: () => [], forEachNode: () => {} } as any;
    return service.evaluateForGraph(
      formula,
      {
        data: { row_code: rowCode },
        node: null as any,
        api: mockApi,
        colDef: { field: 'mockField' } as any,
        column: null as any,
        context: null,
        getValue: () => null,
      } as any,
      {},
      () => undefined,
    );
  }

  it('Pure LOOKUP text column → trả string raw (không bị ép Number → 0)', () => {
    const result = evalLookup('LOOKUP("BC01","r1","note","N")', [
      { row_code: 'r1', note: 'Ghi chú đặc biệt' },
    ]);
    expect(result.error).toBeFalsy();
    expect(result.value).toBe('Ghi chú đặc biệt');
  });

  it('Pure LOOKUP numeric column → trả number', () => {
    const result = evalLookup('LOOKUP("BC01","r1","amount","N")', [
      { row_code: 'r1', amount: 1500 },
    ]);
    expect(result.error).toBeFalsy();
    expect(result.value).toBe(1500);
  });

  it('Pure LOOKUP numeric-string column → trả number (auto-coerce)', () => {
    // BE có thể trả "1500" string từ JSON parse. Pure LOOKUP coerce sang number nếu numeric.
    const result = evalLookup('LOOKUP("BC01","r1","amount","N")', [
      { row_code: 'r1', amount: '1500' },
    ]);
    expect(result.error).toBeFalsy();
    expect(result.value).toBe(1500);
  });

  it('Pure LOOKUP cell null → trả empty string', () => {
    const result = evalLookup('LOOKUP("BC01","r1","note","N")', [
      { row_code: 'r1', note: null },
    ]);
    expect(result.error).toBeFalsy();
    expect(result.value).toBe('');
  });

  it('Pure LOOKUP text với khoảng trắng → giữ string raw', () => {
    const result = evalLookup('LOOKUP("BC01","r1","unitName","N")', [
      { row_code: 'r1', unitName: '  PC Hà Nội  ' },
    ]);
    expect(result.value).toBe('  PC Hà Nội  ');
  });

  it('Compound LOOKUP trong expression → vẫn substitute numeric (Number(text) → NaN → 0)', () => {
    // Khi LOOKUP nằm trong expression `LOOKUP(...) + 1`, không phải pure path → ép numeric.
    // Đây là intended behavior cho phép tính toán; user dùng pure form khi muốn text.
    const result = evalLookup('LOOKUP("BC01","r1","note","N") + 100', [
      { row_code: 'r1', note: 'text value' },
    ]);
    expect(result.value).toBe(100); // text → 0, + 100 = 100
  });
});

/**
 * MYORG = shorthand cho LOOKUP với rowCode = currentUser.companyCode.
 * Test 4 nhóm:
 *  - #NOORG! khi user không có companyCode (HQ user)
 *  - Pure MYORG path: text/numeric raw value (mirror pure LOOKUP)
 *  - Substitution path: error capture (#NOTEMPLATE!/#NODATA!/#NOROW!/#NOCOL!)
 *  - Year/month offset resolution truyền đúng đến getLookupData
 */
describe('FormulaService — MYORG: rowCode auto từ AuthService.companyCode', () => {
  function buildService(companyCode: string | null): FormulaService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: makeAuthMock(companyCode) }],
    });
    return TestBed.inject(FormulaService);
  }

  function evalMyorg(
    service: FormulaService,
    formula: string,
    ctx: FormulaEntryContext,
  ) {
    service.setEntryContext(ctx);
    const mockApi = { getColumns: () => [], forEachNode: () => {} } as any;
    return service.evaluateForGraph(
      formula,
      {
        data: { row_code: 'rUnused' }, // MYORG không dùng row_code của current row
        node: null as any,
        api: mockApi,
        colDef: { field: 'mockField' } as any,
        column: null as any,
        context: null,
        getValue: () => null,
      } as any,
      {},
      () => undefined,
    );
  }

  function makeContext(getData: FormulaEntryContext['getLookupData']): FormulaEntryContext {
    return { year: 2026, month: null, getLookupData: getData };
  }

  describe('#NOORG! — user HQ không có companyCode', () => {
    it('Pure MYORG: companyCode null → #NOORG!', () => {
      const service = buildService(null);
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOORG!');
    });

    it('Compound MYORG trong expression: companyCode null → #NOORG!', () => {
      const service = buildService(null);
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N") + 100', ctx);
      expect(result.error).toBe('#NOORG!');
    });

    it('Pure MYORG: companyCode "" (empty string falsy) → #NOORG!', () => {
      const service = buildService('');
      const ctx = makeContext(() => undefined);
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOORG!');
    });
  });

  describe('Pure MYORG → trả raw value', () => {
    it('Pure MYORG numeric column → trả number', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBeFalsy();
      expect(result.value).toBe(1500);
    });

    it('Pure MYORG text column → trả string raw (không ép Number)', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', unitName: 'PC Hà Nội' }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","unitName","N")', ctx);
      expect(result.error).toBeFalsy();
      expect(result.value).toBe('PC Hà Nội');
    });

    it('Pure MYORG numeric-string column → auto-coerce sang number', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: '2500' }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.value).toBe(2500);
    });

    it('Pure MYORG cell null → trả empty string', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', note: null }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","note","N")', ctx);
      expect(result.value).toBe('');
    });

    it('Pure MYORG khớp đúng companyCode (case-sensitive như LOOKUP)', () => {
      // 'PCHN' ≠ 'pchn' → row 'pchn' không match user 'PCHN' → #NOROW!
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'pchn', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOROW!');
    });
  });

  describe('Pure MYORG → error propagation', () => {
    it('templateExists=false → #NOTEMPLATE!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'WRONG',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [],
        templateExists: false,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("WRONG","amount","N")', ctx);
      expect(result.error).toBe('#NOTEMPLATE!');
    });

    it('templateExists=true + rows empty → #NODATA!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NODATA!');
    });

    it('getLookupData undefined (cache miss) → #NODATA!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => undefined);
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NODATA!');
    });

    it('rowCode=companyCode không có trong rows → #NOROW!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHD', amount: 999 }], // PC khác, không phải PCHN
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOROW!');
    });

    it('column không có trong matched row → #NOCOL!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }], // không có 'note'
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","note","N")', ctx);
      expect(result.error).toBe('#NOCOL!');
    });
  });

  describe('Compound MYORG (substitution path)', () => {
    it('Compound MYORG numeric → tham gia phép tính', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N") + 100', ctx);
      expect(result.error).toBeFalsy();
      expect(result.value).toBe(1600);
    });

    it('Compound MYORG: templateExists=false → #NOTEMPLATE! propagate qua expression', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'WRONG',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [],
        templateExists: false,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("WRONG","amount","N") * 2', ctx);
      expect(result.error).toBe('#NOTEMPLATE!');
    });

    it('Compound MYORG: row missing → #NOROW!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHD', amount: 1 }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","amount","N") + 1', ctx);
      expect(result.error).toBe('#NOROW!');
    });
  });

  describe('Year / month offset resolution', () => {
    it('MYORG yearOffset "N-1" truyền effectiveYear = currentYear - 1 đến getLookupData', () => {
      const service = buildService('PCHN');
      const calls: { year: number; month: number | null | undefined }[] = [];
      const ctx: FormulaEntryContext = {
        year: 2026,
        month: 6,
        getLookupData: (_t, year, month) => {
          calls.push({ year, month });
          return {
            templateCode: 'BC01',
            year,
            month: month ?? null,
            orgCode: null,
            rows: [{ row_code: 'PCHN', amount: 1500 }],
            templateExists: true,
          } as LookupData;
        },
      };
      evalMyorg(service, 'MYORG("BC01","amount","N-1")', ctx);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].year).toBe(2025);
    });

    it('MYORG monthOffset "M-3" truyền month = currentMonth - 3', () => {
      const service = buildService('PCHN');
      const calls: { year: number; month: number | null | undefined }[] = [];
      const ctx: FormulaEntryContext = {
        year: 2026,
        month: 6,
        getLookupData: (_t, year, month) => {
          calls.push({ year, month });
          return {
            templateCode: 'BC01',
            year,
            month: month ?? null,
            orgCode: null,
            rows: [{ row_code: 'PCHN', amount: 1500 }],
            templateExists: true,
          } as LookupData;
        },
      };
      evalMyorg(service, 'MYORG("BC01","amount","N","M-3")', ctx);
      expect(calls[0].month).toBe(3);
      expect(calls[0].year).toBe(2026);
    });

    it('MYORG month underflow "M-3" với currentMonth=1 → year-1, month=10', () => {
      const service = buildService('PCHN');
      const calls: { year: number; month: number | null | undefined }[] = [];
      const ctx: FormulaEntryContext = {
        year: 2026,
        month: 1,
        getLookupData: (_t, year, month) => {
          calls.push({ year, month });
          return {
            templateCode: 'BC01',
            year,
            month: month ?? null,
            orgCode: null,
            rows: [{ row_code: 'PCHN', amount: 1500 }],
            templateExists: true,
          } as LookupData;
        },
      };
      evalMyorg(service, 'MYORG("BC01","amount","N","M-3")', ctx);
      // M-3 từ tháng 1 → tháng 10 năm trước (yearAdjust = -1)
      expect(calls[0].year).toBe(2025);
      expect(calls[0].month).toBe(10);
    });

    it('MYORG fixed year "2024" → bypass currentYear', () => {
      const service = buildService('PCHN');
      const calls: { year: number }[] = [];
      const ctx: FormulaEntryContext = {
        year: 2026,
        month: null,
        getLookupData: (_t, year) => {
          calls.push({ year });
          return {
            templateCode: 'BC01',
            year,
            month: null,
            orgCode: null,
            rows: [{ row_code: 'PCHN', amount: 1500 }],
            templateExists: true,
          } as LookupData;
        },
      };
      evalMyorg(service, 'MYORG("BC01","amount","2024")', ctx);
      expect(calls[0].year).toBe(2024);
    });

    it('MYORG syntax sai (yearOffset không parse được) → #SYNTAX!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      // Compound path bắt #SYNTAX! qua setError. Pure path return undefined → fallback
      // substitution → cũng vào path error capture.
      const result = evalMyorg(service, 'MYORG("BC01","amount","INVALID") + 0', ctx);
      expect(result.error).toBe('#SYNTAX!');
    });

    it('MYORG thiếu argument (chỉ 2 args) → #SYNTAX!', () => {
      const service = buildService('PCHN');
      const ctx = makeContext(() => undefined);
      const result = evalMyorg(service, 'MYORG("BC01","amount") + 0', ctx);
      expect(result.error).toBe('#SYNTAX!');
    });
  });

  describe('Builder mode (no entryContext)', () => {
    it('MYORG trong builder (entryContext=null) → strip thành 0, KHÔNG #REF!', () => {
      const service = buildService('PCHN');
      service.setEntryContext(null);
      const mockApi = { getColumns: () => [], forEachNode: () => {} } as any;
      const result = service.evaluateForGraph(
        'MYORG("BC01","amount","N") + 5',
        {
          data: { row_code: 'r1' },
          node: null as any,
          api: mockApi,
          colDef: { field: 'mockField' } as any,
          column: null as any,
          context: null,
          getValue: () => null,
        } as any,
        {},
        () => undefined,
      );
      expect(result.error).toBeFalsy();
      expect(result.value).toBe(5); // MYORG → 0, + 5 = 5
    });
  });

  describe('Compound MYORG cột text → ép numeric (mirror LOOKUP)', () => {
    it('Compound MYORG cột text → text ép Number → NaN → 0, kết quả expression = 100', () => {
      // Pure path đã handle text qua resolvePureCrossEntry. Compound path đi qua
      // extractGetdataValue → Number(text) → '0'. Đảm bảo behavior consistent với LOOKUP.
      const service = buildService('PCHN');
      const ctx = makeContext(() => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', unitName: 'PC Hà Nội' }],
        templateExists: true,
      } as LookupData));
      const result = evalMyorg(service, 'MYORG("BC01","unitName","N") + 100', ctx);
      expect(result.error).toBeFalsy();
      expect(result.value).toBe(100);
    });
  });

  describe('Precedence error code: SYNTAX > NOORG', () => {
    it('Pure MYORG bad syntax + HQ user → #SYNTAX! (KHÔNG #NOORG!)', () => {
      // Regression: pre-fix `resolvePureCrossEntry` trả undefined cho args < 3 →
      // fall through HQ check → false `#NOORG!`. Sau fix: compound path chạy lại,
      // args check thắng → `#SYNTAX!`. Cho user feedback chính xác hơn.
      const service = buildService(null); // HQ user
      const ctx = makeContext(() => undefined);
      const result = evalMyorg(service, 'MYORG("BC01","amount")', ctx);
      expect(result.error).toBe('#SYNTAX!');
    });

    it('Compound MYORG bad syntax + HQ user → #SYNTAX!', () => {
      const service = buildService(null);
      const ctx = makeContext(() => undefined);
      const result = evalMyorg(service, 'MYORG("BC01","amount") + 0', ctx);
      expect(result.error).toBe('#SYNTAX!');
    });

    it('Pure MYORG good syntax + HQ user → #NOORG! (no syntax error to override)', () => {
      const service = buildService(null);
      const ctx = makeContext(() => undefined);
      const result = evalMyorg(service, 'MYORG("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOORG!');
    });
  });
});

/**
 * LOOKUPENTRY = shorthand cho LOOKUP với rowCode = entry.orgCode (entry hiện tại).
 * Khác MYORG ở chỗ rowCode lấy từ entryContext (đổi theo entry mở), KHÔNG phải
 * AuthService (gắn với user login).
 *
 * Test 4 nhóm (mirror MYORG):
 *  - #NOORG! khi entry không có orgCode (HQ scope, report mode, legacy data)
 *  - Pure path: text/numeric raw value
 *  - Substitution path: error capture + arithmetic
 *  - Year/month offset resolution + builder mode + precedence SYNTAX > NOORG
 */
describe('FormulaService — LOOKUPENTRY: rowCode auto từ entry.orgCode', () => {
  function buildService(): FormulaService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      // AuthService mock với companyCode random — verify LOOKUPENTRY KHÔNG đụng đến.
      providers: [{ provide: AuthService, useValue: makeAuthMock('IGNORED_USER_ORG') }],
    });
    return TestBed.inject(FormulaService);
  }

  function evalLookupEntry(
    service: FormulaService,
    formula: string,
    ctx: FormulaEntryContext,
  ) {
    service.setEntryContext(ctx);
    const mockApi = { getColumns: () => [], forEachNode: () => {} } as any;
    return service.evaluateForGraph(
      formula,
      {
        data: { row_code: 'rUnused' },
        node: null as any,
        api: mockApi,
        colDef: { field: 'mockField' } as any,
        column: null as any,
        context: null,
        getValue: () => null,
      } as any,
      {},
      () => undefined,
    );
  }

  function makeContext(
    orgCode: string | null,
    getData: FormulaEntryContext['getLookupData'],
  ): FormulaEntryContext {
    return { year: 2026, month: null, orgCode, getLookupData: getData };
  }

  describe('#NOORG! — entry không có orgCode', () => {
    it('Pure LOOKUPENTRY: orgCode null → #NOORG!', () => {
      const service = buildService();
      const ctx = makeContext(null, () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOORG!');
    });

    it('Compound LOOKUPENTRY: orgCode null → #NOORG! propagate qua expression', () => {
      const service = buildService();
      const ctx = makeContext(null, () => undefined);
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N") + 100', ctx);
      expect(result.error).toBe('#NOORG!');
    });

    it('Pure LOOKUPENTRY: orgCode "" (empty falsy) → #NOORG!', () => {
      const service = buildService();
      const ctx = makeContext('', () => undefined);
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOORG!');
    });
  });

  describe('LOOKUPENTRY KHÔNG đọc AuthService.companyCode (khác MYORG)', () => {
    it('orgCode entry = "PCHN" + companyCode user = "IGNORED_USER_ORG" → match PCHN', () => {
      // Verify isolation: LOOKUPENTRY chỉ đọc entry.orgCode, KHÔNG fallback user companyCode.
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [
          { row_code: 'PCHN', amount: 1500 },
          { row_code: 'IGNORED_USER_ORG', amount: 9999 },
        ],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.value).toBe(1500); // PCHN, không phải 9999
    });
  });

  describe('Pure LOOKUPENTRY → trả raw value', () => {
    it('Pure LOOKUPENTRY numeric → trả number', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.error).toBeFalsy();
      expect(result.value).toBe(1500);
    });

    it('Pure LOOKUPENTRY text column → trả string raw', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', unitName: 'PC Hà Nội' }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","unitName","N")', ctx);
      expect(result.value).toBe('PC Hà Nội');
    });

    it('Pure LOOKUPENTRY case-sensitive matching (giống LOOKUP/MYORG)', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'pchn', amount: 1500 }], // lowercase, không match
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOROW!');
    });
  });

  describe('Pure LOOKUPENTRY → error propagation', () => {
    it('templateExists=false → #NOTEMPLATE!', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'WRONG',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [],
        templateExists: false,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("WRONG","amount","N")', ctx);
      expect(result.error).toBe('#NOTEMPLATE!');
    });

    it('rows empty → #NODATA!', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NODATA!');
    });

    it('orgCode entry không có trong rows → #NOROW!', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHD', amount: 999 }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N")', ctx);
      expect(result.error).toBe('#NOROW!');
    });

    it('column không có trong matched row → #NOCOL!', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","note","N")', ctx);
      expect(result.error).toBe('#NOCOL!');
    });
  });

  describe('Compound LOOKUPENTRY (substitution path)', () => {
    it('Compound numeric → tham gia phép tính', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', amount: 1500 }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N") + 100', ctx);
      expect(result.value).toBe(1600);
    });

    it('Compound text column → ép Number → 0, expression vẫn eval đúng', () => {
      const service = buildService();
      const ctx = makeContext('PCHN', () => ({
        templateCode: 'BC01',
        year: 2026,
        month: null,
        orgCode: null,
        rows: [{ row_code: 'PCHN', unitName: 'PC Hà Nội' }],
        templateExists: true,
      } as LookupData));
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","unitName","N") + 100', ctx);
      expect(result.value).toBe(100);
    });
  });

  describe('Year / month offset', () => {
    it('LOOKUPENTRY yearOffset "N-1" + monthOffset "M-3" truyền đúng', () => {
      const service = buildService();
      const calls: { year: number; month: number | null | undefined }[] = [];
      const ctx: FormulaEntryContext = {
        year: 2026,
        month: 6,
        orgCode: 'PCHN',
        getLookupData: (_t, year, month) => {
          calls.push({ year, month });
          return {
            templateCode: 'BC01',
            year,
            month: month ?? null,
            orgCode: null,
            rows: [{ row_code: 'PCHN', amount: 1500 }],
            templateExists: true,
          } as LookupData;
        },
      };
      evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount","N-1","M-3")', ctx);
      expect(calls[0].year).toBe(2025);
      expect(calls[0].month).toBe(3);
    });
  });

  describe('Builder mode (no entryContext)', () => {
    it('LOOKUPENTRY trong builder → strip thành 0, KHÔNG #REF!', () => {
      const service = buildService();
      service.setEntryContext(null);
      const mockApi = { getColumns: () => [], forEachNode: () => {} } as any;
      const result = service.evaluateForGraph(
        'LOOKUPENTRY("BC01","amount","N") + 5',
        {
          data: { row_code: 'r1' },
          node: null as any,
          api: mockApi,
          colDef: { field: 'mockField' } as any,
          column: null as any,
          context: null,
          getValue: () => null,
        } as any,
        {},
        () => undefined,
      );
      expect(result.error).toBeFalsy();
      expect(result.value).toBe(5);
    });
  });

  describe('Precedence error code: SYNTAX > NOORG', () => {
    it('Pure LOOKUPENTRY bad syntax + orgCode null → #SYNTAX! (KHÔNG #NOORG!)', () => {
      const service = buildService();
      const ctx = makeContext(null, () => undefined);
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount")', ctx);
      expect(result.error).toBe('#SYNTAX!');
    });

    it('Compound LOOKUPENTRY bad syntax + orgCode null → #SYNTAX!', () => {
      const service = buildService();
      const ctx = makeContext(null, () => undefined);
      const result = evalLookupEntry(service, 'LOOKUPENTRY("BC01","amount") + 0', ctx);
      expect(result.error).toBe('#SYNTAX!');
    });
  });
});
