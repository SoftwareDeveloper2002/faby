import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-paymentfailed',
  imports: [CommonModule, RouterLink],
  templateUrl: './paymentfailed.html',
  styleUrl: './paymentfailed.sass',
})
export class Paymentfailed {}
