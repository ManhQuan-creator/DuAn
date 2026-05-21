/**
 * Pure util — generate tài liệu mô tả chức năng (Tìm kiếm / Thêm mới / Xem /
 * Cập nhật / Xóa / Nhập excel / Xuất excel) cho 1 menu sidebar có thể chứa N
 * biểu mẫu. Template ở `assets/docs/import_export.md`. Trigger ẨN qua phím tắt
 * `Ctrl+Alt+E` ở excel-render.
 *
 * **Loop multi-template**: Template wrap section 2-7 trong cặp markers
 * `<!-- PER_TEMPLATE_START -->` / `<!-- PER_TEMPLATE_END -->`. Section 1 (Tìm
 * kiếm) nằm ngoài markers — render 1 lần. Section 2-7 lặp N lần (1 lần per
 * biểu mẫu cùng REPORT_FC_GROUP).
 *
 * **Placeholder shared** (xuất hiện ở mọi nơi, 1 giá trị duy nhất):
 *  - `${menuName}` — menu sidebar NSD click (vd "Phân bổ vốn ĐTXD THA")
 *  - `${parentMenuName}` — menu cha (vd "Báo cáo")
 *  - `${defaultTemplateLabel}` — biểu mẫu mặc định: `<code> - <name>`
 *  - `${otherTemplatesList}` — biểu mẫu còn lại cùng group, join `, `
 *  - `${templatesCount}` — tổng số biểu mẫu cùng group
 *
 * **Placeholder per-template** (chỉ thay trong loop block, mỗi vòng có giá trị riêng):
 *  - `${templateName}` — tên biểu mẫu (đã strip braces `${N}` → `N`)
 *  - `${columnsList}` — danh sách cột (đã format `<br />`)
 *  - `${currentTemplateLabel}` — heading: `<code> - <name>`
 */

const MARKER_START = '<!-- PER_TEMPLATE_START -->';
const MARKER_END = '<!-- PER_TEMPLATE_END -->';

export interface SharedDocValues {
  menuName: string;
  parentMenuName: string;
  defaultTemplateLabel: string;
  otherTemplatesList: string;
  templatesCount: string;
}

export interface PerTemplateValues {
  templateName: string;
  columnsBlock: string;
  currentTemplateLabel: string;
}

export interface ImportExportDocLoopInput {
  template: string;
  shared: SharedDocValues;
  perTemplate: PerTemplateValues[];
}

/**
 * Render template với section 1 (shared) + loop section 2-7 cho N biểu mẫu.
 *
 * Algorithm:
 *  1. Tìm cặp marker → tách `before` / `loopBlock` / `after`.
 *  2. Render `before` + `after` với shared values.
 *  3. Render `loopBlock` N lần, mỗi lần substitute shared + 3 per-template.
 *  4. Concatenate: `renderedBefore + N×renderedLoopBlock + renderedAfter`.
 *
 * Edge cases:
 *  - Không tìm thấy markers → fallback render toàn bộ template với shared
 *    (backward compat). Per-template placeholder để trống.
 *  - `perTemplate.length === 0` → bỏ hẳn loopBlock, output chỉ có before+after.
 */
export function generateImportExportDoc(input: ImportExportDocLoopInput): string {
  const { template, shared, perTemplate } = input;
  const start = template.indexOf(MARKER_START);
  const end = template.indexOf(MARKER_END);

  if (start === -1 || end === -1 || end < start) {
    // Fallback: không có markers — render full template với shared only.
    return applyShared(template, shared);
  }

  const before = template.slice(0, start);
  const loopBlock = template.slice(start + MARKER_START.length, end);
  const after = template.slice(end + MARKER_END.length);

  const renderedBefore = applyShared(before, shared);
  const renderedAfter = applyShared(after, shared);
  const renderedLoop = perTemplate
    .map((pt) => applyShared(applyPerTemplate(loopBlock, pt), shared))
    .join('');

  return renderedBefore + renderedLoop + renderedAfter;
}

function applyShared(text: string, s: SharedDocValues): string {
  return text
    .split('${menuName}').join(s.menuName)
    .split('${parentMenuName}').join(s.parentMenuName)
    .split('${defaultTemplateLabel}').join(s.defaultTemplateLabel)
    .split('${otherTemplatesList}').join(s.otherTemplatesList)
    .split('${templatesCount}').join(s.templatesCount);
}

function applyPerTemplate(text: string, p: PerTemplateValues): string {
  return text
    .split('${templateName}').join(p.templateName)
    .split('${columnsList}').join(p.columnsBlock)
    .split('${currentTemplateLabel}').join(p.currentTemplateLabel);
}

/**
 * Format danh sách cột (output của `buildColumnDocsText`) để chèn vào cell `<td>`
 * của HTML table trong template MD. 2 bước:
 *
 * 1. Strip dòng đầu (`Hệ thống hiển thị chi tiết biểu mẫu ...`) — template MD đã
 *    có lead-in text riêng ("File excel template gồm các cột như sau:") nên thừa.
 * 2. Convert mỗi `\n` thành `<br />\n` để renderer HTML xuống dòng đúng trong cell.
 *
 * Input rỗng → trả empty string.
 */
export function formatColumnsForHtmlCell(columnDocsText: string): string {
  if (!columnDocsText) return '';
  const firstNewline = columnDocsText.indexOf('\n');
  const body = firstNewline === -1 ? '' : columnDocsText.slice(firstNewline + 1);
  if (!body) return '';
  return body.split('\n').join('<br />\n');
}
