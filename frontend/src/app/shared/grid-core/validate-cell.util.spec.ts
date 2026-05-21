/**
 * Bug 3 regression: cell EMPTY (null/undefined/'') với rule có min/max/pattern
 * không được trigger error → false positive border đỏ. Chỉ `required` check empty.
 */

import { validateCellValue } from './validate-cell.util';

describe('validateCellValue — empty cell behavior (Bug 3)', () => {
  it('null value + min=5 → valid (skip min check)', () => {
    expect(validateCellValue(null, { min: 5 }).valid).toBe(true);
  });

  it('undefined value + min=5 → valid', () => {
    expect(validateCellValue(undefined, { min: 5 }).valid).toBe(true);
  });

  it('empty string + min=5 → valid', () => {
    expect(validateCellValue('', { min: 5 }).valid).toBe(true);
  });

  it('null value + required → invalid (Bắt buộc nhập)', () => {
    const r = validateCellValue(null, { required: true });
    expect(r.valid).toBe(false);
    expect(r.message).toBe('Bắt buộc nhập');
  });

  it('null value + required + min=5 → required wins', () => {
    const r = validateCellValue(null, { required: true, min: 5 });
    expect(r.valid).toBe(false);
    expect(r.message).toBe('Bắt buộc nhập');
  });

  it('value=0 + required → VALID (số 0 là số hợp lệ, không phải empty)', () => {
    // Excel-like: 0 là dữ liệu user đã nhập. Required chỉ fail khi null/undefined/''.
    // Để cấm 0, dùng `min: 1` riêng.
    const r = validateCellValue(0, { required: true });
    expect(r.valid).toBe(true);
  });

  it('value=0 + min=5 → invalid (0 < 5, empty check không apply vì 0 ≠ null/undefined/"")', () => {
    expect(validateCellValue(0, { min: 5 }).valid).toBe(false);
  });

  it('value=10 + min=5 + max=10 → valid (Bug 3 confirm)', () => {
    expect(validateCellValue(10, { min: 5, max: 10 }).valid).toBe(true);
  });

  it('value=7 + min=5 + max=10 → valid', () => {
    expect(validateCellValue(7, { min: 5, max: 10 }).valid).toBe(true);
  });

  it('value=3 + min=5 + max=10 → invalid với errorMessage', () => {
    const r = validateCellValue(3, {
      min: 5,
      max: 10,
      errorMessage: 'Giá trị tối thiểu 5, tối đa là 10',
    });
    expect(r.valid).toBe(false);
    expect(r.message).toBe('Giá trị tối thiểu 5, tối đa là 10');
  });

  it('value=15 + min=5 + max=10 → invalid', () => {
    expect(validateCellValue(15, { min: 5, max: 10 }).valid).toBe(false);
  });

  it('value="abc" + min=5 → valid (Number(abc)=NaN, skip min)', () => {
    expect(validateCellValue('abc', { min: 5 }).valid).toBe(true);
  });

  it('null + pattern → valid (skip pattern when empty)', () => {
    expect(validateCellValue(null, { pattern: '^[A-Z]+$' }).valid).toBe(true);
  });

  it('"abc" + pattern=^[A-Z]+$ → invalid', () => {
    const r = validateCellValue('abc', { pattern: '^[A-Z]+$' });
    expect(r.valid).toBe(false);
    expect(r.message).toBe('Không đúng định dạng');
  });

  it('"ABC" + pattern=^[A-Z]+$ → valid', () => {
    expect(validateCellValue('ABC', { pattern: '^[A-Z]+$' }).valid).toBe(true);
  });

  it('null + minDate → valid (skip)', () => {
    expect(validateCellValue(null, { minDate: '2026-01-01' }).valid).toBe(true);
  });

  it('"2025-12-15" + minDate="2026-01-01" → invalid', () => {
    const r = validateCellValue('2025-12-15', { minDate: '2026-01-01' });
    expect(r.valid).toBe(false);
    expect(r.message).toBe('Ngày tối thiểu: 01/01/2026');
  });

  it('no rule → always valid', () => {
    expect(validateCellValue(null, undefined).valid).toBe(true);
    expect(validateCellValue(0, undefined).valid).toBe(true);
    expect(validateCellValue('any', undefined).valid).toBe(true);
  });
});
