## `WadRayMath`



Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)



### `ray() → uint256` (internal)





### `wad() → uint256` (internal)





### `halfRay() → uint256` (internal)





### `halfWad() → uint256` (internal)





### `wadMul(uint256 a, uint256 b) → uint256` (internal)



Multiplies two wad, rounding half up to the nearest wad


### `wadDiv(uint256 a, uint256 b) → uint256` (internal)



Divides two wad, rounding half up to the nearest wad


### `rayMul(uint256 a, uint256 b) → uint256` (internal)



Multiplies two ray, rounding half up to the nearest ray


### `rayDiv(uint256 a, uint256 b) → uint256` (internal)



Divides two ray, rounding half up to the nearest ray


### `rayToWad(uint256 a) → uint256` (internal)



Casts ray down to wad


### `wadToRay(uint256 a) → uint256` (internal)



Converts wad up to ray





