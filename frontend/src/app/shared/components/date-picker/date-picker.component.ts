import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TuiTextfieldControllerModule } from '@taiga-ui/core';
import {
  TUI_DATE_FORMAT,
  TUI_DATE_SEPARATOR,
  TuiDay,
  TuiTime,
} from '@taiga-ui/cdk';
import { TuiInputDateModule, TuiInputDateTimeModule } from '@taiga-ui/kit';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { TUI_VIETNAMESE_LANGUAGE } from '@taiga-ui/i18n/languages/vietnamese';
import { of } from 'rxjs';

/**
 * Date / Date+Time picker dùng chung — wrap `tui-input-date` / `tui-input-date-time` (Taiga).
 *
 * - CVA value: `string | null` — ISO `YYYY-MM-DD` (date) hoặc `YYYY-MM-DDTHH:mm:ss` (datetime).
 *   Backend nhận `LocalDate`/`LocalDateTime` parse được; FE dễ map qua HTTP/JSON.
 * - Inputs: `withTime` (default false), `placeholder`, `size` (m/s/l), `readOnly`, `disabled`,
 *   `width`, `height`.
 * - Locale tiếng Việt + format `dd/MM/yyyy` (date) hoặc `dd/MM/yyyy HH:mm` (datetime) —
 *   set qua viewProviders, áp scoped cho `<tui-input-date>` / `<tui-input-date-time>` bên trong.
 *
 * **BẮT BUỘC dùng cho mọi date input trong feature code** thay cho native
 * `<input type="date">` (xấu, không đồng nhất thiết kế) hoặc dùng trực tiếp
 * `<tui-input-date>` (lặp boilerplate convert TuiDay ↔ ISO + setup locale). Xem CLAUDE.md.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiInputDateModule,
    TuiInputDateTimeModule,
    TuiTextfieldControllerModule,
  ],
  template: `
    <tui-input-date
      class="due-date-control__picker"
      *ngIf="!withTime"
      [ngModel]="dayValue"
      (ngModelChange)="onDayChange($event)"
      [readOnly]="readOnly"
      [disabled]="disabled"
      [tuiTextfieldLabelOutside]="true"
      [tuiTextfieldSize]="size"
    >
      {{ placeholder }}
    </tui-input-date>

    <tui-input-date-time
      class="due-date-control__picker"
      *ngIf="withTime"
      [ngModel]="dateTimeValue"
      (ngModelChange)="onDateTimeChange($event)"
      [readOnly]="readOnly"
      [disabled]="disabled"
      [tuiTextfieldLabelOutside]="true"
      [tuiTextfieldSize]="size"
    >
      {{ placeholder }}
    </tui-input-date-time>
  `,
  styles: [`:host { display: block; width: var(--width); height: var(--height); }`],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
  // Locale + format áp scoped cho component này — không pollute global Taiga tokens.
  viewProviders: [
    { provide: TUI_DATE_FORMAT, useValue: 'DMY' },           // dd/MM/yyyy
    { provide: TUI_DATE_SEPARATOR, useValue: '/' },
    { provide: TUI_LANGUAGE, useValue: of(TUI_VIETNAMESE_LANGUAGE) },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  @Input() placeholder = 'Chọn ngày';
  @Input() size: 'm' | 's' | 'l' = 'm';
  @Input() readOnly = false;
  @Input() disabled = false;
  /** True → dùng `tui-input-date-time` (date + time mask `dd/MM/yyyy HH:mm`). */
  @Input() withTime = false;
  @Input() width = '100%';
  @Input() height = '100%';
  @HostBinding('style.width') get hostWidth(): string {
    return this.width;
  }
  @HostBinding('style.height') get hostHeight(): string {
    return this.height;
  }

  /** Value cho `tui-input-date` (date-only mode). */
  dayValue: TuiDay | null = null;
  /** Value cho `tui-input-date-time` (date+time mode) — tuple [day, time]. */
  dateTimeValue: [TuiDay | null, TuiTime | null] = [null, null];

  private onChange: (val: string | null) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly cdr = inject(ChangeDetectorRef);

  // ====== ControlValueAccessor ======

  writeValue(val: string | null): void {
    if (this.withTime) {
      this.dateTimeValue = isoToDateTime(val);
    } else {
      this.dayValue = isoToTuiDay(val);
    }
    // OnPush: writeValue được gọi bởi NgModelDirective, KHÔNG trigger CD nội bộ
    // → tui-input-date* sẽ không nhận được [ngModel] mới nếu không markForCheck.
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (val: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  // ====== Event handlers ======

  onDayChange(day: TuiDay | null): void {
    this.dayValue = day;
    this.onChange(tuiDayToIso(day));
    this.onTouched();
  }

  onDateTimeChange(value: [TuiDay | null, TuiTime | null]): void {
    this.dateTimeValue = value;
    this.onChange(dateTimeToIso(value));
    this.onTouched();
  }
}

// ====== Conversion helpers ======

/**
 * Convert `YYYY-MM-DD[Thh:mm:ss]` → `TuiDay`. Trả null nếu không parse được.
 * Chỉ lấy phần date (10 ký tự đầu), bỏ qua phần time/timezone.
 */
function isoToTuiDay(iso: string | null | undefined): TuiDay | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return makeTuiDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

/**
 * Convert `YYYY-MM-DDTHH:mm[:ss]` → `[TuiDay, TuiTime]`. Phần time thiếu → 00:00.
 */
function isoToDateTime(iso: string | null | undefined): [TuiDay | null, TuiTime | null] {
  if (!iso) return [null, null];
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return [null, null];
  const day = makeTuiDay(Number(m[1]), Number(m[2]), Number(m[3]));
  const time = m[4] != null ? new TuiTime(Number(m[4]), Number(m[5]), m[6] ? Number(m[6]) : 0) : new TuiTime(0, 0, 0);
  return [day, time];
}

function makeTuiDay(year: number, monthOneBased: number, day: number): TuiDay | null {
  if (!Number.isFinite(year) || !Number.isFinite(monthOneBased) || !Number.isFinite(day)) return null;
  return new TuiDay(year, monthOneBased - 1, day); // TuiDay month: 0-based
}

/** Convert `TuiDay` → ISO `YYYY-MM-DD`. Null/undefined → null. */
function tuiDayToIso(day: TuiDay | null | undefined): string | null {
  if (!day) return null;
  const yyyy = String(day.year).padStart(4, '0');
  const mm = String(day.month + 1).padStart(2, '0');
  const dd = String(day.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert `[TuiDay, TuiTime]` → ISO `YYYY-MM-DDTHH:mm:ss`. Day=null → null (cả tuple). */
function dateTimeToIso(value: [TuiDay | null, TuiTime | null]): string | null {
  const [day, time] = value;
  if (!day) return null;
  const datePart = tuiDayToIso(day)!;
  const t = time ?? new TuiTime(0, 0, 0);
  const hh = String(t.hours).padStart(2, '0');
  const mm = String(t.minutes).padStart(2, '0');
  const ss = String(t.seconds ?? 0).padStart(2, '0');
  return `${datePart}T${hh}:${mm}:${ss}`;
}
