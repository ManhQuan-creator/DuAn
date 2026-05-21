import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../loading.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="(loading.state$ | async) as state">
      <div class="loading-overlay" *ngIf="state.visible">
        <div class="loading-box">
          <div class="loading-spinner"></div>
          <div class="loading-message">{{ state.message }}</div>
        </div>
      </div>
    </ng-container>
  `,
  styleUrls: ['./app-loading.component.scss'],
})
export class AppLoadingComponent {
  readonly loading = inject(LoadingService);
}
