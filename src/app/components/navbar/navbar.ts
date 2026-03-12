import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.sass',
})
export class Navbar {
  isAuthenticated = false;
  userName = '';
  dropdownOpen = false;
  private readonly routerSubscription: Subscription;

  constructor(
    private readonly router: Router,
    private readonly elementRef: ElementRef<HTMLElement>,
  ) {
    this.syncAuthState();
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncAuthState();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
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

  goToProfile(): void {
    this.dropdownOpen = false;
    this.router.navigate(['/profile']);
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
