import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../component/navbar/navbar';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, push, ref, remove, set, update } from 'firebase/database';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';

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

type ProductCategory = 'motorcycle' | 'tent' | 'table_chair' | 'inn';

type AdminProduct = {
  id: string;
  category: ProductCategory;
  title: string;
  description: string;
  ratePerDay: number;
  imageUrl?: string;
  isRental: boolean;
  details: Record<string, string | number | boolean>;
  createdAt: string;
};

type ProductFormModel = {
  category: ProductCategory;
  title: string;
  description: string;
  ratePerDay: number | null;
  motorcycleEngineCc: number | null;
  motorcycleTransmission: string;
  motorcycleHelmetIncluded: boolean;
  tentCapacity: string;
  tentSize: string;
  tentWeatherRating: string;
  tableCount: number | null;
  chairCount: number | null;
  tableChairMaterial: string;
  innRoomType: string;
  innMaxGuests: number | null;
  innHasBreakfast: boolean;
};

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './products.html',
  styleUrl: './products.sass',
})
export class Products implements OnInit {
  isLoading = true;
  isSaving = false;
  isUpdating = false;
  deletingProductId = '';
  isEditModalOpen = false;
  editingProductId = '';
  addImagePreview = '';
  editImagePreview = '';
  errorMessage = '';
  successMessage = '';

  private addImageFile: File | null = null;
  private editImageFile: File | null = null;

  products: AdminProduct[] = [];

  readonly categories: Array<{ value: ProductCategory; label: string }> = [
    { value: 'motorcycle', label: 'Motorcycle Rental' },
    { value: 'tent', label: 'Camping Tent Rental' },
    { value: 'table_chair', label: 'Tables & Chairs Rental' },
    { value: 'inn', label: 'Inn Rental' },
  ];

  form: ProductFormModel = this.createDefaultForm();
  editForm: ProductFormModel = this.createDefaultForm();

  async ngOnInit(): Promise<void> {
    await this.loadProducts();
  }

