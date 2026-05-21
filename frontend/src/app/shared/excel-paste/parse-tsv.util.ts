/**
 * Parse clipboard text (Excel copy ra TSV — tab-separated values, với cells có
 * chứa tab/newline/quote sẽ được wrap trong dấu " và quote bên trong double lên).
 *
 * Trả về matrix string[][]. Empty string cho cell rỗng. Mỗi row có thể có số cột
 * khác nhau (caller tự padding nếu cần).
 *
 * Ví dụ clipboard:
 *   a\tb\tc\nd\t"e\tf"\tg\n
 * → [['a','b','c'], ['d','e\tf','g']]
 */
export function parseTsv(text: string): string[][] {
  if (!text) return [];
  // Normalize line endings về \n
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("")
        if (normalized[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // Close quote
        inQuotes = false;
        i++;
        continue;
      }
      currentField += ch;
      i++;
      continue;
    }

    // Ngoài quote
    if (ch === '"' && currentField === '') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === '\t') {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }
    if (ch === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }
    currentField += ch;
    i++;
  }

  // Flush row cuối (có thể thiếu \n cuối)
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Bỏ row rỗng cuối (nếu Excel thêm \n cuối → row rỗng thừa)
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}
