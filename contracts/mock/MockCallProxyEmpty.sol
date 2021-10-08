pragma solidity =0.8.7;

import "../interfaces/ICallProxy.sol";


contract MockCallProxyEmpty is ICallProxy {

    constructor(){}

    function call
    (
        address _reserveAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender
    ) 
    external payable override returns(bool)
    {
        return true;
    }

    function callERC20(
        address _token,
        address _reserveAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender
    )external override returns(bool) {
        return true;
    }
}