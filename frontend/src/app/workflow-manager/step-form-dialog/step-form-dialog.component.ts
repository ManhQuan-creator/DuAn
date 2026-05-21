import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { DeptTypeItem, DeptTypeService } from '../../shared/dept-type.service';
import { PositionItem, PositionService } from '../../position-management/position.service';
import {
  StepCandidateItem,
  WorkflowActionHandlerItem,
  WorkflowDefinitionService,
  WorkflowStepItem,
} from '../workflow-definition.service';

export interface StepFormDialogData {
  mode: 'create' | 'edit' | 'view';
  /** Số thứ tự mặc định (khi tạo mới) */
  nextOrder?: number;
  /** Dữ liệu bước hiện tại (khi sửa/xem) — bao gồm cả candidates */
  step?: WorkflowStepItem;
}

/** Kết quả trả về — gồm thông tin bước + handler + candidates (gộp trong 1 form) */
export interface StepFormDialogResult {
  stepOrder: number;
  stepKey: string;
  stepName: string;
  statusAfterApprove: string;
  returnTarget: string;
  notifyMessage?: string;
  onApproveHandlerKey?: string | null;
  onReturnHandlerKey?: string | null;
  onRejectHandlerKey?: string | null;
  candidates: StepCandidateItem[];
}

@Component({
  selector: 'app-step-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step-form-dialog.component.html',
  styleUrls: ['./step-form-dialog.component.scss'],
})
export class StepFormDialogComponent implements OnInit {
  private readonly workflowService = inject(WorkflowDefinitionService);
  private readonly deptTypeService = inject(DeptTypeService);
  private readonly positionService = inject(PositionService);

  readonly data: StepFormDialogData;

  // ── Section 1 & 2: thông tin bước + handler ────────────────
  form = {
    stepOrder: '1',
    stepKey: '',
    stepName: '',
    statusAfterApprove: '',
    returnTarget: 'SUBMITTER',
    notifyMessage: '',
    onApproveHandlerKey: '',
    onReturnHandlerKey: '',
    onRejectHandlerKey: '',
  };

  readonly returnTargetOptions = [
    { value: 'SUBMITTER', label: 'Người gửi ban đầu (gửi lại từ bước 1)' },
    { value: 'PREVIOUS_STEP', label: 'Bước ngay trước (xét duyệt lại)' },
  ];

  actionHandlers: WorkflowActionHandlerItem[] = [];

  // ── Section 3: candidates (gộp từ step-candidate-dialog) ───
  candidates: StepCandidateItem[] = [];
  allDepts: DeptTypeItem[] = [];
  allPositions: PositionItem[] = [];

  candidateForm = {
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
    private readonly context: TuiDialogContext<StepFormDialogResult | null, StepFormDialogData>,
  ) {
    this.data = context.data;

    if ((this.data.mode === 'edit' || this.data.mode === 'view') && this.data.step) {
      const s = this.data.step;
      this.form.stepOrder = s.stepOrder.toString();
      this.form.stepKey = s.stepKey;
      this.form.stepName = s.stepName;
      this.form.statusAfterApprove = s.statusAfterApprove;
      this.form.returnTarget = s.returnTarget || 'SUBMITTER';
      this.form.notifyMessage = s.notifyMessage || '';
      this.form.onApproveHandlerKey = s.onApproveHandlerKey || '';
      this.form.onReturnHandlerKey = s.onReturnHandlerKey || '';
      this.form.onRejectHandlerKey = s.onRejectHandlerKey || '';
      this.candidates = [...(s.candidates || [])];
    } else if (this.data.nextOrder) {
      this.form.stepOrder = this.data.nextOrder.toString();
    }
  }

  get isReadonly(): boolean {
    return this.data.mode === 'view';
  }

  ngOnInit(): void {
    this.workflowService.getActionHandlers().subscribe({
      next: (list) => (this.actionHandlers = list),
      error: () => (this.actionHandlers = []),
    });
    this.deptTypeService.getAllActive().subscribe((d) => (this.allDepts = d));
    this.positionService.getAllActive().subscribe((p) => (this.allPositions = p));
  }

  get title(): string {
    if (this.data.mode === 'view') return 'Xem chi tiết bước duyệt';
    return this.data.mode === 'edit' ? 'Sửa bước duyệt' : 'Thêm bước duyệt';
  }

  /** Label hiển thị handler (đã chọn) — dùng khi readonly để tránh show key thô */
  handlerLabel(key: string | null | undefined): string {
    if (!key) return '— Không chạy logic phụ —';
    const found = this.actionHandlers.find((h) => h.key === key);
    return found ? found.label : key;
  }

  /** Label hiển thị option trả về */
  get returnTargetLabel(): string {
    const opt = this.returnTargetOptions.find((o) => o.value === this.form.returnTarget);
    return opt ? opt.label : this.form.returnTarget;
  }

