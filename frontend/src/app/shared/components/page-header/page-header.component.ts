import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButtonModule } from '@taiga-ui/core';

export interface PageHeaderBreadcrumb {
  label: string;
  link: string | any[];
}

export interface CustomButton {
  title: string;
  icon: string;
  disabled?: boolean;
  show?: boolean;
  action?: string;
  appearance?: 'primary' | 'secondary' | 'flat' | 'outline' | 'whiteblock' | 'accent'; // thêm dòng này
}
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TuiButtonModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() breadcrumbs: PageHeaderBreadcrumb[] = [];

  @Input() showBackBtn = false;
  @Input() showCreateBtn = false;

  @Input() customButtons: CustomButton[] = [];

  @Output() back = new EventEmitter<void>();
  @Output() create = new EventEmitter<void>();
  @Output() customBtnClick = new EventEmitter<CustomButton>();

  get hasVisibleCustomBtn(): boolean {
    return this.customButtons.some((btn) => btn.show !== false);
  }
  
  trackByAction(index: number, btn: CustomButton): string {
    return btn.action!;
  }

  handlerClickCustomButton(btn: CustomButton): void {
    this.customBtnClick.emit(btn);
  }

  handleBack(): void {
    this.back.emit();
  }

  handleCreate(): void {
    this.create.emit();
  }
}
