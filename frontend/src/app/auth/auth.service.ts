import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface CurrentUser {
  username: string;
  fullName: string;
  orgGroupCode: string | null;
  companyCode: string | null;
  deptCode: string | null;
  positionCode: string | null;
  roles: string[];
  token: string;
}

export interface LoginResponse {
  code: string;
  message: string;
  data: {
    token: string;
    username: string;
    fullName: string;
    orgGroupCode: string | null;
    companyCode: string | null;
    deptCode: string | null;
    positionCode: string | null;
    roles: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = '/excelpro-service/v1/auth';

  private readonly STORAGE_KEY = 'auth_user';

  private currentUser$ = new BehaviorSubject<CurrentUser | null>(this.loadFromStorage());

  get user$(): Observable<CurrentUser | null> {
    return this.currentUser$.asObservable();
  }

  get currentUser(): CurrentUser | null {
    return this.currentUser$.value;
  }

  get isAuthenticated(): boolean {
    return !!this.currentUser$.value?.token;
  }

  getToken(): string | null {
    return this.currentUser$.value?.token ?? null;
  }

  hasRole(role: string): boolean {
    const roles = this.currentUser$.value?.roles ?? [];
    return roles.includes(role) || roles.includes('ROLE_' + role);
  }

  /** True if user belongs to EVNNPC org group or is ADMIN — can see all data */
  isHeadquarters(): boolean {
    const orgGroupCode = this.currentUser$.value?.orgGroupCode;
    return orgGroupCode === 'EVNNPC' || this.hasRole('ADMIN');
  }

  /** @deprecated No longer needed — HQ flag now derived directly from orgGroupCode */
  setHeadquartersFlag(_isHQ: boolean): void { }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { username, password }).pipe(
      tap(res => {
        if (res.data) {
          const user: CurrentUser = {
            username: res.data.username,
            fullName: res.data.fullName,
            orgGroupCode: res.data.orgGroupCode ?? null,
            companyCode: res.data.companyCode ?? null,
            deptCode: res.data.deptCode ?? null,
            positionCode: res.data.positionCode ?? null,
            roles: res.data.roles,
            token: res.data.token
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
          this.currentUser$.next(user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  fetchCurrentUser(): Observable<any> {
    return this.http.get(`${this.baseUrl}/me`);
  }

  private loadFromStorage(): CurrentUser | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
