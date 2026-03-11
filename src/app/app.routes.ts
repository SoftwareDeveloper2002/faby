import { Routes } from '@angular/router';
import { Dasboard } from './admin/dasboard/dasboard';
import { Login as AdminLogin } from './admin/login/login';
import { Products } from './admin/products/products';
import { Settings } from './admin/settings/settings';
import { Bookingconfirm } from './pages/bookingconfirm/bookingconfirm';
import { Landing } from './pages/landing/landing';
import { Login } from './pages/login/login';
import { Maintenance } from './pages/maintenance/maintenance';
import { Motorcyclelist } from './pages/motorcyclelist/motorcyclelist';
import { Myproducts } from './pages/myproducts/myproducts';
import { Notfound } from './pages/notfound/notfound';
import { Payment } from './pages/payment/payment';
import { Paymentfailed } from './pages/paymentfailed/paymentfailed';
import { Paymentsuccess } from './pages/paymentsuccess/paymentsuccess';
import { Roomlist } from './pages/roomlist/roomlist';
import { Tablechairlist } from './pages/tablechairlist/tablechairlist';
import { Tentlist } from './pages/tentlist/tentlist';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Monting Balay | Booking and Rentals' },
  { path: 'motorcycle-list', component: Motorcyclelist, title: 'Monting Balay | Motorcycle Rental' },
  { path: 'room-list', component: Roomlist, title: 'Monting Balay | Room List' },
  { path: 'tent-list', component: Tentlist, title: 'Monting Balay | Tent List' },
  { path: 'table-chair-list', component: Tablechairlist, title: 'Monting Balay | Table and Chair List' },
  { path: 'profile', component: Maintenance, title: 'Faby | Profile' },
  { path: 'my-products', component: Myproducts, title: 'Faby | My Products' },
  { path: 'booking-confirm', component: Bookingconfirm, title: 'Monting Balay | Confirm Booking' },
  { path: 'payment', component: Payment, title: 'Monting Balay | Payment' },
  { path: 'payment-success', component: Paymentsuccess, title: 'Monting Balay | Payment Success' },
  { path: 'payment-failed', component: Paymentfailed, title: 'Monting Balay | Payment Failed' },
  { path: 'login', component: Login, title: 'Faby | Login' },
  { path: 'admin/login', component: AdminLogin, title: 'Monting Balay | Admin Login' },
  { path: 'admin/dashboard', component: Dasboard, title: 'Monting Balay | Admin Dashboard' },
  { path: 'admin/products', component: Products, title: 'Monting Balay | Admin Products' },
  { path: 'admin/settings', component: Settings, title: 'Monting Balay | Admin Settings' },
  { path: 'maintenance', component: Maintenance, title: 'Faby | Coming Soon' },
  { path: '**', component: Notfound, title: '404 | Page Not Found' },
];
