import type { ColDef, SuppressKeyboardEventParams } from 'ag-grid-community';

/**
 * Default colDef cho data-entry grid của Builder + Render. Chia sẻ vì 2 component
 * cần CÙNG behavior — đặc biệt `suppressKeyboardEvent` chặn AG Grid tự xử lý
 * Delete/Backspace để handler `handleKeyboard` đảm nhiệm full-range delete
 * (ngăn case anchor cell tách thành undo entry riêng).
 *
 * Không suppress khi cell đang edit (`params.editing === true`) để input nhận
 * Backspace/Delete bình thường.
 */
export const DEFAULT_DATA_GRID_COL_DEF: ColDef = {
  resizable: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
  suppressKeyboardEvent: (params: SuppressKeyboardEventParams) => {
    if (params.editing) return false;
    const k = params.event.key;
    return k === 'Delete' || k === 'Backspace';
  },
};
