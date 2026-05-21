import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BcDtxdThaBaseService,
  LoadedEntry,
  TEMPLATE_CODES,
} from '../shared/bc-dtxd-tha-base.service';
import {
  ChamTienDoItem,
  NhomDuAnSlice,
  PL182_CODES,
  PhaseSlice,
  Pl182Kpi,
  Pl182Row,
  ViPhamItem,
} from './pl182.model';

@Injectable({ providedIn: 'root' })
export class Pl182DataService {
  private readonly base = inject(BcDtxdThaBaseService);

  loadEntry(year: number): Observable<LoadedEntry<Pl182Row>> {
    return this.base.loadEntry<Pl182Row>(TEMPLATE_CODES.PL182, year);
  }

  private byCode(rows: Pl182Row[]): Map<string, Pl182Row> {
    return this.base.indexByRowCode(rows);
  }

  /** Build 6 KPI từ rows snapshot. */
  buildKpi(rows: Pl182Row[]): Pl182Kpi {
    const map = this.byCode(rows);
    const tongOf = (code: string) => this.num(map.get(code)?.tongCong);
    const chamCodes = ['II_9_a', 'II_9_b', 'II_9_c', 'II_9_d', 'II_9_e'];
    return {
      daQuyetDinhDT: tongOf(PL182_CODES.I_2),
      daThucHienDT:  tongOf(PL182_CODES.II_1),
      daDaDanhGia:   tongOf(PL182_CODES.II_5),
      daChamTienDo:  chamCodes.reduce((s, c) => s + tongOf(c), 0),
      daKetThuc:     tongOf(PL182_CODES.III_1),
      daDaQuyetToan: tongOf(PL182_CODES.III_3),
    };
  }

  /**
   * Slice "Phân loại theo nhóm dự án" — từ row II_1.
   * Mặc định show 4 nhóm NgĐTC (QTQG/A/B/C). Nếu dtcTong > 0 thì show cả ĐTC (8 slice).
   */
  buildNhomDuAn(rows: Pl182Row[]): NhomDuAnSlice[] {
    const r = this.byCode(rows).get(PL182_CODES.II_1);
    if (!r) return [];
    const result: NhomDuAnSlice[] = [];
    const ngdtcQtqg = this.num(r.ngdtcQtqg);
    const ngdtcA = this.num(r.ngdtcA);
    const ngdtcB = this.num(r.ngdtcB);
    const ngdtcC = this.num(r.ngdtcC);
    if (ngdtcQtqg > 0) result.push({ label: 'QTQG (NgĐTC)', value: ngdtcQtqg, color: '#8b5cf6' });
    if (ngdtcA > 0)    result.push({ label: 'Nhóm A (NgĐTC)', value: ngdtcA, color: '#3b82f6' });
    if (ngdtcB > 0)    result.push({ label: 'Nhóm B (NgĐTC)', value: ngdtcB, color: '#10b981' });
    if (ngdtcC > 0)    result.push({ label: 'Nhóm C (NgĐTC)', value: ngdtcC, color: '#f59e0b' });

    const dtcTong = this.num(r.dtcTong);
    if (dtcTong > 0) {
      const dtcQtqg = this.num(r.dtcQtqg);
      const dtcA = this.num(r.dtcA);
      const dtcB = this.num(r.dtcB);
      const dtcC = this.num(r.dtcC);
      if (dtcQtqg > 0) result.push({ label: 'QTQG (ĐTC)', value: dtcQtqg, color: '#7c3aed' });
      if (dtcA > 0)    result.push({ label: 'Nhóm A (ĐTC)', value: dtcA, color: '#2563eb' });
      if (dtcB > 0)    result.push({ label: 'Nhóm B (ĐTC)', value: dtcB, color: '#059669' });
      if (dtcC > 0)    result.push({ label: 'Nhóm C (ĐTC)', value: dtcC, color: '#d97706' });
    }
    return result;
  }

  /** 3 giai đoạn vòng đời. */
  buildPhases(rows: Pl182Row[]): PhaseSlice[] {
    const map = this.byCode(rows);
    return [
      { label: 'Chuẩn bị ĐT',  value: this.num(map.get(PL182_CODES.I_2)?.tongCong),   color: '#3b82f6' },
      { label: 'Thực hiện ĐT', value: this.num(map.get(PL182_CODES.II_1)?.tongCong),  color: '#f59e0b' },
      { label: 'Kết thúc ĐT',  value: this.num(map.get(PL182_CODES.III_1)?.tongCong), color: '#10b981' },
    ];
  }

  /** 5 nguyên nhân chậm tiến độ. */
  buildChamTienDo(rows: Pl182Row[]): ChamTienDoItem[] {
    const map = this.byCode(rows);
    return [
      { label: 'Thủ tục đầu tư', value: this.num(map.get(PL182_CODES.II_9_a)?.tongCong) },
      { label: 'GPMB',           value: this.num(map.get(PL182_CODES.II_9_b)?.tongCong) },
      { label: 'Năng lực CĐT/BQLDA/NT', value: this.num(map.get(PL182_CODES.II_9_c)?.tongCong) },
      { label: 'Bố trí vốn',     value: this.num(map.get(PL182_CODES.II_9_d)?.tongCong) },
      { label: 'Nguyên nhân khác', value: this.num(map.get(PL182_CODES.II_9_e)?.tongCong) },
    ]
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  /** Sự cố / Vi phạm trong kỳ. */
  buildViPham(rows: Pl182Row[]): ViPhamItem[] {
    const map = this.byCode(rows);
    return [
      { label: 'Vi phạm thủ tục ĐT',  value: this.num(map.get(PL182_CODES.II_6)?.tongCong),  color: '#ef4444' },
      { label: 'Vi phạm chất lượng',  value: this.num(map.get(PL182_CODES.II_7)?.tongCong),  color: '#f97316' },
      { label: 'Thất thoát lãng phí', value: this.num(map.get(PL182_CODES.II_8)?.tongCong),  color: '#dc2626' },
      { label: 'Phải ngừng thực hiện',value: this.num(map.get(PL182_CODES.II_12)?.tongCong), color: '#991b1b' },
    ];
  }

  // ──────────────────────────────────────────────────────────────────────────

  private num(v: unknown): number {
    return this.base.parseNum(v) ?? 0;
  }
}
