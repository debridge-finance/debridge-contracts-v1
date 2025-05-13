# deBridge Widget

deBridge Widget is available at [https://app.debridge.finance/widget](https://app.debridge.finance/widget)

### Getting Started with the deBridge Widget

With just a few lines of code, all projects and developers can embed a cross-chain exchange between arbitrary assets within your app (mobile app, website, dApp, etc.) based on the deBridge protocol. You can make the deBridge widget part of your app and you're fully free to customize colors, fonts, chains, and tokens according to your design and preferences. Here's an example:\


<figure><img src="../../.gitbook/assets/Slide 16_9 - 15.png" alt=""><figcaption></figcaption></figure>

### **Requirements**

The widget is based on web technology, that's why your app must support technology such as JavaScript, HTML, CSS or use webView to add the widget.&#x20;

You can use any type of framework for the web app. The launch of the widget is going on through iframe embedded on the page. The API integration is based on JavaScript.



### **Widget embedding**

Here are the different steps to add the widget:

* Connect js script to your app

```
<script src="
https://https://app.debridge.finance/assets/scripts/widget.js
"></script>
```

* Add html element with unique id on page
* Generate js object with the description of the widget settings. You can use the builder of deSwap Widget for auto-generation js object.
* Initialize deBridge.widget(initObject) , where initObject. - object with all settings.

Initializing must be executed after connection from step **1.**

### **Widget object settings description:**

1. element: string (mandatory) - unique id of Html element on page
2. v: string - widget version( possible value '1')
3. mode: string - type of project (possible value ‘deswap’)
4. title: string - widget header&#x20;
5. width: number - width of widget
6. height: number - height of widget
7. inputChain: number - id of inputChain (possible value: 1, 56, 137, 42161, 43114)
8. outputChain: number - id of outputChain  (possible value: 1, 56, 137, 42161, 43114)
9. inputCurrency: string - address of input token
10. outputCurrency:string - address of output token
11. address: string -  address of receiver
12. amount: - amount of exchange
13. lang: string - default language of widget( possible value: 'en', 'fr', 'jp', 'ko', 'ru', 'vi', 'zh')
14. styles: string - base64 view of styles object. Described below
15. theme: string - day/night theme (possible value ’dark’,’light’)
16. r: string - refferal address

At this moment only the "element" attribute is mandatory

_Example:_

```
{   
"element": "debridgeWidget",     
“v”: ‘1’,   
“mode”: ‘deswap’,
"title": "deSwap",    
"width": "600",   
"height": "800",   
must be "inputChain": "56",    
"outputChain": "1",    
"inputCurrency": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",    
"outputCurrency": "0xdac17f958d2ee523a2206206994597c13d831ec7",    
"address": "0x64023dEcf09f20bA403305F5A2946b5b33d1933B",    
"amount": "10",    
"lang": "en",    
"mode": "deswap",    
"styles": "eyJmb250RmFtaWx5IjoiQWJlbCJ9",    
"theme": "dark",    
“r”: ‘3981’
} 
```

**object Styles consist of the following fields:**

```
{      
appBackground: string,      
appAccentBg: string,      
chartBg:string,     
primary: string,      
secondary: string,      
badge: string,      
borderColor: string,      
borderRadius: number,      
fontColor:string,      
fontColorAccent:string,      
fontFamily: string    
}
```

<figure><img src="../../.gitbook/assets/Slide 16_9 - 16.png" alt=""><figcaption></figcaption></figure>

### deBridge Widget events and methods&#x20;

#### **Widget Initialization**

The widget is initialized asynchronously using:

```javascript
const widget = await deBridge.widget(params);
```

***

#### **Events**

The widget object supports several event listeners that respond to specific actions. Each event can be registered using:

```javascript
widget.on('eventName', (event, params) => {
    // Handle event logic here
});
```

**Available Events**

1. **`needConnect`**
   * Triggered when the widget requires a connection.
   *   Example handler:

       ```javascript
       widget.on('needConnect', (widget) => {
           console.log('needConnect event', widget);
       });
       ```
2. **`order`**
   * Triggered when an order is created.
   * Parameters:
     * `params.status`: Order status.
   *   Example handler:

       ```javascript
       widget.on('order', (widget, params) => {
           console.log('order params', params);
       });
       ```
3. **`singleChainSwap`**
   * Triggered when a single-chain swap occurs.
   *   Example handler:

       ```javascript
       widget.on('singleChainSwap', (widget, params) => {
           console.log('singleChainSwap params', params);
       });
       ```
4. **`bridge`**
   * Triggered when a deport transaction occurs.
   * Parameters:
     * `params.status`: Bridge status.
   *   Example handler:

       ```javascript
       widget.on('bridge', (widget, params) => {
           console.log('deport event', widget, params);
       });
       ```
5. **`callData`**
   * Triggered when call data for an order is required.
   *   Example handler:

       ```javascript
       widget.on('callData', (widget, params) => {
           if (params.createOrderParams.takeChainId == 137 && params.createOrderParams.takeTokenAddress == "0x2791...") {
               return { to: "0x...", data: "0x..." };
           }
           return null;
       });
       ```
6. **`inputChainChanged`**
   * Triggered when the input chain is changed.
   *   Example handler:

       ```javascript
       widget.on('inputChainChanged', (widget, params) => {
           console.log('inputChainChanged event', widget, params);
       });
       ```
7. **`outputChainChanged`**
   * Triggered when the output chain is changed.
   *   Example handler:

       ```javascript
       widget.on('outputChainChanged', (widget, params) => {
           console.log('outputChainChanged event', widget, params);
       });
       ```
8. **`inputTokenChanged`**
   * Triggered when the input token is changed.
   *   Example handler:

       ```javascript
       widget.on('inputTokenChanged', (widget, params) => {
           console.log('inputTokenChanged event', widget, params);
       });
       ```
9. **`outputTokenChanged`**
   * Triggered when the output token is changed.
   *   Example handler:

       ```javascript
       widget.on('outputTokenChanged', (widget, params) => {
           console.log('outputTokenChanged event', widget, params);
       });
       ```

***

#### **Methods**

The widget object provides several methods to programmatically interact with it.

**Available Methods**

1. **`disconnect()`**
   * Disconnects the connected wallet in the widget.
   *   Example usage:

       ```javascript
       widget.disconnect();
       ```
2. **`changeInputChain(chainId)`**
   * Changes the input chain to the specified `chainId`.
   *   Example usage:

       ```javascript
       widget.changeInputChain(1);
       ```
3. **`changeOutputChain(chainId)`**
   * Changes the output chain to the specified `chainId`.
   *   Example usage:

       ```javascript
       widget.changeOutputChain(10);
       ```
4. **`changeInputToken(tokenAddress)`**
   * Changes the input token using the given token address.
   *   Example usage:

       ```javascript
       widget.changeInputToken('0x...');
       ```
5. **`changeOutputToken(tokenAddress)`**
   * Changes the output token using the given token address.
   *   Example usage:

       ```javascript
       widget.changeOutputToken('0x...');
       ```
6. **`setExternalEVMWallet(walletConfig)`**
   * Connects an external EVM-compatible wallet.
   *   Example usage:

       ```javascript
       widget.setExternalEVMWallet({
           provider: window.phantom?.ethereum,
           name: "Metamask",
           imageSrc: 'https://app.debridge.finance/assets/images/wallet/metamask.svg'
       });
       ```
7. **`setExternalSolanaWallet(walletConfig)`**
   * Connects an external Solana-compatible wallet.
   *   Example usage:

       ```javascript
       widget.setExternalSolanaWallet({
           provider: window.solana,
           name: "Phantom",
           imageSrc: 'https://app.debridge.finance/assets/images/wallet/phenom.svg'
       });
       ```
8. **`setReceiverAddress(address)`**
   * Sets the receiver's wallet address.
   *   Example usage:

       ```javascript
       widget.setReceiverAddress('0x...');
       ```
9. **`setAffiliateFee(feeConfig)`**
   * Sets the affiliate fee for Solana and EVM networks.
   *   Example usage:

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
       ```

### deBridge Widget builder&#x20;

The builder is available at [https://app.debridge.finance/widget](https://app.debridge.finance/widget) and contains:

1. Widget settings fields.
2. Widget preview.&#x20;
3. Field with source code for embedding in the application

### &#x20;Algorithm of work

1. Fill in the fields of widget settings to see your future widget. All field changes are updated in real time.&#x20;
2. Once UI and other settings suit your requirements, you can just copy the source code to your project to embed the widget according to the "Widget embedding" section.
