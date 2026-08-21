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
  paymentStatus?: string;
  status?: string;
  source?: string;
  bank: string;
  createdAt: string;
  bookingType?: string;
  /** True for a QR-transfer receipt still awaiting admin review (not yet a confirmed booking). */
  isSubmission?: boolean;
  submissionStatus?: 'pending' | 'rejected';
  adminNote?: string;
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
      const submissionsRef = ref(db, 'paymentSubmissions');
      const submissionsQuery = query(submissionsRef, orderByChild('email'), equalTo(this.userEmail));

      const [paymentsSnapshot, submissionsSnapshot] = await Promise.all([get(paymentsQuery), get(submissionsQuery)]);

      const confirmed: PaymentItem[] = paymentsSnapshot.exists()
        ? Object.entries(paymentsSnapshot.val() as Record<string, Omit<PaymentItem, 'id'>>).map(([id, value]) => ({ id, ...value }))
        : [];

      // Only surface QR receipts still pending or rejected — approved ones already became a
      // "successfulPayments" record above, so including them again would double-count.
      const pendingOrRejected: PaymentItem[] = submissionsSnapshot.exists()
        ? Object.entries(submissionsSnapshot.val() as Record<string, Record<string, unknown>>)
            .filter(([, value]) => value['status'] === 'pending' || value['status'] === 'rejected')
            .map(([id, value]) => ({
              id,
              email: String(value['email'] ?? ''),
              motorcycleName: String(value['motorcycleName'] ?? 'Rental item'),
              totalDays: Number(value['totalDays'] ?? 0),
              totalAmount: Number(value['totalAmount'] ?? 0),
              startDate: String(value['startDate'] ?? ''),
              returnDate: String(value['returnDate'] ?? ''),
              paymentMethod: String(value['paymentMethod'] ?? 'qr_transfer'),
              bank: String(value['bank'] ?? ''),
              createdAt: String(value['createdAt'] ?? ''),
              bookingType: String(value['bookingType'] ?? ''),
              isSubmission: true,
              submissionStatus: value['status'] as 'pending' | 'rejected',
              adminNote: String(value['adminNote'] ?? ''),
            }))
        : [];

      this.payments = [...confirmed, ...pendingOrRejected].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
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

  getPaymentStatusLabel(payment: PaymentItem): string {
    if (payment.isSubmission) {
      return payment.submissionStatus === 'rejected' ? 'Rejected' : 'Pending Review';
    }

    const normalized = this.getNormalizedPaymentStatus(payment);
    if (normalized === 'paid') {
      return 'Paid';
    }

    if (normalized === 'cancelled') {
      return 'Cancelled';
    }

    return 'Not Paid';
  }

  getPaymentStatusClass(payment: PaymentItem): string {
    if (payment.isSubmission) {
      return payment.submissionStatus === 'rejected' ? 'rejected' : 'pending';
    }

    const normalized = this.getNormalizedPaymentStatus(payment);
    if (normalized === 'paid') {
      return 'paid';
    }

    if (normalized === 'cancelled') {
      return 'cancelled';
    }

    return 'not-paid';
  }

  private getNormalizedPaymentStatus(payment: PaymentItem): 'paid' | 'not_paid' | 'cancelled' {
    const paymentStatus = String(payment.paymentStatus ?? '').trim().toLowerCase();
    if (paymentStatus) {
      if (paymentStatus === 'paid' || paymentStatus === 'not_paid' || paymentStatus === 'cancelled') {
        return paymentStatus;
      }
    }

    const bookingStatus = String(payment.status ?? '').trim().toLowerCase();
    if (bookingStatus === 'cancelled') {
      return 'cancelled';
    }

    const method = String(payment.paymentMethod ?? '').trim().toLowerCase();
    if (method === 'cash') {
      return 'not_paid';
    }

    return 'paid';
  }
}
