import {
  Directive,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appDialog]',
  standalone: true,
})
export class AppDialogDirective implements OnDestroy, OnChanges {
  private readonly dialogService = inject(TuiDialogService);

  private sub?: Subscription;
  private _open = false;

  @Output() appDialogChange = new EventEmitter<boolean>();

  @Input() appDialog = false;
  @Input() appDialogOptions: any = {};

  constructor(private template: TemplateRef<any>) {}

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['appDialog'];
    if (!openChange) return;

    const value = openChange.currentValue;
    if (value === this._open) return;

    this._open = value;

    if (value) {
      this.open();
    } else {
      this.close();
    }
  }

  private open(): void {
    if (this.sub) return;

    // lúc này appDialogOptions đã được gán đầy đủ
    this.sub = this.dialogService
      .open(this.template, this.appDialogOptions)
      .subscribe({
        complete: () => {
          this.sub = undefined;
          this._open = false;
          this.appDialogChange.emit(false);
        },
      });
  }

  private close(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;

    if (this._open) {
      this._open = false;
      this.appDialogChange.emit(false);
    }
  }

  ngOnDestroy(): void {
    this.close();
  }
}