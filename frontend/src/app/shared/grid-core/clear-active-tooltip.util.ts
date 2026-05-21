/**
 * Force remove AG Grid custom tooltip popup khỏi DOM.
 *
 * Lý do tồn tại: AG Grid attach tooltip popup vào popupParent (default body) khi user
 * hover cell. Nếu user GIỮ chuột trên cell rồi data thay đổi qua picker/programmatic
 * update (`setDataValue`/refreshCells), AG Grid KHÔNG tự destroy tooltip popup —
 * tooltip vẫn hiển thị message cũ vì:
 *   1. Mouse chưa leave cell → AG Grid không trigger close.
 *   2. Tooltip component instance được reuse, nhưng `agInit` không được gọi lại
 *      (chỉ gọi khi tooltip mới mount).
 *
 * Workaround: xoá thẳng `.ag-tooltip-custom` element. Khi user di chuột tiếp theo
 * (mouseleave + mouseenter cell), AG Grid tạo tooltip mới → agInit chạy lại với
 * params.value mới → render đúng (hoặc không render nếu valid).
 *
 * Class `.ag-tooltip-custom` xác nhận từ AG Grid v35 source: `tooltip.css-GENERATED.d.ts`.
 */
export function clearActiveTooltip(): void {
  document.querySelectorAll('.ag-tooltip-custom, .ag-tooltip').forEach((el) => el.remove());
}
