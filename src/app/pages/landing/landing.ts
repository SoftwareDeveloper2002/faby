import { Component, OnInit } from '@angular/core';
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
  ratePerDay: number;
};

@Component({
  selector: 'app-landing',
  imports: [],
  templateUrl: './landing.html',
  styleUrl: './landing.sass',
})
export class Landing implements OnInit {
  cheapestMotorcycleRate = 400;
  cheapestInnRate = 1450;
  cheapestTentRate = 150;
  cheapestTableChairRate = 1800;

  async ngOnInit(): Promise<void> {
    await this.loadCheapestRates();
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
