import { Option } from "../../shared/models/common.model";

export const StatusEnum = {
  CHUA_GUI_THAM_DINH: 'CHUA_GUI_THAM_DINH',
  DA_GUI_TD: 'DA_GUI_TD',
  DA_DUYET_TD: 'DA_DUYET_TD',
  GUI_LD_DUYET: 'GUI_LD_DUYET',
  LD_DA_THONG_QUA: 'LD_DA_THONG_QUA',
  TU_CHOI_DUYET_TD: 'TU_CHOI_DUYET_TD',
  DIEU_CHINH_TD: 'DIEU_CHINH_TD',
  DA_THAM_DINH: 'DA_THAM_DINH',
  CAN_HIEU_CHINH: 'CAN_HIEU_CHINH',
} as const;

export const STATUS_OPTIONS: Option[] = [
  {
    value: 'CHUA_GUI_THAM_DINH',
    label: 'Chưa gửi thẩm định',
  },
  {
    value: 'DA_GUI_TD',
    label: 'Đã gửi thẩm định',
  },
  {
    value: 'DA_DUYET_TD',
    label: 'Đã duyệt thẩm định',
  },
  {
    value: 'GUI_LD_DUYET',
    label: 'Gửi LĐ duyệt',
  },
  {
    value: 'LD_DA_THONG_QUA',
    label: 'LĐ đã thông qua',
  },
  {
    value: 'TU_CHOI_DUYET_TD',
    label: 'Đã từ chối duyệt thẩm định',
  },
  {
    value: 'DIEU_CHINH_TD',
    label: 'Điều chỉnh thẩm định',
  },
  {
    value: 'DA_THAM_DINH',
    label: 'Đã được thẩm định',
  },
  {
    value: 'CAN_HIEU_CHINH',
    label: 'Cần hiệu chỉnh',
  },
];

export const STATUS_MAP: Record<string, { label: string; class: string }> = {
  TAO_MOI: { label: 'Tạo mới', class: 'create' },
  CHUA_GUI_THAM_DINH: { label: 'Chưa gửi thẩm định', class: 'draft' },
  DA_GUI_TD: { label: 'Đã gửi thẩm định', class: 'submitted' },
  DA_THAM_DINH: { label: 'Đã được thẩm định', class: 'approved' },
  GUI_DUYET_HM: { label: 'Gửi duyệt hạng mục', class: 'pending' },
  DA_DUYET_HM: { label: 'Đã duyệt hạng mục', class: 'done' },
  TU_CHOI: { label: 'Từ chối duyệt hạng mục', class: 'rejected' },
  TD_KHONG_THONG_QUA: { label: 'TĐ không thông qua', class: 'rejected' },
  TD_DA_THONG_QUA: { label: 'TĐ đã thông qua', class: 'approved' },
  CAN_HIEU_CHINH: { label: 'Cần hiệu chỉnh', class: 'warning' },
  DONG_Y_TD: { label: 'Đồng ý hạng mục thẩm định', class: 'approved' },
  TU_CHOI_TD: { label: 'Từ chối hạng mục thẩm định', class: 'rejected' },
};
