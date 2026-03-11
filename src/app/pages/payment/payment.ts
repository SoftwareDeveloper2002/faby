import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

type PaymentDetails = {
  motorcycleName: string;
  totalDays: number;
  totalAmount: number;
  startDate: string;
  returnDate: string;
  bookingType: string;
  returnPath: string;
};

@Component({
  selector: 'app-payment',
  imports: [CommonModule, FormsModule],
  templateUrl: './payment.html',
  styleUrl: './payment.sass',
})
export class Payment {
  booking: PaymentDetails;
  selectedMethod = 'cash';
  selectedBank = 'bpi';
  isProcessing = false;
  errorMessage = '';

  readonly bankOptions = [
    { code: 'bpi', label: 'BPI' },
    { code: 'unionbank', label: 'UnionBank' },
    { code: 'bdo', label: 'BDO' },
    { code: 'landbank', label: 'Landbank' },
    { code: 'metrobank', label: 'Metrobank' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    const params = this.route.snapshot.queryParams;

    this.booking = {
      motorcycleName: String(params['motorcycleName'] ?? 'Motorcycle Unit'),
      totalDays: Number(params['totalDays'] ?? 0),
      totalAmount: Number(params['totalAmount'] ?? 0),
      startDate: String(params['startDate'] ?? ''),
      returnDate: String(params['returnDate'] ?? ''),
      bookingType: String(params['bookingType'] ?? 'motorcycle'),
      returnPath: String(params['returnPath'] ?? '/motorcycle-list'),
    };

    if (this.booking.totalDays <= 0 || this.booking.totalAmount <= 0) {
      void this.router.navigate([this.booking.returnPath]);
    }
  }

  async confirmPayment(): Promise<void> {
    this.errorMessage = '';

    if (this.selectedMethod === 'cash') {
      await this.router.navigate([this.booking.returnPath]);
      return;
    }

    this.isProcessing = true;

    try {
      const pendingPaymentRecord = {
        motorcycleName: this.booking.motorcycleName,
        totalDays: this.booking.totalDays,
        totalAmount: this.booking.totalAmount,
        startDate: this.booking.startDate,
        returnDate: this.booking.returnDate,
        bookingType: this.booking.bookingType,
        paymentMethod: this.selectedMethod,
        bank: this.selectedMethod === 'bank' ? this.selectedBank : '',
      };
      localStorage.setItem('pendingPaymentRecord', JSON.stringify(pendingPaymentRecord));

      const checkoutUrl = await this.createPayMongoCheckoutUrl();
      window.location.href = checkoutUrl;
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async createPayMongoCheckoutUrl(): Promise<string> {
    const payload = {
      amount: this.booking.totalAmount,
      description: `${this.booking.motorcycleName} rental (${this.booking.totalDays} day/s)`,
      method: this.selectedMethod,
      bank: this.selectedMethod === 'bank' ? this.selectedBank : null,
      metadata: {
        motorcycleName: this.booking.motorcycleName,
        totalDays: this.booking.totalDays,
        startDate: this.booking.startDate,
        returnDate: this.booking.returnDate,
      },
    };

    const primary = await this.requestCheckout('/api/paymongo/checkout-session', payload);
    let response = primary;

    if (!response || response.status === 404) {
      response = await this.requestCheckout('http://localhost:3100/api/paymongo/checkout-session', payload);
    }

    if (!response) {
      throw new Error('Unable to reach payment API. Ensure PayMongo API server is running on port 3100.');
    }

    if (!response.ok) {
      const errorMessage = await this.extractErrorMessage(response);
      throw new Error(errorMessage);
    }

    const result = (await response.json()) as { checkoutUrl?: string };

    if (!result.checkoutUrl) {
      throw new Error('PayMongo checkout URL is missing from the server response.');
    }

    return result.checkoutUrl;
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody?.message) {
          return errorBody.message;
        }
      } catch {
        // Fallback below.
      }
    }

    if (response.status === 404) {
      return 'Payment API route not found on Angular server. Restart frontend with proxy or keep API running on port 3100.';
    }

    return 'Unable to initialize PayMongo checkout. Please try again.';
  }

  private async requestCheckout(url: string, payload: object): Promise<Response | null> {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return null;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Payment initialization failed. Please try again.';
  }
}
