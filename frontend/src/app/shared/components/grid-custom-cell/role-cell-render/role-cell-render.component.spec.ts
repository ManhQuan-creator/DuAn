import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleCellRenderComponent } from './role-cell-render.component';

describe('RoleCellRenderComponent', () => {
  let component: RoleCellRenderComponent;
  let fixture: ComponentFixture<RoleCellRenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleCellRenderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoleCellRenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
