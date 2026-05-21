/**
 * Targeted regression tests cho FormulaService.
 *
 * Không cover full evaluate path (cần AG Grid params giả lập phức tạp). Chỉ test
 * các regex / parser behavior dễ regress.
 */

import { TestBed } from '@angular/core/testing';
import { FormulaService } from './formula.service';
import { AuthService } from '../../auth/auth.service';
import { makeAuthMock } from '../../auth/auth.mock';

describe('FormulaService — regex collision regressions', () => {
  // BUG: regex `LOOKUP\s*\(` từng match cả `LOOKUP(` BÊN TRONG `VLOOKUP(...)` →
  // resolveLookup strip nhầm arg của VLOOKUP, residue còn `V0` → tokenizer fail
  // → false `#REF!`. Fix: dùng `\bLOOKUP\s*\(` để require word boundary trước L.

  describe('LOOKUP regex word boundary (must NOT match VLOOKUP)', () => {
    const lookupRegex = /\bLOOKUP\s*\(([^)]+)\)/g;

    it('matches standalone LOOKUP', () => {
      const formula = 'LOOKUP("VAT", "r1", "X", "N")';
      const matches = [...formula.matchAll(lookupRegex)];
      expect(matches.length).toBe(1);
      expect(matches[0][0]).toBe('LOOKUP("VAT", "r1", "X", "N")');
    });

    it('does NOT match VLOOKUP (regression: was matching LOOKUP inside VLOOKUP)', () => {
      const formula = 'VLOOKUP(r4, revenue)';
      const matches = [...formula.matchAll(lookupRegex)];
      expect(matches.length).toBe(0);
    });

    it('matches LOOKUP but skips VLOOKUP in same formula', () => {
      const formula = 'LOOKUP("X", "r1", "f", "N") + VLOOKUP(r2, qty)';
      const matches = [...formula.matchAll(lookupRegex)];
      expect(matches.length).toBe(1);
      expect(matches[0][0]).toContain('"X"');
    });

    it('matches LOOKUP after operators / punctuation', () => {
      const formula = '5 * LOOKUP("a","b","c","N") + 3';
      const matches = [...formula.matchAll(lookupRegex)];
      expect(matches.length).toBe(1);
    });
  });

  // MYORG = shorthand cho LOOKUP với rowCode = currentUser.companyCode. Regex pattern
  // dùng `\bMYORG\s*\(` — word boundary phòng future collision (vd hypothetical XMYORG).
  describe('MYORG regex word boundary', () => {
    const myorgRegex = /\bMYORG\s*\(([^)]+)\)/g;

    it('matches standalone MYORG', () => {
      const formula = 'MYORG("BC01","amount","N")';
      const matches = [...formula.matchAll(myorgRegex)];
      expect(matches.length).toBe(1);
      expect(matches[0][0]).toBe('MYORG("BC01","amount","N")');
    });

    it('matches MYORG with month offset', () => {
      const formula = 'MYORG("BC01","amount","N-1","M-3")';
      const matches = [...formula.matchAll(myorgRegex)];
      expect(matches.length).toBe(1);
    });

    it('matches MYORG sau toán tử', () => {
      const formula = '100 + MYORG("BC01","amount","N") * 2';
      const matches = [...formula.matchAll(myorgRegex)];
      expect(matches.length).toBe(1);
    });

    it('case-insensitive flag — formula service canonicalize trước eval', () => {
      // Regex \b match exact 'MYORG' (case-sensitive). FormulaService gọi
      // canonicalizeFunctionNames() trước khi resolveMyorg → 'myorg(' → 'MYORG('.
      const formula = 'myorg("BC01","amount","N")'.replace(/\bmyorg\s*\(/gi, 'MYORG(');
      const matches = [...formula.matchAll(myorgRegex)];
      expect(matches.length).toBe(1);
    });

    it('MYORG cùng formula với LOOKUP + GETDATA — cả 3 regex đều match riêng phần của mình', () => {
      const formula = 'GETDATA("A","x","N") + LOOKUP("B","r1","y","N") + MYORG("C","z","N")';
      const myorgMatches = [...formula.matchAll(myorgRegex)];
      const lookupMatches = [...formula.matchAll(/\bLOOKUP\s*\(([^)]+)\)/g)];
      const getdataMatches = [...formula.matchAll(/GETDATA\s*\(([^)]+)\)/g)];
      expect(myorgMatches.length).toBe(1);
      expect(lookupMatches.length).toBe(1);
      expect(getdataMatches.length).toBe(1);
      expect(myorgMatches[0][0]).toContain('"C"');
    });
  });

  // LOOKUPENTRY = shorthand cho LOOKUP với rowCode = entry.orgCode (entry hiện tại).
  // Regex `\bLOOKUPENTRY\s*\(`. Critical: KHÔNG match nhầm với regex `\bLOOKUP\s*\(`.
  describe('LOOKUPENTRY regex word boundary', () => {
    const lookupEntryRegex = /\bLOOKUPENTRY\s*\(([^)]+)\)/g;
    const lookupRegex = /\bLOOKUP\s*\(([^)]+)\)/g;

    it('matches standalone LOOKUPENTRY', () => {
      const formula = 'LOOKUPENTRY("BC01","amount","N")';
      const matches = [...formula.matchAll(lookupEntryRegex)];
      expect(matches.length).toBe(1);
      expect(matches[0][0]).toBe('LOOKUPENTRY("BC01","amount","N")');
    });

    it('regex `\\bLOOKUP\\s*\\(` KHÔNG match `LOOKUPENTRY(` (regression)', () => {
      // Critical: sau LOOKUP là `E` (word char), `\s*\(` không match → safe.
      // Nếu fail: LOOKUP regex strip nhầm args LOOKUPENTRY, layout sai (LOOKUP minArgs=4
      // vs LOOKUPENTRY=3) → corrupted parse.
      const formula = 'LOOKUPENTRY("BC01","amount","N")';
      const lookupMatches = [...formula.matchAll(lookupRegex)];
      expect(lookupMatches.length).toBe(0);
    });

    it('matches LOOKUPENTRY with month offset', () => {
      const formula = 'LOOKUPENTRY("BC01","amount","N-1","M-3")';
      const matches = [...formula.matchAll(lookupEntryRegex)];
      expect(matches.length).toBe(1);
    });

    it('matches LOOKUPENTRY sau toán tử', () => {
      const formula = '100 + LOOKUPENTRY("BC01","amount","N") * 2';
      const matches = [...formula.matchAll(lookupEntryRegex)];
      expect(matches.length).toBe(1);
    });

    it('LOOKUPENTRY cùng formula với LOOKUP + MYORG + GETDATA — cả 4 regex match riêng phần', () => {
      const formula = 'GETDATA("A","x","N") + LOOKUP("B","r1","y","N") + MYORG("C","z","N") + LOOKUPENTRY("D","w","N")';
      const lookupEntryMatches = [...formula.matchAll(lookupEntryRegex)];
      const lookupMatches = [...formula.matchAll(lookupRegex)];
      const myorgMatches = [...formula.matchAll(/\bMYORG\s*\(([^)]+)\)/g)];
      const getdataMatches = [...formula.matchAll(/GETDATA\s*\(([^)]+)\)/g)];
      expect(lookupEntryMatches.length).toBe(1);
      expect(lookupMatches.length).toBe(1); // LOOKUP("B"...) — KHÔNG match LOOKUPENTRY
      expect(myorgMatches.length).toBe(1);
      expect(getdataMatches.length).toBe(1);
      expect(lookupEntryMatches[0][0]).toContain('"D"');
    });
  });
});

