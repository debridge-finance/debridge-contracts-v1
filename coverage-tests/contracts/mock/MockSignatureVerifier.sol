pragma solidity =0.8.7;

import "../interfaces/ISignatureVerifier.sol";

contract MockSignatureVerifier is ISignatureVerifier {

    address public wrappedAssetAddress;
    uint256 public nativeChainId;

    constructor(){}

     function submit(bytes32 _submissionId, bytes[] memory _signatures)
        external override
        returns (uint256 _confirmations, bool _blockConfirmationPassed){
            return (3, true);
        }

    function getWrappedAssetAddress(bytes32 _debridgeId)
        external
        view override
        returns (address _wrappedAssetAddress){

    }

    function deployAsset(bytes32 _debridgeId) 
        external override
        returns (address wrappedAssetAddress, uint256 nativeChainId){
            return (wrappedAssetAddress, nativeChainId);

    }

    function mock_set_WrapedAssetAddress(address wrappedAsset) public{
        wrappedAssetAddress=wrappedAsset;
    }

    function mock_set_NativeChainId(uint256 chainId) public {
        nativeChainId=chainId;
    }

}