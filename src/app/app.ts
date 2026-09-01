import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, type Unsubscribe } from 'firebase/database';
import { applyTheme, getActiveThemePath, mergeThemeWithDefaults } from './shared/theme';

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
  selector: 'app-root',
  imports: [Navbar, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App implements OnDestroy {
  protected title = 'faby-front';
  private currentUrl = '';
  private readonly unsubscribeTheme: Unsubscribe;

  constructor(private readonly router: Router) {
    this.currentUrl = this.router.url;

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
      }
    });

    // Applies the admin's Website Builder theme (colors/fonts) for every visitor, live — or the
    // unpublished draft when this tab was opened via Settings' "Preview" button.
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);
    this.unsubscribeTheme = onValue(ref(db, getActiveThemePath()), (snapshot) => {
      applyTheme(mergeThemeWithDefaults(snapshot.val()));
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeTheme();
  }

  get showMainNavbar(): boolean {
    return !this.currentUrl.startsWith('/admin');
  }
}
