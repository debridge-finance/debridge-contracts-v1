// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWrappedNFT.sol";

contract WrappedNFT is AccessControl, IWrappedNFT, ERC721 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // minter role identifier
    bytes32 public DOMAIN_SEPARATOR;
    // keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH =
        0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;
    mapping(address => uint256) public nonces; // transfer's counter
    string public baseURI;

    modifier onlyMinter {
        require(hasRole(MINTER_ROLE, msg.sender), "onlyMinter: bad role");
        _;
    }

    /// @dev Constructor that initialize the most important configurations.
    /// @param _name Asset's name
    /// @param _symbol Asset's symbol
    /// @param _minters The accounts allowed to mint new tokens
    constructor(
        string memory _name,
        string memory _symbol,
        address[] memory _minters
    ) ERC721(_name, _symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        for (uint256 i = 0; i < _minters.length; i ++) {
            _setupRole(MINTER_ROLE, _minters[i]);
        }

        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(_name)),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    /// @dev Issues new token
    /// @param _to new Token's owner
    /// @param _tokenId new Token's id
    function mint(address _to, uint256 _tokenId) external override onlyMinter(){
        _mint(_to, _tokenId);
    }

    /// @dev Destory an existing token
    /// @param _tokenId Id of token
    function burn(uint256 _tokenId) external override onlyMinter() {
        _burn(_tokenId);
    }

    /// @dev Approves the spender by signature
    /// @param _spender Account to be approved
    /// @param _tokenId Token Id to be approved
    /// @param _deadline The permit valids until
    /// @param _v Signature
    /// @param _r Signature
    /// @param _s Signature
    function permit(
        address _spender,
        uint256 _tokenId,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override{
        require(_deadline >= block.timestamp, "permit: EXPIRED");
        address owner = ownerOf(_tokenId);
        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            _spender,
                            _tokenId,
                            nonces[owner]++,
                            _deadline
                        )
                    )
                )
            );

        require(_spender != owner, "approval to current owner");
        
        address recoveredAddress = ecrecover(digest, _v, _r, _s);
        require(recoveredAddress != address(0), "permit: invalid signature");
        require(recoveredAddress == owner, "permit: Unauthorized");
        _approve(_spender, _tokenId);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string) {
        return string(abi.encodePacked("ipfs://", _symbol));
    }
}