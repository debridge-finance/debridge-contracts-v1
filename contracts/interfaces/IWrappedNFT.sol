// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IWrappedNFT is IERC721 {
    function mint(address _receiver, uint256 _tokenId) external;

    function burn(uint256 _tokenId) external;

    function permit(
        address _spender,
        uint256 _tokenId,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external;
}
