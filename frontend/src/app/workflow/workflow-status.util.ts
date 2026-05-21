/**
 * Pure status mappers cho approval workflow. Dùng cả ExcelRender và bất kỳ
 * component hiển thị status entry (Tasks list, History timeline...).
 */

const STATUS_LABEL_MAP: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  DISTRIBUTED: 'Đã phân phối',
  REJECTED: 'Từ chối',
  APPROVED: 'Đã phê duyệt',
  RETURNED: 'Trả lại',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABEL_MAP[status] || status;
}

export function getStatusColor(status: string): string {
  if (status === 'DISTRIBUTED') return '#dcfce7';
  if (status === 'APPROVED') return '#dcfce7';
  if (status === 'REJECTED') return '#fee2e2';
  if (status === 'RETURNED') return '#fef3c7';
  if (status === 'DRAFT') return '#f1f5f9';
  return '#dbeafe';
}

export function getStatusTextColor(status: string): string {
  if (status === 'APPROVED') return '#16a34a';
  if (status === 'REJECTED') return '#dc2626';
  if (status === 'RETURNED') return '#d97706';
  if (status === 'DRAFT') return '#64748b';
  if (status === 'DISTRIBUTED') return '#16a34a';
  return '#2563eb';
}
