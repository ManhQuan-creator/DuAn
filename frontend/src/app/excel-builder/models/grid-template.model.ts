import { PageAndOrderRequest } from "../../shared/models/common.model";

/** Kỳ báo cáo của biểu mẫu */
export type PeriodType = 'YEAR' | 'HALF_YEAR' | 'QUARTER' | 'MONTH';

export const PERIOD_TYPE_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'YEAR',      label: 'Năm' },
  { value: 'HALF_YEAR', label: '6 tháng' },
  { value: 'QUARTER',   label: 'Quý' },
  { value: 'MONTH',     label: 'Tháng' },
];

export interface GridTemplateListItem {
  id: number;
  code: string;
  name: string;
  description: string;
  status: string;
  version: number;
  processDefinitionKey: string | null;
  reportDepartments: string[];
  reportFcGroups: string[];
  periodType?: PeriodType;
  /** Bật tính năng "Hạn xử lý" — entry mới sẽ có input due_date + render hiện badge. */
  useDueDate?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterGridTemplateRequest extends PageAndOrderRequest {
  keyword?: string;
  status?: string;
}

export interface GridRowDto {
  id?: number;
  rowCode: string;
  rowName: string;
  rowData: string;
  cellConfig: string;
  isTypeHeader: boolean;
  catalogField: string;
  sortOrder: number;
}

export interface GridTemplateDetail {
  id: number;
  code: string;
  name: string;
  description: string;
  columnConfigs: string;
  columnGroups: string;
  status: string;
  version: number;
  rows: GridRowDto[];
  processDefinitionKey: string | null;
  reportDepartments: string[];
  reportFcGroups: string[];
  periodType?: PeriodType;
  /** Bật tính năng "Hạn xử lý" — entry mới sẽ có input due_date + render hiện badge. */
  useDueDate?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}


export interface GridDataEntryListItem {
  id: number;
  entryCode: string;
  entryName: string;
  orgCode: string | null;
  year: number;
  month: number | null;
  status: string;
  submittedBy: string;
  submittedAt: string;
  /** ISO datetime — null nếu entry cũ trước khi bổ sung due_date. */
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GridDataEntryDetail {
  id: number;
  templateId: number;
  entryCode: string;
  entryName: string;
  orgCode: string | null;
  year: number;
  month: number | null;
  /**
   * JSON array các row objects (snapshot độc lập với template). Mỗi row có:
   * `row_code`, `row_name`, `_isTypeHeader`/`_catalogField`/`_isCustomRow`
   * (flags), `_cellConfig` (formula/dropdown/datepicker/format/validation per
   * cell), và values cho mỗi field. Custom rows do NSD thêm có flag
   * `_isCustomRow=true`. Order = visual index trong array.
   */
  rowData: string;
  status: string;
  processInstanceId: string | null;
  submittedBy: string;
  submittedAt: string;
  /** ISO datetime — null nếu entry cũ trước khi bổ sung due_date. */
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
