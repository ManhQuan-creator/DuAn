import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TuiButtonModule, TuiLoaderModule, TuiSvgModule } from '@taiga-ui/core';
import { TuiBadgeModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { GridTemplateListItem } from '../../models/grid-template.model';

@Component({
  selector: 'app-open-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiBadgeModule,
    TuiLoaderModule,
    AppDialogDirective,
  ],
  templateUrl: './open-template-dialog.component.html',
  styleUrls: ['./open-template-dialog.component.scss'],
})
export class OpenTemplateDialogComponent {
  @Input() isOpen = false;
  @Input() loading = false;
  @Input() templateList: GridTemplateListItem[] = [];
  @Input() currentTemplateId: number | null = null;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() loadTemplate = new EventEmitter<number>();
  @Output() deleteTemplate = new EventEmitter<number>();

  onLoadTemplate(id: number): void {
    this.loadTemplate.emit(id);
    this.close();
  }

  onDeleteTemplate(id: number, event: Event): void {
    event.stopPropagation();
    this.deleteTemplate.emit(id);
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
