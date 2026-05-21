import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ICellRendererAngularComp } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";


const STATUS_MAP: Record<string, { label: string; class: string }> = {
  'CHUA_GUI_THAM_DINH': { label: 'Chưa gửi thẩm định', class: 'draft' },
  'DA_GUI_TD': { label: 'Đã gửi thẩm định', class: 'submitted' },
  'DA_DUYET_TD': { label: 'Đã duyệt thẩm định', class: 'approved' },
  'GUI_LD_DUYET': { label: 'Gửi LĐ duyệt', class: 'pending' },
  'LD_KHONG_THONG_QUA': { label: 'LĐ không thông qua', class: 'rejected' },
  'LD_DA_THONG_QUA': { label: 'LĐ đã thông qua', class: 'approved' },
  'TU_CHOI_DUYET_TD': { label: 'Đã từ chối duyệt thẩm định', class: 'rejected' },
  'DIEU_CHINH_TD': { label: 'Điều chỉnh thẩm định', class: 'warning' },
};
@Component({
  selector: 'app-status-cell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [ngClass]="cssClass">
      {{ label }}
    </span>
  `,
  styles: [`
    span {
      display: inline-flex;
      align-items: center;
      padding: 0 8px;
      height: 25px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .create {
      background: #d8d8d8;
      color: #5f6368;
    }

    /* 1 - Draft */
    .draft {
      background: #f1f3f4;
      color: #5f6368;
    }

    /* 2 - Submitted */
    .submitted {
      background: #e8f0fe;
      color: #1a73e8;
    }

    /* 3 - Approved */
    .approved {
      background: #e6f4ea;
      color: #137333;
    }

    /* 4 - Pending */
    .pending {
      background: #fef7e0;
      color: #b06000;
    }

    /* 5 - Done */
    .done {
      background: #e0f7fa;
      color: #006064;
    }

    /* 6 - Rejected */
    .rejected {
      background: #fce8e6;
      color: #c5221f;
    }

    /* fallback */
    .default {
      background: #eeeeee;
      color: #333;
    }
  `]
})
export class StatusCellRenderComponent implements ICellRendererAngularComp {
  label = '';
  cssClass = '';

  agInit(params: ICellRendererParams): void {
    this.setData(params.value);
  }

  refresh(params: ICellRendererParams): boolean {
    this.setData(params.value);
    return true;
  }

  private setData(statusId: string) {
    const status = STATUS_MAP[statusId];

    if (status) {
      this.label = status.label;
      this.cssClass = status.class;
    } else {
      this.label = 'Không xác định';
      this.cssClass = 'default';
    }
  }
}