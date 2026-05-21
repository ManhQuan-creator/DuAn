import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PcOrganizationUnitService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/pc-organization-unit';

  /** Lấy danh sách đơn vị theo PC */
  getPcOrganizationUnits(pc: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/search`, { params: new HttpParams().set('pc', pc) });
  }
}
