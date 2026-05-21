import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttachFileDialogComponent } from './attach-file-dialog.component';

describe('AttachFileDialogComponent', () => {
  let component: AttachFileDialogComponent;
  let fixture: ComponentFixture<AttachFileDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachFileDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttachFileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
