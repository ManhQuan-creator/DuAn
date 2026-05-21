import { inject, Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { TuiAlertService } from '@taiga-ui/core';
import { AuthService } from './auth/auth.service';

export interface NotificationDTO {
  id: string;
  title: string;
  content: string;
  type: 'ANNOUNCEMENT' | 'NOTIFICATION' | 'ALERT';
  status: 'info' | 'error' | 'success' | 'neutral';
  icon: string;
  targetUrl: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly baseUrl = '/excelpro-service/api/v1/notifications';
  private eventSource: EventSource | null = null;
  private unreadCount$ = new BehaviorSubject<number>(0);
  private newNotification$ = new BehaviorSubject<NotificationDTO | null>(null);
  public connectionStatus$ = new BehaviorSubject<string>('CONNECTING');
  private readonly alerts = inject(TuiAlertService);
  private readonly authService = inject(AuthService);

  private reconnectTimeout: any = null;

  constructor(private http: HttpClient, private zone: NgZone) {}

  connect(): void {
    if (document.hidden) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      return;
    }

    this.clearReconnectTimeout();

    const username = this.authService.currentUser?.username || 'unknown';
    const lastId = localStorage.getItem(`last_noti_id_${username}`) || '';
    const url = `${this.baseUrl}/stream?token=${encodeURIComponent(token)}&lastEventId=${encodeURIComponent(lastId)}`;

    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('INIT', () => {
      this.zone.run(() => {
        this.connectionStatus$.next('CONNECTED');
        this.getUnreadCount();
      });
    });

    this.eventSource.addEventListener('NEW_NOTIFICATION', (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const data: NotificationDTO = JSON.parse(event.data);
          localStorage.setItem(`last_noti_id_${username}`, data.id);
          this.newNotification$.next(data);
          this.unreadCount$.next(this.unreadCount$.value + 1);
        } catch (e) {
          console.error('Failed to parse SSE notification data:', e);
        }
      });
    });

    this.eventSource.onerror = () => {
      this.zone.run(() => {
        const readyState = this.eventSource?.readyState;

        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Kiểm tra token còn hạn trước khi reconnect — tránh infinite 401 loop
        const currentToken = this.authService.getToken();
        if (!currentToken) {
          this.connectionStatus$.next('DISCONNECTED');
          return; // Token hết hạn hoặc đã logout → không reconnect
        }

        if (readyState === 2) {
          this.connectionStatus$.next('DISCONNECTED');
          this.alerts.open('Mất kết nối hoàn toàn với máy chủ. Đang khởi tạo lại...', {
            label: 'Cảnh báo hệ thống',
            status: 'error',
            autoClose: 5000
          }).subscribe();
        } else {
          this.connectionStatus$.next('CONNECTING');
        }

        this.clearReconnectTimeout();
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      });
    };
  }

  disconnect() {
    this.clearReconnectTimeout();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connectionStatus$.next('DISCONNECTED');
    }
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  get currentStatus$(): Observable<string> {
    return this.connectionStatus$.asObservable();
  }

  getUnreadCount(): void {
    this.http.get<number>(`${this.baseUrl}/unread-count`)
      .subscribe(count => this.unreadCount$.next(count));
  }

  getNotifications(type: string = 'ALL'): Observable<NotificationDTO[]> {
    return this.http.get<NotificationDTO[]>(`${this.baseUrl}/list?type=${encodeURIComponent(type)}`);
  }

  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${encodeURIComponent(id)}/read`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/mark-all-read`, {});
  }

  decreaseUnreadCount() {
    const current = this.unreadCount$.getValue();
    if (current > 0) {
      this.unreadCount$.next(current - 1);
    }
  }

  get newNotify$() { return this.newNotification$.asObservable(); }
  get currentUnreadCount$() { return this.unreadCount$.asObservable(); }

  resetUnreadCount() { this.unreadCount$.next(0); }
}
