import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiSvgModule } from '@taiga-ui/core';

export interface ContextMenuState {
  x: number;
  y: number;
  row: any;
  showAdd: boolean;
  showDelete: boolean;
  showResetCellConfig: boolean;
}

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 100;

@Component({
  selector: 'app-render-context-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiSvgModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (menu; as m) {
      <div
        class="custom-row-menu"
        [style.left.px]="m.x"
        [style.top.px]="m.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault(); $event.stopPropagation()"
      >
        @if (m.showAdd) {
          <div class="custom-row-menu__add">
            <button
              type="button"
              class="custom-row-menu__item custom-row-menu__add-btn"
              (click)="emitAdd()"
            >
              <tui-svg src="tuiIconPlus" class="custom-row-menu__icon"></tui-svg>
              Thêm
            </button>
            <input
              type="number"
              class="custom-row-menu__count-input"
              [min]="quantityMin"
              [max]="quantityMax"
              [(ngModel)]="quantity"
              (keydown.enter)="emitAdd()"
              (click)="$event.stopPropagation()"
              title="Số dòng cần thêm"
            />
            <span class="custom-row-menu__suffix">dòng bên dưới</span>
          </div>
        }
        @if (m.showDelete) {
          <button
            type="button"
            class="custom-row-menu__item custom-row-menu__item--danger"
            (click)="delete.emit()"
          >
            <tui-svg src="tuiIconTrash2" class="custom-row-menu__icon"></tui-svg>
            Xóa dòng này
          </button>
        }
        @if (m.showResetCellConfig) {
          <button
            type="button"
            class="custom-row-menu__item"
            (click)="resetCellConfig.emit()"
          >
            <tui-svg src="tuiIconRotateCcw" class="custom-row-menu__icon"></tui-svg>
            Khôi phục công thức theo mẫu gốc
          </button>
        }
      </div>
    }
  `,
})
export class RenderContextMenuComponent implements OnChanges {
  @Input() menu: ContextMenuState | null = null;
  @Output() readonly addBelow = new EventEmitter<number>();
  @Output() readonly delete = new EventEmitter<void>();
  @Output() readonly resetCellConfig = new EventEmitter<void>();

  readonly quantityMin = QUANTITY_MIN;
  readonly quantityMax = QUANTITY_MAX;
  quantity: number = QUANTITY_MIN;

  ngOnChanges(changes: SimpleChanges): void {
    const m = changes['menu'];
    if (m && !m.previousValue && this.menu) {
      this.quantity = QUANTITY_MIN;
    }
  }

  emitAdd(): void {
    const n = this.clampQuantity(this.quantity);
    this.quantity = n;
    this.addBelow.emit(n);
  }

  private clampQuantity(value: unknown): number {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < QUANTITY_MIN) return QUANTITY_MIN;
    if (n > QUANTITY_MAX) return QUANTITY_MAX;
    return n;
  }
}
