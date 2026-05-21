import { Option } from '../../shared/models/common.model';

export const StatusAssessmentEnum = {
  DA_GUI_TD: 'DA_GUI_TD',
  DONG_Y_TD: 'DONG_Y_TD',
  TU_CHOI_TD: 'TU_CHOI_TD',
  CAN_HIEU_CHINH: 'CAN_HIEU_CHINH',
  DA_THAM_DINH: 'DA_THAM_DINH',
  CHUA_THAM_DINH: 'CHUA_THAM_DINH',
} as const;

// Trạng thái (field `status` của SclAssessment) — flow thẩm định.
export const STATUS_OPTIONS: Option[] = [
  {
    value: 'DA_GUI_TD',
    label: 'Đã gửi thẩm định',
  },
  {
    value: 'DONG_Y_TD',
    label: 'Đồng ý hạng mục thẩm định',
  },
  {
    value: 'TU_CHOI_TD',
    label: 'Từ chối hạng mục thẩm định',
  },
  {
    value: 'CAN_HIEU_CHINH',
    label: 'Cần hiệu chỉnh',
  },
  {
    value: 'DA_THAM_DINH',
    label: 'Đã thẩm định',
  },
];

// Trạng thái thẩm định (field `statusAssessment`) — kết quả đã/chưa thẩm định.
export const STATUS_ASSESSMENT_OPTIONS: Option[] = [
  {
    value: 'DA_THAM_DINH',
    label: 'Đã thẩm định',
  },
  {
    value: 'CHUA_THAM_DINH',
    label: 'Chưa thẩm định',
  },
];

export const STATUS_ASSESSMENT_MAP: Record<
  string,
  { label: string; class: string }
> = {
  DA_GUI_TD: { label: 'Đã gửi thẩm định', class: 'submitted' },
  DONG_Y_TD: { label: 'Đồng ý hạng mục thẩm định', class: 'approved' },
  TU_CHOI_TD: { label: 'Từ chối hạng mục thẩm định', class: 'rejected' },
  CAN_HIEU_CHINH: { label: 'Cần hiệu chỉnh', class: 'warning' },
  DA_THAM_DINH: { label: 'Đã thẩm định', class: 'approved' },
  CHUA_THAM_DINH: { label: 'Chưa thẩm định', class: 'draft' },
};
