import { Component, HostListener, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiAlertService, TuiButtonModule, TuiHostedDropdownModule } from '@taiga-ui/core';
import { TuiBadgeModule } from '@taiga-ui/kit';
import { NotificationListComponent } from '../notification-list/notification-list.component';
import { NotificationService } from '../notification.service';
import { WorkflowService } from '../workflow/workflow.service';
import { AuthService } from '../auth/auth.service';
import { OrganizationService } from '../shared/organization.service';
import { BehaviorSubject, Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TuiButtonModule,
    TuiBadgeModule,
    TuiHostedDropdownModule,
    NotificationListComponent
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild('dropdown') dropdown!: TemplateRef<Record<string, unknown>>;

  private readonly alerts = inject(TuiAlertService);
  private readonly notificationService = inject(NotificationService);
  private readonly workflowService = inject(WorkflowService);
  private readonly orgService = inject(OrganizationService);
  readonly auth = inject(AuthService);

  // Observable cho UI
  unreadCount$ = this.notificationService.currentUnreadCount$;
  status$ = this.notificationService.currentStatus$;
  taskCount$ = new BehaviorSubject<number>(0);
  userOrgCode: string | null = null;

  // Quản lý subscription để tránh memory leak
  private notifySub: Subscription | null = null;

  get userInitials(): string {
    const name = this.auth.currentUser?.fullName || this.auth.currentUser?.username || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  ngOnInit() {
    // Load org info + resolve HQ flag
    this.userOrgCode = this.auth.currentUser?.companyCode ?? this.auth.currentUser?.orgGroupCode ?? null;
    this.orgService.getAll().subscribe();

    if (!document.hidden) {
      this.connectAndSync();
    }

    this.notifySub = this.notificationService.newNotify$.subscribe(notif => {
      if (notif) {
        this.alerts.open(notif.content, {
          label: notif.title,
          status: notif.status as any,
          icon: notif.icon,
          autoClose: 5000
        }).subscribe();
      }
    });
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.hidden) {
      this.notificationService.disconnect();
    } else {
      this.connectAndSync();
    }
  }

  private connectAndSync() {
    this.notificationService.connect();
    this.notificationService.getUnreadCount();
    this.refreshTaskCount();
  }

  private refreshTaskCount() {
    this.workflowService.getMyTaskCount().subscribe({
      next: count => this.taskCount$.next(count),
      error: () => {} // Silently ignore if workflow service unavailable
    });
  }

  onBellClick() {}

  markAllRead() {
    this.notificationService.markAllAsRead().subscribe(() => {
      this.notificationService.resetUnreadCount();
    });
  }

  onLogout() {
    this.notificationService.disconnect();
    this.auth.logout();
  }

  ngOnDestroy() {
    this.notificationService.disconnect();
    if (this.notifySub) {
      this.notifySub.unsubscribe();
    }
  }
}
