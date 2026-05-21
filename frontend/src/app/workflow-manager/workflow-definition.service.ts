import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ResponseData<T> {
  code: string;
  message: string;
  data: T;
}

export interface StepCandidateItem {
  id?: number;
  subjectOrgCode: string | null;
  subjectPositionCode: string | null;
}

export interface WorkflowStepItem {
  id?: number;
  stepOrder: number;
  stepKey: string;
  stepName: string;
  candidateActionKey?: string;
  statusAfterApprove: string;
  returnTarget: string;
  notifyMessage?: string;
  onApproveHandlerKey?: string | null;
  onReturnHandlerKey?: string | null;
  onRejectHandlerKey?: string | null;
  candidates?: StepCandidateItem[];
}

export interface WorkflowActionHandlerItem {
  key: string;
  label: string;
  description?: string;
}

export interface WorkflowDefinitionListItem {
  id: number;
  workflowKey: string;
  name: string;
  description: string;
  status: string;
  version: number;
  stepCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionDetail {
  id: number;
  workflowKey: string;
  name: string;
  description: string;
  status: string;
  version: number;
  deploymentId: string;
  submitterCandidates?: StepCandidateItem[];
  bpmnXml: string;
  steps: WorkflowStepItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface XmlValidateResponse {
  valid: boolean;
  message: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // current page index (0-based)
  size: number;
}

@Injectable({ providedIn: 'root' })
export class WorkflowDefinitionService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/workflow-definitions';

  getAll(): Observable<WorkflowDefinitionListItem[]> {
    return this.http
      .get<ResponseData<WorkflowDefinitionListItem[]>>(this.baseUrl)
      .pipe(map(res => res.data));
  }

  getById(id: number): Observable<WorkflowDefinitionDetail> {
    return this.http
      .get<ResponseData<WorkflowDefinitionDetail>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  create(req: {
    workflowKey: string;
    name: string;
    description?: string;
    steps: WorkflowStepItem[];
    submitterCandidates?: StepCandidateItem[];
  }): Observable<WorkflowDefinitionDetail> {
    return this.http
      .post<ResponseData<WorkflowDefinitionDetail>>(this.baseUrl, req)
      .pipe(map(res => res.data));
  }

  update(id: number, req: {
    name?: string;
    description?: string;
    steps?: WorkflowStepItem[];
    submitterCandidates?: StepCandidateItem[];
    bpmnXml?: string;
  }): Observable<WorkflowDefinitionDetail> {
    return this.http
      .put<ResponseData<WorkflowDefinitionDetail>>(`${this.baseUrl}/${id}`, req)
      .pipe(map(res => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<ResponseData<void>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  deploy(id: number): Observable<WorkflowDefinitionDetail> {
    return this.http
      .post<ResponseData<WorkflowDefinitionDetail>>(`${this.baseUrl}/${id}/deploy`, {})
      .pipe(map(res => res.data));
  }

  getDeployed(): Observable<WorkflowDefinitionListItem[]> {
    return this.http
      .get<ResponseData<WorkflowDefinitionListItem[]>>(`${this.baseUrl}/deployed`)
      .pipe(map(res => res.data));
  }

  /** Liệt kê các WorkflowActionHandler backend đã đăng ký — dùng cho dropdown trong step-form-dialog. */
  getActionHandlers(): Observable<WorkflowActionHandlerItem[]> {
    return this.http
      .get<ResponseData<WorkflowActionHandlerItem[]>>('/excelpro-service/v1/workflow/action-handlers')
      .pipe(map(res => res.data));
  }

  validateXml(id: number, bpmnXml: string): Observable<XmlValidateResponse> {
    return this.http
      .post<ResponseData<XmlValidateResponse>>(`${this.baseUrl}/${id}/validate-xml`, { bpmnXml })
      .pipe(map(res => res.data));
  }

  search(params: {
    keyword?: string;
    status?: string;
    pageNum?: number;
    pageSize?: number;
  }): Observable<Page<WorkflowDefinitionListItem>> {
    return this.http
      .get<ResponseData<Page<WorkflowDefinitionListItem>>>(`${this.baseUrl}/search`, {
        params: {
          ...(params.keyword != null ? { keyword: params.keyword } : {}),
          ...(params.status != null ? { status: params.status } : {}),
          ...(params.pageNum != null ? { pageNum: params.pageNum } : {}),
          ...(params.pageSize != null ? { pageSize: params.pageSize } : {}),
        } as any,
      })
      .pipe(map(res => res.data));
  }
}
