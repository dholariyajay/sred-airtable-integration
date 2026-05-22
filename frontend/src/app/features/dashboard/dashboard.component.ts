import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ModuleRegistry, AllCommunityModule, SelectionChangedEvent } from 'ag-grid-community';
import { AgCharts } from 'ag-charts-angular';
import { AgChartOptions } from 'ag-charts-community';

ModuleRegistry.registerModules([AllCommunityModule]);

import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { MfaDialogComponent } from '../mfa-dialog/mfa-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatSnackBarModule, MatProgressSpinnerModule,
    MatDialogModule, MatToolbarModule, MatTabsModule,
    MatTooltipModule,
    AgGridModule, AgCharts
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  activeIntegration = 'airtable';
  collections: string[] = [];
  selectedCollection = '';
  processedEntity = '';
  searchTerm = '';
  selectedRowCount = 0;

  isConnected = false;
  isSyncing = false;
  isLoading = false;
  showChart = false;

  chartOptions: AgChartOptions = {};

  private gridApi!: GridApi;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
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
  rowSelection: any = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    private dialog: MatDialog,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['auth'] === 'success') this.notify.success('Airtable connected successfully');
      if (params['auth'] === 'failed') this.notify.error('OAuth authorization failed — try again');
    });
    this.checkConnection();
  }

  ngOnDestroy(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
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
        this.notify.info('Sync started — this may take a moment');
        this.pollSyncStatus();
      },
      error: (err) => {
        this.isSyncing = false;
        this.notify.error('Sync failed: ' + (err.error?.error || err.message));
      }
    });
  }

  private pollSyncStatus(): void {
    this.syncInterval = setInterval(() => {
      this.api.getSyncStatus().subscribe(status => {
        if (!status.inProgress) {
          if (this.syncInterval) clearInterval(this.syncInterval);
          this.syncInterval = null;
          this.isSyncing = false;
          this.loadCollections();
          if (status.lastResult?.errors?.length) {
            this.notify.error('Sync finished with ' + status.lastResult.errors.length + ' error(s)');
          } else {
            this.notify.success('Sync complete!');
          }
        }
      });
    }, 2000);
  }

  loadCollections(): void {
    this.api.getCollections().subscribe({
      next: (cols) => this.collections = cols,
      error: () => this.notify.error('Failed to load collections')
    });
  }

  onCollectionChange(): void {
    if (!this.selectedCollection) return;

    this.isLoading = true;
    this.showChart = false;
    this.selectedRowCount = 0;
    this.api.getCollectionData(this.selectedCollection).subscribe({
      next: (data) => {
        this.rowData = data;
        this.buildColumnDefs(data);
        this.buildChartOptions(data);
        this.isLoading = false;
        if (data.length === 0) {
          this.notify.info('Collection is empty — try syncing first');
        }
      },
      error: () => {
        this.isLoading = false;
        this.rowData = [];
        this.columnDefs = [];
        this.notify.error('Failed to load collection data');
      }
    });
  }

  private buildColumnDefs(data: any[]): void {
    if (data.length === 0) {
      this.columnDefs = [];
      return;
    }

    const keys = new Set<string>();
    data.forEach(record => {
      Object.keys(record).forEach(k => keys.add(k));
    });

    const dataCols: ColDef[] = Array.from(keys).map(key => ({
      field: key,
      headerName: this.formatHeader(key),
      filter: this.isDateField(key) ? 'agDateColumnFilter' : true,
      sortable: true,
      resizable: true
    }));

    const indexCol: ColDef = {
      headerName: '#',
      valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 : '',
      width: 70,
      maxWidth: 80,
      sortable: false,
      filter: false,
      pinned: 'left',
      suppressMovable: true
    };

    this.columnDefs = [indexCol, ...dataCols];
  }

  private buildChartOptions(data: any[]): void {
    if (data.length === 0) return;

    const sample = data.slice(0, 20);
    const dateKey = Object.keys(sample[0]).find(k => this.isDateField(k));

    if (dateKey) {
      const grouped: Record<string, number> = {};
      sample.forEach(row => {
        const val = row[dateKey];
        if (val) {
          const d = new Date(val);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          grouped[label] = (grouped[label] || 0) + 1;
        }
      });

      this.chartOptions = {
        data: Object.entries(grouped).map(([label, count]) => ({ label, count })),
        series: [{ type: 'bar', xKey: 'label', yKey: 'count', yName: 'Records' }]
      };
      this.showChart = true;
    }
  }

  onSearch(): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', this.searchTerm);
    }
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    this.selectedRowCount = event.api.getSelectedRows().length;
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
    if (this.searchTerm) {
      this.gridApi.setGridOption('quickFilterText', this.searchTerm);
    }
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
          this.notify.success('Authenticated! Starting scrape...');
          this.api.startScraping().subscribe();
        } else {
          this.notify.error('Login failed — check credentials');
        }
      },
      error: (err) => this.notify.error('Scraper error: ' + err.message)
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
            this.notify.success('Authenticated! Starting scrape...');
            this.api.startScraping().subscribe();
          } else {
            this.notify.error('MFA failed — try again');
          }
        }
      });
    });
  }

  toggleChart(): void {
    this.showChart = !this.showChart;
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
