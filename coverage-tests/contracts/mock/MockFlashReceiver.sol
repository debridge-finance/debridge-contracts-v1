pragma solidity =0.8.7;

import "../interfaces/IFlashCallback.sol";
import "../interfaces/IDeBridgeGate.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockFlashReceiver is IFlashCallback {

    address public token;

    constructor( address _token){
        token=_token;
    }

    function doFlashLoan(address _debridge, uint256 _amount, bytes memory _data) public {
        IDeBridgeGate debridge = IDeBridgeGate(_debridge);
        debridge.flash(token, address(this), _amount, _data);
    }

     /// @param fee The fee amount in token due to the pool by the end of the flash
    /// @param data Any data passed through by the caller via the IDeBridgeGate#flash call
    function flashCallback(
        uint256 fee,
        bytes calldata data
    ) external override {
        IERC20 flashedToken = IERC20(token);
        uint256 balance = flashedToken.balanceOf(address(this));
        flashedToken.transfer(msg.sender, balance);
    }

}