import { Injectable, OnDestroy } from '@angular/core';
import { getWallets } from "@massalabs/wallet-provider";
import { Provider } from "@massalabs/massa-web3";
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface WalletAccount {
  address: string;
  shortAddress?: string;
  name?: string;
  isConnected?: boolean;
  provider?: Provider;
}

@Injectable({
  providedIn: 'root'
})
export class MassaWalletsIntegrationService implements OnDestroy {
  private readonly WALLET_TIMEOUT = 30000; // 30 seconds timeout
  private readonly STATUS_DISPLAY_TIMEOUT = 5000; // 5 seconds for status messages
  private connectionTimeout?: NodeJS.Timeout;
  private statusTimeout?: NodeJS.Timeout;
  private lastActivity: number = Date.now();
  private readonly INACTIVITY_TIMEOUT = 300000; // 5 minutes
  private activityCheckInterval?: NodeJS.Timeout;

  // BehaviorSubjects for reactive state management
  private providerSubject = new BehaviorSubject<Provider | undefined>(undefined);
  private userAddressSubject = new BehaviorSubject<string>('');
  private connectionStatusSubject = new BehaviorSubject<string>('');
  private walletBalanceSubject = new BehaviorSubject<string>('0');
  private availableWalletsSubject = new BehaviorSubject<any[]>([]);
  private walletAccountsMapSubject = new BehaviorSubject<Map<string, WalletAccount[]>>(new Map());
  private isConnectingSubject = new BehaviorSubject<boolean>(false);

  // Observable streams
  provider$ = this.providerSubject.asObservable();
  userAddress$ = this.userAddressSubject.asObservable();
  connectionStatus$ = this.connectionStatusSubject.asObservable();
  walletBalance$ = this.walletBalanceSubject.asObservable();
  availableWallets$ = this.availableWalletsSubject.asObservable();
  walletAccountsMap$ = this.walletAccountsMapSubject.asObservable();
  isConnecting$ = this.isConnectingSubject.asObservable();

  private currentWallet: any;

  constructor() {
    this.setupActivityMonitoring();
  }

  private setTemporaryStatus(message: string, isError: boolean = false) {
    // Clear any existing timeout
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }

    this.connectionStatusSubject.next(message);

