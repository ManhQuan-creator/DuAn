import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttachCellRenderComponent } from './attach-cell-render.component';

describe('AttachCellRenderComponent', () => {
  let component: AttachCellRenderComponent;
  let fixture: ComponentFixture<AttachCellRenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachCellRenderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttachCellRenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
