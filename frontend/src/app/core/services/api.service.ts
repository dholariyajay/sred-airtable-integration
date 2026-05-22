import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStatus, SyncStats, CookieStatus, ScraperLoginResult, CollectionItem } from '../models/interfaces';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Auth
  getAuthStatus(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>(`${this.baseUrl}/auth/status`);
  }

  getConnectUrl(): string {
    return `${this.baseUrl}/auth/connect`;
  }

  // Sync
  startSync(): Observable<any> {
    return this.http.post(`${this.baseUrl}/sync`, {});
  }

  getSyncStatus(): Observable<{ inProgress: boolean; lastResult: SyncStats }> {
    return this.http.get<any>(`${this.baseUrl}/sync/status`);
  }

  // Scraper
  scraperLogin(email: string, password: string): Observable<ScraperLoginResult> {
    return this.http.post<ScraperLoginResult>(`${this.baseUrl}/scraper/login`, { email, password });
  }

  submitMfa(mfaCode: string): Observable<ScraperLoginResult> {
    return this.http.post<ScraperLoginResult>(`${this.baseUrl}/scraper/mfa`, { mfaCode });
  }

  getCookieStatus(): Observable<CookieStatus> {
    return this.http.get<CookieStatus>(`${this.baseUrl}/scraper/cookies/status`);
  }

  startScraping(baseId?: string, tableId?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/scraper/scrape`, { baseId, tableId });
  }

  // Data — for AG Grid
  getCollections(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/data/collections`);
  }

  getCollectionData(name: string): Observable<CollectionItem[]> {
    return this.http.get<CollectionItem[]>(`${this.baseUrl}/data/collections/${name}`);
  }
}
