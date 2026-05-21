import {
  formatColumnsForHtmlCell,
  generateImportExportDoc,
  type PerTemplateValues,
  type SharedDocValues,
} from './import-export-doc.util';

describe('import-export-doc.util', () => {
  const shared: SharedDocValues = {
    menuName: 'Menu A',
    parentMenuName: 'Báo cáo',
    defaultTemplateLabel: 'CODE_A - Tên A',
    otherTemplatesList: 'CODE_B - Tên B, CODE_C - Tên C',
    templatesCount: '3',
  };

  const mkPerTemplate = (i: number): PerTemplateValues => ({
    templateName: `Biểu mẫu ${i}`,
    columnsBlock: `1. Cột ${i}A<br />\n2. Cột ${i}B`,
    currentTemplateLabel: `CODE_${i} - Tên ${i}`,
  });

  describe('generateImportExportDoc — loop scenarios', () => {
    const tmpl = (loopBody: string) =>
      `Header với ${'$'}{menuName} và ${'$'}{templatesCount}.
<!-- PER_TEMPLATE_START -->
${loopBody}
<!-- PER_TEMPLATE_END -->
Footer với ${'$'}{parentMenuName}.`;

    it('3 perTemplate → loop block lặp 3 lần với values khác nhau', () => {
      const template = tmpl('### ${currentTemplateLabel}\nTên: ${templateName}\nCột: ${columnsList}');
      const out = generateImportExportDoc({
        template,
        shared,
        perTemplate: [mkPerTemplate(1), mkPerTemplate(2), mkPerTemplate(3)],
      });
      expect(out).toContain('### CODE_1 - Tên 1');
      expect(out).toContain('### CODE_2 - Tên 2');
      expect(out).toContain('### CODE_3 - Tên 3');
      expect(out).toContain('Tên: Biểu mẫu 1');
      expect(out).toContain('Tên: Biểu mẫu 2');
      expect(out).toContain('Tên: Biểu mẫu 3');
      // Shared placeholder cũng được thay ở phần before/after.
      expect(out).toContain('Header với Menu A và 3.');
      expect(out).toContain('Footer với Báo cáo.');
      // KHÔNG còn placeholder nào sót.
      expect(out).not.toMatch(/\$\{[a-zA-Z]+\}/);
    });

    it('1 perTemplate → 1 iteration', () => {
      const template = tmpl('LoopOnce ${templateName}');
      const out = generateImportExportDoc({
        template,
        shared,
        perTemplate: [mkPerTemplate(1)],
      });
      const matches = out.match(/LoopOnce Biểu mẫu/g) || [];
      expect(matches.length).toBe(1);
    });

    it('0 perTemplate → loopBlock bị strip, chỉ render shared (header+footer)', () => {
      const template = tmpl('NEVER_RENDERED ${templateName}');
      const out = generateImportExportDoc({
        template,
        shared,
        perTemplate: [],
      });
      expect(out).not.toContain('NEVER_RENDERED');
      expect(out).toContain('Header với Menu A và 3.');
      expect(out).toContain('Footer với Báo cáo.');
    });

    it('Template KHÔNG có markers → fallback render full với shared (no loop)', () => {
      const template = 'Plain ${menuName} doc ${templatesCount}';
      const out = generateImportExportDoc({
        template,
        shared,
        perTemplate: [mkPerTemplate(1)], // bị bỏ qua vì không có markers
      });
      expect(out).toBe('Plain Menu A doc 3');
    });

    it('Shared placeholder xuất hiện trong loopBlock → mỗi iteration vẫn thay', () => {
      const template = tmpl('Menu=${menuName} | Tên=${templateName}');
      const out = generateImportExportDoc({
        template,
        shared,
        perTemplate: [mkPerTemplate(1), mkPerTemplate(2)],
      });
      const matches = out.match(/Menu=Menu A \| Tên=Biểu mẫu \d/g) || [];
      expect(matches.length).toBe(2);
    });

    it('Per-template currentTemplateLabel xuất hiện đúng vị trí heading', () => {
      const template = `Top
<!-- PER_TEMPLATE_START -->
### Biểu mẫu: ${'$'}{currentTemplateLabel}
Tên ${'$'}{templateName}
<!-- PER_TEMPLATE_END -->
Bottom`;
      const out = generateImportExportDoc({
        template,
        shared,
        perTemplate: [mkPerTemplate(1), mkPerTemplate(2)],
      });
      const lines = out.split('\n').filter((l) => l.startsWith('### '));
      expect(lines).toEqual([
        '### Biểu mẫu: CODE_1 - Tên 1',
        '### Biểu mẫu: CODE_2 - Tên 2',
      ]);
    });
  });

  describe('formatColumnsForHtmlCell', () => {
    it('strip dòng header + convert \\n → <br />\\n', () => {
      const input = 'Hệ thống hiển thị chi tiết biểu mẫu "X" bao gồm các trường sau:\n1. A - Cho phép nhập số\n2. B - Cho phép nhập văn bản';
      expect(formatColumnsForHtmlCell(input)).toBe(
        '1. A - Cho phép nhập số<br />\n2. B - Cho phép nhập văn bản',
      );
    });

    it('input rỗng → empty', () => {
      expect(formatColumnsForHtmlCell('')).toBe('');
    });

    it('input chỉ có 1 dòng header → empty', () => {
      expect(
        formatColumnsForHtmlCell(
          'Hệ thống hiển thị chi tiết biểu mẫu "X" bao gồm các trường sau:',
        ),
      ).toBe('');
    });
  });
});
