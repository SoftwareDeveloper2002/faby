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

type Motorcycle = {
  id: string;
  name: string;
  dailyRate: number;
  helmetIncluded: boolean;
  imageUrl?: string;
};

@Component({
  selector: 'app-motorcyclelist',
  imports: [CommonModule, FormsModule],
  templateUrl: './motorcyclelist.html',
  styleUrl: './motorcyclelist.sass',
})
export class Motorcyclelist implements OnInit {
  motorcycles: Motorcycle[] = [
    { id: 'click-125i', name: 'Honda Click 125i', dailyRate: 500, helmetIncluded: true, imageUrl: '/faby.png' },
    { id: 'beat', name: 'Honda Beat', dailyRate: 400, helmetIncluded: true, imageUrl: '/faby.png' },
    { id: 'nmax', name: 'Yamaha NMAX', dailyRate: 650, helmetIncluded: true, imageUrl: '/faby.png' },
  ];

  isLoading = true;

  selectedMotorcycleId = this.motorcycles[0].id;
  bookingStartDate = '';
  bookingReturnDate = '';

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminMotorcycles();
  }

  get selectedMotorcycle(): Motorcycle {
    return this.motorcycles.find((motorcycle) => motorcycle.id === this.selectedMotorcycleId) ?? this.motorcycles[0];
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
    return this.totalDays * this.selectedMotorcycle.dailyRate;
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
    if (!this.selectedMotorcycle) {
      return;
    }

    if (!this.canProceedBooking) {
      return;
    }

    const bookingParams = {
      motorcycleId: this.selectedMotorcycle.id,
      motorcycleName: this.selectedMotorcycle.name,
      dailyRate: this.selectedMotorcycle.dailyRate,
      startDate: this.bookingStartDate,
      returnDate: this.bookingReturnDate,
      totalDays: this.totalDays,
      totalAmount: this.totalAmount,
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

  private async loadAdminMotorcycles(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'motorcycle' && Number(product.ratePerDay) > 0)
        .map(([id, product]) => ({
          id,
          name: String(product.title || 'Motorcycle Unit'),
          dailyRate: Number(product.ratePerDay || 0),
          helmetIncluded: product.details?.['helmetIncluded'] === false ? false : true,
          imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
        }));

      if (mapped.length > 0) {
        this.motorcycles = mapped;
        this.selectedMotorcycleId = mapped[0].id;
      }
    } finally {
      this.isLoading = false;
    }
  }

}
