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

type Room = {
  id: string;
  name: string;
  capacity: string;
  bedType: string;
  pricePerNight: number;
  description: string;
  amenities: string[];
  imageLabel: string;
  imageUrl?: string;
  isPopular?: boolean;
};

@Component({
  selector: 'app-roomlist',
  imports: [CommonModule, FormsModule],
  templateUrl: './roomlist.html',
  styleUrl: './roomlist.sass',
})
export class Roomlist implements OnInit {
  rooms: Room[] = [
    {
      id: 'deluxe-queen',
      name: 'Deluxe Queen Room',
      capacity: '2 Guests',
      bedType: '1 Queen Bed',
      pricePerNight: 1850,
      description: 'Cozy premium room with warm lighting and a relaxing garden-facing window.',
      amenities: ['Air conditioning', 'Private bathroom', 'Wi-Fi', 'Breakfast available'],
      imageLabel: 'Deluxe',
      isPopular: true,
    },
    {
      id: 'family-suite',
      name: 'Family Suite',
      capacity: '4 Guests',
      bedType: '2 Double Beds',
      pricePerNight: 2850,
      description: 'Spacious suite ideal for families with extra seating and a dining corner.',
      amenities: ['Air conditioning', 'Hot shower', 'Wi-Fi', 'Mini fridge'],
      imageLabel: 'Family',
    },
    {
      id: 'standard-twin',
      name: 'Standard Twin Room',
      capacity: '2 Guests',
      bedType: '2 Single Beds',
      pricePerNight: 1450,
      description: 'Practical and clean room perfect for quick stopovers and work trips.',
      amenities: ['Fan or AC option', 'Private bathroom', 'Wi-Fi', 'Cable TV'],
      imageLabel: 'Twin',
    },
    {
      id: 'barkada-loft',
      name: 'Barkada Loft Room',
      capacity: '6 Guests',
      bedType: '3 Double Mattresses',
      pricePerNight: 3350,
      description: 'Loft-style shared room designed for group travelers and weekend rides.',
      amenities: ['Air conditioning', 'Large bathroom', 'Wi-Fi', 'Common lounge access'],
      imageLabel: 'Barkada',
    },
  ];

  selectedRoomId = this.rooms[0].id;
  bookingStartDate = '';
  bookingReturnDate = '';

  constructor(private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.loadAdminRooms();
  }

  get selectedRoom(): Room {
    return this.rooms.find((room) => room.id === this.selectedRoomId) ?? this.rooms[0];
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
    return this.totalDays * this.selectedRoom.pricePerNight;
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
      motorcycleId: this.selectedRoom.id,
      motorcycleName: this.selectedRoom.name,
      dailyRate: this.selectedRoom.pricePerNight,
      startDate: this.bookingStartDate,
      returnDate: this.bookingReturnDate,
      totalDays: this.totalDays,
      totalAmount: this.totalAmount,
      bookingType: 'room',
      returnPath: '/room-list',
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

  private async loadAdminRooms(): Promise<void> {
    const fallbackRooms = this.rooms;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const mapped = Object.entries(data)
        .filter(([, product]) => product.category === 'inn' && Number(product.ratePerDay) > 0)
        .map(([id, product], index) => {
          const details = product.details ?? {};
          const maxGuests = Number(details['maxGuests'] ?? 0);
          const roomType = String(details['roomType'] ?? '').trim();
          const hasBreakfast = details['hasBreakfast'] === true;

          return {
            id,
            name: String(product.title || 'Inn Room'),
            capacity: maxGuests > 0 ? `${maxGuests} Guests` : 'Guest capacity available upon request',
            bedType: roomType || 'Standard Room',
            pricePerNight: Number(product.ratePerDay || 0),
            description: String(product.description || 'Comfortable room for your stay.'),
            amenities: [
              'Private bathroom',
              'Wi-Fi',
              hasBreakfast ? 'Breakfast included' : 'Breakfast available',
            ],
            imageLabel: roomType || 'Room',
            imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : '',
            isPopular: index === 0,
          };
        });

      if (mapped.length > 0) {
        this.rooms = mapped;
        this.selectedRoomId = mapped[0].id;
        return;
      }

      this.rooms = fallbackRooms;
    } catch {
      this.rooms = fallbackRooms;
    }
  }

}
