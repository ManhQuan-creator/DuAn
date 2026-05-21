import { PageAndOrderRequest } from "../../shared/models/common.model";

export interface CatalogTypeItem {
  id: number;
  type: string;
  name: string;
  description: string;
  icon?: string;
  sortOrder: number;
  active: boolean;
}

export interface CreateCatalogTypeRequest {
  type: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateCatalogTypeRequest {
  name?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface CreateCatalogItemRequest {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  note?: string;
  sortOrder?: number;
}

export interface UpdateCatalogItemRequest {
  name?: string;
  parentId?: string;
  note?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface FilterCatalogItemRequest extends PageAndOrderRequest {
    type?: string;
    keyword?: string;
    active?: boolean;
}