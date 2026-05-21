import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButtonModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiTextAreaModule } from '@taiga-ui/kit';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';

export interface SaveTemplateResult {
  code: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-save-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiInputModule,
    TuiTextAreaModule,
    AppDialogDirective,
  ],
  templateUrl: './save-template-dialog.component.html',
  styleUrls: ['./save-template-dialog.component.scss'],
})
export class SaveTemplateDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() saving = false;
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() saveTemplate = new EventEmitter<SaveTemplateResult>();

  saveCodeCtrl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^[a-zA-Z0-9_]+$/),
    Validators.maxLength(50),
  ]);
  saveNameCtrl = new FormControl('', Validators.required);
  saveDescCtrl = new FormControl('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.saveCodeCtrl.reset();
      this.saveNameCtrl.reset();
      this.saveDescCtrl.reset();
    }
  }

  onSubmit(): void {
    if (this.saveCodeCtrl.invalid || this.saveNameCtrl.invalid) {
      this.saveCodeCtrl.markAsTouched();
      this.saveNameCtrl.markAsTouched();
      return;
    }
    this.saveTemplate.emit({
      code: this.saveCodeCtrl.value!.trim(),
      name: this.saveNameCtrl.value!.trim(),
      description: this.saveDescCtrl.value?.trim() || '',
    });
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
