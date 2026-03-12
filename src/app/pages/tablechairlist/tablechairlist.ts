import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

type PackageItem = {
  id: string;
  name: string;
  includes: string;
  ratePerDay: number;
  recommendedFor: string;
  notes: string[];
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
  selector: 'app-tablechairlist',
  imports: [CommonModule, FormsModule],
  templateUrl: './tablechairlist.html',
  styleUrl: './tablechairlist.sass',
})
export class Tablechairlist implements OnInit {
  packages: PackageItem[] = [
    {
      id: 'small-party',
      name: 'Small Party Set',
      includes: '5 Tables + 30 Chairs',
      ratePerDay: 1800,
      recommendedFor: '25 to 35 guests',
      notes: ['Delivery within nearby area', 'Pickup after event', 'Clean units guaranteed'],
    },
    {
      id: 'event-standard',
      name: 'Event Standard Set',
      includes: '10 Tables + 60 Chairs',
      ratePerDay: 3200,
      recommendedFor: '50 to 70 guests',
      notes: ['Best for birthdays and seminars', 'Flexible arrangement', 'Delivery and pickup included'],
      isPopular: true,
    },
    {
      id: 'grand-function',
      name: 'Grand Function Set',
      includes: '20 Tables + 120 Chairs',
      ratePerDay: 6200,
      recommendedFor: '100 to 140 guests',
      notes: ['Ideal for weddings', 'Priority setup schedule', 'Bulk setup support'],
    },
  ];

  selectedPackageId = this.packages[0].id;
  bookingStartDate = '';
  bookingReturnDate = '';
  isAvailabilityLoading = true;
  calendarSelectionError = '';
  readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly todayIso = this.toIsoDate(new Date());

