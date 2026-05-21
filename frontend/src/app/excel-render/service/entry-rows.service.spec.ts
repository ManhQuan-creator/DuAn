import { TestBed } from '@angular/core/testing';
import { EntryRowsService } from './entry-rows.service';

describe('EntryRowsService', () => {
  let service: EntryRowsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EntryRowsService] });
    service = TestBed.inject(EntryRowsService);
  });

  describe('captureOriginal + isCellFormulaModified', () => {
    it('captureOriginal deep-clone: mutate row sau capture không ảnh hưởng original', () => {
      const rows = [
        { row_code: 'R1', _cellConfig: { amount: { formula: 'A + B' } } },
      ];
      service.captureOriginal(rows);

      // Mutate row sau capture
      rows[0]._cellConfig.amount.formula = 'X * Y';

      const orig = service.getOriginalCellConfig('R1');
      expect(orig.amount.formula).toBe('A + B');
    });

    it('isCellFormulaModified true khi formula khác, false khi cùng', () => {
      service.captureOriginal([
        { row_code: 'R1', _cellConfig: { amount: { formula: 'A + B' } } },
      ]);

      expect(service.isCellFormulaModified('R1', 'amount', { amount: { formula: 'A + B' } })).toBe(false);
      expect(service.isCellFormulaModified('R1', 'amount', { amount: { formula: 'X * Y' } })).toBe(true);
    });

    it('isCellFormulaModified: cả 2 null/undefined → false', () => {
      service.captureOriginal([{ row_code: 'R1' }]);
      expect(service.isCellFormulaModified('R1', 'amount', undefined)).toBe(false);
      expect(service.isCellFormulaModified('R1', 'amount', null)).toBe(false);
      expect(service.isCellFormulaModified('R1', 'amount', {})).toBe(false);
    });

    it('isCellFormulaModified: original không có formula, current có → true', () => {
      service.captureOriginal([{ row_code: 'R1' }]);
      expect(service.isCellFormulaModified('R1', 'amount', { amount: { formula: 'NEW' } })).toBe(true);
    });

    it('isCellFormulaModified: original có formula, current xóa → true', () => {
      service.captureOriginal([
        { row_code: 'R1', _cellConfig: { amount: { formula: 'OLD' } } },
      ]);
      expect(service.isCellFormulaModified('R1', 'amount', {})).toBe(true);
    });
  });

  describe('hasOriginalCellConfig', () => {
    it('trả true khi rowCode có snapshot', () => {
      service.captureOriginal([
        { row_code: 'R1', _cellConfig: { x: { formula: 'A' } } },
      ]);
      expect(service.hasOriginalCellConfig('R1')).toBe(true);
    });

    it('trả false khi rowCode không có snapshot (chưa từng capture)', () => {
      expect(service.hasOriginalCellConfig('UNKNOWN')).toBe(false);
    });

    it('trả false khi rowCode tồn tại nhưng không có _cellConfig (skip lúc capture)', () => {
      service.captureOriginal([{ row_code: 'R1' }]);
      expect(service.hasOriginalCellConfig('R1')).toBe(false);
    });
  });

  describe('reset', () => {
    it('reset clear toàn bộ snapshot', () => {
      service.captureOriginal([
        { row_code: 'R1', _cellConfig: { x: { formula: 'A' } } },
      ]);
      service.reset();
      expect(service.hasOriginalCellConfig('R1')).toBe(false);
    });
  });

  describe('isCustomRow', () => {
    it('đọc thẳng flag _isCustomRow', () => {
      expect(service.isCustomRow({ _isCustomRow: true })).toBe(true);
      expect(service.isCustomRow({ _isCustomRow: false })).toBe(false);
      expect(service.isCustomRow({})).toBe(false);
      expect(service.isCustomRow(null)).toBe(false);
    });
  });

  describe('validateRowOrder', () => {
    it('rowData rỗng → invalid', () => {
      const result = service.validateRowOrder([]);
      expect(result.ok).toBe(false);
    });

    it('rowData không rỗng → valid (spec hiện tại không cấm gì khác)', () => {
      const result = service.validateRowOrder([{ row_code: 'R1' }]);
      expect(result.ok).toBe(true);
    });
  });
});
