import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dasboard } from './dasboard';

describe('Dasboard', () => {
  let component: Dasboard;
  let fixture: ComponentFixture<Dasboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dasboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dasboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
