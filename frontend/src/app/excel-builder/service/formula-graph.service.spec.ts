/**
 * Integration test cho FormulaGraphService — verify full pipeline end-to-end:
 * setColumnDefs → setRawData → buildGraph → recomputeAll → shadow values.
 *
 * Mục tiêu chính: catch regression khi refactor engine. Đặc biệt sau khi decouple
 * formula eval khỏi `gridApi.forEachNode` (synthetic API proxy đọc từ rawData
 * snapshot), test này verify rằng:
 *   1. Multi-tier formula chain eval đúng (deps-first qua topo sort).
 *   2. Aggregate (SUM, SUMIF, AVG, ...) iterate đúng rows từ rawData.
 *   3. Cell-level override thắng column-level.
 *   4. Self-dep filter không gây false `#CIRCULAR!`.
 *   5. Edit cell → recomputeAffected propagate đúng tới dependents (BFS reverse-deps).
 *   6. Excel coord (`J1`) resolve đúng index.
 *   7. ROW_COL/COL/ROW tier resolution đúng.
 *
 * Dùng TEST_FORMULA template setup (giống `seed_test_formula_template.sql`) —
 * expected values match SQL seed.
 */

import { TestBed } from '@angular/core/testing';
import { FormulaGraphService } from './formula-graph.service';
import { AuthService } from '../../auth/auth.service';
import { makeAuthMock } from '../../auth/auth.mock';

// FormulaService inject AuthService cho MYORG → cần mock để không cần HttpClient.
// `null` = HQ user; tests ở đây không sử dụng MYORG nên đủ. Test mới có MYORG cần
// override per-test bằng `makeAuthMock('PCHN')`.
const mockAuthService = makeAuthMock(null);

