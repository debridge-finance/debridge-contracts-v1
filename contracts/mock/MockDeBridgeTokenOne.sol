pragma solidity =0.8.7;

import "../periphery/DeBridgeToken.sol";

contract MockDeBridgeTokenOne is DeBridgeToken {

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _tokenDecimals,
        address _admin,
        address[] memory _minters
    ) {
        initialize(_name, _symbol, _tokenDecimals, _admin, _minters);
    }
}


