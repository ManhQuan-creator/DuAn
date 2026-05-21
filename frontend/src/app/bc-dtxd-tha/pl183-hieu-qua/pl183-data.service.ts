import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BcDtxdThaBaseService,
  LoadedEntry,
  TEMPLATE_CODES,
} from '../shared/bc-dtxd-tha-base.service';
import {
  CapDienApSlice,
  PcCountItem,
  Pl183Kpi,
  Pl183Row,
  ProjectTangThietItem,
  ProjectTmdtItem,
} from './pl183.model';

@Injectable({ providedIn: 'root' })
export class Pl183DataService {
  private readonly base = inject(BcDtxdThaBaseService);

  loadEntry(year: number): Observable<LoadedEntry<Pl183Row>> {
    return this.base.loadEntry<Pl183Row>(TEMPLATE_CODES.PL183, year);
  }

  /** Bỏ header rows + rỗng. */
  dataRows(rows: Pl183Row[]): Pl183Row[] {
    return rows.filter(r =>
      r && !r._isTypeHeader && String(r.danhMucDuAn ?? '').trim() !== ''
    );
  }

  /** Lọc theo PC nếu chỉ định. */
  filterByPc(rows: Pl183Row[], pc: string | null): Pl183Row[] {
    const all = this.dataRows(rows);
    if (pc == null) return all;
    return all.filter(r => String(r.pc ?? '').trim() === pc);
  }

  buildKpi(rows: Pl183Row[]): Pl183Kpi {
    let tongTmdtBcnckt = 0;
    let tongChiPhiTt = 0;
    let soDaTangHieuQua = 0;
    let soDaThietHai = 0;
    let tongGiaTriTangThiet = 0;
    for (const r of rows) {
      tongTmdtBcnckt += this.num(r.tmdt);
      tongChiPhiTt   += this.num(r.chiPhiTt);
      const g = this.numOrNull(r.giaTriTangThiet);
      if (g != null) {
        tongGiaTriTangThiet += g;
        if (g >= 0) soDaTangHieuQua++;
        else soDaThietHai++;
      }
    }
    return {
      tongSoDuAn: rows.length,
      tongTmdtBcnckt,
      tongChiPhiTt,
      soDaTangHieuQua,
      soDaThietHai,
      tongGiaTriTangThiet,
    };
  }

  buildCapDienApBreakdown(rows: Pl183Row[]): CapDienApSlice[] {
    const map = new Map<string, number>();
    for (const r of rows) {
      const label = String(r.capDienAp ?? '').trim() || '(Chưa rõ)';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  buildTopByTmdt(rows: Pl183Row[], topN = 10): ProjectTmdtItem[] {
    return rows
      .map(r => ({
        duAn: this.shortName(r.danhMucDuAn),
        pc: String(r.pc ?? '').trim(),
        tmdt: this.num(r.tmdt),
        chiPhiTt: this.num(r.chiPhiTt),
      }))
      .filter(i => i.tmdt > 0 || i.chiPhiTt > 0)
      .sort((a, b) => b.tmdt - a.tmdt)
      .slice(0, topN);
  }

  buildTopByTangThiet(rows: Pl183Row[], topN = 15): ProjectTangThietItem[] {
    return rows
      .map(r => ({
        duAn: this.shortName(r.danhMucDuAn),
        pc: String(r.pc ?? '').trim(),
        giaTri: this.numOrNull(r.giaTriTangThiet) ?? 0,
      }))
      .filter(i => i.giaTri !== 0)
      .sort((a, b) => Math.abs(b.giaTri) - Math.abs(a.giaTri))
      .slice(0, topN);
  }

  buildPcCount(rows: Pl183Row[]): PcCountItem[] {
    const map = new Map<string, number>();
    for (const r of rows) {
      const pc = String(r.pc ?? '').trim();
      if (!pc) continue;
      map.set(pc, (map.get(pc) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([pc, count]) => ({ pc, count }))
      .sort((a, b) => b.count - a.count);
  }

  buildPcNames(rows: Pl183Row[]): string[] {
    const names = new Set<string>();
    for (const r of this.dataRows(rows)) {
      const pc = String(r.pc ?? '').trim();
      if (pc) names.add(pc);
    }
    return Array.from(names).sort();
  }

  // ──────────────────────────────────────────────────────────────────────────

  private num(v: unknown): number {
    return this.base.parseNum(v) ?? 0;
  }

  private numOrNull(v: unknown): number | null {
    return this.base.parseNum(v);
  }

  /** Rút gọn tên dự án dài cho chart label. */
  private shortName(v: unknown): string {
    const s = String(v ?? '').trim();
    return s.length > 40 ? s.slice(0, 38) + '…' : s;
  }
}
