import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MassaWalletsIntegrationService, WalletAccount } from './services/massa-wallets-integration.service';
import { Provider } from "@massalabs/massa-web3";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  isWalletPopupOpen: boolean = false;
  recipientAddress: string = '';
  transferAmount: string = '';
  transferStatus: string = '';

  constructor(public walletService: MassaWalletsIntegrationService) {}

  async ngOnInit() {
    await this.walletService.initialize();
  }

  toggleWalletPopup() {
    this.isWalletPopupOpen = !this.isWalletPopupOpen;
  }

  async connectWallet(event: Event, wallet: any, account?: any) {
    event.stopPropagation();
    if (account) {
      await this.walletService.connectAccount(account);
    } else {
      await this.walletService.changeWallet(wallet);
    }
    this.isWalletPopupOpen = false;
  }

  async transferMAS() {
    try {
      await this.walletService.transferMAS(this.recipientAddress, this.transferAmount);
      this.transferStatus = 'Transfer successful';
      // Reset form
      this.recipientAddress = '';
      this.transferAmount = '';
    } catch (error: any) {
      this.transferStatus = `Transfer failed: ${error.message}`;
    }
  }

  ngOnDestroy() {
    // Service will handle its own cleanup
  }
}
