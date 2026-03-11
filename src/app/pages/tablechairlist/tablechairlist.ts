import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref } from 'firebase/database';

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

type AdminProduct = {
  category: string;
  title: string;
  description: string;
  ratePerDay: number;
  imageUrl?: string;
  details?: Record<string, string | number | boolean>;
};

type PackageItem = {
  id: string;
  name: string;
  includes: string;
  ratePerDay: number;
  recommendedFor: string;
  notes: string[];
  imageUrl?: string;
  isPopular?: boolean;
};

@Component({
  selector: 'app-tablechairlist',
  imports: [CommonModule, FormsModule],
  templateUrl: './tablechairlist.html',
  styleUrl: './tablechairlist.sass',
})
export class Tablechairlist implements OnInit {
  packages: PackageItem[] = [
    {
      id: 'small-party',
      name: 'Small Party Set',
      includes: '5 Tables + 30 Chairs',
      ratePerDay: 1800,
      recommendedFor: '25 to 35 guests',
      notes: ['Delivery within nearby area', 'Pickup after event', 'Clean units guaranteed'],
    },
    {
      id: 'event-standard',
      name: 'Event Standard Set',
      includes: '10 Tables + 60 Chairs',
      ratePerDay: 3200,
      recommendedFor: '50 to 70 guests',
      notes: ['Best for birthdays and seminars', 'Flexible arrangement', 'Delivery and pickup included'],
      isPopular: true,
    },
    {
      id: 'grand-function',
      name: 'Grand Function Set',
      includes: '20 Tables + 120 Chairs',
      ratePerDay: 6200,
      recommendedFor: '100 to 140 guests',
      notes: ['Ideal for weddings', 'Priority setup schedule', 'Bulk setup support'],
    },
  ];

  selectedPackageId = this.packages[0].id;
  bookingStartDate = '';
  bookingReturnDate = '';

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminTableChairProducts();
  }

  get selectedPackage(): PackageItem {
    return this.packages.find((item) => item.id === this.selectedPackageId) ?? this.packages[0];
  }

  get totalDays(): number {
    if (!this.bookingStartDate || !this.bookingReturnDate) {
      return 0;
    }

    const startDate = new Date(`${this.bookingStartDate}T00:00:00`);
    const returnDate = new Date(`${this.bookingReturnDate}T00:00:00`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(returnDate.getTime()) || returnDate < startDate) {
      return 0;
    }

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const dayDiff = Math.floor((returnDate.getTime() - startDate.getTime()) / millisecondsPerDay);

    return dayDiff + 1;
  }

  get totalAmount(): number {
    return this.totalDays * this.selectedPackage.ratePerDay;
  }

  get hasDateError(): boolean {
    if (!this.bookingStartDate || !this.bookingReturnDate) {
      return false;
    }

    return new Date(`${this.bookingReturnDate}T00:00:00`) < new Date(`${this.bookingStartDate}T00:00:00`);
  }

  get canProceedBooking(): boolean {
    return this.totalDays > 0 && !this.hasDateError;
  }

  proceedBooking(): void {
    if (!this.canProceedBooking) {
      return;
    }

    const bookingParams = {
      motorcycleId: this.selectedPackage.id,
      motorcycleName: this.selectedPackage.name,
      dailyRate: this.selectedPackage.ratePerDay,
      startDate: this.bookingStartDate,
      returnDate: this.bookingReturnDate,
      totalDays: this.totalDays,
      totalAmount: this.totalAmount,
      bookingType: 'table_chair',
      returnPath: '/table-chair-list',
    };

    const isLoggedIn = localStorage.getItem('fabyAuth') === 'true' || localStorage.getItem('fabyPhoneAuth') === 'true';

    if (!isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: {
          redirectTo: '/booking-confirm',
          ...bookingParams,
        },
      });
      return;
    }

    this.router.navigate(['/booking-confirm'], {
      queryParams: bookingParams,
    });
  }

  private async loadAdminTableChairProducts(): Promise<void> {
    const fallbackPackages = this.packages;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'table_chair' && Number(product.ratePerDay) > 0)
        .map(([id, product], index) => {
          const details = product.details ?? {};
          const tableCount = Number(details['tableCount'] ?? 0);
          const chairCount = Number(details['chairCount'] ?? 0);
          const material = String(details['material'] ?? '').trim();

          return {
            id,
            name: String(product.title || 'Tables & Chairs Set'),
            includes: `${tableCount > 0 ? tableCount : 'Varied'} Tables + ${chairCount > 0 ? chairCount : 'Varied'} Chairs`,
            ratePerDay: Number(product.ratePerDay || 0),
            recommendedFor: material ? `${material} setup` : 'Events and gatherings',
            notes: [
              String(product.description || 'Rental set for events.'),
              'Delivery and pickup options available',
              'Clean and ready-to-use units',
            ],
            imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
            isPopular: index === 0,
          };
        });

      if (mapped.length > 0) {
        this.packages = mapped;
        this.selectedPackageId = mapped[0].id;
        return;
      }

      this.packages = fallbackPackages;
    } catch {
      this.packages = fallbackPackages;
    }
  }
}
