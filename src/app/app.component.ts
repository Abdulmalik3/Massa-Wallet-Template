import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getWallets } from "@massalabs/wallet-provider";
import { JsonRPCClient, Provider } from "@massalabs/massa-web3";

interface WalletAccount {
  address: string;
  name?: string;
  isConnected?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly WALLET_TIMEOUT = 30000; // 30 seconds timeout
  private connectionTimeout?: NodeJS.Timeout;
  private lastActivity: number = Date.now();
  private readonly INACTIVITY_TIMEOUT = 300000; // 5 minutes

  provider?: Provider;
  userAddress: string = '';
  connectionStatus: string = '';
  isWalletPopupOpen: boolean = false;
  availableWallets: any[] = [];
  currentWallet: any;
  walletAccounts: WalletAccount[] = [];
  isConnecting: boolean = false;
  walletBalance: string = '0';

  // change buildnet to mainnet
  jsonRPCClient: JsonRPCClient = JsonRPCClient.buildnet();

  constructor() {

    this.setupActivityMonitoring();
  }

  async ngOnInit() {
    try {
      await this.initProvider();
      await this.loadWallets();
    } catch (error) {
      console.error('Initialization error:', error);
      this.handleError('Failed to initialize wallet connection');
    }
  }

  private setupActivityMonitoring() {
    // Monitor user activity
    ['click', 'keypress', 'mousemove'].forEach(eventName => {
      document.addEventListener(eventName, () => this.resetInactivityTimer());
    });

    this.checkInactivity();
  }

  private checkInactivity() {
    setInterval(() => {
      if (Date.now() - this.lastActivity > this.INACTIVITY_TIMEOUT) {
        this.disconnectWallet();
      }
    }, 60000); // Check every minute
  }

  private resetInactivityTimer() {
    this.lastActivity = Date.now();
  }

  private async initProvider() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const wallets = await this.withTimeout(getWallets());

      if (wallets.length === 0) {
        throw new Error("No wallets found");
      }

      const wallet = wallets[0];
      this.currentWallet = wallet;

      const accounts = await this.withTimeout(wallet.accounts());
      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      this.provider = accounts[0];
      this.userAddress = accounts[0].address || '';
      this.updateWalletBalance();
    } catch (error) {
      this.handleError('Provider initialization failed');
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }



  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        this.connectionTimeout = setTimeout(() => {
          reject(new Error('Operation timed out'));
        }, this.WALLET_TIMEOUT);
      })
    ]).finally(() => {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
      }
    });
  }

  private handleError(message: string) {
    this.connectionStatus = message;
    console.error(message);
  }

  async disconnectWallet() {
    try {
      // Clean up connection
      this.provider = undefined;
      this.userAddress = '';
      this.currentWallet = null;
      this.walletAccounts = [];
      this.connectionStatus = 'Disconnected';
    } catch (error) {
      this.handleError('Error disconnecting wallet');
    }
  }

  private async loadWallets() {
    try {
      const wallets = await getWallets();
      this.availableWallets = wallets;
      
      if (this.currentWallet) {
        const accounts = await this.currentWallet.accounts();
        this.walletAccounts = accounts.map((account: any) => ({
          address: account.address || '',
          name: `Account ${accounts.indexOf(account) + 1}`,
          isConnected: account.address === this.userAddress
        }));
      }

    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }

  async changeWallet(wallet: any) {
    try {
      const accounts = await wallet.accounts();
      if (!accounts || accounts.length === 0) {
        this.connectionStatus = "No accounts found in wallet";
        return;
      }

      this.currentWallet = wallet;
      this.provider = accounts[0];
      this.userAddress = this.provider?.address || '';
      this.isWalletPopupOpen = false;
      this.connectionStatus = "Connected to wallet successfully";
      
      await this.updateWalletBalance();

    } catch (error) {
      console.error("Error changing wallet:", error);
      this.connectionStatus = "Failed to connect to wallet";
    }
  }

  async connectAccount(account: WalletAccount) {
    try {
      this.provider = this.currentWallet;
      this.userAddress = account.address;
      this.isWalletPopupOpen = false;
      this.connectionStatus = "Connected to account successfully";
      
      await this.updateWalletBalance();
    } catch (error) {
      console.error("Error connecting account:", error);
      this.connectionStatus = "Failed to connect to account";
    }
  }

  private async updateWalletBalance() {
    try {
     
       this.walletBalance = (await this.jsonRPCClient.getBalance(this.userAddress) / 1000000000n).toString()
      
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }

  toggleWalletPopup() {
    this.isWalletPopupOpen = !this.isWalletPopupOpen;
  }

  async connectWallet(event: Event, wallet: any) {
    event.stopPropagation();
    await this.changeWallet(wallet);
  }

  ngOnDestroy() {
    // Clean up
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.disconnectWallet();
  }
}
