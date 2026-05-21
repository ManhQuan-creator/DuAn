import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuggestedCategoryListComponent } from './suggested-category-list.component';

describe('SuggestedCategoryListComponent', () => {
  let component: SuggestedCategoryListComponent;
  let fixture: ComponentFixture<SuggestedCategoryListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuggestedCategoryListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuggestedCategoryListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
