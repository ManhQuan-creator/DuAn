import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { GridTemplateService } from '../../excel-builder/service/grid-template.service';
import { GridDataEntryDetail, GridTemplateDetail } from '../../excel-builder/models/grid-template.model';
import { KhSxkdRow, KhMucTieuRow, KhSxkdKpi, TtdnByCapDienAp, SuatSuCo, DoTinCay, DaoTao, GiaBanBuon, VonDtxd, MucTieuGroup } from '../model/kh-evn.model';

/** orgCode của Tổng công ty (HQ) — 1 entry duy nhất / năm cho toàn EVNNPC.
 *  Convention hệ thống: 'TCT' (Tổng công ty) — TƯƠNG ỨNG EVNNPC nhưng dùng mã 'TCT'. */
export const HQ_ORG_CODE = 'TCT';

/** Code 2 template seed sẵn ở migration V11 */
export const TEMPLATE_CODE_SXKD = 'KH_SXKD_NAM';
export const TEMPLATE_CODE_MUC_TIEU = 'KH_MUC_TIEU_NAM';

interface LoadedEntry<R> {
  template: GridTemplateDetail;
  entry: GridDataEntryDetail;
  rows: R[];
}

/**
 * Service domain riêng cho KH năm EVN giao.
 *
 * Wrap `GridTemplateService` — lookup template theo code, find-or-create entry
 * theo (templateId, year, orgCode='EVNNPC'), parse rowData JSON sang typed rows.
 *
 * Dùng chung cho cả form nhập + dashboard view (đọc đồng 1 entry).
 */
@Injectable({ providedIn: 'root' })
export class KhEvnDataService {
  private readonly gridSvc = inject(GridTemplateService);

  /** Load template + entry hiện hành cho năm. Tự tạo entry rỗng nếu chưa có. */
  loadOrCreateSxkdEntry(year: number): Observable<LoadedEntry<KhSxkdRow>> {
    return this.loadOrCreate<KhSxkdRow>(TEMPLATE_CODE_SXKD, year);
  }

  loadOrCreateMucTieuEntry(year: number): Observable<LoadedEntry<KhMucTieuRow>> {
    return this.loadOrCreate<KhMucTieuRow>(TEMPLATE_CODE_MUC_TIEU, year);
  }

  /** Save lại rows vào entry (JSON.stringify). */
  saveEntry(templateId: number, entryId: number, rows: unknown[]): Observable<void> {
    return this.gridSvc.updateEntry(templateId, entryId, {
      rowData: JSON.stringify(rows),
    }).pipe(map(() => void 0));
  }

  /** Tìm template theo code (search trong list). */
  private findTemplate(code: string): Observable<GridTemplateDetail> {
    return this.gridSvc.getTemplates().pipe(
      switchMap(list => {
        const meta = list.find(t => t.code === code);
        if (!meta) {
          return throwError(() => new Error(`Không tìm thấy template ${code}. Đã chạy migration V11 chưa?`));
        }
        return this.gridSvc.getTemplate(meta.id);
      }),
    );
  }

