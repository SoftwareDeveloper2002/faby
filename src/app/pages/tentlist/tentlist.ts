import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AvailabilityCalendarComponent } from '../../components/availability-calendar/availability-calendar';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyD5DVdin4xLlT86KIiXy2wetJ04fyEeWBA',
  authDomain: 'faby-be0b9.firebaseapp.com',
  projectId: 'faby-be0b9',
  databaseURL: 'https://faby-be0b9-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: 'faby-be0b9.firebasestorage.app',
  messagingSenderId: '71671731623',
  appId: '1:71671731623:web:6df23b47797e12b9aad282',
  measurementId: 'G-ZBZJKVWND9',
};

type AdminProduct = {
  category: string;
  title: string;
  description: string;
  ratePerDay: number;
  imageUrl?: string;
  details?: Record<string, string | number | boolean>;
};

type TentUnit = {
  id: string;
  name: string;
  size: string;
  capacity: string;
  ratePerDay: number;
  description: string;
  inclusions: string[];
  imageUrl?: string;
  isPopular?: boolean;
};

type SuccessfulPaymentRecord = {
  motorcycleId?: string;
  motorcycleName?: string;
  startDate?: string;
  returnDate?: string;
  bookingType?: string;
};

type BookingRange = {
  start: Date;
  end: Date;
};

