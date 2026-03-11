import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
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
  storageBucket: 'faby-be0b9.firebasestorage.app',
  messagingSenderId: '71671731623',
  appId: '1:71671731623:web:6df23b47797e12b9aad282',
  measurementId: 'G-ZBZJKVWND9',
};

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.sass',
})
export class Login {
  isSigningIn = false;

  successMessage = '';
  errorMessage = '';

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
    this.isSigningIn = true;

    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      localStorage.setItem('fabyAuth', 'true');
      localStorage.setItem('fabyPhoneAuth', 'true');
      localStorage.setItem('fabyUserEmail', result.user.email ?? '');
      localStorage.setItem('fabyUserName', result.user.displayName ?? '');
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

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Something went wrong. Please try again.';
  }

}
