export interface GridPermission {
  id?: number;
  level: 'COLUMN' | 'ROW' | 'CELL';
  targetField?: string;
  targetRowCode?: string;
  permissionType: 'ALLOW' | 'DENY' | 'LOCK';
  userId?: string;
  roleCode?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface AddPermissionRequest {
  id?: number;
  level: 'COLUMN' | 'ROW' | 'CELL';
  targetField?: string;
  targetRowCode?: string;
  permissionType: 'ALLOW' | 'DENY' | 'LOCK';
  userId?: string;
  roleCode?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface GridPermissionRequest {
  addPermissionRequest?: AddPermissionRequest[];
  idDeleted?: number[];
}
