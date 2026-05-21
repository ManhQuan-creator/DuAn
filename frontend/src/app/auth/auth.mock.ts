/**
 * Test helper: tạo mock `AuthService` với `currentUser` configurable.
 *
 * Dùng trong specs cần mock AuthService (vd FormulaService inject AuthService cho MYORG).
 * Giữ shape khớp `Partial<AuthService>` để TestBed `useValue` hoạt động.
 *
 * Note: chỉ expose `currentUser` getter — đủ cho mọi consumer hiện tại. Mở rộng khi
 * test mới cần `user$ Observable` hoặc `isAuthenticated`.
 */

import { AuthService, CurrentUser } from './auth.service';

export function makeAuthMock(companyCode: string | null = 'PCHN'): Partial<AuthService> {
  const user: CurrentUser | null =
    companyCode == null
      ? null
      : {
          username: 'test',
          fullName: 'Test User',
          orgGroupCode: null,
          companyCode,
          deptCode: null,
          positionCode: null,
          roles: [],
          token: 'mock-token',
        };
  return { currentUser: user };
}
