import { Column, GridApi, IRowNode } from 'ag-grid-community';

export interface RangeBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

/** Lấy text hiển thị của 1 cell qua valueGetter + valueFormatter. Escape tab/newline/quote cho TSV. */
export function getFormattedCellText(gridApi: GridApi, node: IRowNode, column: Column): string {
  const colDef = column.getColDef();
  let rawValue: any;
  if (typeof colDef.valueGetter === 'function') {
    rawValue = (colDef.valueGetter as any)({
      api: gridApi,
      colDef,
      column,
      context: null,
      data: node.data,
      node,
      getValue: (f: string) => node.data?.[f],
    });
  } else {
    rawValue = node.data?.[column.getColId()];
  }
  let text: string;
  if (typeof colDef.valueFormatter === 'function') {
    const formatted = (colDef.valueFormatter as any)({
      value: rawValue,
      data: node.data,
      node,
      colDef,
      column,
      api: gridApi,
      context: null,
    });
    text = formatted != null ? String(formatted) : '';
  } else {
    text = rawValue != null ? String(rawValue) : '';
  }
  if (/[\t\n\r"]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Serialize range thành TSV (dùng cho copy multi-cell). */
export function serializeRangeAsTsv(gridApi: GridApi, bounds: RangeBounds): string {
  const cols = gridApi.getAllDisplayedColumns();
  const lines: string[] = [];
  for (let r = bounds.r0; r <= bounds.r1; r++) {
    const node = gridApi.getDisplayedRowAtIndex(r);
    if (!node?.data) {
      lines.push('');
      continue;
    }
    const fields: string[] = [];
    for (let c = bounds.c0; c <= bounds.c1; c++) {
      const column = cols[c];
      if (!column) {
        fields.push('');
        continue;
      }
      fields.push(getFormattedCellText(gridApi, node, column));
    }
    lines.push(fields.join('\t'));
  }
  return lines.join('\n');
}
