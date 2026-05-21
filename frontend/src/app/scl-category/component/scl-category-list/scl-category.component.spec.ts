import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SclCategoryComponent } from './scl-category.component';

describe('SclCategoryComponent', () => {
  let component: SclCategoryComponent;
  let fixture: ComponentFixture<SclCategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SclCategoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SclCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
