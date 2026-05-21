import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BcDtxdThaBaseService,
  LoadedEntry,
  TEMPLATE_CODES,
} from '../shared/bc-dtxd-tha-base.service';
import {
  PL180_PHASES,
  PL180_TONG_CONG,
  Pl180Kpi,
  Pl180PhaseBreakdown,
  Pl180Row,
  Pl180UnitBreakdown,
} from './pl180.model';

@Injectable({ providedIn: 'root' })
export class Pl180DataService {
  private readonly base = inject(BcDtxdThaBaseService);

  loadEntry(year: number): Observable<LoadedEntry<Pl180Row>> {
    return this.base.loadEntry<Pl180Row>(TEMPLATE_CODES.PL180, year);
  }

  findTongCong(rows: Pl180Row[]): Pl180Row | undefined {
    return rows.find(r => r?.row_code === PL180_TONG_CONG);
  }

  pcRows(rows: Pl180Row[]): Pl180Row[] {
    return rows.filter(r => r && !r._isTypeHeader && r.row_code !== PL180_TONG_CONG);
  }

  buildKpi(row: Pl180Row | null | undefined): Pl180Kpi {
    if (!row) {
      return { tongSoCT: 0, tongTmdt: 0, truocTmdt: 0, trongTmdt: 0, tyleHtNam: null };
    }
    const tongSoCT = this.num(row.tongSoCT);
    const tongTmdt = this.num(row.tongTmdt);
    const truocTmdt = this.num(row.truocTmdt);
    const trongTmdt = this.num(row.trongTmdt);
    const tyleHtNam = this.tyle(row.tongTyleHt, this.num(row.tongHt), tongSoCT);
    return { tongSoCT, tongTmdt, truocTmdt, trongTmdt, tyleHtNam };
  }

  buildPhaseBreakdown(row: Pl180Row | null | undefined): Pl180PhaseBreakdown[] {
    if (!row) return [];
    const result: Pl180PhaseBreakdown[] = [];
    for (const p of PL180_PHASES) {
      const soCT   = this.num(row[`${p.prefix}SoCT`]);
      const tmdt   = this.num(row[`${p.prefix}Tmdt`]);
      const ht     = this.num(row[`${p.prefix}Ht`]);
      const chuaHt = this.num(row[`${p.prefix}ChuaHt`]);
      if (soCT === 0 && tmdt === 0) continue;
      const tyleHt = this.tyle(row[`${p.prefix}TyleHt`], ht, soCT);
      result.push({
        prefix: p.prefix, label: p.label, color: p.color,
        soCT, tmdt, ht, chuaHt, tyleHt,
      });
    }
    return result;
  }

  buildUnitBreakdown(rows: Pl180Row[]): Pl180UnitBreakdown[] {
    return this.pcRows(rows)
      .map(r => ({
        unit: String(r.donVi ?? '').trim() || '(Chưa rõ)',
        tongSoCT:   this.num(r.tongSoCT),
        tongTmdt:   this.num(r.tongTmdt),
        truocTmdt:  this.num(r.truocTmdt),
        trongTmdt:  this.num(r.trongTmdt),
        tongTyleHt: this.tyle(r.tongTyleHt, this.num(r.tongHt), this.num(r.tongSoCT)),
      }))
      .filter(u => u.tongSoCT > 0 || u.tongTmdt > 0)
      .sort((a, b) => b.tongTmdt - a.tongTmdt);
  }

  buildUnitNames(rows: Pl180Row[]): string[] {
    const names = new Set<string>();
    for (const r of this.pcRows(rows)) {
      const u = String(r.donVi ?? '').trim();
      if (u) names.add(u);
    }
    return Array.from(names).sort();
  }

  findUnitRow(rows: Pl180Row[], unit: string): Pl180Row | undefined {
    return this.pcRows(rows).find(r => String(r.donVi ?? '').trim() === unit);
  }

  // ──────────────────────────────────────────────────────────────────────────

  private num(v: unknown): number {
    return this.base.parseNum(v) ?? 0;
  }

  private tyle(rawCell: unknown, ht: number, soCT: number): number | null {
    const explicit = this.base.parseNum(rawCell);
    if (explicit != null) return explicit;
    if (soCT === 0) return null;
    return (ht / soCT) * 100;
  }
}
