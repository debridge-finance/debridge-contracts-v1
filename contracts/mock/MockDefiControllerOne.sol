pragma solidity =0.8.7;

import "../interfaces/IDefiController.sol";

contract MockDefiControllerOne is IDefiController {

    function claimReserve(address _tokenAddress, uint256 _amount) external override {
        1+2;
    }

}