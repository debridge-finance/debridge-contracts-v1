// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IDeToken.sol";

contract DeToken is ERC20Upgradeable, AccessControlUpgradeable, IDeToken {
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
    /// @param _name Asset's name.
    /// @param _symbol Asset's symbol.
    /// @param _minters The accounts allowed to int new tokens.
    function initialize(
        string memory _name,
        string memory _symbol,
        uint8 _tokenDecimals,
        address _admin,
        address[] memory _minters
    ) public initializer {
        _decimals = _tokenDecimals;
        _symbol = string(abi.encodePacked("de", _symbol));
        _name =  string(abi.encodePacked(_name, " (deBridge)"));
        __ERC20_init(_name, _symbol);

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
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
