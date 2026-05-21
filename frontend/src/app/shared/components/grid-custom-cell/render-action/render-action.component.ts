import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TuiButtonModule, TuiSvgModule } from '@taiga-ui/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

type RowVis = boolean | ((row: unknown) => boolean) | undefined;

/** Hỗ trợ cả grid dùng id số (template, entry) và id chuỗi (catalog). */
export type RenderActionRowId = string | number;

@Component({
  selector: 'app-render-action',
  standalone: true,
  imports: [CommonModule, TuiButtonModule, TuiSvgModule],
  templateUrl: './render-action.component.html',
  styleUrl: './render-action.component.scss',
})
export class RenderActionComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams & {
    onDetail?: (data: any) => void;
    onRender?: (data: any) => void;
    onDownload?: (data: any) => void;
    onEdit?: (data: any) => void;
    onDelete?: (data: any) => void;
    onPublish?: (data: any) => void;
    onCopy?: (data: any) => void;
    onAssessment?: (data: any) => void;
    onConfirmAssessment?: (data: any) => void;
    isActionLoading?: (id: RenderActionRowId) => boolean;
    showDetail?: RowVis;
    showRender?: RowVis;
    showDownload?: RowVis;
    showEdit?: RowVis;
    showPublish?: RowVis;
    showCopy?: RowVis;
    showDelete?: RowVis;
    showAssessment?: RowVis;
    showConfirmAssessment?: RowVis;
  };

  agInit(params: ICellRendererParams): void {
    this.params = params as any;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params as any;
    return true;
  }

  private resolveVis(flag: RowVis, whenUndefined: boolean): boolean {
    if (flag === undefined) return whenUndefined;
    if (typeof flag === 'function') return !!flag(this.params?.data);
    return !!flag;
  }

  private get rowData(): any {
    return this.params?.data;
  }

  private get rowId(): RenderActionRowId | undefined {
    const id = this.rowData?.id;
    if (typeof id === 'number' || typeof id === 'string') return id;
    return undefined;
  }

  get isLoading(): boolean {
    const id = this.rowId;
    if (id === undefined || id === '') return false;
    return this.params.isActionLoading?.(id) ?? false;
  }

  get showDetailBtn(): boolean {
    const defaultVisible = typeof this.params.onDetail === 'function';
    return this.resolveVis(this.params.showDetail, defaultVisible);
  }

  get showRenderBtn(): boolean {
    const defaultVisible = typeof this.params.onRender === 'function';
    return this.resolveVis(this.params.showRender, defaultVisible);
  }

  get showEditBtn(): boolean {
    const defaultVisible = typeof this.params.onEdit === 'function';
    return this.resolveVis(this.params.showEdit, defaultVisible);
  }

  get showPublishBtn(): boolean {
    const def =
      typeof this.params.onPublish === 'function' &&
      this.rowData?.status !== 'PUBLISHED';
    return this.resolveVis(this.params.showPublish, def);
  }

  get showDownloadBtn(): boolean {
    const defaultVisible = typeof this.params.onDownload === 'function';
    return this.resolveVis(this.params.showDownload, defaultVisible);
  }

  get showCopyBtn(): boolean {
    const defaultVisible = typeof this.params.onCopy === 'function';
    return this.resolveVis(this.params.showCopy, defaultVisible);
  }

  get showDeleteBtn(): boolean {
    const defaultVisible = typeof this.params.onDelete === 'function';
    return this.resolveVis(this.params.showDelete, defaultVisible);
  }

  get showAssessmentBtn(): boolean {
    const defaultVisible = typeof this.params.onAssessment === 'function';
    return this.resolveVis(this.params.showAssessment, defaultVisible);
  }

  get showConfirmAssessmentBtn(): boolean {
    const defaultVisible = typeof this.params.onConfirmAssessment === 'function';
    return this.resolveVis(this.params.showConfirmAssessment, defaultVisible);
  }

  onDetailClick(): void {
    if (this.isLoading) return;
    this.params.onDetail?.(this.rowData);
  }

  onRenderClick(): void {
    if (this.isLoading) return;
    this.params.onRender?.(this.rowData);
  }

  onDownloadClick(): void {
    if (this.isLoading) return;
    this.params.onDownload?.(this.rowData);
  }

  onEditClick(): void {
    if (this.isLoading) return;
    this.params.onEdit?.(this.rowData);
  }

  onPublishClick(): void {
    if (this.isLoading) return;
    this.params.onPublish?.(this.rowData);
  }

  onCopyClick(): void {
    if (this.isLoading) return;
    this.params.onCopy?.(this.rowData);
  }

  onDeleteClick(): void {
    if (this.isLoading) return;
    this.params.onDelete?.(this.rowData);
  }

  onAssessmentClick(): void {
    if (this.isLoading) return;
    this.params.onAssessment?.(this.rowData);
  }

  onConfirmAssessmentClick(): void {
    if (this.isLoading) return;
    this.params.onConfirmAssessment?.(this.rowData);
  }
}
