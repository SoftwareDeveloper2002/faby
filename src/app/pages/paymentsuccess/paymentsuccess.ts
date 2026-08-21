import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, push, ref, set } from 'firebase/database';

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

type PendingPayment = {
  motorcycleId?: string;
  motorcycleName?: string;
  totalDays?: number;
  rentalSubtotal?: number;
  depositAmount?: number;
  depositCycles?: number;
  totalAmount?: number;
  startDate?: string;
  returnDate?: string;
  bookingType?: string;
  paymentMethod?: string;
  bank?: string;
  source?: string;
  receiptUrl?: string;
  referenceNote?: string;
  returnPath?: string;
};

/** Where "browse more" should send the customer, and what to call it, per rental category. */
const BROWSE_MORE_BY_TYPE: Record<string, { path: string; label: string }> = {
  motorcycle: { path: '/motorcycle-list', label: 'Book Another Ride' },
  tent: { path: '/tent-list', label: 'Book Another Tent' },
  table_chair: { path: '/table-chair-list', label: 'Book Another Set' },
  room: { path: '/room-list', label: 'Book Another Room' },
  inn: { path: '/room-list', label: 'Book Another Room' },
};

@Component({
  selector: 'app-paymentsuccess',
  imports: [CommonModule, RouterLink],
  templateUrl: './paymentsuccess.html',
  styleUrl: './paymentsuccess.sass',
})
export class Paymentsuccess implements OnInit {
  isSaving = true;
  saveError = '';
  saveSuccess = '';
  /** True when this booking is a QR-transfer submission awaiting admin review, not yet a confirmed booking. */
  isPendingReview = false;
  browsePath = '/motorcycle-list';
  browseLabel = 'Book Another Ride';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly location: Location,
  ) {}

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParams;
    const pendingPaymentRaw = localStorage.getItem('pendingPaymentRecord');
    const pendingPayment = pendingPaymentRaw ? this.parsePendingPayment(pendingPaymentRaw) : null;

    const read = <K extends keyof PendingPayment>(key: K): PendingPayment[K] | undefined =>
      (params[key] as PendingPayment[K] | undefined) ?? pendingPayment?.[key];

    const source = String(read('source') ?? '').trim();
    const paymentMethod = String(read('paymentMethod') ?? '').trim();
    this.isPendingReview = source === 'qr_transfer_review';

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const userEmail = auth.currentUser?.email || localStorage.getItem('fabyUserEmail') || '';

    const shared = {
      email: String(params['email'] ?? userEmail),
      motorcycleId: String(read('motorcycleId') ?? ''),
      motorcycleName: String(read('motorcycleName') ?? 'Motorcycle Unit'),
      totalDays: Number(read('totalDays') ?? 0),
      rentalSubtotal: Number(read('rentalSubtotal') ?? 0),
      depositAmount: Number(read('depositAmount') ?? 0),
      depositCycles: Number(read('depositCycles') ?? 0),
      totalAmount: Number(read('totalAmount') ?? 0),
      startDate: String(read('startDate') ?? ''),
      returnDate: String(read('returnDate') ?? ''),
      bookingType: String(read('bookingType') ?? 'motorcycle'),
      paymentMethod,
      bank: String(read('bank') ?? ''),
      createdAt: new Date().toISOString(),
    };

    const browseMoreConfig = BROWSE_MORE_BY_TYPE[shared.bookingType] ?? BROWSE_MORE_BY_TYPE['motorcycle'];
    this.browsePath = String(read('returnPath') ?? '') || browseMoreConfig.path;
    this.browseLabel = browseMoreConfig.label;

    // Strip the query string (booking details, deposit amounts, the receipt image URL, etc.)
    // now that it's been read into memory — leaving it in the address bar is both messy and a
    // real bug: refreshing this page would otherwise re-run this handler and write a duplicate
    // booking/submission record every time.
    this.location.replaceState('/payment-success');

    if (!shared.totalAmount || !shared.totalDays) {
      this.isSaving = false;
      this.saveError = 'Payment details are incomplete, so this transaction was not saved.';
      return;
    }

    try {
      const db = getDatabase(app, firebaseConfig.databaseURL);

      if (this.isPendingReview) {
        const submissionsRef = ref(db, 'paymentSubmissions');
        const newSubmissionRef = push(submissionsRef);

        await set(newSubmissionRef, {
          ...shared,
          receiptUrl: String(read('receiptUrl') ?? ''),
          referenceNote: String(read('referenceNote') ?? ''),
          status: 'pending',
          adminNote: '',
        });

        localStorage.removeItem('pendingPaymentRecord');
        this.saveSuccess = 'Your payment proof was submitted and is pending admin review.';
      } else {
        const paymentsRef = ref(db, 'successfulPayments');
        const newPaymentRef = push(paymentsRef);

        await set(newPaymentRef, {
          ...shared,
          status: 'success',
          source: source === 'cash_on_arrival' || paymentMethod === 'cash' ? 'cash_on_arrival' : source || 'cash_on_arrival',
        });

        localStorage.removeItem('pendingPaymentRecord');
        this.saveSuccess = `Payment saved successfully at successfulPayments/${newPaymentRef.key ?? 'N/A'}`;
      }
    } catch (error) {
      if (error && typeof error === 'object') {
        const firebaseError = error as { code?: unknown; message?: unknown };
        const codeText = firebaseError.code ? `[${String(firebaseError.code)}] ` : '';
        const messageText = firebaseError.message ? String(firebaseError.message) : 'Payment succeeded but saving to database failed.';
        this.saveError = `${codeText}${messageText}`;
      } else {
        this.saveError = 'Payment succeeded but saving to database failed.';
      }
    } finally {
      this.isSaving = false;
    }
  }

  private parsePendingPayment(raw: string): PendingPayment | null {
    try {
      return JSON.parse(raw) as PendingPayment;
    } catch {
      return null;
    }
  }
}
