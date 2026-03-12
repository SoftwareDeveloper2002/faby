import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AvailabilityCalendarDay = {
  iso: string;
  day: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isBooked: boolean;
  isSelectable: boolean;
  isSelectionStart: boolean;
  isSelectionEnd: boolean;
  isInSelectionRange: boolean;
};

export type AvailabilityCalendarMonth = {
  key: string;
  label: string;
  days: AvailabilityCalendarDay[];
};

@Component({
  selector: 'app-availability-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './availability-calendar.html',
  styleUrl: './availability-calendar.sass',
})
export class AvailabilityCalendarComponent {
  @Input() unitName = '';
  @Input() heading = 'Availability Calendar';
  @Input() selectedRangeLabel = '';
  @Input() clearButtonText = 'Clear dates';
  @Input() showClearButton = false;
  @Input() isLoading = false;
  @Input() showMonthNavigation = true;
  @Input() previousButtonLabel = 'Previous month';
  @Input() nextButtonLabel = 'Next month';
  @Input() loadingText = 'Loading booked dates...';
  @Input() selectionError = '';
  @Input() conflictError = '';
  @Input() calendarMonths: AvailabilityCalendarMonth[] = [];

  @Output() daySelected = new EventEmitter<AvailabilityCalendarDay>();
  @Output() clearSelection = new EventEmitter<void>();
  @Output() previousMonth = new EventEmitter<void>();
  @Output() nextMonth = new EventEmitter<void>();

  readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  onDayClick(day: AvailabilityCalendarDay): void {
    if (!day.isSelectable) {
      return;
    }

    this.daySelected.emit(day);
  }

  onClearSelection(): void {
    this.clearSelection.emit();
  }

  onPreviousMonth(): void {
    this.previousMonth.emit();
  }

  onNextMonth(): void {
    this.nextMonth.emit();
  }
}
