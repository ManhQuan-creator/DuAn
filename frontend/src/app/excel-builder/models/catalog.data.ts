export interface CatalogItem {
  id: string;
  name: string;
  parentId: string | null;
  note?: string;
  level?: number;
  sortOrder?: number;
  active?: boolean;
}