    // Only set timeout for success messages
    if (!isError) {
      this.statusTimeout = setTimeout(() => {
        // Only clear if it's still the same message
        if (this.connectionStatusSubject.value === message) {
          this.connectionStatusSubject.next('');
        }
      }, this.STATUS_DISPLAY_TIMEOUT);
    }
  }

  async initialize() {
    try {
      await this.initProvider();
      await this.loadWallets();
    } catch (error) {
      console.error('Initialization error:', error);
      this.setTemporaryStatus('Failed to initialize wallet connection', true);
    }
  }

  getWalletAccounts(wallet: any): WalletAccount[] {
    const accountsMap = this.walletAccountsMapSubject.value;
    return accountsMap.get(wallet.name()) || [];
  }

  private shortenAddress(address: string): string {
    if (!address) return '';
    if (address.length < 8) return address;
    return `${address.slice(0, 7)}...${address.slice(-7)}`;
  }

  private async loadWalletAccounts(wallet: any): Promise<WalletAccount[]> {
    try {
      const accounts: any = await this.withTimeout(wallet.accounts());
      return accounts.map((account: any, index: number) => ({
        address: account.address || '',
        shortAddress: this.shortenAddress(account.address || ''),
        name: `Account ${index + 1}`,
        isConnected: account.address === this.userAddressSubject.value,
        provider: account
      }));
    } catch (error) {
      console.error('Error loading wallet accounts:', error);
      return [];
    }
  }

  private setupActivityMonitoring() {
    ['click', 'keypress', 'mousemove'].forEach(eventName => {
      document.addEventListener(eventName, () => this.resetInactivityTimer());
    });

    this.checkInactivity();
  }

  private checkInactivity() {
    this.activityCheckInterval = setInterval(() => {
      if (Date.now() - this.lastActivity > this.INACTIVITY_TIMEOUT) {
        this.disconnectWallet();
      }
    }, 60000); // Check every minute
  }

  private resetInactivityTimer() {
    this.lastActivity = Date.now();
  }

  private async initProvider() {
    if (this.isConnectingSubject.value) return;
    this.isConnectingSubject.next(true);

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

      this.providerSubject.next(accounts[0]);
      this.userAddressSubject.next(accounts[0].address || '');
      await this.updateWalletBalance();
    } catch (error) {
      this.handleError('Provider initialization failed');
      throw error;
    } finally {
      this.isConnectingSubject.next(false);
    }
  }

  private async loadWallets() {
    try {
      const wallets = await getWallets();
      this.availableWalletsSubject.next(wallets);
      
      // Load accounts for all wallets
      const accountsMap = new Map<string, WalletAccount[]>();
      for (const wallet of wallets) {
        const accounts = await this.loadWalletAccounts(wallet);
        accountsMap.set(wallet.name(), accounts);
      }
      this.walletAccountsMapSubject.next(accountsMap);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }

  async changeWallet(wallet: any) {
    try {
      const accounts = await wallet.accounts();
      if (!accounts || accounts.length === 0) {
        this.setTemporaryStatus("No accounts found in wallet", true);
        return;
      }

      this.currentWallet = wallet;
      this.providerSubject.next(accounts[0]);
      this.userAddressSubject.next(accounts[0].address || '');
      this.setTemporaryStatus("Connected to wallet successfully");
      
      await this.updateWalletBalance();
      await this.loadWallets(); // Reload wallets to update connection status
    } catch (error) {
      console.error("Error changing wallet:", error);
      this.setTemporaryStatus("Failed to connect to wallet", true);
    }
  }

  async connectAccount(account: WalletAccount) {
    try {
      if (!account.provider) {
        throw new Error("Invalid account provider");
      }
      this.providerSubject.next(account.provider);
      this.userAddressSubject.next(account.address);
      this.setTemporaryStatus("Connected to account successfully");
      await this.updateWalletBalance();
      await this.loadWallets(); // Reload wallets to update connection status
    } catch (error) {
      console.error("Error connecting account:", error);
      this.setTemporaryStatus("Failed to connect to account", true);
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
    this.setTemporaryStatus(message, true);
    console.error(message);
  }

  async disconnectWallet() {
    try {
      this.providerSubject.next(undefined);
      this.userAddressSubject.next('');
      this.currentWallet = null;
      this.walletAccountsMapSubject.next(new Map());
      this.setTemporaryStatus('Disconnected');
    } catch (error) {
      this.setTemporaryStatus('Error disconnecting wallet', true);
    }
  }

  private async updateWalletBalance() {
    try {
      const provider = this.providerSubject.value;
      const userAddress = this.userAddressSubject.value;
      if (userAddress && provider) {
        const balance = ((await provider.balance(true)) || 0n) / 1000000000n;
        this.walletBalanceSubject.next(balance.toString());
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }

  async transferMAS(recipientAddress: string, amount: string) {
    try {
      const provider = this.providerSubject.value;
      const userAddress = this.userAddressSubject.value;

      if (!provider || !userAddress) {
        throw new Error('Wallet not connected');
      }

      if (!recipientAddress) {
        throw new Error('Please enter recipient address');
      }

      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Convert amount to nanoMAS 
      const transfer = await provider.transfer(recipientAddress, BigInt(Math.floor(amountValue * 1000000000)));
      await this.updateWalletBalance();
      return transfer;
    } catch (error: any) {
      console.error('Transfer error:', error);
      throw error;
    }
  }

  ngOnDestroy() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }
    this.disconnectWallet();
    
    this.providerSubject.complete();
    this.userAddressSubject.complete();
    this.connectionStatusSubject.complete();
    this.walletBalanceSubject.complete();
    this.availableWalletsSubject.complete();
    this.walletAccountsMapSubject.complete();
    this.isConnectingSubject.complete();
  }
} 