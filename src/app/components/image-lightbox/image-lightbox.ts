import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Full-screen preview for a product photo. Purely presentational — each rental list page owns
 * its own `lightboxImageUrl`/`lightboxAlt` state and just sets them on click; this component
 * renders the overlay whenever a URL is present and reports back when it should close.
 */
@Component({
  selector: 'app-image-lightbox',
  imports: [],
  templateUrl: './image-lightbox.html',
  styleUrl: './image-lightbox.sass',
})
export class ImageLightbox {
  @Input() imageUrl: string | null = null;
  @Input() alt = 'Full-screen product photo';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.imageUrl) {
      this.closed.emit();
    }
  }
}
