import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface PositionItem {
  id: number;
  positionCode: string;
  positionName: string;
  positionRank: number;
  orgLevelScope: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePositionRequest {
  positionCode: string;
  positionName: string;
  positionRank: number;
  orgLevelScope: string;
}

export interface UpdatePositionRequest {
  positionName?: string;
  positionRank?: number;
  orgLevelScope?: string;
  active?: boolean;
}

const BASE_URL = '/excelpro-service/v1/positions';

@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<PositionItem[]> {
    return this.http.get<any>(BASE_URL).pipe(map(r => r.data));
  }

  getAllActive(): Observable<PositionItem[]> {
    return this.http.get<any>(`${BASE_URL}/active`).pipe(map(r => r.data));
  }

  create(req: CreatePositionRequest): Observable<PositionItem> {
    return this.http.post<any>(BASE_URL, req).pipe(map(r => r.data));
  }

  update(id: number, req: UpdatePositionRequest): Observable<PositionItem> {
    return this.http.put<any>(`${BASE_URL}/${id}`, req).pipe(map(r => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${BASE_URL}/${id}`).pipe(map(() => void 0));
  }
}
