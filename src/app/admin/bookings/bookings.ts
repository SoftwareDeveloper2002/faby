import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../component/navbar/navbar';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref, update } from 'firebase/database';

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

type PaymentStatus = 'paid' | 'not_paid' | 'cancelled';

type BookingRecord = {
  id: string;
  email: string;
  motorcycleId: string;
  motorcycleName: string;
  bookingType: string;
  totalDays: number;
  totalAmount: number;
  startDate: string;
  returnDate: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  bank: string;
  status: string;
  source: string;
  createdAt: string;
};

type BookingFormModel = {
  motorcycleName: string;
  bookingType: string;
  startDate: string;
  returnDate: string;
  totalDays: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  bank: string;
};

@Component({
  selector: 'app-bookings',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './bookings.html',
  styleUrl: './bookings.sass',
})
export class Bookings implements OnInit {
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  searchTerm = '';

  bookings: BookingRecord[] = [];

  isEditModalOpen = false;
  editingBookingId = '';
  editForm: BookingFormModel = {
    motorcycleName: '',
    bookingType: 'motorcycle',
    startDate: '',
    returnDate: '',
    totalDays: 0,
    totalAmount: 0,
    paymentMethod: 'cash',
    paymentStatus: 'not_paid',
    bank: '',
  };

  async ngOnInit(): Promise<void> {
    await this.loadBookings();
  }

  get filteredBookings(): BookingRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.bookings;
    }

    return this.bookings.filter((booking) =>
      booking.motorcycleName.toLowerCase().includes(term)
      || booking.email.toLowerCase().includes(term)
      || this.getBookingTypeLabel(booking.bookingType).toLowerCase().includes(term)
      || booking.paymentStatus.toLowerCase().includes(term),
    );
  }

  get statusSummary(): { paid: number; notPaid: number; cancelled: number } {
    return this.bookings.reduce((acc, booking) => {
      if (booking.paymentStatus === 'paid') {
        acc.paid += 1;
      } else if (booking.paymentStatus === 'cancelled') {
        acc.cancelled += 1;
      } else {
        acc.notPaid += 1;
      }

      return acc;
    }, { paid: 0, notPaid: 0, cancelled: 0 });
  }

  openEditModal(booking: BookingRecord): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isEditModalOpen = true;
    this.editingBookingId = booking.id;
    this.editForm = {
      motorcycleName: booking.motorcycleName,
      bookingType: booking.bookingType,
      startDate: booking.startDate,
      returnDate: booking.returnDate,
      totalDays: booking.totalDays,
      totalAmount: booking.totalAmount,
      paymentMethod: booking.paymentMethod || 'cash',
      paymentStatus: booking.paymentStatus,
      bank: booking.bank,
    };
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.editingBookingId = '';
  }

  async saveBookingUpdates(): Promise<void> {
    if (!this.editingBookingId) {
      return;
    }

    if (!this.editForm.motorcycleName.trim()) {
      this.errorMessage = 'Product name is required.';
      return;
    }

    if (!this.editForm.startDate || !this.editForm.returnDate) {
      this.errorMessage = 'Start and return dates are required.';
      return;
    }

    if (new Date(`${this.editForm.returnDate}T00:00:00`) < new Date(`${this.editForm.startDate}T00:00:00`)) {
      this.errorMessage = 'Return date must be the same or later than the start date.';
      return;
    }

    if (!Number.isFinite(this.editForm.totalAmount) || this.editForm.totalAmount < 0) {
      this.errorMessage = 'Total amount must be 0 or higher.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);

      const paymentMethod = this.editForm.paymentStatus === 'not_paid'
        ? 'cash'
        : this.editForm.paymentMethod || 'cash';

      const payload = {
        motorcycleName: this.editForm.motorcycleName.trim(),
        bookingType: this.editForm.bookingType.trim().toLowerCase(),
        startDate: this.editForm.startDate,
        returnDate: this.editForm.returnDate,
        totalDays: Number(this.editForm.totalDays || 0),
        totalAmount: Number(this.editForm.totalAmount || 0),
        paymentMethod,
        paymentStatus: this.editForm.paymentStatus,
        bank: paymentMethod === 'bank' ? this.editForm.bank.trim().toLowerCase() : '',
        status: this.editForm.paymentStatus === 'cancelled' ? 'cancelled' : 'success',
      };

      await update(ref(db, `successfulPayments/${this.editingBookingId}`), payload);

      this.successMessage = 'Booking updated successfully.';
      this.closeEditModal();
      await this.loadBookings();
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = String((error as { message: unknown }).message);
      } else {
        this.errorMessage = 'Unable to update booking right now.';
      }
    } finally {
      this.isSaving = false;
    }
  }

  async cancelBooking(booking: BookingRecord): Promise<void> {
    const confirmed = window.confirm(`Cancel booking for ${booking.motorcycleName}?`);
    if (!confirmed) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);

      await update(ref(db, `successfulPayments/${booking.id}`), {
        paymentStatus: 'cancelled',
        status: 'cancelled',
      });

      this.successMessage = 'Booking cancelled successfully.';
      await this.loadBookings();
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = String((error as { message: unknown }).message);
      } else {
        this.errorMessage = 'Unable to cancel booking right now.';
      }
    } finally {
      this.isSaving = false;
    }
  }

  getBookingTypeLabel(value: string): string {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getPaymentBadgeClass(status: PaymentStatus): string {
    if (status === 'paid') {
      return 'paid';
    }

    if (status === 'cancelled') {
      return 'cancelled';
    }

    return 'not-paid';
  }

  private async loadBookings(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'successfulPayments'));

      if (!snapshot.exists()) {
        this.bookings = [];
        return;
      }

      const rawData = snapshot.val() as Record<string, Partial<BookingRecord>>;
      this.bookings = Object.entries(rawData)
        .map(([id, value]) => this.normalizeBooking(id, value))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = String((error as { message: unknown }).message);
      } else {
        this.errorMessage = 'Unable to load bookings right now.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private normalizeBooking(id: string, record: Partial<BookingRecord>): BookingRecord {
    const paymentStatus = this.resolvePaymentStatus(record);

    return {
      id,
      email: String(record.email ?? ''),
      motorcycleId: String(record.motorcycleId ?? ''),
      motorcycleName: String(record.motorcycleName ?? 'Unknown Product'),
      bookingType: String(record.bookingType ?? 'motorcycle'),
      totalDays: Number(record.totalDays ?? 0),
      totalAmount: Number(record.totalAmount ?? 0),
      startDate: String(record.startDate ?? ''),
      returnDate: String(record.returnDate ?? ''),
      paymentMethod: String(record.paymentMethod ?? 'cash'),
      paymentStatus,
      bank: String(record.bank ?? ''),
      status: String(record.status ?? ''),
      source: String(record.source ?? ''),
      createdAt: String(record.createdAt ?? ''),
    };
  }

  private resolvePaymentStatus(record: Partial<BookingRecord>): PaymentStatus {
    const raw = String((record as { paymentStatus?: unknown }).paymentStatus ?? '').toLowerCase();
    if (raw === 'paid' || raw === 'not_paid' || raw === 'cancelled') {
      return raw;
    }

    if (String(record.status ?? '').toLowerCase() === 'cancelled') {
      return 'cancelled';
    }

    const method = String(record.paymentMethod ?? '').toLowerCase();
    if (method === 'gcash' || method === 'bank') {
      return 'paid';
    }

    return 'not_paid';
  }

}
