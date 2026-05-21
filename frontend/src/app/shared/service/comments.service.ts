import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ResponseData } from '../models/common.model';
import { EntryFileItem } from '../../excel-render/service/entry-file.service';

/** ====== DTO ====== */

export interface CommentsRequestDTO {
  type: string;
  groupId: number;
}

export interface CommentsSendDTO {
  type?: string;
  content: string;
  groupId?: number;
}

export interface CommentsEditDTO {
  id: number;
  content: string;
}

/** ====== RESPONSE ====== */

export interface UserComment {
  id: number;
  username: string;
  fullName: string;
  orgGroupCode: string;
  companyCode: string;
  deptCode: string;
  positionCode: string;
}

export interface CommentContent {
  id: number;
  userId: number;
  content: string;
  tag?: string;
  tagName?: string;
  editing?: boolean;
  type?: string;
  groupId?: number;
  createdAt: string;
  updatedAt: string;
  isDeleted?: string;
}

export interface Comments {
  currentUser: UserComment;
  userComments: UserComment[];
  commentContents: CommentContent[];
  attachComments: EntryFileItem[];
}

/** ====== SERVICE ====== */
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/excelpro-service/v1/comments';

  // ================== GET COMMENT ==================
  getComments(request: CommentsRequestDTO): Observable<Comments> {
    return this.http
      .post<ResponseData<Comments>>(`${this.baseUrl}`, request)
      .pipe(map((res) => res.data));
  }

  // ================== SEND COMMENT ==================
  sendComment(request: CommentsSendDTO, files: File[] = []): Observable<any> {
    const formData = new FormData();

    files.forEach((file) => formData.append('files', file));

    formData.append(
      'request',
      new Blob([JSON.stringify(request)], { type: 'application/json' }),
    );

    return this.http
      .post<ResponseData<any>>(`${this.baseUrl}/send`, formData)
      .pipe(map((res) => res.data));
  }

  // ================== EDIT COMMENT ==================
  editComment(request: CommentsEditDTO): Observable<void> {
    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/edit`, request)
      .pipe(map((res) => res.data));
  }

  // ================== DELETE COMMENT ==================
  deleteComment(id: number): Observable<void> {
    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/delete/${id}`, {})
      .pipe(map((res) => res.data));
  }

  // ================== DOWNLOAD ATTACH COMMENT ==================
  downloadAttachComment(
    entryId: number,
    fileId: number,
    originalFileName: string,
  ): void {
    this.http
      .get(
        `/excelpro-service/v1/comments/attach/${entryId}/download/${fileId}`,
        {
          responseType: 'blob',
          observe: 'response',
        },
      )
      .subscribe((response) => {
        const blob = response.body!;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalFileName;
        a.click();
        URL.revokeObjectURL(url);
      });
  }
}
