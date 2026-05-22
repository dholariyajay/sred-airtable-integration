import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  constructor(private api: ApiService) {}

  checkStatus() {
    this.api.getAuthStatus().subscribe({
      next: (status) => this.connectedSubject.next(status.connected),
      error: () => this.connectedSubject.next(false)
    });
  }

  get isConnected(): boolean {
    return this.connectedSubject.value;
  }
}
