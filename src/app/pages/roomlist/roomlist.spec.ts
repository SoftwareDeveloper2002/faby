import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Roomlist } from './roomlist';

describe('Roomlist', () => {
  let component: Roomlist;
  let fixture: ComponentFixture<Roomlist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Roomlist]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Roomlist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
