import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref } from 'firebase/database';
import { buildRentalBreakdown, parseDepositConfig, RentalBreakdown } from '../../shared/deposit';

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

type BookingDetails = {
  motorcycleId: string;
  motorcycleName: string;
  dailyRate: number;
  startDate: string;
  returnDate: string;
  totalDays: number;
  /** Rental cost only (days × daily rate) — before any deposit is added. */
  rentalSubtotal: number;
  bookingType: string;
  returnPath: string;
};

@Component({
  selector: 'app-bookingconfirm',
  imports: [CommonModule, RouterLink],
  templateUrl: './bookingconfirm.html',
  styleUrl: './bookingconfirm.sass',
})
export class Bookingconfirm implements OnInit {
  booking: BookingDetails;
  breakdown: RentalBreakdown;
  isLoadingDeposit = true;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    const params = this.route.snapshot.queryParams;
    const rentalSubtotal = Number(params['totalAmount'] ?? 0);

    this.booking = {
      motorcycleId: String(params['motorcycleId'] ?? ''),
      motorcycleName: String(params['motorcycleName'] ?? 'Motorcycle Unit'),
      dailyRate: Number(params['dailyRate'] ?? 0),
      startDate: String(params['startDate'] ?? ''),
      returnDate: String(params['returnDate'] ?? ''),
      totalDays: Number(params['totalDays'] ?? 0),
      rentalSubtotal,
      bookingType: String(params['bookingType'] ?? 'motorcycle'),
      returnPath: String(params['returnPath'] ?? '/motorcycle-list'),
    };

    // Reasonable placeholder until the real deposit config loads (no deposit).
    this.breakdown = {
      rentalSubtotal,
      depositAmount: 0,
      depositCycles: 0,
      totalAmount: rentalSubtotal,
    };

    if (!this.booking.motorcycleId || this.booking.totalDays <= 0 || this.booking.rentalSubtotal <= 0) {
      void this.router.navigate([this.booking.returnPath]);
    }
  }

  async ngOnInit(): Promise<void> {
    if (!this.booking.motorcycleId) {
      this.isLoadingDeposit = false;
      return;
    }

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, `productDeposits/${this.booking.motorcycleId}`));
      const config = snapshot.exists() ? parseDepositConfig(snapshot.val()) : null;

      this.breakdown = buildRentalBreakdown(this.booking.rentalSubtotal, config, this.booking.totalDays);
    } catch {
      // No deposit config reachable — proceed with rental-only total rather than blocking checkout.
      this.breakdown = buildRentalBreakdown(this.booking.rentalSubtotal, null, this.booking.totalDays);
    } finally {
      this.isLoadingDeposit = false;
    }
  }

  proceedToPayment(): void {
    this.router.navigate(['/payment'], {
      queryParams: {
        ...this.booking,
        depositAmount: this.breakdown.depositAmount,
        depositCycles: this.breakdown.depositCycles,
        totalAmount: this.breakdown.totalAmount,
      },
    });
  }
}
