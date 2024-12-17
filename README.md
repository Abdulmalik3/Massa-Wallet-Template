# Massa Wallet Integration

An Angular application that integrates with Massa blockchain wallets, allowing users to connect wallets, view balances, and transfer MAS tokens.

## Core Features

- Wallet connection and management
- Account switching
- Balance checking
- MAS token transfers
- Automatic disconnection on inactivity




### Wallet Connection Methods

#### `initProvider()`
- Initializes the wallet provider
- Connects to first available wallet and account
- Sets up initial wallet connection

#### `changeWallet(wallet: any)`
- Changes the current wallet to a new selected wallet
- Updates provider, address, and balance

#### `connectAccount(account: any)`
- Connects to a specific account within the current wallet
- Updates provider, address, and balance

#### `disconnectWallet()`
- Disconnects the current wallet
- Clears all wallet-related state

### Balance and Transfer Methods

#### `updateWalletBalance()`
- Fetches and updates the current wallet balance
- Converts balance from nanoMAS to MAS

#### `transferMAS()`
- Handles MAS token transfers between addresses
- Validates input and executes transfer transaction

### Wallet Management Methods

#### `loadWallets()`
- Loads all available wallets and their accounts
- Maps wallet accounts to display format

#### `connectWallet(event: Event, wallet: any)`
- Event handler for wallet connection button
- Prevents event propagation and changes wallet



### Activity Monitoring Methods

#### `setupActivityMonitoring()`
- Sets up user activity listeners for auto-disconnect





## Dependencies

- @massalabs/wallet-provider
- @massalabs/massa-web3


## Usage
1. Clone the repository:

```bash
git clone https://github.com/Abdulmalik3/Massa-Wallet-Template.git
```



2. Navigate to the project directory:

```bash
cd Massa-Wallet-Template
```

3. Install dependencies:

```bash
npm install
```

4. Build the project:

```bash
ng build
```

5. Start the development server:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`.