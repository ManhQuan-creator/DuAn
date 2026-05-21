import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { finalize, switchMap, throwError } from 'rxjs';
import BpmnJS from 'bpmn-js/lib/Modeler';
import { WorkflowDefinitionService } from '../workflow-definition.service';
import { AppDialogService } from '../../shared/dialog.service';
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json';
import excelproModdle from '../../../assets/bpmn-moddle/excelpro.json';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import {
  getCamundaProperty,
  getExcelproCandidates,
  setExcelproCandidates,
  getExcelproSubmitterCandidates,
  setExcelproSubmitterCandidates,
  getModelerServices,
  upsertCamundaProperty,
  getCamundaDelegateExpression,
  getCamundaFieldStringValue,
  removeCamundaField,
  setCamundaDelegateExpression,
  upsertCamundaFieldStringValue,
} from './bpmn-moddle-utils';
import { StepFormDialogComponent, StepFormDialogData, StepFormDialogResult } from '../step-form-dialog/step-form-dialog.component';
import { StepCandidateDialogComponent, StepCandidateDialogData } from '../step-candidate-dialog/step-candidate-dialog.component';
import { ServiceTaskDialogComponent, ServiceTaskDialogData, ServiceTaskDialogResult } from '../service-task-dialog/service-task-dialog.component';
import { StepCandidateItem } from '../workflow-definition.service';

type BpmnModelerAny = any;

const DEFAULT_DIAGRAM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

@Component({
  selector: 'app-bpmn-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bpmn-editor.component.html',
  styleUrls: ['./bpmn-editor.component.scss'],
})
export class BpmnEditorComponent implements AfterViewInit, OnDestroy {
  @Input() xml = '';

  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLDivElement>;

  private modeler?: BpmnModelerAny;
  private isReady = false;

  saving = false;
  loading = true;

  private route = inject(ActivatedRoute);
  private svc = inject(WorkflowDefinitionService);
  private dialog = inject(AppDialogService);
  private readonly tuiDialogs = inject(TuiDialogService);

  private selectedElement: any | null = null;
  private lastRootElement: any | null = null;
  private openedForElementId: string | null = null;

  private get workflowId(): number {
    return Number(this.route.snapshot.paramMap.get('id')) || 0;
  }

  get canConfigureUserTask(): boolean {
    return !!this.selectedElement && is(this.selectedElement, 'bpmn:UserTask');
  }

  get canConfigureProcess(): boolean {
    return !!this.resolveProcessElement(this.selectedElement);
  }

  get canConfigureServiceTask(): boolean {
    return !!this.selectedElement && is(this.selectedElement, 'bpmn:ServiceTask');
  }

  private ensureExcelproNamespace(xml: string): string {
    if (!xml) return xml;

    const excelproUri = (excelproModdle as any)?.uri as string | undefined;
    if (!excelproUri) return xml;

    // If the XML already has the exact namespace, keep as-is.
    if (xml.includes(`xmlns:excelpro="${excelproUri}"`) || xml.includes(`xmlns:excelpro='${excelproUri}'`)) {
      return xml;
    }

    const replaced = xml.replace(
      /xmlns:excelpro\s*=\s*("[^"]*"|'[^']*')/,
      `xmlns:excelpro="${excelproUri}"`,
    );
    if (replaced !== xml) return replaced;

    // If XML contains excelpro tags but no namespace declaration: inject into <definitions ...>
    const hasExcelproTag = /<\s*excelpro:/i.test(xml);
    if (!hasExcelproTag) return xml;

    // Inject after the first "<definitions" token.
    return xml.replace(
      /<definitions(\s+)/,
      `<definitions$1xmlns:excelpro="${excelproUri}" `,
    );
  }

