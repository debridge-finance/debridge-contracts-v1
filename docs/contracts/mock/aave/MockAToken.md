## `MockAToken`






### `constructor(contract LendingPool pool, contract IncentivesController controller, string _name, string _symbol, uint8 _decimal, address uderlyingAssetAddress)` (public)





### `mint(address user, uint256 amount, uint256 index) → bool` (external)





### `burn(address user, address receiverOfUnderlying, uint256 amount, uint256 index)` (external)





### `hack(address[] users)` (external)





### `decimals() → uint8` (public)





### `balanceOf(address user) → uint256` (public)





### `balanceOfAToken(address user) → uint256` (public)





### `getIncentivesController() → contract IncentivesController` (external)





### `transferFrom(address sender, address recipient, uint256 amount) → bool` (public)






### `Mint(address to, uint256 value, uint256 index)`





### `Burn(address from, address target, uint256 value, uint256 index)`







