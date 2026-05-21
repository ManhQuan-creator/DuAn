import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TuiSvgModule } from '@taiga-ui/core';
import { AuthService } from '../auth/auth.service';
import { SidebarMenuNode, SidebarMenuService } from '../shared/sidebar-menu.service';

type MenuChild = {
  label: string;
  path: string;
  icon: string;
  queryParams?: Record<string, string | number>;
};

type MenuSection = {
  key: string;
  label: string;
  adminOnly?: boolean;
  children: MenuChild[];
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TuiSvgModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sidebarMenuService = inject(SidebarMenuService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly isAdmin = this.auth.hasRole('ADMIN');

  private readonly partialRouteMatch: IsActiveMatchOptions = {
    paths: 'subset',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored'
  };

  protected readonly linkActiveOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'subset',
    matrixParams: 'ignored',
    fragment: 'ignored'
  };

  /**
   * Các section fix cứng (luôn hiển thị TRƯỚC các section động).
   * Mọi section sau đây sẽ được cấu hình động qua bảng SIDEBAR_MENU
   * và quản lý tại trang /sidebar-menu-manager.
   */
  private readonly fixedSections: MenuSection[] = [
    {
      key: 'main',
      label: 'Quản lý biểu mẫu',
      adminOnly: true,
      children: [
        { label: 'Danh sách biểu mẫu', path: '/grid-templates', icon: 'tuiIconFileLarge' },
        { label: 'Quản lý danh mục', path: '/catalog-manager', icon: 'tuiIconTagLarge' }
      ]
    },
    {
      key: 'approval',
      label: 'PHÊ DUYỆT',
      children: [{ label: 'Công việc của tôi', path: '/workflow/tasks', icon: 'tuiIconCheckCircleLarge' }]
    },
    {
      key: 'system',
      label: 'HỆ THỐNG',
      adminOnly: true,
      children: [
        { label: 'Quản lý đơn vị', path: '/organization-management', icon: 'tuiIconBriefcaseLarge' },
        { label: 'Quản lý người dùng', path: '/user-management', icon: 'tuiIconUsersLarge' },
        { label: 'Quản lý chức danh', path: '/position-management', icon: 'tuiIconAwardLarge' },
        // { label: 'Phân quyền nút trên báo cáo', path: '/template-access-manager', icon: 'tuiIconShieldLarge' },
        { label: 'Quản lý quy trình', path: '/workflow-manager', icon: 'tuiIconSlidersLarge' },
        { label: 'Quản lý menu sidebar', path: '/sidebar-menu-manager', icon: 'tuiIconListLarge' },
        { label: 'Cấu hình biểu mẫu động', path: '/excel-builder', icon: 'tuiIconGridLarge' },
        { label: 'Dump dữ liệu Grid (debug)', path: '/debug/grid-dump', icon: 'tuiIconCodeLarge' }
      ]
    }
  ];

  protected sections: MenuSection[] = [...this.fixedSections];

  protected readonly expandedMenus: Record<string, boolean> = {};

  ngOnInit(): void {
    this.loadDynamicSections();
  }

  private loadDynamicSections(): void {
    this.sidebarMenuService.getActiveTree().subscribe({
      next: (tree) => {
        const dynamic = this.mapTreeToSections(tree);
        this.sections = [...this.fixedSections, ...dynamic];
        this.cdr.markForCheck();
      },
      error: () => {
        // Lỗi load không làm hỏng sidebar — giữ nguyên fix cứng
        this.sections = [...this.fixedSections];
        this.cdr.markForCheck();
      },
    });
  }

  private mapTreeToSections(nodes: SidebarMenuNode[]): MenuSection[] {
    return nodes
      .filter((node) => this.canSeeNode(node))
      .map((node) => ({
        key: node.menuKey,
        label: node.label,
        children: (node.children ?? [])
          .filter((c) => !!c.path && this.canSeeNode(c))
          .map((c) => ({
            label: c.label,
            path: c.path!,
            icon: c.icon || 'tuiIconCircleLarge',
          })),
      }))
      // Ẩn section không còn item con nào sau khi filter quyền
      .filter((s) => s.children.length > 0);
  }

  /**
   * Phân quyền hiển thị menu động:
   *  - ADMIN luôn thấy.
   *  - orgGroupCode null = mọi user (bỏ qua permissionRules).
   *  - orgGroupCode set: user phải cùng nhóm.
   *  - permissionRules empty = mọi user trong nhóm xem được.
   *  - permissionRules có entries: user phải match ÍT NHẤT một rule.
   *
   * Hai loại rule:
   *  1. deptCode != null → user phải có deptCode trùng VÀ (positionCodes rỗng hoặc chứa positionCode user)
   *  2. deptCode == null → user phải CÓ deptCode == null (lãnh đạo cấp cao)
   *     VÀ positionCode nằm trong positionCodes của rule
   */
  private canSeeNode(node: SidebarMenuNode): boolean {
    if (this.isAdmin) return true;
    const user = this.auth.currentUser;
    if (!user) return false;

    if (!node.orgGroupCode) return true;
    if (node.orgGroupCode !== user.orgGroupCode) return false;

    const rules = node.permissionRules ?? [];
    if (rules.length === 0) return true;

    return rules.some((rule) => {
      if (rule.deptCode == null) {
        // Top-level rule (lãnh đạo cấp cao) — user phải có deptCode null
        if (user.deptCode != null) return false;
        if (!rule.positionCodes?.length) return false;
        return !!user.positionCode && rule.positionCodes.includes(user.positionCode);
      }
      // Per-dept rule
      if (!user.deptCode || rule.deptCode !== user.deptCode) return false;
      if (!rule.positionCodes || rule.positionCodes.length === 0) return true;
      return !!user.positionCode && rule.positionCodes.includes(user.positionCode);
    });
  }

  protected toggleMenu(key: string): void {
    const autoExpanded = this.hasActiveChild(key);
    const current = this.isExpanded(key);

    if (current && autoExpanded) {
      this.expandedMenus[key] = false;
    } else if (!current && !autoExpanded) {
      this.expandedMenus[key] = true;
    } else {
      this.expandedMenus[key] = !current;
    }
  }

  protected isExpanded(key: string): boolean {
    const manualState = this.expandedMenus[key];
    if (manualState !== undefined) {
      return manualState;
    }
    return this.hasActiveChild(key);
  }

  private hasActiveChild(key: string): boolean {
    const section = this.sections.find((s) => s.key === key);
    if (!section) return false;
    return section.children.some((child) =>
      this.router.isActive(this.urlTreeForChild(child), this.partialRouteMatch)
    );
  }

  private urlTreeForChild(child: MenuChild) {
    let url = child.path;
    const q = child.queryParams;
    if (q && Object.keys(q).length > 0) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) {
        sp.set(k, String(v));
      }
      url += `?${sp.toString()}`;
    }
    return this.router.parseUrl(url);
  }
}
