import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  TuiScrollbarModule,
  TuiDataListModule,
  TuiSvgModule,
  TuiHostedDropdownModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import {
  TuiInputModule,
  TuiInputComponent,
} from '@taiga-ui/kit';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiHostedDropdownModule,
    TuiScrollbarModule,
    TuiDataListModule,
    TuiInputModule,
    TuiSvgModule,
    TuiTextfieldControllerModule,
  ],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.scss',
})
export class CustomSelectComponent<T> implements OnChanges, OnDestroy {
  // ================= INPUT =================
  @Input() public items: T[] = [];

  @Input() public stringifyLabel!: (item: T) => string;

  @Input() public isLoadDb = false;

  @Input() public filterFunction!: (item: T, query: string) => boolean;

  @Input() public isShowSelectAllValue = false;

  @Input() public selectAllValue!: T;

  @Input() public labelNoResult = 'Không có kết quả';

  @Input() public isSearch = true;

  @Input() public placeholder = 'Chọn một giá trị...';

  // ================= OUTPUT =================
  @Output() searchChangeEnvet = new EventEmitter<string>();
  @Output() valueChange = new EventEmitter<T>();

  // ================= STATE =================
  listItem: T[] = [];
  query = '';
  selectedItem: T | null = null;
  protected labelResult = 'Không có kết quả';

  @ViewChild('searchField') searchField?: TuiInputComponent;

  private _isOpen = false;
  get isOpen(): boolean {
    return this._isOpen;
  }
  set isOpen(value: boolean) {
    this._isOpen = value;
    // Reset query khi đóng dropdown
    if (!value) {
      this.query = '';
    }
  }

  private readonly querySubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  // ================= LIFECYCLE =================
  constructor() {
    this.handleSearch();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.listItem = this.items || [];
    }
    if (changes['labelNoResult']) {
      this.labelResult = this.labelNoResult;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ================= INIT =================
  private handleSearch(): void {
    this.querySubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        if (this.isLoadDb) {
          // isLoadDb = true → emit ra ngoài để parent gọi API
          this.searchChangeEnvet.emit(query);
        }
        // isLoadDb = false → displayList getter tự lọc
      });
  }

  // ================= EVENTS =================
  onQueryChange(value: string): void {
    this.query = value;
    this.querySubject.next(value);
  }

  onSelect(item: T): void {
    this.selectedItem = item;
    this.valueChange.emit(item);
    this.isOpen = false;
  }

  onArrowDown(list: any, event: Event): void {
    if (list) {
      list.nativeElement?.focus?.();
    }
  }

  onKeyDown(key: string, inputEl?: HTMLElement | null): void {
    if (key === 'ArrowUp' && inputEl) {
      inputEl.focus();
    }
  }

  // ================= DISPLAY LIST =================
  /**
   * isLoadDb = true  → data đã được lọc từ API (parent cập nhật items),
   *                    chỉ hiển thị thẳng listItem, không lọc thêm
   * isLoadDb = false → tự filter phía client qua filterFunction
   */
  get displayList(): T[] {
    if (this.isLoadDb) {
      return this.listItem;
    }

    if (!this.query.trim()) {
      return this.listItem;
    }

    if (!this.filterFunction) {
      // Không có filterFunction → fallback tự filter theo stringifyLabel
      return this.listItem.filter((item) =>
        this.stringifyLabel(item)
          .toLowerCase()
          .includes(this.query.toLowerCase()),
      );
    }

    return this.listItem.filter((item) =>
      this.filterFunction(item, this.query),
    );
  }
}
