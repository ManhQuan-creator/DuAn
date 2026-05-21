import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrgLevelCellRenderComponent } from './org-level-cell-render.component';

describe('OrgLevelCellRenderComponent', () => {
  let component: OrgLevelCellRenderComponent;
  let fixture: ComponentFixture<OrgLevelCellRenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgLevelCellRenderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrgLevelCellRenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
