import { EntryFileItem } from '../../excel-render/service/entry-file.service';
import { PageAndOrderRequest } from '../../shared/models/common.model';
import {
  CommentContent,
  UserComment,
} from '../../shared/service/comments.service';

export interface SclCategorFilter extends PageAndOrderRequest {
    id?: number;
    unit?: string;
    categoryCode?: string;
    categoryName?: string;
    yearPlan?: string;
    progress?: string | string[];
    status?: string | string[];
    assetType?: string | string[];
    planType?: string | string[];
    registerType?: string | string[];
}

export interface SclCategoryIdsRequest {
  ids: number[];
  rejectReason?: string;
  status?: string;
}

export interface SclHistoryFilter extends PageAndOrderRequest {
  sclCategoryId?: number;
}

export interface SclCategory {
    id?: number;
    pc?: string;
    unit?: string;
    categoryCode?: string;
    assetCode?: string;
    categoryName?: string;
    assetType?: string;
    planType?: string;
    status?: string;
    yearPlan?: string;
    lastSclYear?: string;
    actualVolume?: string;
    progress?: string;
    scContent?: string;
    sclPerform?: string;
    ssktCode?: number;
    dateCompleteContract?: string;
    approvedCategory?: string;
    approvalLevel?: string;
    executionMethod?: string;
    accumulatedProgress?: string;
    nextMonthPlan?: string;
    decisionNoPakt?: number;
    approvalDatePakt?: string;
    decisionNoEstimate?: number;
    approvalDateEstimate?: string;
    valueVat?: string;
    approvedEstimatedCost?: string;
    assignedSclCost?: string;
    totalContractValue?: string;
    monthAccountingValue?: string;
    accumulatedAccountingValue?: string;
    projectValue?: string;
    itemAccountingValue?: string;
    deliveryPlan?: string;
    plannedCompletionDate?: string;
    actual?: string;
    percentage?: string;
    valueCostEquivalent?: string;
    equipmentBeforeScl?: string;
    equipmentAfterScl?: string;
    issues?: string;
    note?: string;
    updatedAt?: string;
    createdAt?: string;
    registerType?: string;
    categoryCommentsDTO?: CategoryCommentsDTO;
}

export interface UnitAssessment {
  id: number;
  status: string;
  assessmentDeptCode: string;
  assessmentDeptName: string;
  commentContents: CommentContent[];
}

export interface CategoryCommentsDTO {
  currentUser: UserComment;
  listUnitAssessment: UnitAssessment[];
  userComments: UserComment[];
  attachComments: EntryFileItem[];
}

export interface SclHistory {
  id?: number;
  sclCategoryId?: number;
  unit?: string;
  categoryName?: string; // Tên hạng mục
  categoryType?: string; // Phân loại
  yearPlan?: string; // Năm kế hoạch
  actualVolume?: string; // KL thực hiện
  progress?: string; // Tiến độ
  note?: string; // Ghi chú
  month?: string; // Tháng
  updatedAt?: string;
  createdAt?: string;
}
