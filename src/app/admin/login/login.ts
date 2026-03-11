import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.sass',
})
export class Login {
  email = '';
  password = '';
  isSigningIn = false;
  errorMessage = '';
  successMessage = '';

  private readonly auth: Auth;
  private readonly redirectTo: string;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(app);

    const queryParams = this.route.snapshot.queryParams;
    this.redirectTo = typeof queryParams['redirectTo'] === 'string'
      ? queryParams['redirectTo']
      : '/admin/dashboard';
  }

  async signInWithEmailPassword(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isSigningIn = true;

    try {
      const credential = await signInWithEmailAndPassword(
        this.auth,
        this.email.trim(),
        this.password,
      );

      const user = credential.user;
      localStorage.setItem('fabyAuth', 'true');
      localStorage.setItem('fabyPhoneAuth', 'true');
      localStorage.setItem('fabyUserEmail', user.email ?? this.email.trim());
      localStorage.setItem('fabyUserName', user.displayName ?? user.email ?? 'Admin');
      localStorage.setItem('fabyAdminAuth', 'true');

      this.successMessage = 'Login successful.';
      await this.router.navigate([this.redirectTo || '/']);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isSigningIn = false;
    }
  }

  private getErrorMessage(error: unknown): string {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError?.code === 'auth/invalid-email') {
      return 'Invalid email address.';
    }

    if (firebaseError?.code === 'auth/invalid-credential' || firebaseError?.code === 'auth/wrong-password') {
      return 'Incorrect email or password.';
    }

    if (firebaseError?.code === 'auth/user-disabled') {
      return 'This account has been disabled.';
    }

    if (firebaseError?.code === 'auth/too-many-requests') {
      return 'Too many attempts. Please try again later.';
    }

    if (firebaseError?.message) {
      return firebaseError.message;
    }

    return 'Unable to login right now. Please try again.';
  }

}