/**
 * `validate()` strip GETDATA/LOOKUP/MYORG trước khi tokenize references. Pre-fix,
 * regex `LOOKUP\s*\(` không có `\b` → match nhầm bên trong `VLOOKUP(...)` →
 * residue token `V` không tìm thấy → trả `#REF!` → user KHÔNG save được formula
 * VLOOKUP hợp lệ. Test verify fix.
 */
describe('FormulaService.validate — VLOOKUP không bị strip nhầm', () => {
  let service: FormulaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: makeAuthMock(null) }],
    });
    service = TestBed.inject(FormulaService);
  });

  it('VLOOKUP(r4, revenue) hợp lệ → valid (regression: từng false `#REF!`)', () => {
    const result = service.validate(
      'VLOOKUP(r4, revenue)',
      { A: 'stt', B: 'name', E: 'revenue' },
      ['stt', 'name', 'revenue'],
      ['r1', 'r2', 'r3', 'r4'],
    );
    expect(result.valid).toBe(true);
  });

  it('LOOKUP("X","r1","f","N") hợp lệ — vẫn được strip đúng', () => {
    const result = service.validate(
      'LOOKUP("X","r1","f","N")',
      { A: 'stt' },
      ['stt'],
      ['r1'],
    );
    expect(result.valid).toBe(true);
  });

  it('MYORG("X","f","N") hợp lệ — strip đúng dù không có column matching', () => {
    const result = service.validate(
      'MYORG("X","f","N")',
      { A: 'stt' },
      ['stt'],
      ['r1'],
    );
    expect(result.valid).toBe(true);
  });

  it('Compound VLOOKUP + LOOKUP + MYORG — tất cả pass', () => {
    const result = service.validate(
      'VLOOKUP(r1, revenue) + LOOKUP("X","r1","f","N") + MYORG("Y","f","N")',
      { A: 'revenue' },
      ['revenue'],
      ['r1'],
    );
    expect(result.valid).toBe(true);
  });

  it('LOOKUPENTRY("X","f","N") hợp lệ — strip đúng', () => {
    const result = service.validate(
      'LOOKUPENTRY("X","f","N")',
      { A: 'stt' },
      ['stt'],
      ['r1'],
    );
    expect(result.valid).toBe(true);
  });

  it('Compound đầy đủ VLOOKUP + LOOKUP + MYORG + LOOKUPENTRY — tất cả pass', () => {
    const result = service.validate(
      'VLOOKUP(r1, revenue) + LOOKUP("X","r1","f","N") + MYORG("Y","f","N") + LOOKUPENTRY("Z","f","N")',
      { A: 'revenue' },
      ['revenue'],
      ['r1'],
    );
    expect(result.valid).toBe(true);
  });
});
