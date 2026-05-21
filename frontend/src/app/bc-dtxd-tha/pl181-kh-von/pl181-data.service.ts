import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BcDtxdThaBaseService,
  LoadedEntry,
  TEMPLATE_CODES,
} from '../shared/bc-dtxd-tha-base.service';
import {
  NguonVonBreakdown,
  PL181_ROW_CODES,
  Pl181Kpi,
  Pl181Row,
  QuarterProgressPoint,
} from './pl181.model';

/**
 * Service domain cho dashboard PL181 - TH KH vốn TCT.
 *
 * Wrap `BcDtxdThaBaseService.loadEntry` với type Pl181Row, cung cấp các
 * helper aggregate KPI + breakdown + lookup theo quý.
 */
@Injectable({ providedIn: 'root' })
export class Pl181DataService {
  private readonly base = inject(BcDtxdThaBaseService);

  /** Load entry latest quý có data trong năm (service auto-pick). */
  loadEntry(year: number): Observable<LoadedEntry<Pl181Row>> {
    return this.base.loadEntry<Pl181Row>(TEMPLATE_CODES.PL181, year);
  }

  /** Load 4 entry Q1-Q4 song song cho line tiến độ luỹ kế (chart riêng). */
  loadAllQuarters(year: number): Observable<QuarterProgressPoint[]> {
    const months = [3, 6, 9, 12];
    return forkJoin(
      months.map(m =>
        this.base.loadEntryByMonth<Pl181Row>(TEMPLATE_CODES.PL181, year, m).pipe(
          map(le => this.buildQuarterPoint(le, m))
        )
      )
    );
  }

  /** Build 1 điểm Q. */
  private buildQuarterPoint(le: LoadedEntry<Pl181Row>, month: number): QuarterProgressPoint {
    const quarter = month / 3;
    if (!le.entry || le.rows.length === 0) {
      return { quarter, hasData: false, thTle: null, gnTle: null };
    }
    const npc = this.findRow(le.rows, PL181_ROW_CODES.NPC_TONG);
    return {
      quarter,
      hasData: !!npc && (this.base.parseNum(npc.khVonNam) ?? 0) > 0,
      thTle: this.computeTle(npc),
      gnTle: this.computeGnTle(npc),
    };
  }

  /** Build KPI từ row NPC_TONG. Nếu cell % blank → compute từ giá trị/KH. */
  buildKpi(rows: Pl181Row[]): Pl181Kpi {
    const npc = this.findRow(rows, PL181_ROW_CODES.NPC_TONG);
    if (!npc) {
      return { tongKhVonNam: 0, tongTh: 0, thTle: null, tongGn: 0, gnTle: null };
    }
    const tongKhVonNam = this.base.parseNum(npc.khVonNam) ?? 0;
    const tongTh = this.base.parseNum(npc.thGtri) ?? 0;
    const tongGn = this.base.parseNum(npc.gnGtri) ?? 0;
    return {
      tongKhVonNam,
      tongTh,
      thTle: this.computeTle(npc),
      tongGn,
      gnTle: this.computeGnTle(npc),
    };
  }

  /** Breakdown theo nguồn vốn (leaf nodes có data > 0) — feed chart cơ cấu + TH/GN bar. */
  buildNguonVonBreakdown(rows: Pl181Row[]): NguonVonBreakdown[] {
    const leafNodes: Array<{ code: string; label: string }> = [
      { code: PL181_ROW_CODES.I_1_1,  label: 'Vốn NSTW trong nước' },
      { code: PL181_ROW_CODES.I_1_2,  label: 'Vốn ODA (ĐTC)' },
      { code: PL181_ROW_CODES.II_1_1, label: 'Vốn trong nước (TDTM+Ưu đãi)' },
      { code: PL181_ROW_CODES.II_1_2, label: 'Vốn ODA (NgĐTC)' },
      { code: PL181_ROW_CODES.II_2,   label: 'Vốn khác (KHCB/tự có)' },
    ];

    const breakdowns: NguonVonBreakdown[] = [];
    for (const node of leafNodes) {
      const r = this.findRow(rows, node.code);
      if (!r) continue;
      const kh = this.base.parseNum(r.khVonNam) ?? 0;
      const th = this.base.parseNum(r.thGtri) ?? 0;
      const gn = this.base.parseNum(r.gnGtri) ?? 0;
      if (kh === 0 && th === 0 && gn === 0) continue;
      breakdowns.push({
        rowCode: node.code,
        label: node.label,
        khVonNam: kh,
        thGtri: th,
        gnGtri: gn,
        thTle: this.computeTle(r),
      });
    }

    // Fallback nếu II_1_1 + II_1_2 cùng blank nhưng II_1 có data → push 1 slice tổng cho TDTM+Ưu đãi
    if (!breakdowns.find(b => b.rowCode === PL181_ROW_CODES.II_1_1
      || b.rowCode === PL181_ROW_CODES.II_1_2)) {
      const ii1 = this.findRow(rows, PL181_ROW_CODES.II_1);
      if (ii1) {
        const kh = this.base.parseNum(ii1.khVonNam) ?? 0;
        const th = this.base.parseNum(ii1.thGtri) ?? 0;
        const gn = this.base.parseNum(ii1.gnGtri) ?? 0;
        if (kh > 0 || th > 0 || gn > 0) {
          breakdowns.unshift({
            rowCode: PL181_ROW_CODES.II_1,
            label: 'TDTM + Ưu đãi (tổng)',
            khVonNam: kh,
            thGtri: th,
            gnGtri: gn,
            thTle: this.computeTle(ii1),
          });
        }
      }
    }

    return breakdowns;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private findRow(rows: Pl181Row[], code: string): Pl181Row | undefined {
    return rows.find(r => r?.row_code === code);
  }

  /** %TH/KH — ưu tiên cell `thTle` nếu nhập tay, fallback compute từ giá trị. */
  private computeTle(row: Pl181Row | undefined): number | null {
    if (!row) return null;
    const explicit = this.base.parseNum(row.thTle);
    if (explicit != null) return explicit;
    const kh = this.base.parseNum(row.khVonNam);
    const th = this.base.parseNum(row.thGtri);
    if (kh == null || kh === 0 || th == null) return null;
    return (th / kh) * 100;
  }

  /** %GN/KH — ưu tiên cell `gnTle`, fallback compute. */
  private computeGnTle(row: Pl181Row | undefined): number | null {
    if (!row) return null;
    const explicit = this.base.parseNum(row.gnTle);
    if (explicit != null) return explicit;
    const kh = this.base.parseNum(row.khVonNam);
    const gn = this.base.parseNum(row.gnGtri);
    if (kh == null || kh === 0 || gn == null) return null;
    return (gn / kh) * 100;
  }
}
