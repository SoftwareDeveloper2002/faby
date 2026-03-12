import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LegalModalComponent, LegalModalSection } from '../../components/legal-modal/legal-modal';

type PaymentDetails = {
  motorcycleId: string;
  motorcycleName: string;
  totalDays: number;
  totalAmount: number;
  startDate: string;
  returnDate: string;
  bookingType: string;
  returnPath: string;
};

const DEFAULT_PAYMONGO_API_BASE = 'https://faby.soltryxsolutions.com';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, LegalModalComponent],
  templateUrl: './payment.html',
  styleUrl: './payment.sass',
})
export class Payment {
  booking: PaymentDetails;
  selectedMethod = 'cash';
  selectedBank = 'bpi';
  isProcessing = false;
  errorMessage = '';
  hasAcceptedPolicies = false;
  isTermsModalOpen = false;
  isPrivacyModalOpen = false;

  readonly bankOptions = [
    { code: 'bpi', label: 'BPI' },
    { code: 'unionbank', label: 'UnionBank' },
    { code: 'bdo', label: 'BDO' },
    { code: 'landbank', label: 'Landbank' },
    { code: 'metrobank', label: 'Metrobank' },
  ];

  readonly termsSections: LegalModalSection[] = [
    {
      heading: 'Payment Authorization',
      paragraphs: [
        'By continuing, you confirm that the payment method selected belongs to you or is authorized for this booking.',
        'All payment attempts must use valid account details and follow provider security checks.',
      ],
    },
    {
      heading: 'Booking and Charge Terms',
      paragraphs: [
        'Confirmed payments are tied to your booking details, including selected item, dates, and total amount.',
        'Cancellations, adjustments, and refunds are processed under Monting Balay policies and payment provider rules.',
      ],
    },
  ];

  readonly privacySections: LegalModalSection[] = [
    {
      heading: 'Payment Data Handling',
      paragraphs: [
        'We store booking and payment-related metadata needed to complete and verify your reservation.',
        'Sensitive payment processing is handled through secure third-party checkout channels such as PayMongo.',
      ],
    },
    {
      heading: 'Operational Use',
      paragraphs: [
        'Booking and payment records may be used by administrators for support, validation, and reporting.',
        'Stored records are retained according to operational and compliance requirements.',
      ],
    },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    const params = this.route.snapshot.queryParams;

    this.booking = {
      motorcycleId: String(params['motorcycleId'] ?? ''),
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

    if (!this.hasAcceptedPolicies) {
      this.errorMessage = 'You must agree to the Terms and Privacy Policy before confirming payment.';
      return;
    }

    if (this.selectedMethod === 'cash') {
      await this.router.navigate([this.booking.returnPath]);
      return;
    }

    this.isProcessing = true;

    try {
      const pendingPaymentRecord = {
        motorcycleId: this.booking.motorcycleId,
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
        motorcycleId: this.booking.motorcycleId,
        motorcycleName: this.booking.motorcycleName,
        totalDays: this.booking.totalDays,
        startDate: this.booking.startDate,
        returnDate: this.booking.returnDate,
      },
    };

    const candidateUrls = this.getCheckoutEndpointCandidates();
    let response: Response | null = null;

    for (const url of candidateUrls) {
      const candidateResponse = await this.requestCheckout(url, payload);

      if (!candidateResponse) {
        continue;
      }

      if (candidateResponse.ok) {
        response = candidateResponse;
        break;
      }

      if (candidateResponse.status !== 404) {
        response = candidateResponse;
        break;
      }
    }

    if (!response) {
      throw new Error('Unable to reach payment API. Ensure your backend is running and reachable at https://faby.soltryxsolutions.com or set localStorage.paymongoApiBaseUrl to your backend URL.');
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
      return 'Payment API route not found. If deployed on Firebase Hosting, set localStorage.paymongoApiBaseUrl to your public backend URL.';
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

  private getCheckoutEndpointCandidates(): string[] {
    const endpointPath = '/api/paymongo/checkout-session';
    const candidates: string[] = [];

    const configuredBase = localStorage.getItem('paymongoApiBaseUrl')?.trim();
    if (configuredBase) {
      candidates.push(this.composeEndpoint(configuredBase, endpointPath));
    }

    candidates.push(this.composeEndpoint(DEFAULT_PAYMONGO_API_BASE, endpointPath));

    candidates.push(endpointPath);

    return [...new Set(candidates)];
  }

  private composeEndpoint(baseUrl: string, endpointPath: string): string {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${normalizedBase}${endpointPath}`;
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Payment initialization failed. Please try again.';
  }

  openTermsModal(): void {
    this.isTermsModalOpen = true;
  }

  closeTermsModal(): void {
    this.isTermsModalOpen = false;
  }

  openPrivacyModal(): void {
    this.isPrivacyModalOpen = true;
  }

  closePrivacyModal(): void {
    this.isPrivacyModalOpen = false;
  }
}
