import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

type AdminNavItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-admin-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.sass',
})
export class Navbar {
  readonly navItems: AdminNavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Bookings', path: '/admin/bookings' },
    { label: 'Products', path: '/admin/products' },
    { label: 'Settings', path: '/admin/settings' },
  ];

  constructor(private readonly router: Router) {}

  get adminName(): string {
    return localStorage.getItem('fabyUserName') || localStorage.getItem('fabyUserEmail') || 'Admin';
  }

  async logout(): Promise<void> {
    localStorage.removeItem('fabyAuth');
    localStorage.removeItem('fabyPhoneAuth');
    localStorage.removeItem('fabyUserName');
    localStorage.removeItem('fabyUserEmail');
    localStorage.removeItem('fabyAdminAuth');
    await this.router.navigate(['/admin/login']);
  }

}
