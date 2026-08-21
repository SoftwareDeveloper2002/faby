import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD5DVdin4xLlT86KIiXy2wetJ04fyEeWBA',
  authDomain: 'faby-be0b9.firebaseapp.com',
  projectId: 'faby-be0b9',
  storageBucket: 'faby-be0b9.firebasestorage.app',
  messagingSenderId: '71671731623',
  appId: '1:71671731623:web:6df23b47797e12b9aad282',
  measurementId: 'G-ZBZJKVWND9',
};

/**
 * Guards every /admin/* route except /admin/login itself.
 *
 * Admins sign in with email + password (see admin/login). Customers only ever sign in with
 * Google (see pages/login) — never email/password, and there is no self-registration flow for
 * it anywhere in the app. Firebase Auth exposes which provider was used for the current
 * session, so this checks for the 'password' provider specifically: a signed-in Google customer
 * fails it, and so does a visitor who merely fakes the legacy `fabyAdminAuth` localStorage flag
 * in devtools without ever actually signing in. That flag is now display-only (admin name in the
 * navbar) — it is never treated as a security boundary by itself.
 */
export const adminAuthGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  const user = await new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      unsubscribe();
      resolve(nextUser);
    });
  });

  const isAdminSession = user?.providerData.some((provider) => provider.providerId === 'password') ?? false;

  if (isAdminSession) {
    return true;
  }

  localStorage.removeItem('fabyAdminAuth');
  return router.createUrlTree(['/admin/login'], { queryParams: { redirectTo: state.url } });
};
