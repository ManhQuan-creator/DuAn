import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BcDtxdThaBaseService,
  LoadedEntry,
  TEMPLATE_CODES,
} from '../shared/bc-dtxd-tha-base.service';
import {
  PL179_GROUPS,
  PL179_TONG_CONG,
  Pl179GroupBreakdown,
  Pl179Kpi,
  Pl179Row,
  Pl179UnitBreakdown,
} from './pl179.model';

/**
 * Service domain cho PL179. Wrap BcDtxdThaBaseService, cung cấp:
 *  - loadEntry(year) → latest entry trong năm
 *  - buildKpi(row) → KPI cards từ 1 row đã chọn (TONG_CONG hoặc PC)
 *  - buildGroupBreakdown(row) → 7 nhóm leaf cho donut + bar
 *  - buildUnitBreakdown(rows) → top 15 PC theo TMĐT
 */
@Injectable({ providedIn: 'root' })
export class Pl179DataService {
  private readonly base = inject(BcDtxdThaBaseService);

  loadEntry(year: number): Observable<LoadedEntry<Pl179Row>> {
    return this.base.loadEntry<Pl179Row>(TEMPLATE_CODES.M20, year);
  }

  /** Row TONG_CONG (header) — dùng khi không filter đơn vị. */
  findTongCong(rows: Pl179Row[]): Pl179Row | undefined {
    return rows.find(r => r?.row_code === PL179_TONG_CONG);
  }

  /** Tất cả PC rows (loại header + loại row tổng cộng). */
  pcRows(rows: Pl179Row[]): Pl179Row[] {
    return rows.filter(r => r && !r._isTypeHeader && r.row_code !== PL179_TONG_CONG);
  }

  /** Build KPI từ 1 row đã chọn. `null` row → KPI = 0. */
  buildKpi(row: Pl179Row | null | undefined, allRows: Pl179Row[]): Pl179Kpi {
    if (!row) {
      return { tongSoCT: 0, tongTmdt: 0, tongHt: 0, tyleHt: null, soDonViBaoCao: 0 };
    }
    const cnSoCT = this.num(row.cnSoCT);
    const cnTmdt = this.num(row.cnTmdt);
    const cnHt   = this.num(row.cnHt);
    const tyleHt = this.tyle(row.cnTyleHt, cnHt, cnSoCT);
    const soDonViBaoCao = this.pcRows(allRows)
      .filter(r => this.num(r.cnSoCT) > 0)
      .length;
    return { tongSoCT: cnSoCT, tongTmdt: cnTmdt, tongHt: cnHt, tyleHt, soDonViBaoCao };
  }

  /** Breakdown 7 nhóm leaf (filter slice > 0). */
  buildGroupBreakdown(row: Pl179Row | null | undefined): Pl179GroupBreakdown[] {
    if (!row) return [];
    const breakdowns: Pl179GroupBreakdown[] = [];
    for (const g of PL179_GROUPS) {
      const soCT   = this.num(row[`${g.prefix}SoCT`]);
      const tmdt   = this.num(row[`${g.prefix}Tmdt`]);
      const ht     = this.num(row[`${g.prefix}Ht`]);
      const chuaHt = this.num(row[`${g.prefix}ChuaHt`]);
      if (soCT === 0 && tmdt === 0) continue;
      const tyleHt = this.tyle(row[`${g.prefix}TyleHt`], ht, soCT);
      breakdowns.push({
        prefix: g.prefix, label: g.label,
        soCT, tmdt, ht, chuaHt, tyleHt,
      });
    }
    return breakdowns;
  }

  /** Breakdown theo đơn vị (sort desc theo cnTmdt). */
  buildUnitBreakdown(rows: Pl179Row[]): Pl179UnitBreakdown[] {
    return this.pcRows(rows)
      .map(r => ({
        unit: String(r.donVi ?? '').trim() || '(Chưa rõ)',
        cnSoCT:   this.num(r.cnSoCT),
        cnTmdt:   this.num(r.cnTmdt),
        cnHt:     this.num(r.cnHt),
        cnChuaHt: this.num(r.cnChuaHt),
        cnTyleHt: this.tyle(r.cnTyleHt, this.num(r.cnHt), this.num(r.cnSoCT)),
      }))
      .filter(u => u.cnSoCT > 0 || u.cnTmdt > 0)
      .sort((a, b) => b.cnTmdt - a.cnTmdt);
  }

  /** Lấy unique tên đơn vị từ rows (cho dropdown filter). */
  buildUnitNames(rows: Pl179Row[]): string[] {
    const names = new Set<string>();
    for (const r of this.pcRows(rows)) {
      const u = String(r.donVi ?? '').trim();
      if (u) names.add(u);
    }
    return Array.from(names).sort();
  }

  /** Find row theo tên đơn vị. */
  findUnitRow(rows: Pl179Row[], unit: string): Pl179Row | undefined {
    return this.pcRows(rows).find(
      r => String(r.donVi ?? '').trim() === unit,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────

  private num(v: unknown): number {
    return this.base.parseNum(v) ?? 0;
  }

  /**
   * %HT luôn compute từ ratio `ht/soCT`. Bỏ qua giá trị explicit của cell
   * `*TyleHt` vì admin có thể đặt formula `SUMALL` ở row TONG — cộng phần
   * trăm không phải là phần trăm aggregate, cho ra số vô nghĩa (vd 18600%).
   * Với PC row, explicit thường khớp compute nên không mất thông tin.
   */
  private tyle(_rawCell: unknown, ht: number, soCT: number): number | null {
    if (soCT === 0) return null;
    return (ht / soCT) * 100;
  }
}
