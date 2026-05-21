import { PageAndOrderRequest } from "../../shared/models/common.model";

export interface UserItem {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  orgGroupCode: string;
  companyCode: string | null;
  companyName: string | null;
  deptCode: string;
  deptName: string | null;
  positionCode: string;
  positionName: string | null;
  active: boolean;
  roles: string[];
  createdAt: string;
}

export interface FilterAppUserRequest extends PageAndOrderRequest {
  keyword?: string;
  active?: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  orgGroupCode: string;
  companyCode?: string;
  deptCode?: string;
  positionCode?: string;
  roleCodes: string[];
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  orgGroupCode?: string;
  companyCode?: string;
  deptCode?: string;
  positionCode?: string;
  password?: string;
  active?: boolean;
  roleCodes?: string[];
}
