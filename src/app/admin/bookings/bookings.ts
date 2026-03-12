import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../component/navbar/navbar';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { get, getDatabase, push, ref, set, update } from 'firebase/database';

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
  email: string;
  motorcycleId: string;
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

type ProductCategory = 'motorcycle' | 'tent' | 'table_chair' | 'inn';

type AdminProductOption = {
  id: string;
  title: string;
  category: ProductCategory;
  ratePerDay: number;
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
  adminProducts: AdminProductOption[] = [];
  authUserEmails: string[] = [];

  isEditModalOpen = false;
  isCreateMode = false;
  editingBookingId = '';
  editForm: BookingFormModel = {
    email: '',
    motorcycleId: '',
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
    await Promise.all([this.loadBookings(), this.loadAdminProducts(), this.loadAuthUserEmails()]);
  }

  get selectableUserEmails(): string[] {
    const merged = new Set<string>();

    this.authUserEmails.forEach((email) => {
      const trimmed = email.trim();
      if (trimmed) {
        merged.add(trimmed);
      }
    });

    this.uniqueEmails.forEach((email) => {
      const trimmed = email.trim();
      if (trimmed) {
        merged.add(trimmed);
      }
    });

    return [...merged].sort((a, b) => a.localeCompare(b));
  }

  get availableProductsForForm(): AdminProductOption[] {
    const expectedCategory = this.getCategoryFromBookingType(this.editForm.bookingType);
    return this.adminProducts
      .filter((product) => product.category === expectedCategory)
      .sort((a, b) => a.title.localeCompare(b.title));
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

  get uniqueEmails(): string[] {
    return [...new Set(this.bookings.map((booking) => booking.email.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  openEditModal(booking: BookingRecord): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isEditModalOpen = true;
    this.isCreateMode = false;
    this.editingBookingId = booking.id;
    this.editForm = {
      email: booking.email,
      motorcycleId: booking.motorcycleId,
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
    this.recalculateComputedFields();
  }

  openCreateModal(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isEditModalOpen = true;
    this.isCreateMode = true;
    this.editingBookingId = '';
    this.editForm = {
      email: '',
      motorcycleId: '',
      motorcycleName: '',
      bookingType: 'motorcycle',
      startDate: '',
      returnDate: '',
      totalDays: 1,
      totalAmount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'not_paid',
      bank: '',
    };

    const firstEmail = this.selectableUserEmails[0] ?? '';
    this.editForm.email = firstEmail;
    this.recalculateComputedFields();
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.isCreateMode = false;
    this.editingBookingId = '';
  }

  async saveBookingUpdates(): Promise<void> {
    if (this.isCreateMode) {
      await this.createBooking();
      return;
    }

    if (!this.editingBookingId) {
      return;
    }

    if (!this.validateBookingForm()) {
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
        email: this.editForm.email.trim(),
        motorcycleId: this.editForm.motorcycleId.trim() || this.createProductId(this.editForm.motorcycleName),
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

  private async createBooking(): Promise<void> {
    if (!this.validateBookingForm()) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const paymentsRef = ref(db, 'successfulPayments');
      const newBookingRef = push(paymentsRef);

      const paymentMethod = this.editForm.paymentStatus === 'not_paid'
        ? 'cash'
        : this.editForm.paymentMethod || 'cash';

      const payload = {
        email: this.editForm.email.trim(),
        motorcycleId: this.editForm.motorcycleId.trim() || this.createProductId(this.editForm.motorcycleName),
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
        source: 'admin_manual',
        createdAt: new Date().toISOString(),
      };

      await set(newBookingRef, payload);

      this.successMessage = 'Booking created successfully.';
      this.closeEditModal();
      await this.loadBookings();
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = String((error as { message: unknown }).message);
      } else {
        this.errorMessage = 'Unable to create booking right now.';
      }
    } finally {
      this.isSaving = false;
    }
  }

  private validateBookingForm(): boolean {
    if (!this.editForm.motorcycleName.trim()) {
      this.errorMessage = 'Product name is required.';
      return false;
    }

    if (!this.editForm.email.trim()) {
      this.errorMessage = 'User email is required.';
      return false;
    }

    if (!this.editForm.startDate || !this.editForm.returnDate) {
      this.errorMessage = 'Start and return dates are required.';
      return false;
    }

    if (new Date(`${this.editForm.returnDate}T00:00:00`) < new Date(`${this.editForm.startDate}T00:00:00`)) {
      this.errorMessage = 'Return date must be the same or later than the start date.';
      return false;
    }

    if (!Number.isFinite(this.editForm.totalAmount) || this.editForm.totalAmount < 0) {
      this.errorMessage = 'Total amount must be 0 or higher.';
      return false;
    }

    if (!Number.isFinite(this.editForm.totalDays) || this.editForm.totalDays <= 0) {
      this.errorMessage = 'Total days must be greater than 0.';
      return false;
    }

    return true;
  }

  private createProductId(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  onBookingTypeChanged(): void {
    this.editForm.motorcycleId = '';
    this.editForm.motorcycleName = '';
    this.recalculateComputedFields();
  }

  onProductSelected(productId: string): void {
    this.editForm.motorcycleId = productId;
    const selected = this.availableProductsForForm.find((product) => product.id === productId);

    if (!selected) {
      this.editForm.motorcycleName = '';
      this.recalculateComputedFields();
      return;
    }

    this.editForm.motorcycleName = selected.title;
    this.recalculateComputedFields();
  }

  onBookingDatesChanged(): void {
    this.recalculateComputedFields();
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

  private async loadAdminProducts(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        this.adminProducts = [];
        return;
      }

      const rawData = snapshot.val() as Record<string, Partial<AdminProductOption>>;
      this.adminProducts = Object.entries(rawData)
        .map(([id, value]) => ({
          id,
          title: String(value.title ?? '').trim(),
          category: this.normalizeProductCategory(String(value.category ?? 'motorcycle')),
          ratePerDay: Number(value.ratePerDay ?? 0),
        }))
        .filter((product) => product.title && Number.isFinite(product.ratePerDay) && product.ratePerDay > 0);
    } catch {
      this.adminProducts = [];
    }
  }

  private async loadAuthUserEmails(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getDatabase(app, firebaseConfig.databaseURL);

      const snapshot = await get(ref(db, 'appUsers'));
      const emails = new Set<string>();

      if (snapshot.exists()) {
        const users = snapshot.val() as Record<string, { email?: unknown }>;
        Object.values(users).forEach((user) => {
          const email = String(user?.email ?? '').trim();
          if (email) {
            emails.add(email);
          }
        });
      }

      const currentEmail = auth.currentUser?.email?.trim() || localStorage.getItem('fabyUserEmail')?.trim() || '';
      if (currentEmail) {
        emails.add(currentEmail);
      }

      this.authUserEmails = [...emails].sort((a, b) => a.localeCompare(b));
    } catch {
      const fallbackEmail = localStorage.getItem('fabyUserEmail')?.trim() || '';
      this.authUserEmails = fallbackEmail ? [fallbackEmail] : [];
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

  private recalculateComputedFields(): void {
    const start = this.parseDateAtMidnight(this.editForm.startDate);
    const end = this.parseDateAtMidnight(this.editForm.returnDate);

    if (!start || !end || end < start) {
      this.editForm.totalDays = 0;
      this.editForm.totalAmount = 0;
      return;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
    this.editForm.totalDays = days;

    const rate = this.getSelectedRatePerDay();
    this.editForm.totalAmount = Math.round(days * rate);
  }

  private getSelectedRatePerDay(): number {
    const selectedById = this.editForm.motorcycleId
      ? this.adminProducts.find((product) => product.id === this.editForm.motorcycleId)
      : null;

    if (selectedById && selectedById.ratePerDay > 0) {
      return selectedById.ratePerDay;
    }

    const selectedByName = this.editForm.motorcycleName
      ? this.adminProducts.find((product) => product.title === this.editForm.motorcycleName)
      : null;

    if (selectedByName && selectedByName.ratePerDay > 0) {
      return selectedByName.ratePerDay;
    }

    if (!this.isCreateMode && this.editForm.totalDays > 0 && this.editForm.totalAmount > 0) {
      return this.editForm.totalAmount / this.editForm.totalDays;
    }

    return 0;
  }

  private parseDateAtMidnight(value: string): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private getCategoryFromBookingType(bookingType: string): ProductCategory {
    const normalized = bookingType.trim().toLowerCase();
    if (normalized === 'room') {
      return 'inn';
    }

    if (normalized === 'table_chair') {
      return 'table_chair';
    }

    if (normalized === 'tent') {
      return 'tent';
    }

    return 'motorcycle';
  }

  private normalizeProductCategory(value: string): ProductCategory {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'inn') {
      return 'inn';
    }

    if (normalized === 'table_chair') {
      return 'table_chair';
    }

    if (normalized === 'tent') {
      return 'tent';
    }

    return 'motorcycle';
  }

}
