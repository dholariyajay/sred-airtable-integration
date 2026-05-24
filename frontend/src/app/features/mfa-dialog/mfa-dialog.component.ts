import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-mfa-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './mfa-dialog.component.html',
  styleUrls: ['./mfa-dialog.component.scss']
})
export class MfaDialogComponent {
  mfaCode = '';

  constructor(public dialogRef: MatDialogRef<MfaDialogComponent>) {}

  submit() {
    if (this.mfaCode.length >= 6) {
      this.dialogRef.close(this.mfaCode);
    }
  }
}
