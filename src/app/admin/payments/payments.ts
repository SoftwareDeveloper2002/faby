import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref, set, update, type Unsubscribe } from 'firebase/database';
import { Navbar } from '../component/navbar/navbar';

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

type SubmissionStatus = 'pending' | 'approved' | 'rejected';

type PaymentSubmission = {
  id: string;
  email: string;
  motorcycleId: string;
  motorcycleName: string;
  bookingType: string;
  startDate: string;
  returnDate: string;
  totalDays: number;
  rentalSubtotal: number;
  depositAmount: number;
  depositCycles: number;
  totalAmount: number;
  receiptUrl: string;
  referenceNote: string;
  status: SubmissionStatus;
  adminNote: string;
  createdAt: string;
};

@Component({
  selector: 'app-admin-payments',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './payments.html',
  styleUrl: './payments.sass',
})
export class Payments implements OnInit, OnDestroy {
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  statusFilter: 'all' | SubmissionStatus = 'pending';
  processingId = '';
  activeReceiptUrl = '';

  submissions: PaymentSubmission[] = [];

  private unsubscribe: Unsubscribe | null = null;

  ngOnInit(): void {
    this.subscribe();
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  get filteredSubmissions(): PaymentSubmission[] {
    if (this.statusFilter === 'all') {
      return this.submissions;
    }

    return this.submissions.filter((item) => item.status === this.statusFilter);
  }

  get pendingCount(): number {
    return this.submissions.filter((item) => item.status === 'pending').length;
  }

  openReceipt(url: string): void {
    this.activeReceiptUrl = url;
  }

  closeReceipt(): void {
    this.activeReceiptUrl = '';
  }

  async approve(submission: PaymentSubmission): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.processingId = submission.id;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);

      const bookingRef = push(ref(db, 'successfulPayments'));
      await set(bookingRef, {
        email: submission.email,
        motorcycleId: submission.motorcycleId,
        motorcycleName: submission.motorcycleName,
        bookingType: submission.bookingType,
        startDate: submission.startDate,
        returnDate: submission.returnDate,
        totalDays: submission.totalDays,
        rentalSubtotal: submission.rentalSubtotal,
        depositAmount: submission.depositAmount,
        totalAmount: submission.totalAmount,
        paymentMethod: 'qr_transfer',
        paymentStatus: 'paid',
        bank: '',
        status: 'success',
        source: 'manual_qr_review',
        receiptUrl: submission.receiptUrl,
        createdAt: new Date().toISOString(),
      });

      await update(ref(db, `paymentSubmissions/${submission.id}`), {
        status: 'approved',
        linkedBookingId: bookingRef.key,
        reviewedAt: new Date().toISOString(),
      });

      this.successMessage = `Approved — ${submission.motorcycleName} booking is now confirmed.`;
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.processingId = '';
    }
  }

  async reject(submission: PaymentSubmission): Promise<void> {
    const confirmed = window.confirm(`Reject this receipt for ${submission.motorcycleName}? The customer will need to resubmit.`);
    if (!confirmed) {
      return;
    }

    const note = window.prompt('Optional note for your own records (why this was rejected):', '') ?? '';
    this.errorMessage = '';
    this.successMessage = '';
    this.processingId = submission.id;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);

      await update(ref(db, `paymentSubmissions/${submission.id}`), {
        status: 'rejected',
        adminNote: note.trim(),
        reviewedAt: new Date().toISOString(),
      });

      this.successMessage = `Rejected the receipt for ${submission.motorcycleName}.`;
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.processingId = '';
    }
  }

  getBookingTypeLabel(value: string): string {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  private subscribe(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribe = onValue(
      ref(db, 'paymentSubmissions'),
      (snapshot) => {
        const data = (snapshot.val() ?? {}) as Record<string, Partial<PaymentSubmission>>;
        this.submissions = Object.entries(data)
          .map(([id, value]) => this.normalize(id, value))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.isLoading = false;
      },
      (error) => {
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      },
    );
  }

  private normalize(id: string, record: Partial<PaymentSubmission>): PaymentSubmission {
    const status = record.status === 'approved' || record.status === 'rejected' ? record.status : 'pending';

    return {
      id,
      email: String(record.email ?? ''),
      motorcycleId: String(record.motorcycleId ?? ''),
      motorcycleName: String(record.motorcycleName ?? 'Rental item'),
      bookingType: String(record.bookingType ?? 'motorcycle'),
      startDate: String(record.startDate ?? ''),
      returnDate: String(record.returnDate ?? ''),
      totalDays: Number(record.totalDays ?? 0),
      rentalSubtotal: Number(record.rentalSubtotal ?? 0),
      depositAmount: Number(record.depositAmount ?? 0),
      depositCycles: Number(record.depositCycles ?? 0),
      totalAmount: Number(record.totalAmount ?? 0),
      receiptUrl: String(record.receiptUrl ?? ''),
      referenceNote: String(record.referenceNote ?? ''),
      status,
      adminNote: String(record.adminNote ?? ''),
      createdAt: String(record.createdAt ?? ''),
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Something went wrong. Please try again.';
  }
}
