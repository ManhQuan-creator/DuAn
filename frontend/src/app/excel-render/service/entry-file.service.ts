import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface EntryFileItem {
  id: number;
  entryId: number;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  fileType?: string;
  createdBy?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class EntryFileService {
  private readonly http = inject(HttpClient);

  private base(templateId: number, entryId: number): string {
    return `/excelpro-service/v1/grid-templates/${templateId}/entries/${entryId}/files`;
  }

  list(templateId: number, entryId: number): Observable<EntryFileItem[]> {
    return this.http.get<any>(this.base(templateId, entryId)).pipe(map(r => r.data ?? []));
  }

  upload(templateId: number, entryId: number, files: File[]): Observable<EntryFileItem[]> {
    const form = new FormData();
    files.forEach(f => form.append('files', f, f.name));
    return this.http.post<any>(this.base(templateId, entryId), form).pipe(map(r => r.data ?? []));
  }

  delete(templateId: number, entryId: number, fileId: number): Observable<void> {
    return this.http
      .delete<any>(`${this.base(templateId, entryId)}/${fileId}`)
      .pipe(map(() => void 0));
  }

  /** Tải file về client — Content-Disposition từ server giữ filename gốc. */
  download(templateId: number, entryId: number, fileId: number, originalName: string): void {
    const url = `${this.base(templateId, entryId)}/${fileId}/download`;
    this.http.get(url, { responseType: 'blob' }).subscribe(blob => {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    });
  }
}
