export interface ResponseData<T> {
  code: string;
  message: string;
  data: T;
}

export interface PageAndOrderRequest {
  orders?: AppOrder[];
  pageNum?: number;
  pageSize?: number;
}

export interface AppOrder {
  field?: string;
  direction?: 'asc' | 'desc';
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;      // trang hiện tại
  size: number;        // page size
  first: boolean;
  last: boolean;
}

export interface Option {
  value: string;
  label: string;
}