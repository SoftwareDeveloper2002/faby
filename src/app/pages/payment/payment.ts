import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref } from 'firebase/database';
import { LegalModalComponent, LegalModalSection } from '../../components/legal-modal/legal-modal';

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

// Same Cloudinary account already used for product photos and the admin payment QR code.
const CLOUDINARY_CLOUD_NAME = 'srza69qv';
const CLOUDINARY_UPLOAD_PRESET = 'faby_admin_products';

type PaymentDetails = {
  motorcycleId: string;
  motorcycleName: string;
  totalDays: number;
  rentalSubtotal: number;
  depositAmount: number;
  depositCycles: number;
  totalAmount: number;
  startDate: string;
  returnDate: string;
  bookingType: string;
  returnPath: string;
};

type PaymentMethod = 'cash' | 'qr';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, LegalModalComponent],
  templateUrl: './payment.html',
  styleUrl: './payment.sass',
})
export class Payment implements OnInit {
  booking: PaymentDetails;
  selectedMethod: PaymentMethod = 'cash';
  referenceNote = '';
  isProcessing = false;
  errorMessage = '';
  hasAcceptedPolicies = false;
  isTermsModalOpen = false;
  isPrivacyModalOpen = false;

  // Admin-configured payment QR + instructions (Settings > Payment QR Code).
  qrCodeUrl = '';
  paymentInstructions = '';
  isLoadingQrCode = true;

  receiptPreview = '';
  private receiptFile: File | null = null;

  readonly termsSections: LegalModalSection[] = [
    {
      heading: 'Payment Authorization',
      paragraphs: [
        'By continuing, you confirm that the payment method selected belongs to you or is authorized for this booking.',
        'For QR transfers, you are responsible for sending the exact total amount shown and for uploading a clear, unedited receipt screenshot.',
      ],
    },
    {
      heading: 'Booking and Charge Terms',
      paragraphs: [
        'Confirmed payments are tied to your booking details, including selected item, dates, and total amount (rental plus any applicable deposit).',
        'QR transfer bookings are held as pending until an admin verifies your receipt. Cancellations, adjustments, and refunds are processed under Monting Balay policies.',
      ],
    },
  ];

  readonly privacySections: LegalModalSection[] = [
    {
      heading: 'Payment Data Handling',
      paragraphs: [
        'We store booking and payment-related metadata needed to complete and verify your reservation, including the receipt screenshot you upload for QR transfers.',
        'Your receipt image is only used to verify this booking and is visible to Monting Balay admins during review.',
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
      rentalSubtotal: Number(params['rentalSubtotal'] ?? params['totalAmount'] ?? 0),
      depositAmount: Number(params['depositAmount'] ?? 0),
      depositCycles: Number(params['depositCycles'] ?? 0),
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

  async ngOnInit(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'settings/payment'));
      const data = (snapshot.val() ?? {}) as { qrCodeUrl?: string; instructions?: string };
      this.qrCodeUrl = String(data.qrCodeUrl ?? '');
      this.paymentInstructions = String(data.instructions ?? '');
    } catch {
      this.qrCodeUrl = '';
      this.paymentInstructions = '';
    } finally {
      this.isLoadingQrCode = false;
    }
  }

  onReceiptSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.errorMessage = '';

    if (!file) {
      this.receiptFile = null;
      this.receiptPreview = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please upload a valid image (screenshot or photo) of your receipt.';
      this.receiptFile = null;
      this.receiptPreview = '';
      input.value = '';
      return;
    }

    this.receiptFile = file;
    this.receiptPreview = URL.createObjectURL(file);
  }

  async confirmPayment(): Promise<void> {
    this.errorMessage = '';

    if (!this.hasAcceptedPolicies) {
      this.errorMessage = 'You must agree to the Terms and Conditions and Privacy Policy before confirming payment.';
      return;
    }

    if (this.selectedMethod === 'cash') {
      await this.router.navigate(['/payment-success'], {
        queryParams: {
          ...this.booking,
          paymentMethod: 'cash',
          bank: '',
          source: 'cash_on_arrival',
        },
      });
      return;
    }

    if (!this.receiptFile) {
      this.errorMessage = 'Please upload a screenshot of your payment receipt.';
      return;
    }

    this.isProcessing = true;

    try {
      const receiptUrl = await this.uploadReceipt(this.receiptFile);

      await this.router.navigate(['/payment-success'], {
        queryParams: {
          ...this.booking,
          paymentMethod: 'qr_transfer',
          bank: '',
          source: 'qr_transfer_review',
          receiptUrl,
          referenceNote: this.referenceNote.trim(),
        },
      });
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async uploadReceipt(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'payment-receipts');
    formData.append('public_id', `receipt-${Date.now()}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error?.message ?? 'Receipt upload failed. Please try again.');
    }

    const data = await response.json();
    return data.secure_url as string;
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Unable to submit your payment right now. Please try again.';
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
