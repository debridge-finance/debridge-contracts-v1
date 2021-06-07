// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MockNFTToken is ERC721 {

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {
    }

    function mint(address _receiver, uint256 _tokenId) external {
        _mint(_receiver, _tokenId);
    }

    function burn(uint256 _tokenId) external {
        _burn(_tokenId);
    }
}
