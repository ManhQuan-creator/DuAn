import { Injectable } from '@angular/core';
import { UndoAction } from '../../shared/models/undo-redo.model';

@Injectable()
export class UndoRedoService {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private maxHistorySize = 100;

  public isExecuting = false;
  public isBulkOperation = false;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  pushUndo(action: Omit<UndoAction, 'timestamp'>): void {
    // Không ghi lịch sử khi đang undo/redo hoặc đang xóa/paste hàng loạt
    if (this.isExecuting || this.isBulkOperation) return; //Bỏ qua nếu đang undo/redo hoặc bulk

    const full = { ...action, timestamp: Date.now() };
    this.undoStack.push(full);  // Đẩy vào stack
    if (this.undoStack.length > this.maxHistorySize) this.undoStack.shift();  // Xóa cái cũ nhất nếu tràn
    this.redoStack = []; // Xóa redo stack
  }

  undo(): void {
    const action = this.undoStack.pop(); // Lấy action mới nhất ra khỏi undo stack 
    if (!action) return; // Stack rỗng → không làm gì
    this.isExecuting = true; // Đang thực thi
    try {
      action.undo(); // Thực hiện undo
      this.redoStack.push(action); // Đẩy vào redo stack
    } finally {
      this.isExecuting = false; // Luôn tắt cờ dù có lỗi
    }
  }

  redo(): void {
    const action = this.redoStack.pop(); // Lấy action mới nhất ra khỏi redo stack
    if (!action) return; // Stack rỗng → không làm gì
    this.isExecuting = true; // Đang thực thi
    try {
      action.redo(); // Thực hiện redo
      this.undoStack.push(action); // Đẩy vào undo stack
    } finally {
      this.isExecuting = false; // Luôn tắt cờ dù có lỗi
    }
  }

  clear(): void {
    this.undoStack = []; // Xóa undo stack
    this.redoStack = []; // Xóa redo stack
    this.isExecuting = false; // Tắt cờ thực thi
    this.isBulkOperation = false; // Tắt cờ bulk
  }
}
