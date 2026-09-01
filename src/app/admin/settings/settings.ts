import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { getDatabase, onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
import { Navbar } from '../component/navbar/navbar';
import { DepositType } from '../../shared/deposit';
import {
  DEFAULT_THEME,
  FONT_PAIRINGS,
  mergeThemeWithDefaults,
  type FontPairingKey,
  type SiteTheme,
} from '../../shared/theme';

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

// Same Cloudinary account already used for product photos (unsigned upload — see products.ts).
const CLOUDINARY_CLOUD_NAME = 'srza69qv';
const CLOUDINARY_UPLOAD_PRESET = 'faby_admin_products';

type ProductCategory = 'motorcycle' | 'tent' | 'table_chair' | 'inn';

type AdminProductOption = {
  id: string;
  title: string;
  category: ProductCategory;
  ratePerDay: number;
};

type DepositRow = {
  productId: string;
  title: string;
  category: ProductCategory;
  ratePerDay: number;
  amount: number | null;
  type: DepositType;
  intervalDays: number | null;
  isSaving: boolean;
};

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './settings.html',
  styleUrl: './settings.sass',
})
export class Settings implements OnInit, OnDestroy {
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  isChangingPassword = false;
  passwordError = '';
  passwordSuccess = '';

  // Payment QR + instructions shown to customers on the /payment page.
  qrCodeUrl = '';
  qrCodePreview = '';
  paymentInstructions = '';
  isUploadingQr = false;
  isSavingInstructions = false;
  paymentSettingsError = '';
  paymentSettingsSuccess = '';

  // Per-product deposit rules.
  depositRows: DepositRow[] = [];
  isLoadingDeposits = true;
  depositError = '';
  depositSuccess = '';

  // Which category nav links are shown on the public site.
  readonly categoryNavItems: Array<{ value: ProductCategory; label: string }> = [
    { value: 'motorcycle', label: 'Motorcycle' },
    { value: 'inn', label: 'Rooms' },
    { value: 'tent', label: 'Tents' },
    { value: 'table_chair', label: 'Tables & Chair' },
  ];
  categoryVisibility: Record<ProductCategory, boolean> = {
    motorcycle: true,
    tent: true,
    table_chair: true,
    inn: true,
  };
  togglingCategory: ProductCategory | null = null;
  visibilityError = '';

  // Website Builder — brand colors, fonts, logo, and homepage text, with a draft/live split so
  // you can experiment safely and only push it to visitors once you're happy with it.
  draftTheme: SiteTheme = structuredClone(DEFAULT_THEME);
  liveTheme: SiteTheme = structuredClone(DEFAULT_THEME);
  readonly fontPairingOptions: Array<{ key: FontPairingKey; label: string }> = Object.entries(FONT_PAIRINGS).map(
    ([key, value]) => ({ key: key as FontPairingKey, label: value.label }),
  );
  logoPreview = '';
  isUploadingLogo = false;
  isSavingTheme = false;
  isPublishingTheme = false;
  themeError = '';
  themeSuccess = '';

  private hasDraftTheme = false;
  private logoFile: File | null = null;
  private qrCodeFile: File | null = null;
  private adminProducts: AdminProductOption[] = [];
  private productDeposits: Record<string, { amount: number; type: DepositType; intervalDays: number }> = {};
  private unsubscribePaymentSettings: Unsubscribe | null = null;
  private unsubscribeProducts: Unsubscribe | null = null;
  private unsubscribeDeposits: Unsubscribe | null = null;
  private unsubscribeVisibility: Unsubscribe | null = null;
  private unsubscribeLiveTheme: Unsubscribe | null = null;
  private unsubscribeDraftTheme: Unsubscribe | null = null;

  ngOnInit(): void {
    this.subscribeToPaymentSettings();
    this.subscribeToAdminProducts();
    this.subscribeToDeposits();
    this.subscribeToCategoryVisibility();
    this.subscribeToLiveTheme();
    this.subscribeToDraftTheme();
  }

