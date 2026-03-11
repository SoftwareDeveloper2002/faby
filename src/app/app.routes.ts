import { Routes } from '@angular/router';
import { Maintenance } from './pages/maintenance/maintenance';
import { Notfound } from './pages/notfound/notfound';

export const routes: Routes = [
  { path: '', component: Maintenance, title: 'Faby | Coming Soon' },
  { path: '**', component: Notfound, title: '404 | Page Not Found' },
];
