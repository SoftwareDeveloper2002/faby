import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD5DVdin4xLlT86KIiXy2wetJ04fyEeWBA',
  authDomain: 'faby-be0b9.firebaseapp.com',
  projectId: 'faby-be0b9',
  storageBucket: 'faby-be0b9.firebasestorage.app',
  messagingSenderId: '71671731623',
  appId: '1:71671731623:web:6df23b47797e12b9aad282',
  measurementId: 'G-ZBZJKVWND9',
};

type AdminNavItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-admin-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.sass',
})
export class Navbar {
  readonly navItems: AdminNavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Bookings', path: '/admin/bookings' },
    { label: 'Products', path: '/admin/products' },
    { label: 'Payments', path: '/admin/payments' },
    { label: 'Settings', path: '/admin/settings' },
  ];

  constructor(private readonly router: Router) {}

  get adminName(): string {
    return localStorage.getItem('fabyUserName') || localStorage.getItem('fabyUserEmail') || 'Admin';
  }

  async logout(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      // Actually end the Firebase session — the route guard checks this, not just the
      // localStorage flags below, so signing out here is what makes "Logout" stick.
      await signOut(getAuth(app));
    } catch {
      // Even if sign-out fails (e.g. offline), still clear local flags and navigate away below.
    }

    localStorage.removeItem('fabyAuth');
    localStorage.removeItem('fabyPhoneAuth');
    localStorage.removeItem('fabyUserName');
    localStorage.removeItem('fabyUserEmail');
    localStorage.removeItem('fabyAdminAuth');
    await this.router.navigate(['/admin/login']);
  }

}
