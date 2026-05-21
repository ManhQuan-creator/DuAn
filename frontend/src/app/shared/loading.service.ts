import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LoadingState {
  visible: boolean;
  message: string;
}

/**
 * Global loading overlay.
 *
 * Dùng `wrap(message, fn)` cho việc cần defer 1 tick để spinner kịp paint
 * trước khi work nặng chạy (AG Grid rebuild, xử lý lớn…). `show/hide` trực tiếp
 * cho flow async HTTP. Counter hỗ trợ nested calls — loading chỉ ẩn khi tất cả
 * người gọi đã `hide()`.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private counter = 0;
  private readonly subject = new BehaviorSubject<LoadingState>({
    visible: false,
    message: '',
  });

  readonly state$: Observable<LoadingState> = this.subject.asObservable();

  show(message = 'Đang xử lý...'): void {
    this.counter++;
    this.subject.next({ visible: true, message });
  }

  hide(): void {
    this.counter = Math.max(0, this.counter - 1);
    if (this.counter === 0) {
      this.subject.next({ visible: false, message: '' });
    }
  }

  /**
   * Show overlay, defer `fn` 1 task tick để browser paint spinner, rồi chạy
   * và luôn `hide` ở finally (kể cả khi `fn` throw).
   */
  wrap<T>(message: string, fn: () => T | Promise<T>): Promise<T> {
    this.show(message);
    return new Promise<T>((resolve, reject) => {
      setTimeout(async () => {
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          this.hide();
        }
      }, 0);
    });
  }
}
