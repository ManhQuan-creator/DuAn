import { EntryFileItem } from "../../excel-render/service/entry-file.service";
import { PageAndOrderRequest } from "../../shared/models/common.model";

export interface SuggestedCategoryFilter extends PageAndOrderRequest {
    unitName?: string;
    categoryName?: string;
    categoryCode?: string;
    yearPlan?: string;
    status?: string;
}

export interface SuggestedCategory {
    id?: number;
    unitName?: string;
    categoryName?: string;
    categoryCode?: string;
    yearPlan?: string;
    estimatedValue?: string;
    status?: string;
    attachmentFile?: EntryFileItem[];
}
