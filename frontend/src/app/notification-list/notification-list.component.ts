import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TuiScrollbarModule } from '@taiga-ui/core';
import { NotificationDTO, NotificationService } from '../notification.service';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule, TuiScrollbarModule],
  template: `
    <div class="noti-tabs">
      <button *ngFor="let tab of tabs; let i = index"
              class="noti-tab"
              [class.active]="activeTab === i"
              (click)="activeTab = i; loadData()">
        {{ tab }}
      </button>
    </div>

    <tui-scrollbar class="noti-scroll">
      <div *ngFor="let item of items"
           class="noti-item"
           [class.unread]="!item.isRead"
           (click)="readItem(item)">
        <div class="noti-icon-wrap" [ngClass]="'noti-icon--' + (item.status || 'info')">
          <span class="noti-icon">{{ getIcon(item) }}</span>
        </div>
        <div class="noti-body">
          <div class="noti-title">
            {{ item.title }}
            <span *ngIf="!item.isRead" class="unread-dot"></span>
          </div>
          <div class="noti-content">{{ item.content }}</div>
          <div class="noti-time">{{ formatTime(item.createdAt) }}</div>
        </div>
      </div>

      <div *ngIf="items.length === 0" class="noti-empty">
        <div class="noti-empty-icon">&#128276;</div>
        <div class="noti-empty-text">Chưa có thông báo nào</div>
      </div>
    </tui-scrollbar>
  `,
  styles: [`
    :host { display: block; }

    /* Tabs */
    .noti-tabs {
      display: flex;
      gap: 4px;
      padding: 0 0 8px;
      border-bottom: 1px solid #e8eaed;
    }
    .noti-tab {
      flex: 1;
      padding: 6px 12px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #5f6368;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .noti-tab:hover { background: #f1f3f4; }
    .noti-tab.active {
      background: #e8f0fe;
      color: #1a73e8;
      font-weight: 600;
    }

    /* Scrollbar */
    .noti-scroll { height: 380px; }

    /* Item */
    .noti-item {
      display: flex;
      gap: 12px;
      padding: 12px 8px;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .noti-item:hover { background: #f6f8fc; }
    .noti-item.unread { background: #f0f6ff; }
    .noti-item.unread:hover { background: #e4effd; }

    /* Icon */
    .noti-icon-wrap {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .noti-icon--info    { background: #e8f0fe; color: #1a73e8; }
    .noti-icon--success { background: #e6f4ea; color: #1e8e3e; }
    .noti-icon--error   { background: #fce8e6; color: #d93025; }
    .noti-icon--neutral { background: #f1f3f4; color: #5f6368; }

    /* Body */
    .noti-body { flex: 1; min-width: 0; }
    .noti-title {
      font-size: 13px;
      font-weight: 600;
      color: #202124;
      display: flex;
      align-items: center;
      gap: 6px;
      line-height: 1.3;
    }
    .unread-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #1a73e8;
      flex-shrink: 0;
    }
    .noti-content {
      font-size: 12.5px;
      color: #5f6368;
      margin-top: 2px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .noti-time {
      font-size: 11px;
      color: #9aa0a6;
      margin-top: 4px;
    }

    /* Empty state */
    .noti-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: #9aa0a6;
    }
    .noti-empty-icon { font-size: 40px; opacity: 0.5; margin-bottom: 12px; }
    .noti-empty-text { font-size: 13px; }
  `]
})
export class NotificationListComponent implements OnInit, OnDestroy {
  private readonly service = inject(NotificationService);
  private readonly router = inject(Router);
  private destroy$ = new Subject<void>();

  tabs = ['Tất cả', 'Công việc', 'Cảnh báo'];
  activeTab = 0;
  items: NotificationDTO[] = [];
  ngOnInit() {
    this.loadData();

    this.service.newNotify$.pipe(takeUntil(this.destroy$)).subscribe(newNoti => {
      if (newNoti) {
        this.items = [newNoti, ...this.items];
        if (this.items.length > 50) {
          this.items = this.items.slice(0, 50);
        }
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData() {
    const types = ['ALL', 'NOTIFICATION', 'ALERT'];
    this.service.getNotifications(types[this.activeTab])
      .subscribe(data => this.items = data);
  }

  readItem(item: NotificationDTO) {
    if (!item.isRead) {
      this.service.markAsRead(item.id).subscribe(() => {
        item.isRead = true;
        this.service.decreaseUnreadCount();
      });
    }
    // Navigate to target URL (e.g., /excel-render?templateId=215&entryId=199)
    if (item.targetUrl) {
      this.router.navigateByUrl(item.targetUrl);
    }
  }

  getIcon(item: NotificationDTO): string {
    switch (item.status) {
      case 'success': return '\u2713';
      case 'error':   return '!';
      case 'info':    return 'i';
      default:        return '\u2022';
    }
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}