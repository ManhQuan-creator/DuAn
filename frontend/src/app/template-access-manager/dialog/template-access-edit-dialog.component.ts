import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { UpdateTemplateAccessRequest } from '../../shared/template-access.service';
import { DeptTypeItem, DeptTypeService } from '../../shared/dept-type.service';
import { PositionItem, PositionService } from '../../position-management/position.service';

interface SelectOption { value: string; label: string; }

export interface TemplateAccessEditDialogData {
  id: number;
  templateId: number;
  templateName: string;
  actionKey: string;
  subjectOrgCode: string | null;
  subjectPositionCode: string | null;
}

export interface TemplateAccessEditDialogResult {
  id: number;
  data: UpdateTemplateAccessRequest;
}

@Component({
  selector: 'app-template-access-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-access-edit-dialog.component.html',
  styleUrls: ['./template-access-edit-dialog.component.scss'],
})
export class TemplateAccessEditDialogComponent implements OnInit {
  readonly data: TemplateAccessEditDialogData;
  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);

  form = {
    actionKey: '',
    orgGroupCode: '' as '' | 'EVNNPC' | 'PC_COMPANY',
    employeeKind: '' as '' | 'TOP' | 'DEPT',
    subjectOrgCode: '',
    subjectPositionCode: '',
  };

  buttonOptions: SelectOption[] = [];
  allDepts: DeptTypeItem[] = [];
  allPositions: PositionItem[] = [];

  readonly orgGroupOptions = [
    { value: '' as const, label: 'Tất cả tổ chức', hint: 'Không giới hạn' },
    { value: 'EVNNPC' as const, label: 'EVNNPC (Tổng công ty)', hint: 'Cán bộ TCT' },
    { value: 'PC_COMPANY' as const, label: 'Công ty Điện lực', hint: 'Cán bộ PC' },
  ];

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<TemplateAccessEditDialogResult | null, TemplateAccessEditDialogData>,
    private readonly http: HttpClient,
  ) {
    this.data = context.data;
  }

  ngOnInit(): void {
    this.form.actionKey = this.data.actionKey;
    this.loadButtons(this.data.templateId);

    this.deptTypeService.getAllActive().subscribe(depts => {
      this.allDepts = depts;
      this.positionService.getAllActive().subscribe(positions => {
        this.allPositions = positions;
        this.inferFromData();
      });
    });
  }

  /** Xác định orgGroupCode + employeeKind từ dữ liệu hiện tại */
  private inferFromData(): void {
    const orgCode = this.data.subjectOrgCode;
    const posCode = this.data.subjectPositionCode;

    // Cả hai null → "Tất cả"
    if (!orgCode && !posCode) {
      this.form.orgGroupCode = '';
      return;
    }

    // Có orgCode → cán bộ Ban/Phòng
    if (orgCode) {
      const dept = this.allDepts.find(d => d.deptTypeCode === orgCode);
      this.form.orgGroupCode = dept?.orgLevelScope === 'PC_DEPT' ? 'PC_COMPANY' : 'EVNNPC';
      this.form.employeeKind = 'DEPT';
      this.form.subjectOrgCode = orgCode;
      if (posCode) this.form.subjectPositionCode = posCode;
      return;
    }

    // Không có orgCode, có posCode → lãnh đạo cấp cao
    if (posCode) {
      const pos = this.allPositions.find(p => p.positionCode === posCode);
      this.form.orgGroupCode = pos?.orgLevelScope === 'PC_COMPANY' ? 'PC_COMPANY' : 'EVNNPC';
      this.form.employeeKind = 'TOP';
      this.form.subjectPositionCode = posCode;
    }
  }

  private loadButtons(templateId: number): void {
    this.http.get<any>(`/excelpro-service/v1/template-buttons/by-template/${templateId}`).subscribe(res => {
      this.buttonOptions = (res.data as any[])
        .filter(b => b.active !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(b => ({ value: b.buttonKey, label: `${b.buttonKey} — ${b.buttonLabel}` }));
    });
  }

  // ── Cascade handlers ────────────────────────────────────────

  onOrgGroupChange(): void {
    this.form.employeeKind = '';
    this.form.subjectOrgCode = '';
    this.form.subjectPositionCode = '';
  }

  onEmployeeKindChange(): void {
    this.form.subjectOrgCode = '';
    this.form.subjectPositionCode = '';
  }

  onDeptChange(): void {
    this.form.subjectPositionCode = '';
  }

  // ── Computed visibility ─────────────────────────────────────

  get isPermissionEnabled(): boolean {
    return this.form.orgGroupCode === 'EVNNPC' || this.form.orgGroupCode === 'PC_COMPANY';
  }

  get showEmployeeKind(): boolean {
    return this.isPermissionEnabled;
  }

  get isTopLevel(): boolean {
    return this.showEmployeeKind && this.form.employeeKind === 'TOP';
  }

  get isDeptLevel(): boolean {
    return this.showEmployeeKind && this.form.employeeKind === 'DEPT';
  }

  get showPositionPicker(): boolean {
    if (this.isTopLevel) return true;
    if (this.isDeptLevel) return !!this.form.subjectOrgCode;
    return false;
  }

  get topLevelLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC' ? 'Lãnh đạo cấp cao TCT' : 'Lãnh đạo Công ty ĐL';
  }

  get deptLevelLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC' ? 'Cán bộ Ban TCT' : 'Cán bộ Phòng PC';
  }

  get deptLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC' ? 'Ban' : 'Phòng';
  }

  get visibleDepts(): DeptTypeItem[] {
    const scope = this.form.orgGroupCode === 'EVNNPC' ? 'HQ_DEPT' : 'PC_DEPT';
    return this.allDepts
      .filter(d => d.orgLevelScope === scope)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  get visiblePositions(): PositionItem[] {
    if (this.isTopLevel) {
      // Lãnh đạo cấp cao: EVNNPC scope (HDTV, TGD, PTGD) hoặc PC_COMPANY scope (GD, PGD)
      return this.allPositions
        .filter(p => p.orgLevelScope === this.form.orgGroupCode)
        .sort((a, b) => a.positionRank - b.positionRank);
    }

    if (this.isDeptLevel && this.form.subjectOrgCode) {
      // Cán bộ Ban/Phòng: HQ_DEPT scope hoặc PC_DEPT scope
      const dept = this.allDepts.find(d => d.deptTypeCode === this.form.subjectOrgCode);
      if (!dept) return [];
      return this.allPositions
        .filter(p => p.orgLevelScope === dept.orgLevelScope)
        .sort((a, b) => a.positionRank - b.positionRank);
    }

    return [];
  }

  // ── Submit ──────────────────────────────────────────────────

  canSubmit(): boolean {
    return !!this.form.actionKey;
  }

  submit(): void {
    if (!this.canSubmit()) return;

    let orgCode: string | null = null;
    let posCode: string | null = null;

    if (this.isTopLevel) {
      posCode = this.form.subjectPositionCode || null;
    } else if (this.isDeptLevel) {
      orgCode = this.form.subjectOrgCode || null;
      posCode = this.form.subjectPositionCode || null;
    }
    // "Tất cả" → both null

    this.context.completeWith({
      id: this.data.id,
      data: { actionKey: this.form.actionKey, subjectOrgCode: orgCode, subjectPositionCode: posCode },
    });
  }

  cancel(): void {
    this.context.completeWith(null);
  }
}