  get canSubmit(): boolean {
    return !!this.form.stepKey.trim()
        && !!this.form.stepName.trim()
        && !!this.form.statusAfterApprove.trim();
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.context.completeWith({
      stepOrder: parseInt(this.form.stepOrder, 10) || 1,
      stepKey: this.form.stepKey.trim(),
      stepName: this.form.stepName.trim(),
      statusAfterApprove: this.form.statusAfterApprove.trim().toUpperCase(),
      returnTarget: this.form.returnTarget || 'SUBMITTER',
      notifyMessage: this.form.notifyMessage.trim() || undefined,
      onApproveHandlerKey: this.form.onApproveHandlerKey || null,
      onReturnHandlerKey: this.form.onReturnHandlerKey || null,
      onRejectHandlerKey: this.form.onRejectHandlerKey || null,
      candidates: this.candidates,
    });
  }

  cancel(): void {
    this.context.completeWith(null);
  }

  // ─── Candidate section logic (từ step-candidate-dialog) ────────────

  onOrgGroupChange(): void {
    this.candidateForm.employeeKind = '';
    this.candidateForm.subjectOrgCode = '';
    this.candidateForm.subjectPositionCode = '';
  }

  onEmployeeKindChange(): void {
    this.candidateForm.subjectOrgCode = '';
    this.candidateForm.subjectPositionCode = '';
  }

  onDeptChange(): void {
    this.candidateForm.subjectPositionCode = '';
  }

  get showEmployeeKind(): boolean {
    return !!this.candidateForm.orgGroupCode;
  }

  get isTopLevel(): boolean {
    return this.showEmployeeKind && this.candidateForm.employeeKind === 'TOP';
  }

  get isDeptLevel(): boolean {
    return this.showEmployeeKind && this.candidateForm.employeeKind === 'DEPT';
  }

  get showPositionPicker(): boolean {
    if (this.isTopLevel) return true;
    if (this.isDeptLevel) return !!this.candidateForm.subjectOrgCode;
    return false;
  }

  get topLevelLabel(): string {
    return this.candidateForm.orgGroupCode === 'EVNNPC'
      ? 'Lãnh đạo cấp cao TCT'
      : 'Lãnh đạo Công ty ĐL';
  }

  get deptLevelLabel(): string {
    return this.candidateForm.orgGroupCode === 'EVNNPC' ? 'Cán bộ Ban TCT' : 'Cán bộ Phòng PC';
  }

  get deptLabel(): string {
    return this.candidateForm.orgGroupCode === 'EVNNPC' ? 'Ban' : 'Phòng';
  }

  get visibleDepts(): DeptTypeItem[] {
    const scope = this.candidateForm.orgGroupCode === 'EVNNPC' ? 'HQ_DEPT' : 'PC_DEPT';
    return this.allDepts
      .filter((d) => d.orgLevelScope === scope)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  get visiblePositions(): PositionItem[] {
    if (this.isTopLevel) {
      return this.allPositions
        .filter((p) => p.orgLevelScope === this.candidateForm.orgGroupCode)
        .sort((a, b) => a.positionRank - b.positionRank);
    }
    if (this.isDeptLevel && this.candidateForm.subjectOrgCode) {
      const dept = this.allDepts.find((d) => d.deptTypeCode === this.candidateForm.subjectOrgCode);
      if (!dept) return [];
      return this.allPositions
        .filter((p) => p.orgLevelScope === dept.orgLevelScope)
        .sort((a, b) => a.positionRank - b.positionRank);
    }
    return [];
  }

  resolveOrgName(orgCode: string | null): string {
    if (!orgCode) return '(tất cả ban/phòng)';
    const dept = this.allDepts.find((d) => d.deptTypeCode === orgCode);
    return dept ? dept.deptTypeName : orgCode;
  }

  resolvePositionName(posCode: string | null): string {
    if (!posCode) return '(tất cả chức danh)';
    const pos = this.allPositions.find((p) => p.positionCode === posCode);
    return pos ? pos.positionName : posCode;
  }

  get canAddCandidate(): boolean {
    if (this.isTopLevel) return !!this.candidateForm.subjectPositionCode;
    if (this.isDeptLevel) return !!this.candidateForm.subjectOrgCode;
    return false;
  }

  addCandidate(): void {
    if (!this.canAddCandidate) return;

    let orgCode: string | null = null;
    let posCode: string | null = null;

    if (this.isTopLevel) {
      posCode = this.candidateForm.subjectPositionCode || null;
    } else if (this.isDeptLevel) {
      orgCode = this.candidateForm.subjectOrgCode || null;
      posCode = this.candidateForm.subjectPositionCode || null;
    }

    const exists = this.candidates.some(
      (c) => c.subjectOrgCode === orgCode && c.subjectPositionCode === posCode,
    );
    if (exists) return;

    this.candidates = [
      ...this.candidates,
      { subjectOrgCode: orgCode, subjectPositionCode: posCode },
    ];
    this.candidateForm.subjectPositionCode = '';
  }

  removeCandidate(index: number): void {
    this.candidates = this.candidates.filter((_, i) => i !== index);
  }
}
