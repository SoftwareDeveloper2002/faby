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

type Room = {
  id: string;
  name: string;
  capacity: string;
  bedType: string;
  pricePerNight: number;
  description: string;
  amenities: string[];
  imageLabel: string;
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
  selector: 'app-roomlist',
  imports: [CommonModule, FormsModule, AvailabilityCalendarComponent],
  templateUrl: './roomlist.html',
  styleUrl: './roomlist.sass',
})
export class Roomlist implements OnInit {
  rooms: Room[] = [
    {
      id: 'deluxe-queen',
      name: 'Deluxe Queen Room',
      capacity: '2 Guests',
      bedType: '1 Queen Bed',
      pricePerNight: 1850,
      description: 'Cozy premium room with warm lighting and a relaxing garden-facing window.',
      amenities: ['Air conditioning', 'Private bathroom', 'Wi-Fi', 'Breakfast available'],
      imageLabel: 'Deluxe',
      isPopular: true,
    },
    {
      id: 'family-suite',
      name: 'Family Suite',
      capacity: '4 Guests',
      bedType: '2 Double Beds',
      pricePerNight: 2850,
      description: 'Spacious suite ideal for families with extra seating and a dining corner.',
      amenities: ['Air conditioning', 'Hot shower', 'Wi-Fi', 'Mini fridge'],
      imageLabel: 'Family',
    },
    {
      id: 'standard-twin',
      name: 'Standard Twin Room',
      capacity: '2 Guests',
      bedType: '2 Single Beds',
      pricePerNight: 1450,
      description: 'Practical and clean room perfect for quick stopovers and work trips.',
      amenities: ['Fan or AC option', 'Private bathroom', 'Wi-Fi', 'Cable TV'],
      imageLabel: 'Twin',
    },
    {
      id: 'barkada-loft',
      name: 'Barkada Loft Room',
      capacity: '6 Guests',
      bedType: '3 Double Mattresses',
      pricePerNight: 3350,
      description: 'Loft-style shared room designed for group travelers and weekend rides.',
      amenities: ['Air conditioning', 'Large bathroom', 'Wi-Fi', 'Common lounge access'],
      imageLabel: 'Barkada',
    },
  ];

  selectedRoomId = this.rooms[0].id;
  bookingStartDate = '';
  bookingReturnDate = '';
  isAvailabilityLoading = true;
  calendarSelectionError = '';
  readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly todayIso = this.toIsoDate(new Date());

  private successfulPayments: SuccessfulPaymentRecord[] = [];

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminRooms();
    await this.loadSuccessfulPayments();
  }

  get selectedRoom(): Room {
    return this.rooms.find((room) => room.id === this.selectedRoomId) ?? this.rooms[0];
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
    return this.totalDays * this.selectedRoom.pricePerNight;
  }

  get hasDateError(): boolean {
    if (!this.bookingStartDate || !this.bookingReturnDate) {
      return false;
    }

    return new Date(`${this.bookingReturnDate}T00:00:00`) < new Date(`${this.bookingStartDate}T00:00:00`);
  }

  get hasAvailabilityConflict(): boolean {
    const selectedRange = this.getSelectedRange();

    if (!selectedRange || this.selectedRoomBookings.length === 0) {
      return false;
    }

    return this.selectedRoomBookings.some((range) => this.doRangesOverlap(selectedRange, range));
  }

  get selectedDateRangeLabel(): string {
    if (!this.bookingStartDate && !this.bookingReturnDate) {
      return 'Pick your check-in and check-out dates from the calendar below.';
    }

    if (this.bookingStartDate && !this.bookingReturnDate) {
      return `Check-in selected: ${this.bookingStartDate}. Choose your check-out date.`;
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

  get selectedRoomBookings(): BookingRange[] {
    const selectedName = this.selectedRoom.name.trim().toLowerCase();

    return this.successfulPayments
      .filter((payment) => {
        const bookingType = String(payment.bookingType || '').toLowerCase();
        if (bookingType && bookingType !== 'room') {
          return false;
        }

        const paymentRoomId = String(payment.motorcycleId || '').trim();
        const paymentRoomName = String(payment.motorcycleName || '').trim().toLowerCase();

        if (paymentRoomId && paymentRoomId === this.selectedRoom.id) {
          return true;
        }

        return !!paymentRoomName && paymentRoomName === selectedName;
      })
      .map((payment) => this.toBookingRange(payment))
      .filter((range): range is BookingRange => range !== null);
  }

  get canProceedBooking(): boolean {
    return this.totalDays > 0 && !this.hasDateError && !this.hasAvailabilityConflict;
  }

  onSelectedRoomChange(): void {
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
      this.calendarSelectionError = 'That range includes already booked dates. Choose an earlier check-out or start over.';
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
      motorcycleId: this.selectedRoom.id,
      motorcycleName: this.selectedRoom.name,
      dailyRate: this.selectedRoom.pricePerNight,
      startDate: this.bookingStartDate,
      returnDate: this.bookingReturnDate,
      totalDays: this.totalDays,
      totalAmount: this.totalAmount,
      bookingType: 'room',
      returnPath: '/room-list',
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
      const isBooked = this.selectedRoomBookings.some((range) => dayDate >= range.start && dayDate <= range.end);
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

    return this.selectedRoomBookings.some((range) => this.doRangesOverlap({ start, end }, range));
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

  private async loadAdminRooms(): Promise<void> {
    const fallbackRooms = this.rooms;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'inn' && Number(product.ratePerDay) > 0)
        .map(([id, product], index) => {
          const details = product.details ?? {};
          const maxGuests = Number(details['maxGuests'] ?? 0);
          const roomType = String(details['roomType'] ?? '').trim();
          const hasBreakfast = details['hasBreakfast'] === true;

          return {
            id,
            name: String(product.title || 'Inn Room'),
            capacity: maxGuests > 0 ? `${maxGuests} Guests` : 'Guest capacity available upon request',
            bedType: roomType || 'Standard Room',
            pricePerNight: Number(product.ratePerDay || 0),
            description: String(product.description || 'Comfortable room for your stay.'),
            amenities: [
              'Private bathroom',
              'Wi-Fi',
              hasBreakfast ? 'Breakfast included' : 'Breakfast available',
            ],
            imageLabel: roomType || 'Room',
            imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
            isPopular: index === 0,
          };
        });

      if (mapped.length > 0) {
        this.rooms = mapped;
        this.selectedRoomId = mapped[0].id;
        return;
      }

      this.rooms = fallbackRooms;
    } catch {
      this.rooms = fallbackRooms;
    }
  }

}
