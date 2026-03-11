import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Motorcyclelist } from './motorcyclelist';

describe('Motorcyclelist', () => {
  let component: Motorcyclelist;
  let fixture: ComponentFixture<Motorcyclelist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Motorcyclelist]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Motorcyclelist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
