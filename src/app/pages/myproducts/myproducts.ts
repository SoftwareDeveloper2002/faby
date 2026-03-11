import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { get, getDatabase, orderByChild, query, ref, equalTo } from 'firebase/database';

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

type PaymentItem = {
  id: string;
  email: string;
  motorcycleName: string;
  totalDays: number;
  totalAmount: number;
  startDate: string;
  returnDate: string;
  paymentMethod: string;
  bank: string;
  createdAt: string;
  bookingType?: string;
};

@Component({
  selector: 'app-myproducts',
  imports: [CommonModule, RouterLink],
  templateUrl: './myproducts.html',
  styleUrl: './myproducts.sass',
})
export class Myproducts implements OnInit {
  isLoading = true;
  errorMessage = '';
  userEmail = '';
  payments: PaymentItem[] = [];

  printReceipt(payment: PaymentItem): void {
    const receiptWindow = window.open('', '_blank', 'width=900,height=700');

    if (!receiptWindow) {
      this.errorMessage = 'Unable to open print window. Please allow pop-ups and try again.';
      return;
    }

    const printableDate = new Date(payment.createdAt);
    const safeDate = Number.isNaN(printableDate.getTime())
      ? payment.createdAt
      : printableDate.toLocaleString();
    const bookingLabel = this.toTitleCase(payment.bookingType || 'product');

    const receiptHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt - ${this.escapeHtml(payment.id)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        font-family: "Georgia", "Times New Roman", serif;
        margin: 0;
        background: #f8f0e4;
        color: #2f2114;
        padding: 24px;
      }
      .receipt {
        max-width: 760px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #d8bc99;
        border-radius: 12px;
        overflow: hidden;
      }
      .header {
        padding: 18px 20px;
        background: linear-gradient(135deg, #f4e2cc, #ead2b0);
        border-bottom: 1px solid #d8bc99;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
      }
      .header p {
        margin: 6px 0 0;
        color: #6b5438;
      }
      .content {
        padding: 18px 20px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 18px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #e6d2b6;
        padding-bottom: 8px;
      }
      .label {
        color: #6b5438;
        font-weight: 700;
      }
      .value {
        color: #2f2114;
        font-weight: 700;
        text-align: right;
      }
      .total {
        margin-top: 16px;
        padding-top: 10px;
        border-top: 2px solid #d8bc99;
        font-size: 20px;
      }
      .footer {
        padding: 14px 20px;
        color: #6b5438;
        background: #fff7ee;
        border-top: 1px solid #ead3b6;
      }
      .actions {
        margin: 12px auto 0;
        text-align: center;
      }
      button {
        border: 0;
        border-radius: 8px;
        padding: 10px 14px;
        font-weight: 700;
        background: #8b4d23;
        color: #fff;
        cursor: pointer;
      }
      @media print {
        body {
          background: #fff;
          padding: 0;
        }
        .receipt {
          border: 0;
          border-radius: 0;
        }
        .actions {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <section class="receipt">
      <header class="header">
        <h1>Faby Receipt</h1>
        <p>Booking confirmation and payment record</p>
      </header>
      <div class="content">
        <div class="grid">
          <div class="row"><span class="label">Receipt ID</span><span class="value">${this.escapeHtml(payment.id)}</span></div>
          <div class="row"><span class="label">Email</span><span class="value">${this.escapeHtml(payment.email)}</span></div>
          <div class="row"><span class="label">Product Type</span><span class="value">${this.escapeHtml(bookingLabel)}</span></div>
          <div class="row"><span class="label">Product Name</span><span class="value">${this.escapeHtml(payment.motorcycleName)}</span></div>
          <div class="row"><span class="label">Booking Date</span><span class="value">${this.escapeHtml(payment.startDate)}</span></div>
          <div class="row"><span class="label">Return Date</span><span class="value">${this.escapeHtml(payment.returnDate)}</span></div>
          <div class="row"><span class="label">Duration</span><span class="value">${this.escapeHtml(String(payment.totalDays))} day(s)</span></div>
          <div class="row"><span class="label">Payment Method</span><span class="value">${this.escapeHtml(this.toTitleCase(payment.paymentMethod))}</span></div>
          <div class="row"><span class="label">Bank</span><span class="value">${this.escapeHtml(payment.bank ? payment.bank.toUpperCase() : '-')}</span></div>
          <div class="row"><span class="label">Saved At</span><span class="value">${this.escapeHtml(safeDate)}</span></div>
        </div>
        <div class="row total"><span class="label">Total Amount</span><span class="value">${this.escapeHtml(this.formatCurrency(payment.totalAmount))}</span></div>
      </div>
      <footer class="footer">Thank you for booking with Faby.</footer>
    </section>
    <div class="actions">
      <button onclick="window.print()">Print Receipt</button>
    </div>
  </body>
</html>`;

    receiptWindow.document.open();
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  private toTitleCase(value: string): string {
    if (!value) {
      return '';
    }

    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async ngOnInit(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      this.userEmail = auth.currentUser?.email || localStorage.getItem('fabyUserEmail') || '';

      if (!this.userEmail) {
        this.errorMessage = 'Please login first to view your products and bookings.';
        return;
      }

      const db = getDatabase(app, firebaseConfig.databaseURL);
      const paymentsRef = ref(db, 'successfulPayments');
      const paymentsQuery = query(paymentsRef, orderByChild('email'), equalTo(this.userEmail));
      const snapshot = await get(paymentsQuery);

      if (!snapshot.exists()) {
        this.payments = [];
        return;
      }

      const rawData = snapshot.val() as Record<string, Omit<PaymentItem, 'id'>>;
      this.payments = Object.entries(rawData)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = String((error as { message: unknown }).message);
      } else {
        this.errorMessage = 'Unable to load your products right now.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
