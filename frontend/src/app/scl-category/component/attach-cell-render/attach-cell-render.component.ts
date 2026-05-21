import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { TuiSvgModule } from "@taiga-ui/core";

@Component({
  selector: 'app-attach-cell-render',
  imports: [TuiSvgModule],
  templateUrl: './attach-cell-render.component.html',
  styleUrl: './attach-cell-render.component.scss'
})
export class AttachCellRenderComponent implements ICellRendererAngularComp {

  fileCount = 0;
  private onAttachClick?: (data: any) => void;
  private rowData: any;

  agInit(params: ICellRendererParams & { onAttachClick?: (data: any) => void }): void {
    this.onAttachClick = params.onAttachClick;
    this.rowData = params.data;
    this.setData(params.value);
  }

  refresh(params: ICellRendererParams & { onAttachClick?: (data: any) => void }): boolean {
    this.onAttachClick = params.onAttachClick;
    this.rowData = params.data;
    this.setData(params.value);
    return true;
  }

  handleClick(): void {
    this.onAttachClick?.(this.rowData);
  }

  private setData(value: any): void {
    if (Array.isArray(value)) {
      this.fileCount = value.length;
    } else if (!isNaN(value)) {
      this.fileCount = Number(value);
    } else {
      this.fileCount = 0;
    }
  }
}