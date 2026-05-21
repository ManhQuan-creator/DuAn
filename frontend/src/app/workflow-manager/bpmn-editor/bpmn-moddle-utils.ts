import { is } from 'bpmn-js/lib/util/ModelUtil';

export type CandidateDto = {
  orgCode: string | null;
  positionCode: string | null;
};

type ModdleElement = any;

type ModelerServices = {
  moddle: any;
  modeling: any;
  bpmnFactory: any;
  commandStack: any;
};

export function getModelerServices(modeler: any): ModelerServices {
  return {
    moddle: modeler.get('moddle'),
    modeling: modeler.get('modeling'),
    bpmnFactory: modeler.get('bpmnFactory'),
    commandStack: modeler.get('commandStack'),
  };
}

export function getBusinessObject(element: any): any {
  return element?.businessObject || element;
}

export function getOrCreateExtensionElements(services: ModelerServices, element: any): ModdleElement {
  const bo = getBusinessObject(element);

  if (bo.extensionElements) return bo.extensionElements;

  const extensionElements = services.moddle.create('bpmn:ExtensionElements', { values: [] });

  // Use modeling.updateProperties so it goes through commandStack (undo/redo)
  services.modeling.updateProperties(element, { extensionElements });

  return extensionElements;
}

function getExtensionValues(extensionElements: any): any[] {
  return Array.isArray(extensionElements?.values) ? extensionElements.values : [];
}

export function getOrCreateCamundaProperties(services: ModelerServices, element: any): ModdleElement {
  const extensionElements = getOrCreateExtensionElements(services, element);

  const existing = getExtensionValues(extensionElements).find(v => is(v, 'camunda:Properties'));
  if (existing) return existing;

  const camundaProps = services.moddle.create('camunda:Properties', { values: [] });
  const nextValues = [...getExtensionValues(extensionElements), camundaProps];

  services.modeling.updateModdleProperties(element, extensionElements, { values: nextValues });

  return camundaProps;
}

export function getCamundaProperty(element: any, name: string): string {
  const bo = getBusinessObject(element);
  const ext = bo.extensionElements;
  const camundaProps = getExtensionValues(ext).find(v => is(v, 'camunda:Properties')) as any;
  const values = Array.isArray(camundaProps?.values) ? camundaProps.values : [];
  const prop = values.find((p: any) => is(p, 'camunda:Property') && p.name === name);
  return prop?.value ?? '';
}

export function upsertCamundaProperty(services: ModelerServices, element: any, name: string, value: string | null | undefined): void {
  const camundaProps = getOrCreateCamundaProperties(services, element);
  const values = Array.isArray(camundaProps.values) ? camundaProps.values : [];

  const existing = values.find((p: any) => is(p, 'camunda:Property') && p.name === name);

  const nextValue = value ?? '';

  if (existing) {
    services.modeling.updateModdleProperties(element, existing, { value: nextValue });
    return;
  }

  const prop = services.moddle.create('camunda:Property', { name, value: nextValue });
  services.modeling.updateModdleProperties(element, camundaProps, { values: [...values, prop] });
}

export function removeCamundaProperty(services: ModelerServices, element: any, name: string): void {
  const bo = getBusinessObject(element);
  const ext = bo.extensionElements;
  const camundaProps = getExtensionValues(ext).find(v => is(v, 'camunda:Properties')) as any;
  if (!camundaProps) return;

  const values = Array.isArray(camundaProps.values) ? camundaProps.values : [];
  const nextValues = values.filter((p: any) => !(is(p, 'camunda:Property') && p.name === name));
  services.modeling.updateModdleProperties(element, camundaProps, { values: nextValues });
}

function findExcelproContainer(ext: any, type: 'excelpro:Candidates' | 'excelpro:SubmitterCandidates'): any {
  return getExtensionValues(ext).find(v => is(v, type));
}

function mapCandidateFromModdle(c: any): CandidateDto {
  return {
    orgCode: c?.orgCode ?? null,
    positionCode: c?.positionCode ?? null,
  };
}

function createExcelproCandidate(services: ModelerServices, candidate: CandidateDto): any {
  return services.moddle.create('excelpro:Candidate', {
    orgCode: candidate.orgCode,
    positionCode: candidate.positionCode,
  });
}

