// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IDeBridgeToken.sol";

contract DeBridgeToken is ERC20Upgradeable, AccessControlUpgradeable, IDeBridgeToken {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // minter role identifier
    bytes32 public DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint256) public nonces; // transfer's counter
    uint8 internal _decimals;

    /* ========== ERRORS ========== */

    error MinterBadRole();

    /* ========== MODIFIERS ========== */

    modifier onlyMinter() {
        if (!hasRole(MINTER_ROLE, msg.sender)) revert MinterBadRole();
        _;
    }

    /// @dev Constructor that initializes the most important configurations.
    /// @param name_ Asset's name.
    /// @param symbol_ Asset's symbol.
    /// @param minters The accounts allowed to int new tokens.
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address admin,
        address[] memory minters
    ) public initializer {
        _decimals = decimals_;
        name_ = string(abi.encodePacked("deBridge ",
            bytes(name_).length == 0 ? symbol_ : name_));
        symbol_ = string(abi.encodePacked("de", symbol_));
        // name_ =  string(abi.encodePacked("deBridge ", name_));
        __ERC20_init(name_, symbol_);

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        for (uint256 i = 0; i < minters.length; i++) {
            _setupRole(MINTER_ROLE, minters[i]);
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
                keccak256(bytes(name_)),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    /// @dev Issues new tokens.
    /// @param _receiver Token's receiver.
    /// @param _amount Amount to be minted.
    function mint(address _receiver, uint256 _amount) external override onlyMinter {
        _mint(_receiver, _amount);
    }

    /// @dev Destroys existed tokens.
    /// @param _amount Amount to be burnt.
    function burn(uint256 _amount) external override onlyMinter {
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
    ) external override {
        require(_deadline >= block.timestamp, "permit: EXPIRED");
        bytes32 digest = keccak256(
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

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
