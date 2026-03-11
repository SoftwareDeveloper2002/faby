import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Navbar } from '../component/navbar/navbar';
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

type SuccessfulPaymentRecord = {
  motorcycleName: string;
  totalAmount: number;
  createdAt: string;
  bookingType?: string;
};

type ProductEarning = {
  key: string;
  label: string;
  amount: number;
  bookings: number;
};

type MonthlyEarning = {
  key: string;
  label: string;
  amount: number;
  bookings: number;
  barPercent: number;
};

@Component({
  selector: 'app-dasboard',
  imports: [CommonModule, Navbar],
  templateUrl: './dasboard.html',
  styleUrl: './dasboard.sass',
})
export class Dasboard implements OnInit {
  isLoading = true;
  errorMessage = '';

  totalRevenue = 0;
  totalProfit = 0;
  totalBookings = 0;

  productEarnings: ProductEarning[] = [];
  monthlyEarnings: MonthlyEarning[] = [];

  async ngOnInit(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'successfulPayments'));

      if (!snapshot.exists()) {
        this.resetStats();
        return;
      }

      const rawData = snapshot.val() as Record<string, Partial<SuccessfulPaymentRecord>>;
      const records = Object.values(rawData)
        .map((item) => this.normalizeRecord(item))
        .filter((item) => item.totalAmount > 0);

      this.totalRevenue = records.reduce((sum, item) => sum + item.totalAmount, 0);
      this.totalProfit = this.totalRevenue;
      this.totalBookings = records.length;

      this.productEarnings = this.buildProductEarnings(records);
      this.monthlyEarnings = this.buildMonthlyEarnings(records);
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = String((error as { message: unknown }).message);
      } else {
        this.errorMessage = 'Unable to load admin analytics right now.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  private resetStats(): void {
    this.totalRevenue = 0;
    this.totalProfit = 0;
    this.totalBookings = 0;
    this.productEarnings = [];
    this.monthlyEarnings = [];
  }

  private normalizeRecord(record: Partial<SuccessfulPaymentRecord>): SuccessfulPaymentRecord {
    return {
      motorcycleName: String(record.motorcycleName ?? 'Unknown Product'),
      totalAmount: Number(record.totalAmount ?? 0),
      createdAt: String(record.createdAt ?? ''),
      bookingType: typeof record.bookingType === 'string' ? record.bookingType : undefined,
    };
  }

  private buildProductEarnings(records: SuccessfulPaymentRecord[]): ProductEarning[] {
    const bucket = new Map<string, ProductEarning>();

    records.forEach((record) => {
      const key = this.resolveProductKey(record);
      const label = this.toTitleCase(key);
      const current = bucket.get(key) ?? {
        key,
        label,
        amount: 0,
        bookings: 0,
      };

      current.amount += record.totalAmount;
      current.bookings += 1;
      bucket.set(key, current);
    });

    return [...bucket.values()].sort((a, b) => b.amount - a.amount);
  }

  private buildMonthlyEarnings(records: SuccessfulPaymentRecord[]): MonthlyEarning[] {
    const now = new Date();
    const monthKeys: string[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(this.getMonthKey(date));
    }

    const totals = new Map<string, { amount: number; bookings: number }>();
    monthKeys.forEach((key) => {
      totals.set(key, { amount: 0, bookings: 0 });
    });

    records.forEach((record) => {
      const date = new Date(record.createdAt);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      const key = this.getMonthKey(date);
      const month = totals.get(key);

      if (!month) {
        return;
      }

      month.amount += record.totalAmount;
      month.bookings += 1;
    });

    const maxAmount = Math.max(1, ...[...totals.values()].map((month) => month.amount));

    return monthKeys.map((key) => {
      const month = totals.get(key) ?? { amount: 0, bookings: 0 };
      const [yearText, monthText] = key.split('-');
      const labelDate = new Date(Number(yearText), Number(monthText) - 1, 1);

      return {
        key,
        label: labelDate.toLocaleString('en-PH', { month: 'short' }),
        amount: month.amount,
        bookings: month.bookings,
        barPercent: Math.round((month.amount / maxAmount) * 100),
      };
    });
  }

  private resolveProductKey(record: SuccessfulPaymentRecord): string {
    if (record.bookingType && record.bookingType.trim()) {
      return record.bookingType.trim().toLowerCase();
    }

    const name = record.motorcycleName.toLowerCase();
    if (name.includes('tent')) {
      return 'tent';
    }

    if (name.includes('room') || name.includes('suite')) {
      return 'room';
    }

    if (name.includes('chair') || name.includes('table')) {
      return 'table and chair';
    }

    return 'motorcycle';
  }

  private getMonthKey(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  private toTitleCase(value: string): string {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

}
