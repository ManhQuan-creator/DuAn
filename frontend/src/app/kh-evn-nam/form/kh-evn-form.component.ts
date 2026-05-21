import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { LoadingService } from '../../shared/loading.service';
import { AppDialogService } from '../../shared/dialog.service';
import { SingleSelectComponent, SelectOption } from '../../shared/components/multi-select';
import { GridDataEntryDetail, GridTemplateDetail } from '../../excel-builder/models/grid-template.model';
import { KhEvnDataService } from '../service/kh-evn-data.service';
import { KhSxkdRow, KhMucTieuRow } from '../model/kh-evn.model';
import { buildYearOptions } from '../utils/year-options.util';

type TabKey = 'SXKD' | 'MUC_TIEU';

/** 1 row trong section đã tagged với index tuyệt đối trong rows array gốc. */
interface IndexedRow<R> {
  row: R;
  globalIdx: number;
}

interface SectionView<R> {
  header: R;                // section row (_isTypeHeader=true)
  items: IndexedRow<R>[];   // data rows trong section
}

/**
 * Form nhập KH năm EVN giao — 2 tab tách biệt vì column shape khác nhau:
 *   - SXKD     : chỉ tiêu định lượng (PL1+PL2+PL3) — nhập giaTri (number) + ghiChu (text)
 *   - MUC_TIEU : mục tiêu định tính (PL4) — nhập chiTieuDinhLuong + ghiChu (cả 2 text)
 *
 * 1 entry / tab / năm — load qua KhEvnDataService.loadOrCreate*Entry(year).
 * Save toàn bộ rows array (JSON serialize); section headers giữ flag _isTypeHeader,
 * không cho nhập.
 */
@Component({
  selector: 'app-kh-evn-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SingleSelectComponent],
  templateUrl: './kh-evn-form.component.html',
  styleUrls: ['./kh-evn-form.component.scss'],
})
export class KhEvnFormComponent implements OnInit {
  private readonly dataSvc = inject(KhEvnDataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  readonly yearOptions: SelectOption<number>[] = buildYearOptions();

  selectedYear = new Date().getFullYear();
  activeTab: TabKey = 'SXKD';
  saving = false;

  // ── SXKD state ────────────────────────────────────────────────────────────
  sxkdTemplate: GridTemplateDetail | null = null;
  sxkdEntry: GridDataEntryDetail | null = null;
  readonly sxkdRows = signal<KhSxkdRow[]>([]);
  readonly sxkdSections = computed<SectionView<KhSxkdRow>[]>(() =>
    this.groupSectionsWithIndex(this.sxkdRows()),
  );

  // ── MUC_TIEU state ────────────────────────────────────────────────────────
  mucTieuTemplate: GridTemplateDetail | null = null;
  mucTieuEntry: GridDataEntryDetail | null = null;
  readonly mucTieuRows = signal<KhMucTieuRow[]>([]);
  readonly mucTieuSections = computed<SectionView<KhMucTieuRow>[]>(() =>
    this.groupSectionsWithIndex(this.mucTieuRows()),
  );

  ngOnInit(): void {
    this.loadData();
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.loadData();
  }

  switchTab(tab: TabKey): void {
    this.activeTab = tab;
  }

  /** Save tab hiện tại (SXKD hoặc MUC_TIEU). */
  saveCurrentTab(): void {
    if (this.activeTab === 'SXKD') this.saveSxkd();
    else this.saveMucTieu();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Two-way binding helpers — mutate signal value immutably rồi notify.
  // ──────────────────────────────────────────────────────────────────────────

  setSxkdValue(rowIdx: number, field: keyof KhSxkdRow, value: unknown): void {
    this.sxkdRows.set(this.replaceAt(this.sxkdRows(), rowIdx, field, value));
  }

  setMucTieuValue(rowIdx: number, field: keyof KhMucTieuRow, value: unknown): void {
    this.mucTieuRows.set(this.replaceAt(this.mucTieuRows(), rowIdx, field, value));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private replaceAt<R>(rows: R[], idx: number, field: keyof R, value: unknown): R[] {
    if (idx < 0 || idx >= rows.length) return rows;
    const next = [...rows];
    next[idx] = { ...rows[idx], [field]: value };
    return next;
  }

  /** Nhóm rows theo section header, tag mỗi row với index gốc. */
  private groupSectionsWithIndex<R extends { _isTypeHeader?: boolean }>(rows: R[]): SectionView<R>[] {
    const result: SectionView<R>[] = [];
    let current: SectionView<R> | null = null;
    rows.forEach((row, idx) => {
      if (row._isTypeHeader) {
        current = { header: row, items: [] };
        result.push(current);
        return;
      }
      if (!current) {
        current = { header: { _isTypeHeader: true } as R, items: [] };
        result.push(current);
      }
      current.items.push({ row, globalIdx: idx });
    });
    return result;
  }

  private loadData(): void {
    this.loading.show();
    const year = this.selectedYear;
    this.dataSvc.loadOrCreateSxkdEntry(year).pipe(
      tap(({ template, entry, rows }) => {
        this.sxkdTemplate = template;
        this.sxkdEntry = entry;
        this.sxkdRows.set(rows);
      }),
      switchMap(() => this.dataSvc.loadOrCreateMucTieuEntry(year)),
      tap(({ template, entry, rows }) => {
        this.mucTieuTemplate = template;
        this.mucTieuEntry = entry;
        this.mucTieuRows.set(rows);
      }),
      catchError(err => {
        this.dialog.error(err?.message ?? 'Không tải được dữ liệu KH năm.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  private saveSxkd(): void {
    if (!this.sxkdTemplate || !this.sxkdEntry) return;
    this.runSave(this.sxkdTemplate.id, this.sxkdEntry.id, this.sxkdRows(),
      'Đã lưu chỉ tiêu định lượng SXKD.');
  }

  private saveMucTieu(): void {
    if (!this.mucTieuTemplate || !this.mucTieuEntry) return;
    this.runSave(this.mucTieuTemplate.id, this.mucTieuEntry.id, this.mucTieuRows(),
      'Đã lưu mục tiêu định tính.');
  }

  private runSave(templateId: number, entryId: number, rows: unknown[], successMsg: string): void {
    this.saving = true;
    this.loading.show();
    this.dataSvc.saveEntry(templateId, entryId, rows).pipe(
      finalize(() => { this.saving = false; this.loading.hide(); }),
    ).subscribe({
      next: () => this.dialog.success(successMsg),
      error: () => this.dialog.error('Lưu thất bại — vui lòng thử lại.'),
    });
  }
}
