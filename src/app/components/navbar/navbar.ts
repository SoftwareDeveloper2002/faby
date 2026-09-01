import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, onAuthStateChanged, getAuth } from 'firebase/auth';
import { getDatabase, onValue, ref, type Unsubscribe } from 'firebase/database';
import { DEFAULT_THEME, getActiveThemePath, mergeThemeWithDefaults } from '../../shared/theme';

type CategoryVisibility = {
  motorcycle: boolean;
  tent: boolean;
  table_chair: boolean;
  inn: boolean;
};

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

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.sass',
})
export class Navbar implements OnDestroy {
  isAuthenticated = false;
  userName = '';
  dropdownOpen = false;
  // Defaults to all-visible so links don't flash-hide before Firebase responds; an admin
  // toggling a category off in Settings updates this live for anyone already browsing.
  categoryVisibility: CategoryVisibility = {
    motorcycle: true,
    tent: true,
    table_chair: true,
    inn: true,
  };
  logoUrl = DEFAULT_THEME.logoUrl;
  private readonly routerSubscription: Subscription;
  private readonly auth: Auth;
  private readonly authSubscription: Subscription;
  private readonly unsubscribeVisibility: Unsubscribe;
  private readonly unsubscribeTheme: Unsubscribe;

  constructor(
    private readonly router: Router,
    private readonly elementRef: ElementRef<HTMLElement>,
  ) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(app);

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

    this.unsubscribeTheme = onValue(ref(db, getActiveThemePath()), (snapshot) => {
      this.logoUrl = mergeThemeWithDefaults(snapshot.val()).logoUrl;
    });

    this.syncAuthState();
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncAuthState();
      }
    });

    this.authSubscription = new Subscription();
    const unsubscribeAuth = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.isAuthenticated = true;
        this.userName = user.displayName || user.email || 'User';
        localStorage.setItem('fabyAuth', 'true');
        localStorage.setItem('fabyUserEmail', user.email || '');
        localStorage.setItem('fabyUserName', user.displayName || user.email || '');
        return;
      }

      this.syncAuthState();
    });
    this.authSubscription.add(unsubscribeAuth);
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
    this.authSubscription.unsubscribe();
    this.unsubscribeVisibility();
    this.unsubscribeTheme();
  }

  @HostListener('window:storage')
  onStorageChange(): void {
    this.syncAuthState();
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.syncAuthState();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dropdownOpen) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen = false;
    }
  }

  login(): void {
    this.router.navigate(['/login']);
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  goToProducts(): void {
    this.dropdownOpen = false;
    this.router.navigate(['/my-products']);
  }

  logout(): void {
    localStorage.removeItem('fabyAuth');
    localStorage.removeItem('fabyPhoneAuth');
    localStorage.removeItem('fabyUserEmail');
    localStorage.removeItem('fabyUserName');
    localStorage.removeItem('fabyPhoneNumber');

    this.dropdownOpen = false;
    this.syncAuthState();
    this.router.navigate(['/']);
  }

  get userInitials(): string {
    const words = this.userName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return 'U';
    }

    if (words.length === 1) {
      return words[0].slice(0, 1).toUpperCase();
    }

    return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
  }

  private syncAuthState(): void {
    const authFlag = localStorage.getItem('fabyAuth') === 'true' || localStorage.getItem('fabyPhoneAuth') === 'true';
    const storedName = localStorage.getItem('fabyUserName') || localStorage.getItem('fabyUserEmail') || localStorage.getItem('fabyPhoneNumber') || '';

    this.isAuthenticated = authFlag;
    this.userName = storedName || 'User';
  }

}