  onCategoryChange(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  async addProduct(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.form.title.trim() || !this.form.description.trim()) {
      this.errorMessage = 'Title and description are required.';
      return;
    }

    if (!this.form.ratePerDay || this.form.ratePerDay <= 0) {
      this.errorMessage = 'Rate per day must be greater than zero.';
      return;
    }

    this.isSaving = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const productRef = push(ref(db, 'adminProducts'));
      const imageUrl = this.addImageFile
        ? await this.uploadProductImage(app, this.addImageFile, productRef.key ?? crypto.randomUUID())
        : '';

      const payload: Omit<AdminProduct, 'id'> = {
        category: this.form.category,
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        ratePerDay: this.form.ratePerDay,
        imageUrl,
        isRental: true,
        details: this.buildCategoryDetails(this.form),
        createdAt: new Date().toISOString(),
      };

      await set(productRef, payload);

      this.products = [{ id: productRef.key ?? crypto.randomUUID(), ...payload }, ...this.products];
      this.form = this.createDefaultForm();
      this.addImageFile = null;
      this.addImagePreview = '';
      this.successMessage = 'Product added successfully.';
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isSaving = false;
    }
  }

  openEditModal(product: AdminProduct): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.editingProductId = product.id;
    this.editForm = this.createFormFromProduct(product);
    this.editImageFile = null;
    this.editImagePreview = product.imageUrl ?? '';
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.editingProductId = '';
    this.editForm = this.createDefaultForm();
    this.editImageFile = null;
    this.editImagePreview = '';
  }

  async updateProduct(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.editingProductId) {
      this.errorMessage = 'No selected product to update.';
      return;
    }

    if (!this.editForm.title.trim() || !this.editForm.description.trim()) {
      this.errorMessage = 'Title and description are required.';
      return;
    }

    if (!this.editForm.ratePerDay || this.editForm.ratePerDay <= 0) {
      this.errorMessage = 'Rate per day must be greater than zero.';
      return;
    }

    this.isUpdating = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const currentProduct = this.products.find((product) => product.id === this.editingProductId);
      const imageUrl = this.editImageFile
        ? await this.uploadProductImage(app, this.editImageFile, this.editingProductId)
        : (currentProduct?.imageUrl ?? '');
      const payload = {
        category: this.editForm.category,
        title: this.editForm.title.trim(),
        description: this.editForm.description.trim(),
        ratePerDay: this.editForm.ratePerDay,
        imageUrl,
        isRental: true,
        details: this.buildCategoryDetails(this.editForm),
      };

      await update(ref(db, `adminProducts/${this.editingProductId}`), payload);

      this.products = this.products.map((product) => {
        if (product.id !== this.editingProductId) {
          return product;
        }

        return {
          ...product,
          ...payload,
        };
      });

      this.successMessage = 'Product updated successfully.';
      this.closeEditModal();
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isUpdating = false;
    }
  }

  async deleteProduct(product: AdminProduct): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    const shouldDelete = window.confirm(`Delete ${product.title}? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    this.deletingProductId = product.id;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      await remove(ref(db, `adminProducts/${product.id}`));

      this.products = this.products.filter((item) => item.id !== product.id);
      this.successMessage = 'Product deleted successfully.';

      if (this.editingProductId === product.id) {
        this.closeEditModal();
      }
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.deletingProductId = '';
    }
  }

  getCategoryLabel(category: ProductCategory): string {
    return this.categories.find((item) => item.value === category)?.label ?? category;
  }

  getDetailEntries(product: AdminProduct): Array<{ key: string; value: string | number | boolean }> {
    return Object.entries(product.details)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => ({ key, value }));
  }

  formatRate(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatDetailLabel(label: string): string {
    return label
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
  }

  onAddImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.addImageFile = null;
      this.addImagePreview = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select a valid image file.';
      this.addImageFile = null;
      this.addImagePreview = '';
      input.value = '';
      return;
    }

    this.addImageFile = file;
    this.addImagePreview = URL.createObjectURL(file);
    this.errorMessage = '';
  }

  onEditImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.editImageFile = null;
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select a valid image file.';
      this.editImageFile = null;
      input.value = '';
      return;
    }

    this.editImageFile = file;
    this.editImagePreview = URL.createObjectURL(file);
    this.errorMessage = '';
  }

  clearEditImage(): void {
    this.editImageFile = null;
    this.editImagePreview = '';
  }

  private async loadProducts(): Promise<void> {
    this.isLoading = true;

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getDatabase(app, firebaseConfig.databaseURL);
      const snapshot = await get(ref(db, 'adminProducts'));

      if (!snapshot.exists()) {
        this.products = [];
        return;
      }

      const data = snapshot.val() as Record<string, Omit<AdminProduct, 'id'>>;
      this.products = Object.entries(data)
        .map(([id, product]) => ({ id, ...product }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  private async uploadProductImage(app: ReturnType<typeof getApp>, file: File, productKey: string): Promise<string> {
    const storage = getStorage(app, 'gs://faby-be0b9.firebasestorage.app');
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const filePath = `admin-products/${productKey}-${Date.now()}.${extension}`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }

  private buildCategoryDetails(source: ProductFormModel): Record<string, string | number | boolean> {
    if (source.category === 'motorcycle') {
      return {
        engineCc: source.motorcycleEngineCc ?? '',
        transmission: source.motorcycleTransmission.trim(),
        helmetIncluded: source.motorcycleHelmetIncluded,
      };
    }

    if (source.category === 'tent') {
      return {
        capacity: source.tentCapacity.trim(),
        size: source.tentSize.trim(),
        weatherRating: source.tentWeatherRating.trim(),
      };
    }

    if (source.category === 'table_chair') {
      return {
        tableCount: source.tableCount ?? '',
        chairCount: source.chairCount ?? '',
        material: source.tableChairMaterial.trim(),
      };
    }

    return {
      roomType: source.innRoomType.trim(),
      maxGuests: source.innMaxGuests ?? '',
      hasBreakfast: source.innHasBreakfast,
    };
  }

  private createFormFromProduct(product: AdminProduct): ProductFormModel {
    const details = product.details ?? {};
    return {
      category: product.category,
      title: product.title,
      description: product.description,
      ratePerDay: product.ratePerDay,
      motorcycleEngineCc: this.toNullableNumber(details['engineCc']),
      motorcycleTransmission: String(details['transmission'] ?? ''),
      motorcycleHelmetIncluded: details['helmetIncluded'] === false ? false : true,
      tentCapacity: String(details['capacity'] ?? ''),
      tentSize: String(details['size'] ?? ''),
      tentWeatherRating: String(details['weatherRating'] ?? ''),
      tableCount: this.toNullableNumber(details['tableCount']),
      chairCount: this.toNullableNumber(details['chairCount']),
      tableChairMaterial: String(details['material'] ?? ''),
      innRoomType: String(details['roomType'] ?? ''),
      innMaxGuests: this.toNullableNumber(details['maxGuests']),
      innHasBreakfast: details['hasBreakfast'] === true,
    };
  }

  private toNullableNumber(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    return numeric;
  }

  private createDefaultForm(): ProductFormModel {
    return {
      category: 'motorcycle',
      title: '',
      description: '',
      ratePerDay: null,
      motorcycleEngineCc: null,
      motorcycleTransmission: '',
      motorcycleHelmetIncluded: true,
      tentCapacity: '',
      tentSize: '',
      tentWeatherRating: '',
      tableCount: null,
      chairCount: null,
      tableChairMaterial: '',
      innRoomType: '',
      innMaxGuests: null,
      innHasBreakfast: false,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Unable to save product right now.';
  }

}