export function getExcelproCandidates(element: any): CandidateDto[] {
  const bo = getBusinessObject(element);
  const ext = bo.extensionElements;
  const container = findExcelproContainer(ext, 'excelpro:Candidates');
  const items = Array.isArray(container?.candidate) ? container.candidate : [];
  return items.map(mapCandidateFromModdle);
}

export function setExcelproCandidates(services: ModelerServices, element: any, candidates: CandidateDto[]): void {
  const extensionElements = getOrCreateExtensionElements(services, element);
  const existing = findExcelproContainer(extensionElements, 'excelpro:Candidates');

  const candidate = (candidates || []).map(c => createExcelproCandidate(services, c));

  if (existing) {
    services.modeling.updateModdleProperties(element, existing, { candidate });
    return;
  }

  const container = services.moddle.create('excelpro:Candidates', { candidate });
  const nextValues = [...getExtensionValues(extensionElements), container];
  services.modeling.updateModdleProperties(element, extensionElements, { values: nextValues });
}

export function getExcelproSubmitterCandidates(processElement: any): CandidateDto[] {
  const bo = getBusinessObject(processElement);
  const ext = bo.extensionElements;
  const container = findExcelproContainer(ext, 'excelpro:SubmitterCandidates');
  const items = Array.isArray(container?.candidate) ? container.candidate : [];
  return items.map(mapCandidateFromModdle);
}

export function setExcelproSubmitterCandidates(services: ModelerServices, processElement: any, candidates: CandidateDto[]): void {
  const extensionElements = getOrCreateExtensionElements(services, processElement);
  const existing = findExcelproContainer(extensionElements, 'excelpro:SubmitterCandidates');

  const candidate = (candidates || []).map(c => createExcelproCandidate(services, c));

  if (existing) {
    services.modeling.updateModdleProperties(processElement, existing, { candidate });
    return;
  }

  const container = services.moddle.create('excelpro:SubmitterCandidates', { candidate });
  const nextValues = [...getExtensionValues(extensionElements), container];
  services.modeling.updateModdleProperties(processElement, extensionElements, { values: nextValues });
}

/** Read camunda:delegateExpression (stored as businessObject.delegateExpression). */
export function getCamundaDelegateExpression(element: any): string {
  const bo = getBusinessObject(element);
  // In Camunda moddle, delegateExpression is an attribute.
  return bo?.delegateExpression ?? '';
}

/** Set camunda:delegateExpression (stored as businessObject.delegateExpression). */
export function setCamundaDelegateExpression(services: ModelerServices, element: any, expr: string): void {
  services.modeling.updateProperties(element, { delegateExpression: expr || '' });
}

function findCamundaField(ext: any, name: string): any {
  const values = getExtensionValues(ext);
  return values.find((v: any) => is(v, 'camunda:Field') && v.name === name);
}

/** Get <camunda:field name="..." stringValue="..."/> from extensionElements. */
export function getCamundaFieldStringValue(element: any, name: string): string {
  const bo = getBusinessObject(element);
  const ext = bo.extensionElements;
  const field = findCamundaField(ext, name);
  return field?.stringValue ?? '';
}

/** Upsert <camunda:field name="..." stringValue="..."/> into extensionElements. */
export function upsertCamundaFieldStringValue(
  services: ModelerServices,
  element: any,
  name: string,
  stringValue: string | null | undefined,
): void {
  const extensionElements = getOrCreateExtensionElements(services, element);
  const existing = findCamundaField(extensionElements, name);
  const nextValue = stringValue ?? '';

  if (existing) {
    services.modeling.updateModdleProperties(element, existing, { stringValue: nextValue });
    return;
  }

  const field = services.moddle.create('camunda:Field', { name, stringValue: nextValue });
  const nextValues = [...getExtensionValues(extensionElements), field];
  services.modeling.updateModdleProperties(element, extensionElements, { values: nextValues });
}

/** Remove a camunda:field by name (if exists). */
export function removeCamundaField(services: ModelerServices, element: any, name: string): void {
  const bo = getBusinessObject(element);
  const ext = bo.extensionElements;
  if (!ext) return;

  const values = getExtensionValues(ext);
  const nextValues = values.filter((v: any) => !(is(v, 'camunda:Field') && v.name === name));
  services.modeling.updateModdleProperties(element, ext, { values: nextValues });
}
