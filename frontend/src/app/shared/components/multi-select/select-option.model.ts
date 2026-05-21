/**
 * Kiểu option dùng chung cho MultiSelect + GroupedMultiSelect.
 *
 * `V` là kiểu giá trị lưu (string id, number code, ...). Mặc định string.
 * Caller lưu/gửi API dưới dạng `V[]` — component chịu trách nhiệm map value ↔ label.
 */
export interface SelectOption<V = string> {
  /** Giá trị được lưu (id/code/menuKey). Phải unique trong cùng options[]. */
  value: V;
  /** Text hiển thị cho user. */
  label: string;
  /** Option bị disable — không chọn được, nhưng vẫn hiển thị. */
  disabled?: boolean;
  /** Chỉ dùng ở GroupedMultiSelect — khóa group (vd parent menuKey). */
  group?: string;
  /** Chỉ dùng ở GroupedMultiSelect — label hiển thị header group (fallback về `group`). */
  groupLabel?: string;
  /** Text bổ sung dùng cho search (vd parent label, keywords). Không hiển thị. */
  searchText?: string;
}
