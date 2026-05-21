import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionTemplateDialogComponent } from './permission-template-dialog.component';

describe('PermissionTemplateDialogComponent', () => {
  let component: PermissionTemplateDialogComponent;
  let fixture: ComponentFixture<PermissionTemplateDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionTemplateDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionTemplateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
