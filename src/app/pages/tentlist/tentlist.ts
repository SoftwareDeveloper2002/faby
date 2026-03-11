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

type TentUnit = {
  id: string;
  name: string;
  size: string;
  capacity: string;
  ratePerDay: number;
  description: string;
  inclusions: string[];
  imageUrl?: string;
  isPopular?: boolean;
};

@Component({
  selector: 'app-tentlist',
  imports: [CommonModule, FormsModule],
  templateUrl: './tentlist.html',
  styleUrl: './tentlist.sass',
})
export class Tentlist implements OnInit {
  tents: TentUnit[] = [
    {
      id: 'camp-solo-2p',
      name: 'Camping Tent Solo',
      size: 'Small Dome',
      capacity: '1 to 2 adults',
      ratePerDay: 150,
      description: 'Lightweight camping tent ideal for solo trips and quick overnight stays.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Carry bag'],
    },
    {
      id: 'camp-couple-3p',
      name: 'Camping Tent Couple',
      size: 'Medium Dome',
      capacity: '2 to 3 adults',
      ratePerDay: 250,
      description: 'Comfortable tent for couples or small groups with extra headroom.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Ventilated windows'],
      isPopular: true,
    },
    {
      id: 'camp-family-4p',
      name: 'Camping Tent Family',
      size: 'Large Cabin',
      capacity: '4 adults',
      ratePerDay: 350,
      description: 'Spacious family tent for multi-day outdoor trips with gear space.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Interior pockets'],
    },
    {
      id: 'camp-group-6p',
      name: 'Camping Tent Group',
      size: 'XL Cabin',
      capacity: '5 to 6 adults',
      ratePerDay: 450,
      description: 'Extra large camping tent for group adventures and weekend camps.',
      inclusions: ['Ground sheet', 'Rainfly cover', 'Reinforced poles'],
    },
  ];

  selectedTentId = '';
  startDate = '';
  returnDate = '';
  bookingError = '';

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminTents();
  }

  get selectedTent(): TentUnit | null {
    return this.tents.find((tent) => tent.id === this.selectedTentId) ?? null;
  }

  get totalDays(): number {
    if (!this.startDate || !this.returnDate) {
      return 0;
    }

    const start = new Date(`${this.startDate}T00:00:00`);
    const end = new Date(`${this.returnDate}T00:00:00`);
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / msPerDay);

    return Number.isFinite(diffDays) && diffDays > 0 ? diffDays : 0;
  }

  get totalAmount(): number {
    if (!this.selectedTent) {
      return 0;
    }

    return this.totalDays * this.selectedTent.ratePerDay;
  }

  selectTent(tentId: string): void {
    this.selectedTentId = tentId;
    this.bookingError = '';
  }

  proceedBooking(): void {
    this.bookingError = '';

    if (!this.selectedTent) {
      this.bookingError = 'Please select a tent before proceeding.';
      return;
    }

    if (!this.startDate || !this.returnDate) {
      this.bookingError = 'Please select your booking and return dates.';
      return;
    }

    if (this.totalDays <= 0) {
      this.bookingError = 'Return date must be later than the booking date.';
      return;
    }

    const isAuthenticated = localStorage.getItem('fabyAuth') === 'true' || localStorage.getItem('fabyPhoneAuth') === 'true';

    if (!isAuthenticated) {
      void this.router.navigate(['/login'], {
        queryParams: {
          redirectTo: '/booking-confirm',
          motorcycleId: this.selectedTent.id,
          motorcycleName: this.selectedTent.name,
          dailyRate: this.selectedTent.ratePerDay,
          startDate: this.startDate,
          returnDate: this.returnDate,
          totalDays: this.totalDays,
          totalAmount: this.totalAmount,
          bookingType: 'tent',
          returnPath: '/tent-list',
        },
      });
      return;
    }

    void this.router.navigate(['/booking-confirm'], {
      queryParams: {
        motorcycleId: this.selectedTent.id,
        motorcycleName: this.selectedTent.name,
        dailyRate: this.selectedTent.ratePerDay,
        startDate: this.startDate,
        returnDate: this.returnDate,
        totalDays: this.totalDays,
        totalAmount: this.totalAmount,
        bookingType: 'tent',
        returnPath: '/tent-list',
      },
    });
  }

  private async loadAdminTents(): Promise<void> {
    const fallbackTents = this.tents;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'tent' && Number(product.ratePerDay) > 0)
        .map(([id, product], index) => {
          const details = product.details ?? {};
          const size = String(details['size'] ?? '').trim();
          const capacity = String(details['capacity'] ?? '').trim();
          const weatherRating = String(details['weatherRating'] ?? '').trim();

          return {
            id,
            name: String(product.title || 'Camping Tent'),
            size: size || 'Camping Tent',
            capacity: capacity || 'Capacity details available on request',
            ratePerDay: Number(product.ratePerDay || 0),
            description: String(product.description || 'Reliable tent for outdoor rentals.'),
            inclusions: [
              'Carry bag',
              weatherRating || 'Weather-ready setup',
              'Ground sheet',
            ],
            imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
            isPopular: index === 0,
          };
        });

      if (mapped.length > 0) {
        this.tents = mapped;
        this.selectedTentId = mapped[0].id;
        return;
      }

      this.tents = fallbackTents;
    } catch {
      this.tents = fallbackTents;
    }
  }
}
