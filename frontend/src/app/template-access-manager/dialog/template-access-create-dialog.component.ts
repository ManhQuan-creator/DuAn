import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { CreateTemplateAccessRequest } from '../../shared/template-access.service';
import { DeptTypeItem, DeptTypeService } from '../../shared/dept-type.service';
import { PositionItem, PositionService } from '../../position-management/position.service';

interface SelectOption { value: string; label: string; }

export interface TemplateAccessCreateDialogData {
  initialTemplateId?: number;
}

@Component({
  selector: 'app-template-access-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-access-create-dialog.component.html',
  styleUrls: ['./template-access-create-dialog.component.scss'],
})
export class TemplateAccessCreateDialogComponent implements OnInit {
  readonly data: TemplateAccessCreateDialogData;
  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);

  form = {
    templateId: '',
    actionKey: '',
    orgGroupCode: '' as '' | 'EVNNPC' | 'PC_COMPANY',
  };

  templateOptions: SelectOption[] = [];
  buttonOptions: SelectOption[] = [];
  allDepts: DeptTypeItem[] = [];
  allPositions: PositionItem[] = [];
  loadingLookups = false;

  /** Lãnh đạo cấp cao — không thuộc Ban/Phòng (subjectOrgCode = null) */
  topLevelPositions = new Set<string>();
  /** Ban/Phòng → Set chức danh đã chọn. Empty set = mọi chức danh */
  rules = new Map<string, Set<string>>();

  readonly orgGroupOptions = [
    { value: '' as const, label: 'Tất cả tổ chức', hint: 'Mọi đơn vị / chức danh đều được phép' },
    { value: 'EVNNPC' as const, label: 'EVNNPC (Tổng công ty)', hint: 'Chỉ cán bộ thuộc cơ quan Tổng công ty' },
    { value: 'PC_COMPANY' as const, label: 'Công ty Điện lực', hint: 'Cán bộ các Công ty Điện lực (không phân biệt PC cụ thể)' },
  ];

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<CreateTemplateAccessRequest[] | null, TemplateAccessCreateDialogData>,
    private readonly http: HttpClient,
  ) {
    this.data = context.data;
  }

  ngOnInit(): void {
    if (this.data.initialTemplateId) {
      this.form.templateId = String(this.data.initialTemplateId);
    }

    this.http.get<any>('/excelpro-service/v1/grid-templates').subscribe(res => {
      this.templateOptions = (res.data as any[]).map(t => ({
        value: String(t.id),
        label: `[${t.id}] ${t.name}`,
      }));
      if (this.form.templateId) {
        this.loadButtons(Number(this.form.templateId));
      }
    });

    this.loadingLookups = true;
    this.deptTypeService.getAllActive().subscribe(depts => {
      this.allDepts = depts;
      this.loadingLookups = false;
    });

    this.positionService.getAllActive().subscribe(positions => {
      this.allPositions = positions;
    });
  }

  // ── Cascading ──────────────────────────────────────────────

  onTemplateChange(templateId: string): void {
    this.form.actionKey = '';
    this.buttonOptions = [];
    if (templateId) this.loadButtons(Number(templateId));
  }

  private loadButtons(templateId: number): void {
    this.http.get<any>(`/excelpro-service/v1/template-buttons/by-template/${templateId}`).subscribe(res => {
      this.buttonOptions = (res.data as any[])
        .filter(b => b.active !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(b => ({ value: b.buttonKey, label: `${b.buttonKey} — ${b.buttonLabel}` }));
    });
  }

  onOrgGroupChange(): void {
    this.topLevelPositions.clear();
    this.rules.clear();
  }

  // ── Computed ────────────────────────────────────────────────

  get showPermissionSection(): boolean {
    return !!this.form.templateId && !!this.form.actionKey;
  }

  get isPermissionEnabled(): boolean {
    return this.form.orgGroupCode === 'EVNNPC' || this.form.orgGroupCode === 'PC_COMPANY';
  }

  get topLevelSectionTitle(): string {
    return this.form.orgGroupCode === 'EVNNPC'
      ? 'Lãnh đạo Tổng công ty'
      : 'Lãnh đạo Công ty Điện lực';
  }

  get deptSectionLabel(): string {
    return this.form.orgGroupCode === 'EVNNPC' ? 'Ban' : 'Phòng';
  }

  get visibleDepts(): DeptTypeItem[] {
    const scope = this.form.orgGroupCode === 'EVNNPC' ? 'HQ_DEPT' : 'PC_DEPT';
    return this.allDepts
      .filter(d => d.orgLevelScope === scope)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  get topLevelPositionOptions(): PositionItem[] {
    return this.allPositions
      .filter(p => p.orgLevelScope === this.form.orgGroupCode)
      .sort((a, b) => a.positionRank - b.positionRank);
  }

  positionsForDept(deptCode: string): PositionItem[] {
    const dept = this.allDepts.find(d => d.deptTypeCode === deptCode);
    if (!dept) return [];
    return this.allPositions
      .filter(p => p.orgLevelScope === dept.orgLevelScope)
      .sort((a, b) => a.positionRank - b.positionRank);
  }

  // ── Top-level toggles ──────────────────────────────────────

  isTopLevelSelected(code: string): boolean {
    return this.topLevelPositions.has(code);
  }

  toggleTopLevelPosition(code: string): void {
    this.topLevelPositions.has(code)
      ? this.topLevelPositions.delete(code)
      : this.topLevelPositions.add(code);
  }

  selectAllTopLevel(): void {
    for (const p of this.topLevelPositionOptions) this.topLevelPositions.add(p.positionCode);
  }

  clearTopLevel(): void {
    this.topLevelPositions.clear();
  }

  // ── Dept-rule toggles ──────────────────────────────────────

  isDeptSelected(code: string): boolean {
    return this.rules.has(code);
  }

  toggleDept(code: string): void {
    this.rules.has(code) ? this.rules.delete(code) : this.rules.set(code, new Set());
  }

  isPositionSelected(deptCode: string, posCode: string): boolean {
    return this.rules.get(deptCode)?.has(posCode) ?? false;
  }

  togglePosition(deptCode: string, posCode: string): void {
    const set = this.rules.get(deptCode);
    if (!set) return;
    set.has(posCode) ? set.delete(posCode) : set.add(posCode);
  }

  positionsCountForDept(deptCode: string): number {
    return this.rules.get(deptCode)?.size ?? 0;
  }

  selectAllVisibleDepts(): void {
    for (const d of this.visibleDepts) {
      if (!this.rules.has(d.deptTypeCode)) this.rules.set(d.deptTypeCode, new Set());
    }
  }

  clearAllRules(): void {
    this.rules.clear();
  }

  // ── Build & submit ─────────────────────────────────────────

  get ruleCount(): number {
    if (!this.form.orgGroupCode) return 1;
    let n = this.topLevelPositions.size;
    for (const [, pos] of this.rules) n += pos.size === 0 ? 1 : pos.size;
    return n;
  }

  private buildRules(): CreateTemplateAccessRequest[] {
    const templateId = Number(this.form.templateId);
    const actionKey = this.form.actionKey;

    // "Tất cả" → 1 wildcard rule
    if (!this.form.orgGroupCode) {
      return [{ templateId, actionKey, subjectOrgCode: null, subjectPositionCode: null }];
    }

    const out: CreateTemplateAccessRequest[] = [];

    // Top-level: orgCode=null, positionCode=selected
    for (const posCode of this.topLevelPositions) {
      out.push({ templateId, actionKey, subjectOrgCode: null, subjectPositionCode: posCode });
    }

    // Per-dept: orgCode=deptCode, positionCode=selected (or null = all)
    for (const [deptCode, positions] of this.rules) {
      if (positions.size === 0) {
        out.push({ templateId, actionKey, subjectOrgCode: deptCode, subjectPositionCode: null });
      } else {
        for (const posCode of positions) {
          out.push({ templateId, actionKey, subjectOrgCode: deptCode, subjectPositionCode: posCode });
        }
      }
    }

    return out;
  }

  canSubmit(): boolean {
    if (!this.form.templateId || !this.form.actionKey) return false;
    if (!this.form.orgGroupCode) return true;
    return this.topLevelPositions.size > 0 || this.rules.size > 0;
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.context.completeWith(this.buildRules());
  }

  cancel(): void {
    this.context.completeWith(null);
  }

  // ── trackBy ────────────────────────────────────────────────

  trackByDept(_: number, d: DeptTypeItem): string { return d.deptTypeCode; }
  trackByPosition(_: number, p: PositionItem): string { return p.positionCode; }
}
