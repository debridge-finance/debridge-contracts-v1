pragma solidity =0.8.7;


import "../interfaces/IWETH.sol";
import "../interfaces/IDefiController.sol";
import "../transfers/DeBridgeGate.sol";

contract MockAdminSetter {


    function set_weth_to_debridge(address _debridge, address weth) public{
        //IWETH newWeth = IWETH(weth);
        //DeBridgeGate debridge = DeBridgeGate(_debridge);
        //debridge.setWeth(newWeth);
    }

    function set_defi_controller_to_debridge(address _debridge, address _defi) public {
        //IDefiController newController = IDefiController(_defi);
        //DeBridgeGate debridge = DeBridgeGate(_debridge);
        //debridge.setDefiController(newController);
    }
}