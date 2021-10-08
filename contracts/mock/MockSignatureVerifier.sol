pragma solidity =0.8.7;

import "../interfaces/ISignatureVerifier.sol";

contract MockSignatureVerifier is ISignatureVerifier {

    address public wrappedAssetAddress;
    uint256 public nativeChainId;

    constructor(){}

     function submit(bytes32 _submissionId, bytes memory _signatures, uint8 _excessConfirmations)
        external override
        //returns (uint8 _confirmations, bool _blockConfirmationPassed)
        {
           1+2; //return (3, true);
        }

    function getWrappedAssetAddress(bytes32 _debridgeId)
        external
        view //override
        returns (address _wrappedAssetAddress){

    }

    function deployAsset(bytes32 _debridgeId) 
        external //override
        returns (address wrappedAssetAddress, address nativeAddress, uint256 nativeChainId){
            return (wrappedAssetAddress, nativeAddress, nativeChainId);

    }

    function mock_set_WrapedAssetAddress(address wrappedAsset) public{
        wrappedAssetAddress=wrappedAsset;
    }

    function mock_set_NativeChainId(uint256 chainId) public {
        nativeChainId=chainId;
    }

}