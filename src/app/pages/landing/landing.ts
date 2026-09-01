import { Component, OnDestroy, OnInit } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, onValue, ref, type Unsubscribe } from 'firebase/database';

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
  ratePerDay: number;
};

type CategoryVisibility = {
  motorcycle: boolean;
  tent: boolean;
  table_chair: boolean;
  inn: boolean;
};

@Component({
  selector: 'app-landing',
  imports: [],
  templateUrl: './landing.html',
  styleUrl: './landing.sass',
})
export class Landing implements OnInit, OnDestroy {
  cheapestMotorcycleRate = 400;
  cheapestInnRate = 1450;
  cheapestTentRate = 150;
  cheapestTableChairRate = 1800;

  // Defaults to all-visible so sections don't flash-hide before Firebase responds; an admin
  // toggling a category off in Settings updates this live for anyone already on the page.
  categoryVisibility: CategoryVisibility = {
    motorcycle: true,
    tent: true,
    table_chair: true,
    inn: true,
  };

  private unsubscribeVisibility: Unsubscribe | null = null;

  async ngOnInit(): Promise<void> {
    this.subscribeToCategoryVisibility();
    await this.loadCheapestRates();
  }

  ngOnDestroy(): void {
    this.unsubscribeVisibility?.();
  }

  /** Builds the hero heading from whichever categories are actually turned on, instead of a
   *  hardcoded "Inn Booking and Motorcycle Rental" that goes stale the moment either is hidden. */
  get heroTitle(): string {
    const labels: string[] = [];
    if (this.categoryVisibility.inn) labels.push('Inn Booking');
    if (this.categoryVisibility.motorcycle) labels.push('Motorcycle Rental');
    if (this.categoryVisibility.tent) labels.push('Tent Rental');
    if (this.categoryVisibility.table_chair) labels.push('Event Rentals');

    if (labels.length === 0) return 'Monting Balay Rentals';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
  }

  get showBookingGrid(): boolean {
    return this.categoryVisibility.inn || this.categoryVisibility.motorcycle;
  }

  get showOtherProducts(): boolean {
    return this.categoryVisibility.tent || this.categoryVisibility.table_chair;
  }

  private subscribeToCategoryVisibility(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribeVisibility = onValue(ref(db, 'settings/categoryVisibility'), (snapshot) => {
      const data = (snapshot.val() ?? {}) as Partial<CategoryVisibility>;
      this.categoryVisibility = {
        motorcycle: data.motorcycle !== false,
        tent: data.tent !== false,
        table_chair: data.table_chair !== false,
        inn: data.inn !== false,
      };
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  private async loadCheapestRates(): Promise<void> {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.val() as Record<string, AdminProduct>;
      const products = Object.values(data).filter((product) => Number(product.ratePerDay) > 0);

      this.cheapestMotorcycleRate = this.getCheapestRate(products, 'motorcycle', this.cheapestMotorcycleRate);
      this.cheapestInnRate = this.getCheapestRate(products, 'inn', this.cheapestInnRate);
      this.cheapestTentRate = this.getCheapestRate(products, 'tent', this.cheapestTentRate);
      this.cheapestTableChairRate = this.getCheapestRate(products, 'table_chair', this.cheapestTableChairRate);
    } catch {
      // Keep fallback preview values.
    }
  }

  private getCheapestRate(products: AdminProduct[], category: string, fallback: number): number {
    const categoryRates = products
      .filter((product) => product.category === category)
      .map((product) => Number(product.ratePerDay))
      .filter((rate) => Number.isFinite(rate) && rate > 0);

    if (categoryRates.length === 0) {
      return fallback;
    }

    return Math.min(...categoryRates);
  }

}