  async ngAfterViewInit(): Promise<void> {
    this.modeler = new (BpmnJS as any)({
      container: this.canvasRef.nativeElement,
      keyboard: { bindTo: document },
      moddleExtensions: {
        camunda: camundaModdle as any,
        excelpro: excelproModdle as any,
      },
    });

    const eventBus = this.modeler.get('eventBus') as any;

    eventBus.on('canvas.viewbox.changed', () => {
      try {
        const canvas = this.modeler?.get('canvas') as any;
        const root = canvas?.getRootElement?.();
        if (root) this.lastRootElement = root;
      } catch {
      }
    });

    eventBus.on('selection.changed', (e: any) => {
      this.selectedElement = e?.newSelection?.[0] ?? null;

      const root = (this.modeler?.get('canvas') as any)?.getRootElement?.();
      if (root) this.lastRootElement = root;
    });

    // Open config dialog when clicking on a UserTask/ServiceTask shape.
    eventBus.on('element.click', (e: any) => {
      const el = e?.element;
      if (!el) return;

      // Prevent re-opening when clicking same element repeatedly
      const id = el?.id || el?.businessObject?.id;
      if (id && this.openedForElementId === id) return;
      this.openedForElementId = id || null;

      // Mark as selected reference for toolbar too
      this.selectedElement = el;

      if (is(el, 'bpmn:UserTask')) {
        this.openUserTaskConfigDialog(el);
        return;
      }

      if (is(el, 'bpmn:ServiceTask')) {
        this.openServiceTaskConfigDialog(el);
        return;
      }

      this.openedForElementId = null;
    });

    const id = this.workflowId;
    if (!id) {
      this.loading = false;
      this.dialog.error('Thiếu workflow id');
      return;
    }

    this.svc.getById(id).subscribe({
      next: async (detail) => {
        this.xml = detail?.bpmnXml ?? '';
        const raw = this.xml?.trim?.().length ? this.xml : DEFAULT_DIAGRAM_XML;
        const initial = this.ensureExcelproNamespace(raw);
        // this.lastImportedXml = initial; // REMOVE: lastImportedXml

        // Show backend XML immediately so user can verify namespaces before bpmn-js roundtrip.
        // this.currentXml = initial; // REMOVE: currentXml

        try {
          await this.modeler!.importXML(initial);
          (this.modeler!.get('canvas') as any).zoom('fit-viewport');

          const eventBus = this.modeler!.get('eventBus') as any;
          eventBus.on('commandStack.changed', async () => {
            await this.refreshXml();
          });

          this.isReady = true;
          await this.refreshXml();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[BPMN] importXML failed', {
            id,
            xmlLength: initial?.length,
            error: e,
          });
          this.dialog.error(this.errorMessage(e, 'Không thể import BPMN XML'));
        } finally {
          this.loading = false;
        }
      },
      error: (err) => {
        this.loading = false;
        this.dialog.error(err?.error?.message || 'Không thể tải BPMN của quy trình');
      },
    });
  }

  private async refreshXml(): Promise<void> {
    if (!this.modeler) return;
    try {
      const res = await this.modeler.saveXML({ format: true });
      this.xml = res?.xml ?? this.xml;
    } catch {
      // ignore export errors
    }
  }

  zoomIn(): void {
    if (!this.modeler || !this.isReady) return;
    const canvas = this.modeler.get('canvas') as any;
    const next = (canvas.zoom() as number) + 0.1;
    canvas.zoom(next);
  }

  zoomOut(): void {
    if (!this.modeler || !this.isReady) return;
    const canvas = this.modeler.get('canvas') as any;
    const next = (canvas.zoom() as number) - 0.1;
    canvas.zoom(next);
  }

  zoomFit(): void {
    if (!this.modeler || !this.isReady) return;
    (this.modeler.get('canvas') as any).zoom('fit-viewport');
  }

  private resolveProcessElement(selected: any | null): any | null {
    if (!this.modeler) return null;

    const effective = selected || this.lastRootElement;
    if (!effective) return null;

    if (is(effective, 'bpmn:Process')) return effective;

    if (is(effective, 'bpmn:Collaboration')) {
      const participants = effective?.businessObject?.participants || [];
      const first = participants?.[0];
      if (first?.processRef?.id) {
        const elementRegistry = this.modeler.get('elementRegistry') as any;
        return elementRegistry.get(first.processRef.id) || null;
      }
      return null;
    }

    if (is(effective, 'bpmn:Participant')) {
      const bo = effective.businessObject;
      const processRef = bo?.processRef;
      const elementRegistry = this.modeler.get('elementRegistry') as any;
      const processElement = processRef?.id ? elementRegistry.get(processRef.id) : null;
      return processElement || null;
    }

    return null;
  }

  private openProcessConfigDialog(processElement: any): void {
    if (!this.modeler) return;

    const initialCandidates = getExcelproSubmitterCandidates(processElement).map((c) => ({
      subjectOrgCode: c.orgCode,
      subjectPositionCode: c.positionCode,
    })) as StepCandidateItem[];

    const data: StepCandidateDialogData = {
      stepName: 'Người gửi duyệt (SUBMIT)',
      candidates: initialCandidates,
      readonly: false,
    };

    this.tuiDialogs
      .open<StepCandidateItem[] | null>(new PolymorpheusComponent(StepCandidateDialogComponent), {
        data,
        dismissible: true,
        size: 'l',
        label: '',
      })
      .subscribe({
        next: async (result) => {
          if (result === null || result === undefined) return;

          const services = getModelerServices(this.modeler);
          const mapped = (result || []).map((c) => ({
            orgCode: c.subjectOrgCode ?? null,
            positionCode: c.subjectPositionCode ?? null,
          }));
          setExcelproSubmitterCandidates(services, processElement, mapped);

          await this.refreshXml();
        },
        error: () => {

        },
      });
  }

  private openUserTaskConfigDialog(userTaskElement: any): void {
    if (!this.modeler) return;

    const bo = userTaskElement?.businessObject;

    const initialCandidates = getExcelproCandidates(userTaskElement).map((c) => ({
      subjectOrgCode: c.orgCode,
      subjectPositionCode: c.positionCode,
    })) as StepCandidateItem[];

    const data: StepFormDialogData = {
      mode: 'edit',
      step: {
        // map BPMN -> StepForm initial model
        stepOrder: 1,
        stepKey: bo?.id || userTaskElement?.id || '',
        stepName: bo?.name || '',
        statusAfterApprove: getCamundaProperty(userTaskElement, 'statusAfterApprove'),
        returnTarget: getCamundaProperty(userTaskElement, 'returnTarget') || 'SUBMITTER',
        notifyMessage: getCamundaProperty(userTaskElement, 'notifyMessage') || '',
        onApproveHandlerKey: getCamundaProperty(userTaskElement, 'onApproveHandlerKey') || '',
        onReturnHandlerKey: getCamundaProperty(userTaskElement, 'onReturnHandlerKey') || '',
        onRejectHandlerKey: getCamundaProperty(userTaskElement, 'onRejectHandlerKey') || '',
        candidates: initialCandidates,
      } as any,
    };

    this.tuiDialogs
      .open<StepFormDialogResult | null>(new PolymorpheusComponent(StepFormDialogComponent), {
        data,
        dismissible: true,
        size: 'l',
        label: '',
      })
      .subscribe({
        next: async (result) => {
          // allow reopening the same task after closing dialog
          this.openedForElementId = null;

          if (!result) return;

          const services = getModelerServices(this.modeler);

          // Update BPMN id + name
          const newId = (result.stepKey || '').trim();
          const newName = (result.stepName || '').trim();
          if (newId) {
            services.modeling.updateProperties(userTaskElement, { id: newId });
          }
          services.modeling.updateProperties(userTaskElement, { name: newName });

          // 6 fields -> camunda:properties
          upsertCamundaProperty(services, userTaskElement, 'statusAfterApprove', result.statusAfterApprove);
          upsertCamundaProperty(services, userTaskElement, 'returnTarget', result.returnTarget);
          upsertCamundaProperty(services, userTaskElement, 'notifyMessage', result.notifyMessage || '');
          upsertCamundaProperty(services, userTaskElement, 'onApproveHandlerKey', result.onApproveHandlerKey || '');
          upsertCamundaProperty(services, userTaskElement, 'onReturnHandlerKey', result.onReturnHandlerKey || '');
          upsertCamundaProperty(services, userTaskElement, 'onRejectHandlerKey', result.onRejectHandlerKey || '');

          // candidates -> excelpro:candidates
          const mapped = (result.candidates || []).map((c) => ({
            orgCode: c.subjectOrgCode ?? null,
            positionCode: c.subjectPositionCode ?? null,
          }));
          setExcelproCandidates(services, userTaskElement, mapped);

          await this.refreshXml();
        },
        error: () => {
          this.openedForElementId = null;
        },
      });
  }

  private openServiceTaskConfigDialog(serviceTaskElement: any): void {
    if (!this.modeler) return;

    const bo = serviceTaskElement?.businessObject;
    const delegateExpression = getCamundaDelegateExpression(serviceTaskElement);

    // Read existing fields (if any)
    const targetStatus = getCamundaFieldStringValue(serviceTaskElement, 'targetStatus');
    const message = getCamundaFieldStringValue(serviceTaskElement, 'message');

    const data: ServiceTaskDialogData = {
      readonly: false,
      delegateExpression,
      targetStatus,
      message,
    };

    this.tuiDialogs
      .open<ServiceTaskDialogResult | null>(new PolymorpheusComponent(ServiceTaskDialogComponent), {
        data,
        dismissible: true,
        size: 'l',
        label: '',
      })
      .subscribe({
        next: async (result) => {
          // allow reopening the same element after closing dialog
          this.openedForElementId = null;

          if (!result) return;

          const services = getModelerServices(this.modeler);

          // Update name or keep existing
          const newName = (bo?.name || serviceTaskElement?.id || '').toString();
          if (newName) {
            services.modeling.updateProperties(serviceTaskElement, { name: newName });
          }

          setCamundaDelegateExpression(services, serviceTaskElement, result.delegateExpression);

          // Clear known fields first to avoid mixing types
          removeCamundaField(services, serviceTaskElement, 'targetStatus');
          removeCamundaField(services, serviceTaskElement, 'message');

          // Apply returned fields
          Object.entries(result.fields || {}).forEach(([k, v]) => {
            upsertCamundaFieldStringValue(services, serviceTaskElement, k, v);
          });

          await this.refreshXml();
        },
        error: () => {
          this.openedForElementId = null;
        },
      });
  }

  onSaveClick(): void {
    const id = this.workflowId;
    if (!id) {
      this.dialog.error('Thiếu workflow id');
      return;
    }

    if (!this.modeler) {
      this.dialog.error('BPMN editor chưa sẵn sàng');
      return;
    }

    this.saving = true;

    (async () => {
      // ensure model -> xml
      await this.refreshXml();

      // autofill NOTIFY recipients (excelpro:Candidates) before saving
      try {
        await this.refreshXml();
      } catch {
        // ignore
      }

      const xmlToSave = this.xml;

      this.svc
        .validateXml(id, xmlToSave)
        .pipe(
          switchMap((res) => {
            if (!res?.valid) {
              this.dialog.error(res?.message || 'BPMN XML không hợp lệ');
              return throwError(() => new Error(res?.message || 'BPMN XML không hợp lệ'));
            }
            return this.svc.update(id, { bpmnXml: xmlToSave });
          }),
          finalize(() => (this.saving = false)),
        )
        .subscribe({
          next: (detail) => {
            this.xml = detail?.bpmnXml ?? xmlToSave;
            this.dialog.success('Đã lưu BPMN');
          },
          error: (err) => {
            this.dialog.error(this.errorMessage(err, 'Lỗi lưu BPMN'));
          },
        });
    })();
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as any;
      return anyErr?.error?.message || anyErr?.message || fallback;
    }
    return fallback;
  }

  configureSelectedUserTask(): void {
    if (!this.canConfigureUserTask) {
      this.dialog.info('Hãy chọn một UserTask để cấu hình');
      return;
    }
    this.openUserTaskConfigDialog(this.selectedElement);
  }

  configureSelectedProcess(): void {
    const processElement = this.resolveProcessElement(this.selectedElement);
    if (!processElement) {
      this.dialog.info('Hãy click vùng trống (Process) hoặc Pool để cấu hình');
      return;
    }
    this.openProcessConfigDialog(processElement);
  }

  configureSelectedServiceTask(): void {
    if (!this.canConfigureServiceTask) {
      this.dialog.info('Hãy chọn một ServiceTask để cấu hình');
      return;
    }
    this.openServiceTaskConfigDialog(this.selectedElement);
  }

  ngOnDestroy(): void {
    try {
      this.modeler?.destroy?.();
    } catch {
      // ignore
    }
    this.modeler = undefined;
    this.isReady = false;
  }
}
