import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButtonModule } from '@taiga-ui/core';

/** Toggle + collapsible panel hướng dẫn viết công thức cho Excel Builder. */
@Component({
  selector: 'app-builder-formula-help',
  standalone: true,
  imports: [CommonModule, TuiButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title-row">
      <h2 class="page-title">{{ title || 'Cấu hình biểu mẫu động' }}</h2>
      <button
        tuiButton
        appearance="icon"
        size="xs"
        class="help-toggle-btn"
        [title]="visible ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'"
        (click)="toggle()"
      >
        ?
      </button>
    </div>

    @if (visible) {
      <div class="formula-help-content">
        <h4>Hướng dẫn viết công thức</h4>
        <ul>
          <li><strong>Phép tính cơ bản:</strong> <code>(A + B) * 10%</code></li>
          <li><strong>Tham chiếu cột (Dòng hiện tại):</strong> <code>DOANHTHU - CHIPHI</code></li>
          <li><strong>Tham chiếu chéo (Đơn vị khác):</strong> <code>PCHP_SANLUONG + PCHD_SANLUONG</code></li>
          <li><strong>Điều kiện:</strong> <code>IF(LOINHUAN > 0, LOINHUAN * 0.2, 0)</code></li>
          <li><strong>Làm tròn:</strong> <code>ROUND(GIATRI)</code></li>
        </ul>
        <p><em>Lưu ý: Mã dòng/cột không phân biệt hoa thường, không chứa ký tự đặc biệt.</em></p>
      </div>
    }
  `,
})
export class BuilderFormulaHelpComponent {
  @Input() title = '';
  @Input() visible = false;
  @Output() readonly visibleChange = new EventEmitter<boolean>();

  toggle(): void {
    this.visibleChange.emit(!this.visible);
  }
}
