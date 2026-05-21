import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { DeptTypeItem, DeptTypeService } from '../../shared/dept-type.service';
import { PositionItem, PositionService } from '../../position-management/position.service';
import { StepCandidateItem } from '../workflow-definition.service';

export interface StepCandidateDialogData {
  stepName: string;
  candidates: StepCandidateItem[];
  /** Chế độ chỉ xem (quy trình đã deployed) */
  readonly?: boolean;
}

@Component({
  selector: 'app-step-candidate-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step-candidate-dialog.component.html',
  styleUrls: ['./step-candidate-dialog.component.scss'],
})
export class StepCandidateDialogComponent implements OnInit {
  readonly data: StepCandidateDialogData;
  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);

  /** Bản sao candidates để chỉnh sửa local */
  candidates: StepCandidateItem[] = [];

  allDepts: DeptTypeItem[] = [];
  allPositions: PositionItem[] = [];

  /** Form thêm mới */
  form = {
    orgGroupCode: '' as '' | 'EVNNPC' | 'PC_COMPANY',
    employeeKind: '' as '' | 'TOP' | 'DEPT',
    subjectOrgCode: '',
    subjectPositionCode: '',
  };

  readonly orgGroupOptions = [
    { value: 'EVNNPC' as const, label: 'EVNNPC (Tổng công ty)', hint: 'Cán bộ TCT' },
    { value: 'PC_COMPANY' as const, label: 'Công ty Điện lực', hint: 'Cán bộ PC' },
  ];

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<StepCandidateItem[] | null, StepCandidateDialogData>,
  ) {
    this.data = context.data;
  }

  ngOnInit(): void {
    this.candidates = [...(this.data.candidates || [])];
    this.deptTypeService.getAllActive().subscribe(d => this.allDepts = d);
    this.positionService.getAllActive().subscribe(p => this.allPositions = p);
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

  // ── Computed ────────────────────────────────────────────────

  get showEmployeeKind(): boolean {
    return !!this.form.orgGroupCode;
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
      return this.allPositions
        .filter(p => p.orgLevelScope === this.form.orgGroupCode)
        .sort((a, b) => a.positionRank - b.positionRank);
    }
    if (this.isDeptLevel && this.form.subjectOrgCode) {
      const dept = this.allDepts.find(d => d.deptTypeCode === this.form.subjectOrgCode);
      if (!dept) return [];
      return this.allPositions
        .filter(p => p.orgLevelScope === dept.orgLevelScope)
        .sort((a, b) => a.positionRank - b.positionRank);
    }
    return [];
  }

  // ── Candidate list display helpers ──────────────────────────

  resolveOrgName(orgCode: string | null): string {
    if (!orgCode) return '(tất cả ban/phòng)';
    const dept = this.allDepts.find(d => d.deptTypeCode === orgCode);
    return dept ? dept.deptTypeName : orgCode;
  }

  resolvePositionName(posCode: string | null): string {
    if (!posCode) return '(tất cả chức danh)';
    const pos = this.allPositions.find(p => p.positionCode === posCode);
    return pos ? pos.positionName : posCode;
  }

  // ── Actions ─────────────────────────────────────────────────

  get canAdd(): boolean {
    if (this.isTopLevel) return !!this.form.subjectPositionCode;
    if (this.isDeptLevel) return !!this.form.subjectOrgCode;
    return false;
  }

  addCandidate(): void {
    if (!this.canAdd) return;

    let orgCode: string | null = null;
    let posCode: string | null = null;

    if (this.isTopLevel) {
      posCode = this.form.subjectPositionCode || null;
    } else if (this.isDeptLevel) {
      orgCode = this.form.subjectOrgCode || null;
      posCode = this.form.subjectPositionCode || null;
    }

    // Check duplicate
    const exists = this.candidates.some(c =>
      c.subjectOrgCode === orgCode && c.subjectPositionCode === posCode
    );
    if (exists) return;

    this.candidates = [...this.candidates, { subjectOrgCode: orgCode, subjectPositionCode: posCode }];

    // Reset position for quick re-add
    this.form.subjectPositionCode = '';
  }

  removeCandidate(index: number): void {
    this.candidates = this.candidates.filter((_, i) => i !== index);
  }

  // ── Dialog actions ──────────────────────────────────────────

  save(): void {
    this.context.completeWith(this.candidates);
  }

  cancel(): void {
    this.context.completeWith(null);
  }
}
