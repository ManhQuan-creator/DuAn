import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { FilterAppUserRequest } from '../models/app-user.model';
import { Page, ResponseData } from '../../shared/models/common.model';

export interface PcCompanyOption {
  companyCode: string;
  companyName: string;
}

export interface OrgOption {
  orgCode: string;
  orgName: string;
}

export interface PositionOption {
  positionCode: string;
  positionName: string;
}

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

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/excelpro-service/v1/users';

  searchUsers(req: FilterAppUserRequest): Observable<Page<UserItem>> {
    if (req.pageNum == undefined) req.pageNum = 0;
    if (req.pageSize == undefined) req.pageSize = 20;

    return this.http
      .post<ResponseData<Page<UserItem>>>(`${this.baseUrl}/search`, req)
      .pipe(map((res) => res.data));
  }

  getAllUsers(): Observable<UserItem[]> {
    return this.http.get<any>(this.baseUrl).pipe(map(res => res.data));
  }

  getUserById(id: number): Observable<UserItem> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(map(res => res.data));
  }

  createUser(req: CreateUserRequest): Observable<UserItem> {
    return this.http.post<any>(this.baseUrl, req).pipe(map(res => res.data));
  }

  updateUser(id: number, req: UpdateUserRequest): Observable<UserItem> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, req).pipe(map(res => res.data));
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(map(res => res.data));
  }

  getPcCompanies(): Observable<PcCompanyOption[]> {
    return this.http.get<any>('/excelpro-service/v1/pc-companies').pipe(map(res => res.data));
  }

  getDepartments(): Observable<OrgOption[]> {
    return this.http.get<any>('/excelpro-service/v1/organizations').pipe(map(res => res.data));
  }

  getPositions(): Observable<PositionOption[]> {
    return this.http.get<any>('/excelpro-service/v1/positions/active').pipe(map(res => res.data));
  }
}
