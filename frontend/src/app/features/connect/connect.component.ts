import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {
  isConnected = false;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.api.getAuthStatus().subscribe({
      next: (s) => {
        this.isConnected = s.connected;
        if (s.connected) this.router.navigate(['/dashboard']);
      }
    });
  }

  connect() {
    window.location.href = this.api.getConnectUrl();
  }
}
