import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TuiButtonModule } from "@taiga-ui/core";

@Component({
  selector: 'app-grid-header',
  standalone: true,
  imports: [CommonModule, TuiButtonModule],
  templateUrl: './grid-header.component.html',
  styleUrls: ['./grid-header.component.scss']
})
export class GridHeaderComponent {
  @Input() title: string = '';

  @Input() subtitle: string = '';

  @Input() customIcon: string = 'tuiIconCheck';
  
  @Input() buttons: { label: string, icon?: string }[] = [
    { label: 'Thêm mới', icon: 'plus' },
    { label: 'Xuất Excel', icon: 'download' },
    { label: 'Nhập dữ liệu', icon: 'upload' },
    { label: 'Xóa', icon: 'trash' }
  ];

  @Input()
  public showBtnCustom: boolean = false;

  @Input()
  public showBtnReject: boolean = false;

  @Input()
  public showBtnApproval: boolean = false;

  @Input()
  public showBtnSendApprove: boolean = false;

  @Input()
  public showBtnExport: boolean = false;

  @Input()
  public showBtnAssessment: boolean = false;

  @Input()
  public showBtnCreateNew: boolean = false;

  @Input()
  public showBtnDelete: boolean = false;
  
  @Input()
  public btnLabelCustom = 'Btn Custom';

  @Input()
  public btnLabelReject = 'Từ chối';

  @Input()
  public btnLabelApproval = 'Phê duyệt';

  @Input()
  public btnLabelSendApprove = 'Gửi duyệt';

  @Input()
  public btnLabelExport = 'Xuất danh sách';

  @Input()
  public btnLabelAssessment = 'Chọn ban thẩm định';

  @Input()
  public btnLabelCreateNew = 'Thêm mới';

  @Input()
  public btnLabelDelete = 'Xóa';

  @Input()
  public disableCustom = false;

  @Input()
  public disableReject = false;

  @Input()
  public disableApproval = false;

  @Input()
  public disableSendApprove = false;

  @Input()
  public disableDelete = false;
  
  @Input()
  public disableAssessment = false;

  @Input()
  public disableExport = false;
  
  @Input()
  public disableCreateNew = false;

  @Output() buttonClickCustom = new EventEmitter<string>();
  @Output() buttonClickReject = new EventEmitter<string>();
  @Output() buttonClickApproval = new EventEmitter<string>();
  @Output() buttonClickSendApprove = new EventEmitter<string>();
  @Output() buttonClickExport = new EventEmitter<string>();
  @Output() buttonClickCreateNew = new EventEmitter<string>();
  @Output() buttonClickDelete = new EventEmitter<string>();
  @Output() buttonClickAssessment = new EventEmitter<string>();

  onButtonClickCustom() {
    this.buttonClickCustom.emit();
  }

  onButtonClickReject() {
    this.buttonClickReject.emit();
  }

  onButtonClickApproval() {
    this.buttonClickApproval.emit();
  }

  onButtonClickSendApprove() {
    this.buttonClickSendApprove.emit();
  }

  onButtonClickExport() {
    this.buttonClickExport.emit();
  }

  onButtonClickCreateNew() {
    this.buttonClickCreateNew.emit();
  }

  onButtonClickDelete() {
    this.buttonClickDelete.emit();
  }

  onButtonClickAssessment() {
    this.buttonClickAssessment.emit();
  }
}