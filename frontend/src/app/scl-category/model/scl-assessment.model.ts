import { Option, PageAndOrderRequest } from "../../shared/models/common.model";
import { CommentContent, Comments, UserComment} from "../../shared/service/comments.service";
import { SclCategory } from "./scl-category.model";

export interface SclAssessment {
  id?: number;
  pc?: string;
  unit?: string;
  categoryCode?: string;
  assetCode?: string;
  categoryName?: string;
  assetType?: string;
  planType?: string;
  actualVolume?: string;
  progress?: string;
  lastSclYear?: string;
  yearPlan?: string;
  registerType?: string;
  status?: string;
  updatedAt?: string;
  categoryId?: number;
  assessmentDeptCode?: string;
  assessmentDeptName?: string;
}

export interface SclAssessmentDetail {
  id?: number;
  actualVolume?: string;
  progress?: string;
  lastSclYear?: string;
  status?: string;
  updatedAt?: string;
  assessmentDeptCode?: string;
  assessmentDeptName?: string;

  categoryResponse: SclCategory;
}

export interface SclAssessmentFilter extends PageAndOrderRequest {
  unit?: string;
  categoryCode?: string;
  categoryName?: string;
  yearPlan?: string;
  progress?: string;
  status?: string;
  assetType?: string;
  planType?: string;
  registerType?: string;
  categoryId?: number;
  assessmentDeptCode?: string;
}

export interface RejectRequest {
  id: number;
  reason: string;
}

export interface ReviseRequest {
  id: number;
}

export interface RejectionAssessment {
  reason: string;
  attachments: File[];
  year?: string | null;
}

export interface IdsDTO {
  ids: number[];
  assessmentUnit?: Option[];
  rejectReason?: string;
  status?: string;
}