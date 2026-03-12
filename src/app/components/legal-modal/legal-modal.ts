import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type LegalModalSection = {
  heading?: string;
  paragraphs: string[];
};

@Component({
  selector: 'app-legal-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './legal-modal.html',
  styleUrl: './legal-modal.sass',
})
export class LegalModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() sections: LegalModalSection[] = [];
  @Input() closeLabel = 'Close';

  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}