  ngOnDestroy(): void {
    this.unsubscribePaymentSettings?.();
    this.unsubscribeProducts?.();
    this.unsubscribeDeposits?.();
    this.unsubscribeVisibility?.();
    this.unsubscribeLiveTheme?.();
    this.unsubscribeDraftTheme?.();
  }

  async changePassword(): Promise<void> {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordError = 'Please complete all password fields.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordError = 'New password must be at least 6 characters.';
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordError = 'New password and confirmation do not match.';
      return;
    }

    this.isChangingPassword = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const user = auth.currentUser;

      if (!user || !user.email) {
        this.passwordError = 'No active admin user found. Please login again.';
        return;
      }

      const credential = EmailAuthProvider.credential(user.email, this.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, this.newPassword);

      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.passwordSuccess = 'Password changed successfully.';
    } catch (error) {
      this.passwordError = this.getPasswordErrorMessage(error);
    } finally {
      this.isChangingPassword = false;
    }
  }

  onQrCodeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.paymentSettingsError = '';
    this.paymentSettingsSuccess = '';

    if (!file) {
      this.qrCodeFile = null;
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.paymentSettingsError = 'Please select a valid image file.';
      this.qrCodeFile = null;
      input.value = '';
      return;
    }

    this.qrCodeFile = file;
    this.qrCodePreview = URL.createObjectURL(file);
  }

  async saveQrCode(): Promise<void> {
    if (!this.qrCodeFile) {
      this.paymentSettingsError = 'Choose a QR code image first.';
      return;
    }

    this.isUploadingQr = true;
    this.paymentSettingsError = '';
    this.paymentSettingsSuccess = '';

    try {
      const uploadedUrl = await this.uploadImage(this.qrCodeFile, 'payment-settings', `qr-code-${Date.now()}`);
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      await update(ref(db, 'settings/payment'), { qrCodeUrl: uploadedUrl });

      this.qrCodeFile = null;
      this.qrCodePreview = '';
      this.paymentSettingsSuccess = 'Payment QR code updated.';
    } catch (error) {
      this.paymentSettingsError = this.getErrorMessage(error);
    } finally {
      this.isUploadingQr = false;
    }
  }

  async saveInstructions(): Promise<void> {
    this.isSavingInstructions = true;
    this.paymentSettingsError = '';
    this.paymentSettingsSuccess = '';

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      await update(ref(db, 'settings/payment'), { instructions: this.paymentInstructions.trim() });
      this.paymentSettingsSuccess = 'Payment instructions saved.';
    } catch (error) {
      this.paymentSettingsError = this.getErrorMessage(error);
    } finally {
      this.isSavingInstructions = false;
    }
  }

  onDepositTypeChanged(row: DepositRow): void {
    if (row.type === 'recurring' && !row.intervalDays) {
      row.intervalDays = 7;
    }
  }

  async saveDepositRow(row: DepositRow): Promise<void> {
    this.depositError = '';
    this.depositSuccess = '';

    if (row.amount !== null && row.amount < 0) {
      this.depositError = `Deposit amount for ${row.title} cannot be negative.`;
      return;
    }

    if (row.type === 'recurring' && (!row.intervalDays || row.intervalDays <= 0)) {
      this.depositError = `Set a valid interval (in days) for ${row.title}.`;
      return;
    }

    row.isSaving = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);

      if (!row.amount || row.amount <= 0) {
        // Treat "0 / empty" as "no deposit required" and clear any stored rule.
        await update(ref(db, `productDeposits/${row.productId}`), {
          amount: 0,
          type: row.type,
          intervalDays: row.intervalDays ?? 7,
        });
      } else {
        await update(ref(db, `productDeposits/${row.productId}`), {
          amount: row.amount,
          type: row.type,
          intervalDays: row.type === 'recurring' ? row.intervalDays : 7,
        });
      }

      this.depositSuccess = `Deposit rule saved for ${row.title}.`;
    } catch (error) {
      this.depositError = this.getErrorMessage(error);
    } finally {
      row.isSaving = false;
    }
  }

  /** Flips one category's public visibility immediately — no separate Save step, same as the
   *  per-product show/hide switch on Admin Products, and for the same reason: a toggle that
   *  needs a Save click is a toggle people forget to actually apply. */
  async toggleCategoryVisibility(category: ProductCategory): Promise<void> {
    this.visibilityError = '';
    const nextValue = !this.categoryVisibility[category];
    this.togglingCategory = category;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      await update(ref(db, 'settings/categoryVisibility'), { [category]: nextValue });
    } catch (error) {
      this.visibilityError = this.getErrorMessage(error);
    } finally {
      this.togglingCategory = null;
    }
  }

  private subscribeToCategoryVisibility(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribeVisibility = onValue(ref(db, 'settings/categoryVisibility'), (snapshot) => {
      const data = (snapshot.val() ?? {}) as Partial<Record<ProductCategory, boolean>>;
      this.categoryVisibility = {
        motorcycle: data.motorcycle !== false,
        tent: data.tent !== false,
        table_chair: data.table_chair !== false,
        inn: data.inn !== false,
      };
    });
  }

  /** Persists whatever's currently in `draftTheme` — call this after any field changes. Only
   *  affects tabs opened with ?theme_preview=1 (the Settings "Preview" button) until Published. */
  async saveDraftTheme(): Promise<void> {
    this.themeError = '';
    this.themeSuccess = '';
    this.isSavingTheme = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      await set(ref(db, 'settings/theme/draft'), this.draftTheme);
      this.hasDraftTheme = true;
    } catch (error) {
      this.themeError = this.getErrorMessage(error);
    } finally {
      this.isSavingTheme = false;
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.themeError = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.themeError = 'Please select a valid image file.';
      input.value = '';
      return;
    }

    this.logoFile = file;
    this.logoPreview = URL.createObjectURL(file);
  }

  async saveLogo(): Promise<void> {
    if (!this.logoFile) {
      this.themeError = 'Choose a logo image first.';
      return;
    }

    this.isUploadingLogo = true;
    this.themeError = '';
    this.themeSuccess = '';

    try {
      const uploadedUrl = await this.uploadImage(this.logoFile, 'site-theme', `logo-${Date.now()}`);
      this.draftTheme.logoUrl = uploadedUrl;
      await this.saveDraftTheme();
      this.logoFile = null;
      this.logoPreview = '';
    } catch (error) {
      this.themeError = this.getErrorMessage(error);
    } finally {
      this.isUploadingLogo = false;
    }
  }

  /** Opens the real homepage in a new tab rendering your unpublished draft, so you can check it
   *  looks right before anyone else sees it. */
  openThemePreview(): void {
    window.open('/?theme_preview=1', '_blank', 'noopener');
  }

  /** Makes the current draft what every visitor sees. */
  async publishTheme(): Promise<void> {
    this.themeError = '';
    this.themeSuccess = '';
    this.isPublishingTheme = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      await set(ref(db, 'settings/theme/live'), this.draftTheme);
      this.themeSuccess = 'Published! Your site now shows these changes to everyone.';
    } catch (error) {
      this.themeError = this.getErrorMessage(error);
    } finally {
      this.isPublishingTheme = false;
    }
  }

  /** Throws away unpublished experiments and goes back to what's currently live. */
  async discardDraftTheme(): Promise<void> {
    this.themeError = '';
    this.themeSuccess = '';
    this.draftTheme = structuredClone(this.liveTheme);
    await this.saveDraftTheme();
  }

  private subscribeToLiveTheme(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribeLiveTheme = onValue(ref(db, 'settings/theme/live'), (snapshot) => {
      this.liveTheme = mergeThemeWithDefaults(snapshot.val());
      if (!this.hasDraftTheme) {
        // No experiment started yet — start editing from what's currently published.
        this.draftTheme = structuredClone(this.liveTheme);
      }
    });
  }

  private subscribeToDraftTheme(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribeDraftTheme = onValue(ref(db, 'settings/theme/draft'), (snapshot) => {
      if (snapshot.exists()) {
        this.hasDraftTheme = true;
        this.draftTheme = mergeThemeWithDefaults(snapshot.val());
      }
    });
  }

  private subscribeToPaymentSettings(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribePaymentSettings = onValue(ref(db, 'settings/payment'), (snapshot) => {
      const data = (snapshot.val() ?? {}) as { qrCodeUrl?: string; instructions?: string };
      this.qrCodeUrl = String(data.qrCodeUrl ?? '');
      this.paymentInstructions = String(data.instructions ?? '');
    });
  }

  private subscribeToAdminProducts(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribeProducts = onValue(ref(db, 'adminProducts'), (snapshot) => {
      const data = (snapshot.val() ?? {}) as Record<string, Partial<AdminProductOption>>;
      this.adminProducts = Object.entries(data)
        .map(([id, value]) => ({
          id,
          title: String(value.title ?? 'Untitled product'),
          category: this.normalizeCategory(String(value.category ?? 'motorcycle')),
          ratePerDay: Number(value.ratePerDay ?? 0),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      this.rebuildDepositRows();
    });
  }

  private subscribeToDeposits(): void {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);

    this.unsubscribeDeposits = onValue(ref(db, 'productDeposits'), (snapshot) => {
      const data = (snapshot.val() ?? {}) as Record<string, { amount?: unknown; type?: unknown; intervalDays?: unknown }>;
      this.productDeposits = Object.fromEntries(
        Object.entries(data).map(([id, value]) => [
          id,
          {
            amount: Number(value.amount ?? 0),
            type: value.type === 'recurring' ? 'recurring' : 'one_time' as DepositType,
            intervalDays: Number(value.intervalDays ?? 7),
          },
        ]),
      );

      this.isLoadingDeposits = false;
      this.rebuildDepositRows();
    });
  }

  private rebuildDepositRows(): void {
    this.depositRows = this.adminProducts.map((product) => {
      const existing = this.productDeposits[product.id];
      return {
        productId: product.id,
        title: product.title,
        category: product.category,
        ratePerDay: product.ratePerDay,
        amount: existing && existing.amount > 0 ? existing.amount : null,
        type: existing?.type ?? 'one_time',
        intervalDays: existing?.intervalDays ?? 7,
        isSaving: false,
      };
    });
  }

  private async uploadImage(file: File, folder: string, publicId: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);
    formData.append('public_id', publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error?.message ?? 'Image upload failed. Please try again.');
    }

    const data = await response.json();
    return data.secure_url as string;
  }

  private normalizeCategory(value: string): ProductCategory {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'inn' || normalized === 'tent' || normalized === 'table_chair') {
      return normalized as ProductCategory;
    }

    return 'motorcycle';
  }

  getCategoryLabel(category: ProductCategory): string {
    if (category === 'inn') return 'Inn Rental';
    if (category === 'tent') return 'Camping Tent Rental';
    if (category === 'table_chair') return 'Tables & Chairs Rental';
    return 'Motorcycle Rental';
  }

  private getPasswordErrorMessage(error: unknown): string {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError?.code === 'auth/wrong-password' || firebaseError?.code === 'auth/invalid-credential') {
      return 'Current password is incorrect.';
    }

    if (firebaseError?.code === 'auth/too-many-requests') {
      return 'Too many attempts. Please wait and try again.';
    }

    if (firebaseError?.code === 'auth/requires-recent-login') {
      return 'Please login again before changing password.';
    }

    if (firebaseError?.message) {
      return firebaseError.message;
    }

    return 'Unable to change password right now.';
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Something went wrong. Please try again.';
  }

}
