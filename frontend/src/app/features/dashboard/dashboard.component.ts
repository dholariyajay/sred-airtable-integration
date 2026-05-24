import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { ApiService } from '../../core/services/api.service';
import { MfaDialogComponent } from '../mfa-dialog/mfa-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatSnackBarModule, MatProgressSpinnerModule,
    MatDialogModule, MatToolbarModule,
    AgGridModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  activeIntegration = 'airtable';
  collections: string[] = [];
  selectedCollection = '';
  searchTerm = '';

  isConnected = false;
  isSyncing = false;
  isLoading = false;

  private gridApi!: GridApi;
  columnDefs: ColDef[] = [];
  rowData: any[] = [];
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 120
  };
  paginationPageSize = 100;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.checkConnection();
  }

  checkConnection(): void {
    this.api.getAuthStatus().subscribe({
      next: (status) => {
        this.isConnected = status.connected;
        if (this.isConnected) this.loadCollections();
      },
      error: () => { this.isConnected = false; }
    });
  }

  connectAirtable(): void {
    window.location.href = this.api.getConnectUrl();
  }

  startSync(): void {
    this.isSyncing = true;
    this.api.startSync().subscribe({
      next: () => {
        this.snackBar.open('Sync started — this may take a moment', 'OK', { duration: 3000 });
        this.pollSyncStatus();
      },
      error: (err) => {
        this.isSyncing = false;
        this.snackBar.open('Sync failed: ' + (err.error?.error || err.message), 'OK', { duration: 5000 });
      }
    });
  }

  private pollSyncStatus(): void {
    const interval = setInterval(() => {
      this.api.getSyncStatus().subscribe(status => {
        if (!status.inProgress) {
          clearInterval(interval);
          this.isSyncing = false;
          this.loadCollections();
          this.snackBar.open('Sync complete!', 'OK', { duration: 3000 });
        }
      });
    }, 2000);
  }

  loadCollections(): void {
    this.api.getCollections().subscribe({
      next: (cols) => this.collections = cols,
      error: () => this.snackBar.open('Failed to load collections', 'OK', { duration: 3000 })
    });
  }

  onCollectionChange(): void {
    if (!this.selectedCollection) return;

    this.isLoading = true;
    this.api.getCollectionData(this.selectedCollection).subscribe({
      next: (data) => {
        this.rowData = data;
        this.buildColumnDefs(data);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.rowData = [];
        this.columnDefs = [];
        this.snackBar.open('Failed to load collection data', 'OK', { duration: 3000 });
      }
    });
  }

  private buildColumnDefs(data: any[]): void {
    if (data.length === 0) {
      this.columnDefs = [];
      return;
    }

    const keys = new Set<string>();
    data.slice(0, 10).forEach(record => {
      Object.keys(record).forEach(k => keys.add(k));
    });

    this.columnDefs = Array.from(keys).map(key => ({
      field: key,
      headerName: this.formatHeader(key),
      filter: this.isDateField(key) ? 'agDateColumnFilter' : true,
      sortable: true,
      resizable: true
    }));
  }

  onSearch(): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', this.searchTerm);
    }
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  // --- Scraper ---
  startScraper(): void {
    const email = prompt('Airtable email:');
    const password = prompt('Airtable password:');
    if (!email || !password) return;

    this.api.scraperLogin(email, password).subscribe({
      next: (result) => {
        if (result.status === 'mfa_required') {
          this.openMfaDialog();
        } else if (result.status === 'authenticated') {
          this.snackBar.open('Authenticated! Starting scrape...', 'OK', { duration: 3000 });
          this.api.startScraping().subscribe();
        } else {
          this.snackBar.open('Login failed — check credentials', 'OK', { duration: 5000 });
        }
      },
      error: (err) => this.snackBar.open('Scraper error: ' + err.message, 'OK', { duration: 5000 })
    });
  }

  private openMfaDialog(): void {
    const ref = this.dialog.open(MfaDialogComponent, {
      width: '350px',
      disableClose: true
    });

    ref.afterClosed().subscribe(code => {
      if (!code) return;
      this.api.submitMfa(code).subscribe({
        next: (res) => {
          if (res.status === 'authenticated') {
            this.snackBar.open('Authenticated! Starting scrape...', 'OK', { duration: 3000 });
            this.api.startScraping().subscribe();
          } else {
            this.snackBar.open('MFA failed — try again', 'OK', { duration: 3000 });
          }
        }
      });
    });
  }

  private formatHeader(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  private isDateField(key: string): boolean {
    const k = key.toLowerCase();
    return k.includes('date') || k.includes('time') || k.includes('created') || k.includes('synced');
  }
}
