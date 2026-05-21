import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  IdsDTO,
  RejectRequest,
  ReviseRequest,
  SclAssessment,
  SclAssessmentDetail,
  SclAssessmentFilter,
} from '../model/scl-assessment.model';
import { Page, ResponseData } from '../../shared/models/common.model';

@Injectable({ providedIn: 'root' })
export class SclAssessmentService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/scl-assessment';

  search(req: SclAssessmentFilter): Observable<Page<SclAssessment>> {
    const body = this.buildSearchBody(req);

    return this.http
      .post<ResponseData<Page<SclAssessment>>>(`${this.baseUrl}/search`, body)
      .pipe(map((res) => res.data));
  }

  exportAssessments(req: SclAssessmentFilter): Observable<HttpResponse<Blob>> {
    const body = this.buildSearchBody(req);

    return this.http.post(`${this.baseUrl}/export`, body, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  private buildSearchBody(req: SclAssessmentFilter): SclAssessmentFilter {
    const body: SclAssessmentFilter = {
      pageNum: req.pageNum ?? 0,
      pageSize: req.pageSize ?? 20,
    };

    if (req.unit) body.unit = req.unit;
    if (req.categoryCode) body.categoryCode = req.categoryCode;
    if (req.categoryName) body.categoryName = req.categoryName;
    if (req.yearPlan) body.yearPlan = req.yearPlan;
    if (req.progress) body.progress = req.progress;
    if (req.status) body.status = req.status;
    if (req.assetType) body.assetType = req.assetType;
    if (req.planType) body.planType = req.planType;
    if (req.registerType) body.registerType = req.registerType;
    if (typeof req.categoryId === 'number') body.categoryId = req.categoryId;
    if (req.assessmentDeptCode) body.assessmentDeptCode = req.assessmentDeptCode;
    if (req.orders?.length) body.orders = req.orders;

    return body;
  }

  getById(id: number): Observable<SclAssessmentDetail> {
    return this.http.get<ResponseData<SclAssessmentDetail>>(`${this.baseUrl}/${id}`).pipe(map((res) => res.data));
  }

  // ================== APPROVE ==================
  approve(id: number): Observable<void> {
    const params = new HttpParams().set('id', id);

    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/approve`, null, { params })
      .pipe(map((res) => res.data));
  }

  // ================== REJECT (có file) ==================
  reject(request: RejectRequest, files: File[] = []): Observable<void> {
    const formData = new FormData();

    // files
    files.forEach((file) => formData.append('files', file));

    // JSON request
    formData.append(
      'request',
      new Blob([JSON.stringify(request)], { type: 'application/json' })
    );

    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/reject`, formData)
      .pipe(map((res) => res.data));
  }

  // ================== REVISE ==================
  revise(request: ReviseRequest): Observable<void> {
    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/revise`, request)
      .pipe(map((res) => res.data));
  }

  // ================== CONFIRM ==================
  confirm(request: IdsDTO): Observable<void> {
    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/confirm`, request)
      .pipe(map((res) => res.data));
  }
}