describe('FormulaGraphService — integration (full eval pipeline)', () => {
  let service: FormulaGraphService;

  /** Setup mirror TEST_FORMULA template (xem seed_test_formula_template.sql). */
  function setupTestFormulaTemplate(): void {
    service.setColMap({
      A: 'stt', B: 'name', C: 'qty', D: 'price', E: 'revenue',
      F: 'discount', G: 'net', H: 'tier',
    });
    service.setColumnDefs([
      { field: 'stt', dataType: 'text' },
      { field: 'name', dataType: 'text' },
      { field: 'qty', dataType: 'number' },
      { field: 'price', dataType: 'number' },
      { field: 'revenue', dataType: 'number', formula: 'qty * price' },
      { field: 'discount', dataType: 'number' },
      { field: 'net', dataType: 'number', formula: 'revenue - revenue * discount' },
      { field: 'tier', dataType: 'text' },
    ]);
    const rows = [
      { row_code: 'r1', stt: 1, name: 'Item A', qty: 10, price: 100, discount: 0.1, tier: 'A' },
      { row_code: 'r2', stt: 2, name: 'Item B', qty: 5, price: 200, discount: 0, tier: 'B' },
      { row_code: 'r3', stt: 3, name: 'Item C', qty: 8, price: 150, discount: 0.05, tier: 'A' },
      { row_code: 'r4', stt: 4, name: 'Item D', qty: 3, price: 300, discount: 0.2, tier: 'B' },
      {
        row_code: 'rSum', stt: 'Σ', name: 'Tổng',
        _cellConfig: {
          qty: { formula: 'SUM(qty, r1, r4)' },
          price: { formula: 'SUM(price, r1, r4)' },
          revenue: { formula: 'SUM(revenue, r1, r4)' },
          net: { formula: 'SUM(net, r1, r4)' },
        },
      },
      {
        row_code: 'rAvg', stt: 'x̄', name: 'TB',
        _cellConfig: {
          qty: { formula: 'AVGROW(qty, r1, r4)' },
          price: { formula: '(r1_price + r2_price + r3_price + r4_price) / 4' },
          revenue: { formula: 'AVGROW(revenue, r1, r4)' },
          net: { formula: 'AVGCOL(qty, net, r1)' },
        },
      },
      {
        row_code: 'rTier', stt: 'A/B', name: 'tier',
        _cellConfig: {
          qty: { formula: 'SUMIF(qty, tier, "A")' },
          price: { formula: 'COUNTIF(tier, "A")' },
          revenue: { formula: 'SUMIF(revenue, tier, "A")' },
          net: { formula: 'SUMIF(net, tier, "B")' },
        },
      },
      {
        row_code: 'rExcel', stt: 'E', name: 'Excel',
        _cellConfig: {
          qty: { formula: 'C1 + C2' },
          price: { formula: 'D2 + D3' },
          revenue: { formula: 'SUMCOL(qty, price, r3)' },
          discount: { formula: 'r1_qty * 50%' },
          net: { formula: 'VLOOKUP(r4, revenue)' },
        },
      },
      {
        row_code: 'rMath', stt: 'M', name: 'Math',
        _cellConfig: {
          qty: { formula: 'IF(rSum_revenue > 4000, 1, 0)' },
          price: { formula: 'MAX(r1, r2, r3, r4)' },
          revenue: { formula: 'MIN(r1, r2, r3, r4)' },
          discount: { formula: 'SUMALL(qty)' },
          net: { formula: 'ROUND(rAvg_revenue * 1.5, 0)' },
        },
      },
    ];
    service.setRowOrder(rows.map(r => r.row_code));
    service.setRawData(rows);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    });
    service = TestBed.inject(FormulaGraphService);
    service.clear();
    setupTestFormulaTemplate();
  });

  describe('Tier 2 COL refs (column-level formula)', () => {
    it('r1.revenue = qty * price = 10*100 = 1000', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('r1', 'revenue')).toBe(1000);
    });

    it('all 4 data rows compute revenue correctly', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('r1', 'revenue')).toBe(1000);
      expect(service.getValue('r2', 'revenue')).toBe(1000);
      expect(service.getValue('r3', 'revenue')).toBe(1200);
      expect(service.getValue('r4', 'revenue')).toBe(900);
    });

    it('r1.net = revenue - revenue * discount = 1000 - 100 = 900', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('r1', 'net')).toBe(900);
      expect(service.getValue('r2', 'net')).toBe(1000);
      expect(service.getValue('r3', 'net')).toBe(1140);
      expect(service.getValue('r4', 'net')).toBe(720);
    });
  });

  describe('Multi-tier chain (Tier 2 → Tier 3 deep deps)', () => {
    it('rSum.revenue = SUM(revenue, r1, r4) = 4100 (deps depth 2: SUM → r*.revenue → r*.qty/price)', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rSum', 'revenue')).toBe(4100);
    });

    it('rSum.net = SUM(net, r1, r4) = 3760 (deps depth 3: SUM → r*.net → r*.revenue → r*.qty/price)', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rSum', 'net')).toBe(3760);
    });

    it('rMath.net = ROUND(rAvg_revenue * 1.5, 0) = 1538 (deps depth 4)', () => {
      // Chain: rMath.net → rAvg.revenue → AVGROW(revenue, r1..r4) → r*.revenue → r*.qty/price
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rMath', 'net')).toBe(1538);
    });
  });

  describe('Aggregate functions iterate rawData (proxy path)', () => {
    it('SUM(field, fromRow, toRow) inclusive', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rSum', 'qty')).toBe(26);   // 10+5+8+3
      expect(service.getValue('rSum', 'price')).toBe(750); // 100+200+150+300
    });

    it('SUMIF condField filtering', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rTier', 'qty')).toBe(18);    // r1.qty + r3.qty (tier=A)
      expect(service.getValue('rTier', 'revenue')).toBe(2200); // r1+r3 revenue
      expect(service.getValue('rTier', 'net')).toBe(1720);  // r2+r4 (tier=B)
    });

    it('COUNTIF count by condition', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rTier', 'price')).toBe(2); // 2 rows with tier=A
    });

    it('AVGROW = SUM / count', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rAvg', 'qty')).toBe(6.5);
      expect(service.getValue('rAvg', 'revenue')).toBe(1025);
    });

    it('AVGCOL across cols of single row', () => {
      service.buildGraph();
      service.recomputeAll();
      // AVGCOL(qty, net, r1) = avg(r1.qty=10, r1.price=100, r1.revenue=1000, r1.discount=0.1, r1.net=900) = 2010.1/5
      expect(service.getValue('rAvg', 'net')).toBeCloseTo(402.02, 2);
    });

    it('SUMCOL across cols of single row', () => {
      service.buildGraph();
      service.recomputeAll();
      // SUMCOL(qty, price, r3) = r3.qty + r3.price = 8 + 150 = 158
      expect(service.getValue('rExcel', 'revenue')).toBe(158);
    });

    it('SUMALL sums all rows including computed ones', () => {
      service.buildGraph();
      service.recomputeAll();
      // r1..r4 qty: 10+5+8+3=26
      // rSum.qty=26, rAvg.qty=6.5, rTier.qty=18, rExcel.qty=15, rMath.qty=1
      // Total = 26+26+6.5+18+15+1 = 92.5
      expect(service.getValue('rMath', 'discount')).toBe(92.5);
    });

    it('VLOOKUP single-cell lookup', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rExcel', 'net')).toBe(900); // r4.revenue
    });
  });

  describe('Tier 1 ROW_COL refs', () => {
    it('rAvg.price = (r1_price + r2_price + r3_price + r4_price) / 4 = 187.5', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rAvg', 'price')).toBe(187.5);
    });
  });

  describe('Tier 3 ROW refs (current col)', () => {
    it('rMath.price = MAX(r1, r2, r3, r4) for current col=price → 300', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rMath', 'price')).toBe(300);
      expect(service.getValue('rMath', 'revenue')).toBe(900); // MIN over revenue
    });
  });

  describe('Tier 4 EXCEL coord refs', () => {
    it('C1 + C2 → r1.qty + r2.qty = 15 (rowOrder index 0,1)', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rExcel', 'qty')).toBe(15);
    });

    it('D2 + D3 → r2.price + r3.price = 350', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rExcel', 'price')).toBe(350);
    });
  });

  describe('Percentage operator', () => {
    it('r1_qty * 50% = 10 * 0.5 = 5', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rExcel', 'discount')).toBe(5);
    });
  });

  describe('IF / Math functions', () => {
    it('IF(rSum_revenue > 4000, 1, 0) = 1 (4100 > 4000)', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rMath', 'qty')).toBe(1);
    });
  });

  describe('Cell-level override wins column-level', () => {
    it('rSum.revenue uses cell-level SUM (4100), KHÔNG dùng column-level qty*price (=19500)', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rSum', 'revenue')).toBe(4100);
    });
  });

  describe('Cycle detection (no false-positive)', () => {
    it('SUMIF tại (rTier, qty) KHÔNG bị false #CIRCULAR! (self-dep filtered)', () => {
      service.buildGraph();
      const cycles = service.getCycles();
      const hasCycleForRTierQty = cycles.some(cycle =>
        cycle.some(ref => ref.rowCode === 'rTier' && ref.field === 'qty'),
      );
      expect(hasCycleForRTierQty).toBe(false);
      service.recomputeAll();
      expect(service.getValue('rTier', 'qty')).toBe(18); // không phải '#CIRCULAR!'
    });
  });

  describe('Incremental recompute (recomputeAffected)', () => {
    it('Edit r1.qty → rSum.qty/revenue/net cascade update', () => {
      service.buildGraph();
      service.recomputeAll();
      expect(service.getValue('rSum', 'qty')).toBe(26);

      // Mutate raw data (simulate AG Grid valueSetter)
      const r1 = service['rawData'].find((r: any) => r.row_code === 'r1');
      r1.qty = 20; // was 10
      service.setData('r1', 'qty', 20);

      // rSum.qty = 20+5+8+3 = 36
      expect(service.getValue('rSum', 'qty')).toBe(36);
      // r1.revenue = 20*100 = 2000 → rSum.revenue = 2000+1000+1200+900 = 5100
      expect(service.getValue('r1', 'revenue')).toBe(2000);
      expect(service.getValue('rSum', 'revenue')).toBe(5100);
    });

    it('getDependentFields trả đúng tập columns cần refresh', () => {
      service.buildGraph();
      service.recomputeAll();
      const fields = service.getDependentFields('r1', 'qty');
      // r1.qty đụng đến: r1.revenue (col formula), r1.net (col formula),
      // rSum.qty/revenue/net, rAvg.qty/price (no — price uses r1_price)/revenue/net,
      // rTier.qty/revenue/net (SUMIF), rExcel.qty (C1+C2), rExcel.discount (r1_qty),
      // rMath qty/price/revenue/discount/net (deep chain via SUMALL/MAX/...)
      // Quan trọng: tập này KHÔNG rỗng và bao gồm 'revenue' và 'net'.
      expect(fields).toContain('revenue');
      expect(fields).toContain('net');
      expect(fields).toContain('qty');
    });
  });

  describe('Stability — repeated buildGraph + recomputeAll', () => {
    it('Build + recompute 10 lần → kết quả stable', () => {
      for (let i = 0; i < 10; i++) {
        service.buildGraph();
        service.recomputeAll();
        expect(service.getValue('rSum', 'revenue')).toBe(4100);
        expect(service.getValue('rMath', 'net')).toBe(1538);
      }
    });
  });
});