  private loadOrCreate<R>(
    templateCode: string,
    year: number,
  ): Observable<LoadedEntry<R>> {
    return this.findTemplate(templateCode).pipe(
      switchMap(template =>
        this.gridSvc.getEntries(template.id, { year, orgCode: HQ_ORG_CODE }).pipe(
          switchMap(entries => {
            if (entries.length > 0) {
              return this.gridSvc.getEntry(template.id, entries[0].id).pipe(
                map(entry => this.buildLoadedEntry<R>(template, entry)),
              );
            }
            return this.gridSvc.createEntry(template.id, {
              entryCode: `${templateCode}_${year}`,
              entryName: `${template.name} năm ${year}`,
              orgCode: HQ_ORG_CODE,
              year,
              month: null,
              rowData: '[]',
            }).pipe(
              switchMap(newEntry =>
                this.gridSvc.getEntry(template.id, newEntry.id).pipe(
                  map(entry => this.buildLoadedEntry<R>(template, entry)),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  private buildLoadedEntry<R>(template: GridTemplateDetail, entry: GridDataEntryDetail): LoadedEntry<R> {
    let rows: R[] = [];
    try {
      const parsed = entry.rowData ? JSON.parse(entry.rowData) : [];
      rows = Array.isArray(parsed) ? parsed : [];
    } catch {
      rows = [];
    }
    return { template, entry, rows };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aggregation helpers — đọc rows snapshot, project ra typed KPI/chart inputs.
  // ──────────────────────────────────────────────────────────────────────────

  /** Trả về Map<row_code, giaTri> đã parse number. Skip header rows. */
  private indexByRowCode(rows: KhSxkdRow[]): Map<string, number | null> {
    const out = new Map<string, number | null>();
    for (const r of rows) {
      if (!r?.row_code) continue;
      out.set(r.row_code, this.parseNum(r.giaTri));
    }
    return out;
  }

  private parseNum(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  buildKpi(rows: KhSxkdRow[]): KhSxkdKpi {
    const idx = this.indexByRowCode(rows);
    const dt = (idx.get('DT_DAI_HAN_LUOT') ?? 0)
             + (idx.get('DT_NGAN_HAN_LUOT') ?? 0)
             + (idx.get('DT_ELEARNING_LUOT') ?? 0);
    return {
      dienThuongPham: idx.get('DIEN_TP') ?? null,
      giaBanBinhQuan: idx.get('GIA_BQ') ?? null,
      ttdnTong:       idx.get('TTDN_TONG') ?? null,
      chiPhiScl:      idx.get('CP_SCL') ?? null,
      maifi:          idx.get('MAIFI') ?? null,
      saidi:          idx.get('SAIDI') ?? null,
      saifi:          idx.get('SAIFI') ?? null,
      daoTaoTongLuot: dt || null,
      tongDauTu:      idx.get('DT_TONG') ?? null,
    };
  }

  buildTtdn(rows: KhSxkdRow[]): TtdnByCapDienAp {
    const idx = this.indexByRowCode(rows);
    return {
      tong:     idx.get('TTDN_TONG') ?? null,
      caoAp:    idx.get('TTDN_CAO_AP') ?? null,
      trungAp:  idx.get('TTDN_TRUNG_AP') ?? null,
      haAp:     idx.get('TTDN_HA_AP') ?? null,
    };
  }

  buildSuatSuCo(rows: KhSxkdRow[]): SuatSuCo {
    const idx = this.indexByRowCode(rows);
    return {
      duongDayKeoDai:    idx.get('SSC_DZ_KEO_DAI') ?? null,
      duongDayThoangQua: idx.get('SSC_DZ_THOANG_QUA') ?? null,
      tba:               idx.get('SSC_TBA') ?? null,
    };
  }

  buildDoTinCay(rows: KhSxkdRow[]): DoTinCay {
    const idx = this.indexByRowCode(rows);
    return {
      maifi: idx.get('MAIFI') ?? null,
      saidi: idx.get('SAIDI') ?? null,
      saifi: idx.get('SAIFI') ?? null,
    };
  }

  buildDaoTao(rows: KhSxkdRow[]): DaoTao {
    const idx = this.indexByRowCode(rows);
    return {
      daiHan:    { luot: idx.get('DT_DAI_HAN_LUOT') ?? null,  chiPhi: idx.get('DT_DAI_HAN_CP') ?? null },
      nganHan:   { luot: idx.get('DT_NGAN_HAN_LUOT') ?? null, chiPhi: idx.get('DT_NGAN_HAN_CP') ?? null },
      eLearning: { luot: idx.get('DT_ELEARNING_LUOT') ?? null,chiPhi: idx.get('DT_ELEARNING_CP') ?? null },
    };
  }

  buildGiaBanBuon(rows: KhSxkdRow[]): GiaBanBuon {
    const idx = this.indexByRowCode(rows);
    return {
      caoDiemT1_3: idx.get('GBB_CD_T1_3') ?? null,
      caoDiemT4_6: idx.get('GBB_CD_T4_6') ?? null,
      caoDiemT7_9: idx.get('GBB_CD_T7_9') ?? null,
      thapDiem:    idx.get('GBB_THAP_DIEM') ?? null,
      binhThuong:  idx.get('GBB_BINH_THUONG') ?? null,
      binhQuanKh:  idx.get('GBB_BQ_KH') ?? null,
    };
  }

  buildVonDtxd(rows: KhSxkdRow[]): VonDtxd {
    const idx = this.indexByRowCode(rows);
    return {
      tongDauTu:  idx.get('DT_TONG') ?? null,
      luoi110kv:  idx.get('DT_LUOI_110KV') ?? null,
      von: {
        nuocNgoai:     idx.get('DT_VON_NN') ?? null,
        vayTrongNuoc:  idx.get('DT_VON_TN_VAY') ?? null,
        tdtm:          idx.get('DT_VON_TN_TDTM') ?? null,
        khcb:          idx.get('DT_VON_TN_KHCB') ?? null,
      },
      hangMuc: {
        xayLap:   idx.get('DT_XAY_LAP') ?? null,
        thietBi:  idx.get('DT_THIET_BI') ?? null,
        khac:     idx.get('DT_KHAC') ?? null,
      },
    };
  }

  /** Group rows mục tiêu định tính theo section (3 nhóm I/II/III). */
  buildMucTieuGroups(rows: KhMucTieuRow[]): MucTieuGroup[] {
    const groups: MucTieuGroup[] = [];
    let current: MucTieuGroup | null = null;
    for (const r of rows) {
      if (r._isTypeHeader) {
        current = {
          sectionCode: r.row_code,
          tieuDe: `${r.stt ?? ''}. ${r.mucTieu ?? ''}`.trim(),
          mucTieuItems: [],
        };
        groups.push(current);
        continue;
      }
      if (!current) continue;
      current.mucTieuItems.push({
        stt: String(r.stt ?? ''),
        mucTieu: String(r.mucTieu ?? ''),
        chiTieuDinhLuong: String(r.chiTieuDinhLuong ?? ''),
        ghiChu: String(r.ghiChu ?? ''),
      });
    }
    return groups;
  }
}
