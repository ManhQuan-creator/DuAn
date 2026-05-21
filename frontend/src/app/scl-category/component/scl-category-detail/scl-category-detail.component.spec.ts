import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SclCategoryDetailComponent } from './scl-category-detail.component';

describe('SclCategoryDetailComponent', () => {
  let component: SclCategoryDetailComponent;
  let fixture: ComponentFixture<SclCategoryDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SclCategoryDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SclCategoryDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
