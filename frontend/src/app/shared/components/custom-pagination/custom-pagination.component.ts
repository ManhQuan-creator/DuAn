import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-pagination.component.html',
  styleUrls: ['./custom-pagination.component.scss']
})
export class CustomPaginationComponent implements OnChanges {
  @Input() totalRows: number = 0;
  @Input() currentPage: number = 1;
  @Input() pageSize: number = 10;
  @Input() pageSizeOptions: number[] = [10, 20, 50, 100];

  @Output() pageChanged = new EventEmitter<{ page: number; pageSize: number }>();
  @Output() pageSizeChanged = new EventEmitter<{ page: number; pageSize: number }>();

  pageNumbers: number[] = []; // -1 = dấu "..."

  get totalPages(): number {
    return Math.ceil(this.totalRows / this.pageSize);
  }
  get rangeStart(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }
  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRows);
  }

  ngOnChanges(): void {
    this.buildPages();
  }

  buildPages(): void {
    const c = this.currentPage;
    const total = this.totalPages;
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (c > 4) pages.push(-1);          // "..."
      const start = Math.max(2, c - 1);
      const end   = Math.min(total - 1, c + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (c < total - 3) pages.push(-1);  // "..."
      pages.push(total);
    }

    this.pageNumbers = pages;
  }

  go(page: number): void {
    if (page === this.currentPage) return;
    this.pageChanged.emit({ page, pageSize: this.pageSize });
  }

  goPrev(): void { this.go(this.currentPage - 1); }
  goNext(): void { this.go(this.currentPage + 1); }

  onSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.pageSizeChanged.emit({ page: 1, pageSize: size });
  }
}