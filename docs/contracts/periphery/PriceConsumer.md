


## Functions
### initialize
```solidity
  function initialize(
  ) public
```




### getPriceOfTokenInWETH
```solidity
  function getPriceOfTokenInWETH(
    address _token
  ) external returns (uint256)
```

get Price of Token in WETH

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_token` | address | address of token

### getRate
```solidity
  function getRate(
    address _base,
    address _quote
  ) public returns (uint256)
```

get Price of Token in another token.
returns price in decimals of quote token

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_base` | address | address of base token
|`_quote` | address | address of quote token
ETH/USD = 3000 (ETH is base, USD is quote)
Rate = reserveQuote / reserveBase

### getPairAddress
```solidity
  function getPairAddress(
  ) public returns (address)
```




