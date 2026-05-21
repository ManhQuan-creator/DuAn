import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

/**
 * Format Vietnamese-style number.
 *
 * - "1000000,2"        → "1.000.000,2"
 * - "1.000.000,2"      → "1.000.000,2" (idempotent — already formatted)
 * - "abc 1000000 def"  → "abc 1.000.000 def" (mixed content — format các đoạn số bên trong)
 * - "ABC"              → "ABC"
 * - "" / null          → ""
 *
 * Quy ước: dấu `.` là phân cách hàng nghìn, dấu `,` là phân cách thập phân (chuẩn VN).
 *
 * Áp dụng trên `<tui-input>` (hay native input) có `formControlName` /
 * `[(ngModel)]`. Format on:
 *  - `ngOnInit` → giá trị initial từ template/parent.
 *  - `valueChanges` → programmatic patch (vd `form.patchValue(beResponse)`),
 *    skip khi host đang focus để user gõ không bị nhảy caret.
 *  - `focusout` → fallback sau khi user edit xong.
 */
@Directive({
  selector: '[appVnNumberFormat]',
  standalone: true,
})
export class VnNumberFormatDirective implements OnInit, OnDestroy {
  private readonly ngControl = inject(NgControl, { optional: true });
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    const ctrl = this.ngControl?.control;
    if (!ctrl) return;

    this.applyFormat();

    ctrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (!this.isHostFocused()) {
        this.applyFormat();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('focusout')
  onFocusOut(): void {
    this.applyFormat();
  }

  private applyFormat(): void {
    const ctrl = this.ngControl?.control;
    if (!ctrl) return;
    const formatted = formatVnNumber(ctrl.value);
    if (formatted !== ctrl.value) {
      ctrl.setValue(formatted, { emitEvent: false });
    }
  }

  private isHostFocused(): boolean {
    const el = this.host.nativeElement;
    const active = document.activeElement;
    return !!active && el.contains(active);
  }
}

/**
 * Format chuỗi theo number VN. Idempotent với chuỗi đã format.
 * - Pure-number input → format toàn bộ.
 * - Mixed content (chứa kí tự khác số) → chỉ format từng cụm số liền nhau,
 *   giữ nguyên phần còn lại.
 */
export function formatVnNumber(input: unknown): string {
  if (input == null) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  const stripped = raw.replace(/\./g, '');
  const fullMatch = stripped.match(/^(-?)(\d+)(?:,(\d+))?$/);
  if (fullMatch) {
    const [, sign, intPart, decPart] = fullMatch;
    const formattedInt = formatIntPart(intPart);
    return decPart ? `${sign}${formattedInt},${decPart}` : `${sign}${formattedInt}`;
  }

  return raw.replace(/\d+(?:,\d+)?/g, (chunk) => {
    const sub = chunk.match(/^(\d+)(?:,(\d+))?$/);
    if (!sub) return chunk;
    const [, intPart, decPart] = sub;
    const formattedInt = formatIntPart(intPart);
    return decPart ? `${formattedInt},${decPart}` : formattedInt;
  });
}

function formatIntPart(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
