// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWrappedAsset.sol";

contract WrappedAsset is AccessControl, IWrappedAsset, ERC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // minter role identifier
    bytes32 public DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint256) public nonces; // transfer's counter

    modifier onlyMinter {
        require(hasRole(MINTER_ROLE, msg.sender), "onlyMinter: bad role");
        _;
    }

    /// @dev Constructor that initializes the most important configurations.
    /// @param _name Asset's name.
    /// @param _symbol Asset's symbol.
    /// @param _minters The accounts allowed to int new tokens.
    constructor(
        string memory _name,
        string memory _symbol,
        address[] memory _minters
    ) ERC20(_name, _symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        for (uint256 i = 0; i < _minters.length; i++) {
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
                keccak256(_uintToBytes(chainId)),
                chainId,
                address(this)
            )
        );
    }

    /// @dev Issues new tokens.
    /// @param _receiver Token's receiver.
    /// @param _amount Amount to be minted.
    function mint(address _receiver, uint256 _amount)
        external
        override
        onlyMinter()
    {
        _mint(_receiver, _amount);
    }

    /// @dev Destroys existed tokens.
    /// @param _amount Amount to be burnt.
    function burn(uint256 _amount) external override onlyMinter() {
        _burn(msg.sender, _amount);
    }

    /// @dev Approves the spender by signature.
    /// @param _owner Token's owner.
    /// @param _spender Account to be approved.
    /// @param _value Amount to be approved.
    /// @param _deadline The permit valid until.
    /// @param _v Signature part.
    /// @param _r Signature part.
    /// @param _s Signature part.
    function permit(
        address _owner,
        address _spender,
        uint256 _value,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        require(_deadline >= block.timestamp, "UniswapV2: EXPIRED");
        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            _owner,
                            _spender,
                            _value,
                            nonces[_owner]++,
                            _deadline
                        )
                    )
                )
            );
        address recoveredAddress = ecrecover(digest, _v, _r, _s);
        require(
            recoveredAddress != address(0) && recoveredAddress == _owner,
            "permit: invalid signature"
        );
        _approve(_owner, _spender, _value);
    }

    /// @dev Converts number to bytes.
    /// @param _i Number.
    function _uintToBytes(uint256 _i) internal pure returns (bytes memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        return bstr;
    }
}
