import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendAssesmentDialogComponent } from './send-assesment-dialog.component';

describe('SendAssesmentDialogComponent', () => {
  let component: SendAssesmentDialogComponent;
  let fixture: ComponentFixture<SendAssesmentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendAssesmentDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendAssesmentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
