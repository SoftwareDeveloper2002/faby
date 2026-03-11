import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

type BookingDetails = {
  motorcycleId: string;
  motorcycleName: string;
  dailyRate: number;
  startDate: string;
  returnDate: string;
  totalDays: number;
  totalAmount: number;
  bookingType: string;
  returnPath: string;
};

@Component({
  selector: 'app-bookingconfirm',
  imports: [CommonModule, RouterLink],
  templateUrl: './bookingconfirm.html',
  styleUrl: './bookingconfirm.sass',
})
export class Bookingconfirm {
  booking: BookingDetails;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    const params = this.route.snapshot.queryParams;

    this.booking = {
      motorcycleId: String(params['motorcycleId'] ?? ''),
      motorcycleName: String(params['motorcycleName'] ?? 'Motorcycle Unit'),
      dailyRate: Number(params['dailyRate'] ?? 0),
      startDate: String(params['startDate'] ?? ''),
      returnDate: String(params['returnDate'] ?? ''),
      totalDays: Number(params['totalDays'] ?? 0),
      totalAmount: Number(params['totalAmount'] ?? 0),
      bookingType: String(params['bookingType'] ?? 'motorcycle'),
      returnPath: String(params['returnPath'] ?? '/motorcycle-list'),
    };

    if (!this.booking.motorcycleId || this.booking.totalDays <= 0 || this.booking.totalAmount <= 0) {
      void this.router.navigate([this.booking.returnPath]);
    }
  }

  proceedToPayment(): void {
    this.router.navigate(['/payment'], {
      queryParams: {
        ...this.booking,
      },
    });
  }
}
