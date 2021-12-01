
Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)


## Functions
### ray
```solidity
  function ray(
  ) internal returns (uint256)
```



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`One`|  | ray, 1e27

### wad
```solidity
  function wad(
  ) internal returns (uint256)
```



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`One`|  | wad, 1e18

### halfRay
```solidity
  function halfRay(
  ) internal returns (uint256)
```



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Half`|  | ray, 1e27/2

### halfWad
```solidity
  function halfWad(
  ) internal returns (uint256)
```



#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Half`|  | ray, 1e18/2

### wadMul
```solidity
  function wadMul(
    uint256 a,
    uint256 b
  ) internal returns (uint256)
```

Multiplies two wad, rounding half up to the nearest wad

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`a` | uint256 | Wad
|`b` | uint256 | Wad

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| uint256 | result of a*b, in wad

### wadDiv
```solidity
  function wadDiv(
    uint256 a,
    uint256 b
  ) internal returns (uint256)
```

Divides two wad, rounding half up to the nearest wad

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`a` | uint256 | Wad
|`b` | uint256 | Wad

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| uint256 | result of a/b, in wad

### rayMul
```solidity
  function rayMul(
    uint256 a,
    uint256 b
  ) internal returns (uint256)
```

Multiplies two ray, rounding half up to the nearest ray

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`a` | uint256 | Ray
|`b` | uint256 | Ray

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| uint256 | result of a*b, in ray

### rayDiv
```solidity
  function rayDiv(
    uint256 a,
    uint256 b
  ) internal returns (uint256)
```

Divides two ray, rounding half up to the nearest ray

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`a` | uint256 | Ray
|`b` | uint256 | Ray

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| uint256 | result of a/b, in ray

### rayToWad
```solidity
  function rayToWad(
    uint256 a
  ) internal returns (uint256)
```

Casts ray down to wad

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`a` | uint256 | Ray

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`a`| uint256 | casted to wad, rounded half up to the nearest wad

### wadToRay
```solidity
  function wadToRay(
    uint256 a
  ) internal returns (uint256)
```

Converts wad up to ray

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`a` | uint256 | Wad

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`a`| uint256 | converted in ray

