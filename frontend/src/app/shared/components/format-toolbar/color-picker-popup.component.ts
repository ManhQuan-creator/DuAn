import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

const SUGGESTED_COLORS: string[] = [
  '#000000', '#475569', '#dc2626', '#ea580c',
  '#f59e0b', '#eab308', '#16a34a', '#0d9488',
  '#2563eb', '#7c3aed', '#db2777', '#ffffff',
];

const HEX_PATTERN = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/** Chuẩn hóa hex thành "#rrggbb" lowercase. Expand 3-char "#fff" → "#ffffff". */
function normalizeHex(raw: string): string {
  const trimmed = raw.trim().replace(/^#/, '').toLowerCase();
  const expanded = trimmed.length === 3
    ? trimmed.split('').map((c) => c + c).join('')
    : trimmed;
  return '#' + expanded;
}

/**
 * Popup color picker mini: 12 swatch gợi ý + hex input + nút "Không màu".
 * Tự đóng khi click ngoài hoặc Esc. Phát `colorPicked` (string hex hoặc null).
 */
@Component({
  selector: 'app-color-picker-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cp-popup" (click)="$event.stopPropagation()">
      <div class="cp-swatches">
        <button
          *ngFor="let c of suggested"
          type="button"
          class="cp-swatch"
          [class.cp-swatch--white]="c === '#ffffff'"
          [class.cp-swatch--active]="c.toLowerCase() === currentColor?.toLowerCase()"
          [style.backgroundColor]="c"
          [title]="c"
          (click)="pick(c)"
        ></button>
      </div>

      <label class="cp-spectrum-label">
        <span class="cp-spectrum-text">Bảng màu đầy đủ</span>
        <input
          type="color"
          class="cp-spectrum-input"
          [value]="currentColor || '#000000'"
          (input)="onSpectrumInput($event)"
          (change)="onSpectrumChange($event)"
        />
      </label>

      <div class="cp-hex-row">
        <input
          type="text"
          class="cp-hex-input"
          placeholder="#RRGGBB"
          maxlength="7"
          [(ngModel)]="hexDraft"
          (keydown.enter)="applyHex()"
          (keydown.escape)="closed.emit()"
        />
        <button type="button" class="cp-apply" (click)="applyHex()" [disabled]="!isValidHex(hexDraft)">Áp dụng</button>
      </div>
      <button type="button" class="cp-clear" (click)="pick(null)">Không màu</button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cp-popup {
      position: absolute;
      z-index: 50;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
      padding: 10px;
      width: 200px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cp-swatches {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .cp-swatch {
      width: 100%;
      aspect-ratio: 1 / 1;
      border: 1px solid rgba(15, 23, 42, 0.15);
      border-radius: 4px;
      cursor: pointer;
      padding: 0;
      transition: transform 0.1s ease, border-color 0.1s ease;
    }
    .cp-swatch:hover { transform: scale(1.08); border-color: #2563eb; }
    .cp-swatch--white { border-color: #cbd5e1; }
    .cp-swatch--active { outline: 2px solid #2563eb; outline-offset: 1px; }
    .cp-spectrum-label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      cursor: pointer;
      background: #ffffff;
      transition: border-color 0.12s ease, background 0.12s ease;
    }
    .cp-spectrum-label:hover { background: #f8fafc; border-color: #94a3b8; }
    .cp-spectrum-text {
      flex: 1;
      font-size: 12px;
      color: #334155;
    }
    .cp-spectrum-input {
      width: 28px;
      height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      cursor: pointer;
      padding: 0;
      background: transparent;
    }
    .cp-spectrum-input::-webkit-color-swatch-wrapper { padding: 0; border-radius: 2px; }
    .cp-spectrum-input::-webkit-color-swatch { border: none; border-radius: 2px; }
    .cp-spectrum-input::-moz-color-swatch { border: none; border-radius: 2px; }
    .cp-hex-row { display: flex; gap: 6px; }
    .cp-hex-input {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      text-transform: uppercase;
    }
    .cp-hex-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18); }
    .cp-apply, .cp-clear {
      padding: 4px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.12s ease;
    }
    .cp-apply:hover:not(:disabled), .cp-clear:hover { background: #f1f5f9; }
    .cp-apply:disabled { opacity: 0.5; cursor: not-allowed; }
    .cp-clear { color: #64748b; }
  `],
})
export class ColorPickerPopupComponent implements OnInit {
  @Input() currentColor: string | null = null;
  @Output() colorPicked = new EventEmitter<string | null>();
  @Output() closed = new EventEmitter<void>();

  readonly suggested = SUGGESTED_COLORS;
  hexDraft = '';

  constructor(private elRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.hexDraft = this.currentColor ?? '';
  }

  isValidHex(raw: string): boolean {
    return HEX_PATTERN.test((raw || '').trim());
  }

  pick(color: string | null): void {
    this.colorPicked.emit(color);
  }

  applyHex(): void {
    const v = (this.hexDraft || '').trim();
    if (!this.isValidHex(v)) return;
    this.colorPicked.emit(normalizeHex(v));
  }

  /** Spectrum picker đang kéo → cập nhật hex input để user thấy giá trị, không emit liên tục. */
  onSpectrumInput(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.hexDraft = value.toLowerCase();
  }

  /** Spectrum đóng dialog → emit + đóng popup. */
  onSpectrumChange(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    if (this.isValidHex(value)) {
      this.colorPicked.emit(value.toLowerCase());
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(ev.target as Node)) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
