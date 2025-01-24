
### **Widget Initialization**

The widget is initialized asynchronously using:

```javascript
const widget = await deBridge.widget(params);
```

---

### **Events**

The widget object supports several event listeners that respond to specific actions. Each event can be registered using:

```javascript
widget.on('eventName', (event, params) => {
    // Handle event logic here
});
```

#### **Available Events**

1. **`needConnect`**  
   - Triggered when the widget requires a connection.  
   - Example handler:  
     ```javascript
     widget.on('needConnect', (widget) => {
         console.log('needConnect event', widget);
     });
     ```

2. **`order`**  
   - Triggered when an order is created.  
   - Parameters:  
     - `params.status`: Order status.  
   - Example handler:  
     ```javascript
     widget.on('order', (widget, params) => {
         console.log('order params', params);
     });
     ```

3. **`singleChainSwap`**  
   - Triggered when a single-chain swap occurs.  
   - Example handler:  
     ```javascript
     widget.on('singleChainSwap', (widget, params) => {
         console.log('singleChainSwap params', params);
     });
     ```

4. **`bridge`**  
   - Triggered when a deport transaction occurs.  
   - Parameters:  
     - `params.status`: Bridge status.  
   - Example handler:  
     ```javascript
     widget.on('bridge', (widget, params) => {
         console.log('deport event', widget, params);
     });
     ```

5. **`callData`**  
   - Triggered when call data for an order is required.   
   - Example handler:  
     ```javascript
     widget.on('callData', (widget, params) => {
         if (params.createOrderParams.takeChainId == 137 && params.createOrderParams.takeTokenAddress == "0x2791...") {
             return { to: "0x...", data: "0x..." };
         }
         return null;
     });
     ```

6. **`inputChainChanged`**  
   - Triggered when the input chain is changed.  
   - Example handler:  
     ```javascript
     widget.on('inputChainChanged', (widget, params) => {
         console.log('inputChainChanged event', widget, params);
     });
     ```

7. **`outputChainChanged`**  
   - Triggered when the output chain is changed.  
   - Example handler:  
     ```javascript
     widget.on('outputChainChanged', (widget, params) => {
         console.log('outputChainChanged event', widget, params);
     });
     ```

8. **`inputTokenChanged`**  
   - Triggered when the input token is changed.  
   - Example handler:  
     ```javascript
     widget.on('inputTokenChanged', (widget, params) => {
         console.log('inputTokenChanged event', widget, params);
     });
     ```

9. **`outputTokenChanged`**  
   - Triggered when the output token is changed.  
   - Example handler:  
     ```javascript
     widget.on('outputTokenChanged', (widget, params) => {
         console.log('outputTokenChanged event', widget, params);
     });
     ```

---

### **Methods**

The widget object provides several methods to programmatically interact with it.

#### **Available Methods**

1. **`disconnect()`**  
   - Disconnects the connected wallet in the widget.  
   - Example usage:  
     ```javascript
     widget.disconnect();
     ```

2. **`changeInputChain(chainId)`**  
   - Changes the input chain to the specified `chainId`.  
   - Example usage:  
     ```javascript
     widget.changeInputChain(1);
     ```

3. **`changeOutputChain(chainId)`**  
   - Changes the output chain to the specified `chainId`.  
   - Example usage:  
     ```javascript
     widget.changeOutputChain(10);
     ```

4. **`changeInputToken(tokenAddress)`**  
   - Changes the input token using the given token address.  
   - Example usage:  
     ```javascript
     widget.changeInputToken('0x...');
     ```

5. **`changeOutputToken(tokenAddress)`**  
   - Changes the output token using the given token address.  
   - Example usage:  
     ```javascript
     widget.changeOutputToken('0x...');
     ```

6. **`setExternalEVMWallet(walletConfig)`**  
   - Connects an external EVM-compatible wallet.  
   - Example usage:  
     ```javascript
     widget.setExternalEVMWallet({
         provider: window.phantom?.ethereum,
         name: "Metamask",
         imageSrc: 'https://app.debridge.finance/assets/images/wallet/metamask.svg'
     });
     ```

7. **`setExternalSolanaWallet(walletConfig)`**  
   - Connects an external Solana-compatible wallet.  
   - Example usage:  
     ```javascript
     widget.setExternalSolanaWallet({
         provider: window.solana,
         name: "Phantom",
         imageSrc: 'https://app.debridge.finance/assets/images/wallet/metamask.svg'
     });
     ```

7. **`setExternalSolanaWallet(walletConfig)`**  
   - Connects an external Solana-compatible wallet.  
   - Example usage:  
     ```javascript
     widget.setExternalSolanaWallet({
         provider: window.solana,
         name: "Phantom",
         imageSrc: 'https://app.debridge.finance/assets/images/wallet/metamask.svg'
     });
     ```

8. **`setReceiverAddress(address)`**  
   - Sets the receiver's wallet address.  
   - Example usage:  
     ```javascript
     widget.setReceiverAddress('0x...');
     ```

9. **`setAffiliateFee(feeConfig)`**  
   - Sets the affiliate fee for Solana and EVM networks.  
   - Example usage:  
     ```javascript
     widget.setAffiliateFee({
         solana: {
             affiliateFeePercent: '0.5',
             affiliateFeeRecipient: 'B5...',
         },
         evm: {
             affiliateFeePercent: '1',
             affiliateFeeRecipient: '0x...',
         }
     });