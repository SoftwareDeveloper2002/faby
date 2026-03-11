import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { Navbar } from '../component/navbar/navbar';

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
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './settings.html',
  styleUrl: './settings.sass',
})
export class Settings {
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  isChangingPassword = false;
  passwordError = '';
  passwordSuccess = '';

  async changePassword(): Promise<void> {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordError = 'Please complete all password fields.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordError = 'New password must be at least 6 characters.';
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordError = 'New password and confirmation do not match.';
      return;
    }

    this.isChangingPassword = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const user = auth.currentUser;

      if (!user || !user.email) {
        this.passwordError = 'No active admin user found. Please login again.';
        return;
      }

      const credential = EmailAuthProvider.credential(user.email, this.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, this.newPassword);

      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.passwordSuccess = 'Password changed successfully.';
    } catch (error) {
      this.passwordError = this.getPasswordErrorMessage(error);
    } finally {
      this.isChangingPassword = false;
    }
  }

  private getPasswordErrorMessage(error: unknown): string {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError?.code === 'auth/wrong-password' || firebaseError?.code === 'auth/invalid-credential') {
      return 'Current password is incorrect.';
    }

    if (firebaseError?.code === 'auth/too-many-requests') {
      return 'Too many attempts. Please wait and try again.';
    }

    if (firebaseError?.code === 'auth/requires-recent-login') {
      return 'Please login again before changing password.';
    }

    if (firebaseError?.message) {
      return firebaseError.message;
    }

    return 'Unable to change password right now.';
  }

}
