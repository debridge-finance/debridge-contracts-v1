pragma solidity =0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IDeBridgeToken.sol";

contract MockDeBridgeToken is ERC20Upgradeable, AccessControlUpgradeable, IDeBridgeToken {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // minter role identifier

    
    mapping(address => uint256) public nonces; // transfer's counter
    uint8 internal _decimals;

    /* ========== ERRORS ========== */

    error MinterBadRole();

    /* ========== MODIFIERS ========== */

    modifier onlyMinter() {
        if (!hasRole(MINTER_ROLE, msg.sender)) revert MinterBadRole();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _tokenDecimals,
        address _admin,
        address[] memory _minters
    ) {
        __ERC20_init(_name, _symbol);
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);

        for (uint256 i = 0; i < _minters.length; i++) {
            _setupRole(MINTER_ROLE, _minters[i]);
        }
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

    }

    function permit(
        address _owner,
        address  _spender, 
        uint256 _value, 
        uint256 _deadline, 
        uint8    _v, 
        bytes32  _r, 
        bytes32  _s
    ) external override {
        1+2;
    }

    function mint(address _receiver, uint256 _amount) external override onlyMinter {
        _mint(_receiver, _amount);
    }

    function burn(uint256 _amount) external override onlyMinter {
        _burn(msg.sender, _amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

}