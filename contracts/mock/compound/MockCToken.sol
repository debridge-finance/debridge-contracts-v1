pragma solidity ^0.8.2;

import "./Comptroller.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockCToken is ERC20 {
    using SafeERC20 for IERC20;
    address public admin;
    address public comptroller;
    uint8 _decimals;
    address public immutable UNDERLYING_ASSET_ADDRESS;
    uint256 public accrualBlockNumber;
    mapping(address => uint256) public accountTokens;

    event Mint(address indexed to, uint256 value, uint256 index);
    event Burn(address indexed from, address indexed target, uint256 value, uint256 index);

    constructor(
        address _comptroller,
        string memory _name,
        string memory _symbol,
        uint8 decimals_,
        address uderlyingAssetAddress
    ) ERC20(_name, _symbol) {
        require(accrualBlockNumber == 0, "market may only be initialized once");

        UNDERLYING_ASSET_ADDRESS = uderlyingAssetAddress;
        _setComptroller(_comptroller);

        accrualBlockNumber = getBlockNumber();

        _decimals = decimals_;
        comptroller = _comptroller;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
         _transfer(sender, recipient, amount);

        accountTokens[sender] -= amount;
        accountTokens[recipient] += amount;

        return true;
    }

    function balanceOf(address owner) public view override returns (uint256) {
        return accountTokens[owner];
    }

    function balanceOfCToken(address user)
    public
    returns (uint256)
    {
        uint256 userBalance = accountTokens[user];
        accountTokens[user] = userBalance /* TODO: add accrued rewards */;
        return accountTokens[user];
    }

    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool) {
        accountTokens[user] += amount;
        _mint(user, amount);

        emit Transfer(address(0), user, amount);
        emit Mint(user, amount, index);
    }

    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external {
        
        accountTokens[user] -= amount;
        _burn(user, amount);

        IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);

        emit Transfer(user, address(0), amount);
        emit Burn(user, receiverOfUnderlying, amount, index);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function getBlockNumber() internal view returns (uint) {
        return block.number;
    }

    function _setComptroller(address newComptroller) public {
        comptroller = newComptroller;
    }
}