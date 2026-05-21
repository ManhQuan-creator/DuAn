import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RenderActionComponent } from './render-action.component';

describe('RenderActionComponent', () => {
  let component: RenderActionComponent;
  let fixture: ComponentFixture<RenderActionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenderActionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RenderActionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