type CalendarDay = {
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

type CalendarMonth = {
  key: string;
  label: string;
  days: CalendarDay[];
};

@Component({
  selector: 'app-tentlist',
  imports: [CommonModule, FormsModule, AvailabilityCalendarComponent],
  templateUrl: './tentlist.html',
  styleUrl: './tentlist.sass',
})
export class Tentlist implements OnInit {
  tents: TentUnit[] = [
    {
      id: 'camp-solo-2p',
      name: 'Camping Tent Solo',
      size: 'Small Dome',
      capacity: '1 to 2 adults',
      ratePerDay: 150,
      description: 'Lightweight camping tent ideal for solo trips and quick overnight stays.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Carry bag'],
    },
    {
      id: 'camp-couple-3p',
      name: 'Camping Tent Couple',
      size: 'Medium Dome',
      capacity: '2 to 3 adults',
      ratePerDay: 250,
      description: 'Comfortable tent for couples or small groups with extra headroom.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Ventilated windows'],
      isPopular: true,
    },
    {
      id: 'camp-family-4p',
      name: 'Camping Tent Family',
      size: 'Large Cabin',
      capacity: '4 adults',
      ratePerDay: 350,
      description: 'Spacious family tent for multi-day outdoor trips with gear space.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Interior pockets'],
    },
    {
      id: 'camp-group-6p',
      name: 'Camping Tent Group',
      size: 'XL Cabin',
      capacity: '5 to 6 adults',
      ratePerDay: 450,
      description: 'Extra large camping tent for group adventures and weekend camps.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Reinforced poles'],
    },
  ];

  selectedTentId = '';
  startDate = '';
  returnDate = '';
  bookingError = '';
  isAvailabilityLoading = true;
  readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly todayIso = this.toIsoDate(new Date());

  private successfulPayments: SuccessfulPaymentRecord[] = [];

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminTents();
    await this.loadSuccessfulPayments();
  }

  get selectedTent(): TentUnit | null {
    return this.tents.find((tent) => tent.id === this.selectedTentId) ?? null;
  }

  get totalDays(): number {
    if (!this.startDate || !this.returnDate) {
      return 0;
    }

    const start = new Date(`${this.startDate}T00:00:00`);
    const end = new Date(`${this.returnDate}T00:00:00`);
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / msPerDay);

    return Number.isFinite(diffDays) && diffDays > 0 ? diffDays : 0;
  }

  get totalAmount(): number {
    if (!this.selectedTent) {
      return 0;
    }

    return this.totalDays * this.selectedTent.ratePerDay;
  }

  get hasDateError(): boolean {
    if (!this.startDate || !this.returnDate) {
      return false;
    }

    return new Date(`${this.returnDate}T00:00:00`) <= new Date(`${this.startDate}T00:00:00`);
  }

  get hasAvailabilityConflict(): boolean {
    const selectedRange = this.getSelectedRange();

    if (!selectedRange || this.selectedTentBookings.length === 0) {
      return false;
    }

    return this.selectedTentBookings.some((range) => this.doRangesOverlap(selectedRange, range));
  }

  get selectedDateRangeLabel(): string {
    if (!this.startDate && !this.returnDate) {
      return 'Pick your booking and return dates from the calendar below.';
    }

    if (this.startDate && !this.returnDate) {
      return `Booking date selected: ${this.startDate}. Choose your return date.`;
    }

    return `${this.startDate} to ${this.returnDate}`;
  }

  get calendarMonths(): CalendarMonth[] {
    const months: CalendarMonth[] = [];
    const baseDate = this.startDate ? this.parseIsoDate(this.startDate) : this.parseIsoDate(this.todayIso);
    const firstMonth = baseDate ? new Date(baseDate.getFullYear(), baseDate.getMonth(), 1) : new Date();

    for (let index = 0; index < 2; index += 1) {
      const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      months.push(this.buildCalendarMonth(monthDate));
    }

    return months;
  }

  get selectedTentBookings(): BookingRange[] {
    const selected = this.selectedTent;
    if (!selected) {
      return [];
    }

    const selectedName = selected.name.trim().toLowerCase();

    return this.successfulPayments
      .filter((payment) => {
        const bookingType = String(payment.bookingType || '').toLowerCase();
        if (bookingType && bookingType !== 'tent') {
          return false;
        }

        const paymentTentId = String(payment.motorcycleId || '').trim();
        const paymentTentName = String(payment.motorcycleName || '').trim().toLowerCase();

        if (paymentTentId && paymentTentId === selected.id) {
          return true;
        }

        return !!paymentTentName && paymentTentName === selectedName;
      })
      .map((payment) => this.toBookingRange(payment))
      .filter((range): range is BookingRange => range !== null);
  }

  get canProceedBooking(): boolean {
    return !!this.selectedTent && this.totalDays > 0 && !this.hasDateError && !this.hasAvailabilityConflict;
  }

  selectTent(tentId: string): void {
    this.selectedTentId = tentId;
    this.onSelectedTentChange();
  }

  onSelectedTentChange(): void {
    this.bookingError = '';

    if (this.hasAvailabilityConflict) {
      this.startDate = '';
      this.returnDate = '';
    }
  }

  onCalendarDayClick(day: CalendarDay): void {
    if (!day.isSelectable || !this.selectedTentId) {
      return;
    }

    this.bookingError = '';

    if (!this.startDate || (this.startDate && this.returnDate)) {
      this.startDate = day.iso;
      this.returnDate = '';
      return;
    }

    if (day.iso <= this.startDate) {
      this.startDate = day.iso;
      this.returnDate = '';
      return;
    }

    if (this.hasBookedDateBetween(this.startDate, day.iso)) {
      this.bookingError = 'That range includes already booked dates. Choose an earlier return date or start over.';
      return;
    }

    this.returnDate = day.iso;
  }

  resetCalendarSelection(): void {
    this.startDate = '';
    this.returnDate = '';
    this.bookingError = '';
  }

  proceedBooking(): void {
    this.bookingError = '';

    if (!this.selectedTent) {
      this.bookingError = 'Please select a tent before proceeding.';
      return;
    }

    if (!this.startDate || !this.returnDate) {
      this.bookingError = 'Please select your booking and return dates.';
      return;
    }

    if (this.hasDateError || this.totalDays <= 0) {
      this.bookingError = 'Return date must be later than the booking date.';
      return;
    }

    if (this.hasAvailabilityConflict) {
      this.bookingError = 'Selected dates overlap with an existing tent booking.';
      return;
    }

    const isAuthenticated = localStorage.getItem('fabyAuth') === 'true' || localStorage.getItem('fabyPhoneAuth') === 'true';

    if (!isAuthenticated) {
      void this.router.navigate(['/login'], {
        queryParams: {
          redirectTo: '/booking-confirm',
          motorcycleId: this.selectedTent.id,
          motorcycleName: this.selectedTent.name,
          dailyRate: this.selectedTent.ratePerDay,
          startDate: this.startDate,
          returnDate: this.returnDate,
          totalDays: this.totalDays,
          totalAmount: this.totalAmount,
          bookingType: 'tent',
          returnPath: '/tent-list',
        },
      });
      return;
    }

    void this.router.navigate(['/booking-confirm'], {
      queryParams: {
        motorcycleId: this.selectedTent.id,
        motorcycleName: this.selectedTent.name,
        dailyRate: this.selectedTent.ratePerDay,
        startDate: this.startDate,
        returnDate: this.returnDate,
        totalDays: this.totalDays,
        totalAmount: this.totalAmount,
        bookingType: 'tent',
        returnPath: '/tent-list',
      },
    });
  }

  private async loadAdminTents(): Promise<void> {
    const fallbackTents = this.tents;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'tent' && Number(product.ratePerDay) > 0)
        .map(([id, product], index) => {
          const details = product.details ?? {};
          const size = String(details['size'] ?? '').trim();
          const capacity = String(details['capacity'] ?? '').trim();
          const weatherRating = String(details['weatherRating'] ?? '').trim();

          return {
            id,
            name: String(product.title || 'Camping Tent'),
            size: size || 'Camping Tent',
            capacity: capacity || 'Capacity details available on request',
            ratePerDay: Number(product.ratePerDay || 0),
            description: String(product.description || 'Reliable tent for outdoor rentals.'),
            inclusions: [
              'Carry bag',
              weatherRating || 'Weather-ready setup',
              'Ground sheet',
            ],
            imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
            isPopular: index === 0,
          };
        });

      if (mapped.length > 0) {
        this.tents = mapped;
        this.selectedTentId = mapped[0].id;
        return;
      }

      this.tents = fallbackTents;
    } catch {
      this.tents = fallbackTents;
    }
  }

  private buildCalendarMonth(monthDate: Date): CalendarMonth {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const firstCellDate = new Date(start);
    firstCellDate.setDate(start.getDate() - start.getDay());

    const lastCellDate = new Date(end);
    lastCellDate.setDate(end.getDate() + (6 - end.getDay()));

    const days: CalendarDay[] = [];
    const selectedRange = this.getSelectedRange();

    for (const current = new Date(firstCellDate); current <= lastCellDate; current.setDate(current.getDate() + 1)) {
      const iso = this.toIsoDate(current);
      const normalizedCurrent = this.parseIsoDate(iso);
      const dayDate = normalizedCurrent ?? new Date(current);
      const isPast = iso < this.todayIso;
      const isBooked = this.selectedTentBookings.some((range) => dayDate >= range.start && dayDate <= range.end);
      const isSelectable = !!this.selectedTentId && !isPast && !isBooked && dayDate.getMonth() === month;
      const isSelectionStart = this.startDate === iso;
      const isSelectionEnd = this.returnDate === iso;
      const isInSelectionRange = selectedRange ? dayDate >= selectedRange.start && dayDate <= selectedRange.end : false;

      days.push({
        iso,
        day: dayDate.getDate(),
        isCurrentMonth: dayDate.getMonth() === month,
        isPast,
        isBooked,
        isSelectable,
        isSelectionStart,
        isSelectionEnd,
        isInSelectionRange,
      });
    }

    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      days,
    };
  }

  private getSelectedRange(): BookingRange | null {
    if (!this.startDate || !this.returnDate || this.hasDateError) {
      return null;
    }

    const start = this.parseIsoDate(this.startDate);
    const end = this.parseIsoDate(this.returnDate);

    if (!start || !end) {
      return null;
    }

    return { start, end };
  }

  private doRangesOverlap(a: BookingRange, b: BookingRange): boolean {
    return a.start <= b.end && a.end >= b.start;
  }

  private hasBookedDateBetween(startIso: string, endIso: string): boolean {
    const start = this.parseIsoDate(startIso);
    const end = this.parseIsoDate(endIso);

    if (!start || !end || end <= start) {
      return true;
    }

    return this.selectedTentBookings.some((range) => this.doRangesOverlap({ start, end }, range));
  }

  private toBookingRange(payment: SuccessfulPaymentRecord): BookingRange | null {
    const start = this.parseIsoDate(String(payment.startDate || ''));
    const end = this.parseIsoDate(String(payment.returnDate || ''));

    if (!start || !end || end <= start) {
      return null;
    }

    return { start, end };
  }

  private parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async loadSuccessfulPayments(): Promise<void> {
    this.isAvailabilityLoading = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'successfulPayments'));

      if (!snapshot.exists()) {
        this.successfulPayments = [];
        return;
      }

      const records = snapshot.val() as Record<string, SuccessfulPaymentRecord>;
      this.successfulPayments = Object.values(records || {});
    } finally {
      this.isAvailabilityLoading = false;
    }
  }
}
