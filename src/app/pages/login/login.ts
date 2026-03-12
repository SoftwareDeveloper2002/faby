import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LegalModalComponent, LegalModalSection } from '../../components/legal-modal/legal-modal';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import {
  Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
} from 'firebase/auth';

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

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, LegalModalComponent],
  templateUrl: './login.html',
  styleUrl: './login.sass',
})
export class Login {
  isSigningIn = false;
  hasAcceptedPolicies = false;
  isTermsModalOpen = false;
  isPrivacyModalOpen = false;

  successMessage = '';
  errorMessage = '';

  readonly termsSections: LegalModalSection[] = [
    {
      heading: 'Acceptance of Terms',
      paragraphs: [
        'By signing in, you agree to use Faby booking services only for lawful and valid reservation purposes.',
        'You are responsible for the accuracy of details submitted during booking and payment.',
      ],
    },
    {
      heading: 'Booking Rules',
      paragraphs: [
        'Bookings are subject to product availability and confirmation by the system records.',
        'Admin may update booking status to cancelled when policy violations or invalid payment activity is detected.',
      ],
    },
    {
      heading: 'Payments and Cancellations',
      paragraphs: [
        'Payment method and payment status must reflect true transaction outcomes.',
        'Refund and cancellation handling follow Monting Balay booking policies and applicable local regulations.',
      ],
    },
  ];

  readonly privacySections: LegalModalSection[] = [
    {
      heading: 'Information We Store',
      paragraphs: [
        'We store booking details such as email, selected product, rental dates, payment method, and total amount.',
        'These records are used for booking fulfillment, support, and administrative reporting.',
      ],
    },
    {
      heading: 'How Data Is Used',
      paragraphs: [
        'Your data is used to process bookings, verify payment status, and manage your reservation lifecycle.',
        'Administrative users may view and update booking records only for operational purposes.',
      ],
    },
    {
      heading: 'Security and Retention',
      paragraphs: [
        'Reasonable safeguards are applied to protect booking data stored in the configured backend services.',
        'Data retention follows operational and legal requirements for transaction and audit records.',
      ],
    },
  ];

  private readonly auth: Auth;
  private readonly googleProvider: GoogleAuthProvider;
  private readonly redirectTo: string;
  private readonly redirectQueryParams: Record<string, string>;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    this.googleProvider = new GoogleAuthProvider();

    const queryParams = this.route.snapshot.queryParams;
    this.redirectTo = typeof queryParams['redirectTo'] === 'string' ? queryParams['redirectTo'] : '';

    this.redirectQueryParams = {};
    Object.entries(queryParams).forEach(([key, value]) => {
      if (key === 'redirectTo') {
        return;
      }

      if (typeof value === 'string') {
        this.redirectQueryParams[key] = value;
      }
    });
  }

  async signInWithGoogle(): Promise<void> {
    this.resetMessages();

    if (!this.hasAcceptedPolicies) {
      this.errorMessage = 'You must agree to the Terms and Privacy Policy before logging in.';
      return;
    }

    this.isSigningIn = true;

    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      localStorage.setItem('fabyAuth', 'true');
      localStorage.setItem('fabyPhoneAuth', 'true');
      localStorage.setItem('fabyUserEmail', result.user.email ?? '');
      localStorage.setItem('fabyUserName', result.user.displayName ?? '');

      const db = getDatabase(getApp(), firebaseConfig.databaseURL);
      await set(ref(db, `appUsers/${result.user.uid}`), {
        email: result.user.email ?? '',
        displayName: result.user.displayName ?? '',
        provider: 'google',
        updatedAt: new Date().toISOString(),
      });

      this.successMessage = `Login successful. Welcome, ${result.user.displayName ?? 'guest'}!`;

      if (this.redirectTo) {
        await this.router.navigate([this.redirectTo], { queryParams: this.redirectQueryParams });
        return;
      }

      await this.router.navigate(['/']);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isSigningIn = false;
    }
  }

  private resetMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
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

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Something went wrong. Please try again.';
  }

}
