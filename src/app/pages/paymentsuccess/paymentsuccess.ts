import { CommonModule } from '@angular/common';
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

type SuccessfulPaymentRecord = {
  email: string;
  motorcycleId: string;
  motorcycleName: string;
  totalDays: number;
  totalAmount: number;
  startDate: string;
  returnDate: string;
  bookingType: string;
  paymentMethod: string;
  bank: string;
  status: 'success';
  source: 'paymongo_checkout' | 'cash_on_arrival';
  createdAt: string;
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

  constructor(private readonly route: ActivatedRoute) {}

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParams;
    const pendingPaymentRaw = localStorage.getItem('pendingPaymentRecord');
    const pendingPayment = pendingPaymentRaw ? this.parsePendingPayment(pendingPaymentRaw) : null;

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const userEmail = auth.currentUser?.email || localStorage.getItem('fabyUserEmail') || '';

    const record: SuccessfulPaymentRecord = {
      email: String(params['email'] ?? userEmail),
      motorcycleId: String(params['motorcycleId'] ?? pendingPayment?.motorcycleId ?? ''),
      motorcycleName: String(params['motorcycleName'] ?? pendingPayment?.motorcycleName ?? 'Motorcycle Unit'),
      totalDays: Number(params['totalDays'] ?? pendingPayment?.totalDays ?? 0),
      totalAmount: Number(params['totalAmount'] ?? pendingPayment?.totalAmount ?? 0),
      startDate: String(params['startDate'] ?? pendingPayment?.startDate ?? ''),
      returnDate: String(params['returnDate'] ?? pendingPayment?.returnDate ?? ''),
      bookingType: String(params['bookingType'] ?? pendingPayment?.bookingType ?? 'motorcycle'),
      paymentMethod: String(params['paymentMethod'] ?? pendingPayment?.paymentMethod ?? ''),
      bank: String(params['bank'] ?? pendingPayment?.bank ?? ''),
      status: 'success',
      source: String(params['source'] ?? pendingPayment?.source ?? '').trim() === 'cash_on_arrival' || String(params['paymentMethod'] ?? pendingPayment?.paymentMethod ?? '').trim() === 'cash'
        ? 'cash_on_arrival'
        : 'paymongo_checkout',
      createdAt: new Date().toISOString(),
    };

    if (!record.totalAmount || !record.totalDays) {
      this.isSaving = false;
      this.saveError = 'Payment details are incomplete, so this transaction was not saved.';
      return;
    }

    try {
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const paymentsRef = ref(db, 'successfulPayments');
      const newPaymentRef = push(paymentsRef);

      await set(newPaymentRef, record);
      localStorage.removeItem('pendingPaymentRecord');
      this.saveSuccess = `Payment saved successfully at successfulPayments/${newPaymentRef.key ?? 'N/A'}`;
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

  private parsePendingPayment(raw: string): Partial<SuccessfulPaymentRecord> | null {
    try {
      const parsed = JSON.parse(raw) as Partial<SuccessfulPaymentRecord>;
      return parsed;
    } catch {
      return null;
    }
  }
}