  private successfulPayments: SuccessfulPaymentRecord[] = [];

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminTableChairProducts();
    await this.loadSuccessfulPayments();
  }

  get selectedPackage(): PackageItem {
    return this.packages.find((item) => item.id === this.selectedPackageId) ?? this.packages[0];
  }

  get totalDays(): number {
    if (!this.bookingStartDate || !this.bookingReturnDate) {
      return 0;
    }

    const startDate = new Date(`${this.bookingStartDate}T00:00:00`);
    const returnDate = new Date(`${this.bookingReturnDate}T00:00:00`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(returnDate.getTime()) || returnDate < startDate) {
      return 0;
    }

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const dayDiff = Math.floor((returnDate.getTime() - startDate.getTime()) / millisecondsPerDay);

    return dayDiff + 1;
  }

  get totalAmount(): number {
    return this.totalDays * this.selectedPackage.ratePerDay;
  }

  get hasDateError(): boolean {
    if (!this.bookingStartDate || !this.bookingReturnDate) {
      return false;
    }

    return new Date(`${this.bookingReturnDate}T00:00:00`) < new Date(`${this.bookingStartDate}T00:00:00`);
  }

  get hasAvailabilityConflict(): boolean {
    const selectedRange = this.getSelectedRange();

    if (!selectedRange || this.selectedPackageBookings.length === 0) {
      return false;
    }

    return this.selectedPackageBookings.some((range) => this.doRangesOverlap(selectedRange, range));
  }

  get selectedDateRangeLabel(): string {
    if (!this.bookingStartDate && !this.bookingReturnDate) {
      return 'Pick your event start and end dates from the calendar below.';
    }

    if (this.bookingStartDate && !this.bookingReturnDate) {
      return `Event start selected: ${this.bookingStartDate}. Choose event end date.`;
    }

    return `${this.bookingStartDate} to ${this.bookingReturnDate}`;
  }

  get calendarMonths(): CalendarMonth[] {
    const months: CalendarMonth[] = [];
    const baseDate = this.bookingStartDate ? this.parseIsoDate(this.bookingStartDate) : this.parseIsoDate(this.todayIso);
    const firstMonth = baseDate ? new Date(baseDate.getFullYear(), baseDate.getMonth(), 1) : new Date();

    for (let index = 0; index < 2; index += 1) {
      const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      months.push(this.buildCalendarMonth(monthDate));
    }

    return months;
  }

  get selectedPackageBookings(): BookingRange[] {
    const selectedName = this.selectedPackage.name.trim().toLowerCase();

    return this.successfulPayments
      .filter((payment) => {
        const bookingType = String(payment.bookingType || '').toLowerCase();
        if (bookingType && bookingType !== 'table_chair') {
          return false;
        }

        const paymentPackageId = String(payment.motorcycleId || '').trim();
        const paymentPackageName = String(payment.motorcycleName || '').trim().toLowerCase();

        if (paymentPackageId && paymentPackageId === this.selectedPackage.id) {
          return true;
        }

        return !!paymentPackageName && paymentPackageName === selectedName;
      })
      .map((payment) => this.toBookingRange(payment))
      .filter((range): range is BookingRange => range !== null);
  }

  get canProceedBooking(): boolean {
    return this.totalDays > 0 && !this.hasDateError && !this.hasAvailabilityConflict;
  }

  onSelectedPackageChange(): void {
    this.calendarSelectionError = '';

    if (this.hasAvailabilityConflict) {
      this.bookingStartDate = '';
      this.bookingReturnDate = '';
    }
  }

  onCalendarDayClick(day: CalendarDay): void {
    if (!day.isSelectable) {
      return;
    }

    this.calendarSelectionError = '';

    if (!this.bookingStartDate || (this.bookingStartDate && this.bookingReturnDate)) {
      this.bookingStartDate = day.iso;
      this.bookingReturnDate = '';
      return;
    }

    if (day.iso < this.bookingStartDate) {
      this.bookingStartDate = day.iso;
      this.bookingReturnDate = '';
      return;
    }

    if (this.hasBookedDateBetween(this.bookingStartDate, day.iso)) {
      this.calendarSelectionError = 'That range includes already booked dates. Choose an earlier event end date or start over.';
      return;
    }

    this.bookingReturnDate = day.iso;
  }

  resetCalendarSelection(): void {
    this.bookingStartDate = '';
    this.bookingReturnDate = '';
    this.calendarSelectionError = '';
  }

  proceedBooking(): void {
    if (!this.canProceedBooking) {
      return;
    }

    const bookingParams = {
      motorcycleId: this.selectedPackage.id,
      motorcycleName: this.selectedPackage.name,
      dailyRate: this.selectedPackage.ratePerDay,
      startDate: this.bookingStartDate,
      returnDate: this.bookingReturnDate,
      totalDays: this.totalDays,
      totalAmount: this.totalAmount,
      bookingType: 'table_chair',
      returnPath: '/table-chair-list',
    };

    const isLoggedIn = localStorage.getItem('fabyAuth') === 'true' || localStorage.getItem('fabyPhoneAuth') === 'true';

    if (!isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: {
          redirectTo: '/booking-confirm',
          ...bookingParams,
        },
      });
      return;
    }

    this.router.navigate(['/booking-confirm'], {
      queryParams: bookingParams,
    });
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
      const isBooked = this.selectedPackageBookings.some((range) => dayDate >= range.start && dayDate <= range.end);
      const isSelectable = !isPast && !isBooked && dayDate.getMonth() === month;
      const isSelectionStart = this.bookingStartDate === iso;
      const isSelectionEnd = this.bookingReturnDate === iso;
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
    if (!this.bookingStartDate || !this.bookingReturnDate || this.hasDateError) {
      return null;
    }

    const start = this.parseIsoDate(this.bookingStartDate);
    const end = this.parseIsoDate(this.bookingReturnDate);

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

    if (!start || !end || end < start) {
      return true;
    }

    return this.selectedPackageBookings.some((range) => this.doRangesOverlap({ start, end }, range));
  }

  private toBookingRange(payment: SuccessfulPaymentRecord): BookingRange | null {
    const start = this.parseIsoDate(String(payment.startDate || ''));
    const end = this.parseIsoDate(String(payment.returnDate || ''));

    if (!start || !end || end < start) {
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

  private async loadAdminTableChairProducts(): Promise<void> {
    const fallbackPackages = this.packages;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'table_chair' && Number(product.ratePerDay) > 0)
        .map(([id, product], index) => {
          const details = product.details ?? {};
          const tableCount = Number(details['tableCount'] ?? 0);
          const chairCount = Number(details['chairCount'] ?? 0);
          const material = String(details['material'] ?? '').trim();

          return {
            id,
            name: String(product.title || 'Tables & Chairs Set'),
            includes: `${tableCount > 0 ? tableCount : 'Varied'} Tables + ${chairCount > 0 ? chairCount : 'Varied'} Chairs`,
            ratePerDay: Number(product.ratePerDay || 0),
            recommendedFor: material ? `${material} setup` : 'Events and gatherings',
            notes: [
              String(product.description || 'Rental set for events.'),
              'Delivery and pickup options available',
              'Clean and ready-to-use units',
            ],
            imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
            isPopular: index === 0,
          };
        });

      if (mapped.length > 0) {
        this.packages = mapped;
        this.selectedPackageId = mapped[0].id;
        return;
      }

      this.packages = fallbackPackages;
    } catch {
      this.packages = fallbackPackages;
    }
  }
}
