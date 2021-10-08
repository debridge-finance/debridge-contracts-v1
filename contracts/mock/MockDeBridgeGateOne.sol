pragma solidity =0.8.7;

import "../transfers/DeBridgeGate.sol";

contract MockDeBridgeGateOne is DeBridgeGate {
    function get_flashFeeBps() public view returns (uint256) {
        return flashFeeBps;
    }

    function mock_set_deBridgeInfo(
        bytes32 deBridgeId, 
        address token, 
        uint256 chainId, 
        uint256 maxAmount, 
        uint256 collectedFees, 
        uint256 balance,
        uint256 lookedInStragegis,
        uint16 minReserveBps,
        uint256 chainFee,
        bool exist
        ) public {
        DebridgeInfo storage info = getDebridge[deBridgeId];
        info.tokenAddress=token; // asset address on the current chain
        info.chainId=chainId; // native chain id
        info.maxAmount=maxAmount; // minimal amount to transfer
        //info.collectedFees=collectedFees; // total collected fees that can be used to buy LINK
        info.balance=balance; // total locked assets
        info.lockedInStrategies=lookedInStragegis; // total locked assets in strategy (AAVE, Compound, etc)
        info.minReservesBps=minReserveBps; // minimal hot reserves in basis points (1/10000)
        //info.getChainFee[chainId]=chainFee; // whether the chain for the asset is supported
        info.exist=exist;
    }

    fallback() external payable {}

    function mock_set_chainSupportInfo(uint256 chainId, bool isSupported, uint256 fixedNativeFee, uint16 transferFeeBps) public {
        ChainSupportInfo memory info = ChainSupportInfo(fixedNativeFee, isSupported, transferFeeBps);
        getChainSupport[chainId]=info;
    }

    function mock_set_chainSupportInfoIsSupported(uint256 chainId, bool value) public {
        getChainSupport[chainId].isSupported=value;
    }

    function mock_set_deFiController(address controller) public {
       defiController=controller;
       
    }

    function mock_set_collectedFees(uint256 amount) public {
        //collectedFees=amount;
    }

    function mock_set_chainId(uint256 id) public {
       // chainId=id;
    }

    function mock_set_aggregatorLightVersion(uint8 version) public {
        //aggregatorLightVersion=version;
    }

    function mock_set_aggregatorFullVersion(uint8 version) public {
        //aggregatorFullVersion=version;
    }

    function mock_set_AggregatorInfoForOlgSinatureVerifier(uint8 version, address _aggregator, bool value) public {
       // AggregatorInfo storage infos = getOldSignatureVerifier[version];
       // infos.aggregator=_aggregator;
       // infos.isValid=value;
    }

    function mock_set_amountThreshold(bytes32 debridgeId, uint256 amount) public {
        getAmountThreshold[debridgeId]=amount;
    }

    function mock_set_excessConfirmations(uint8 amount) public {
        excessConfirmations=amount;
    }

    function mock_set_fixedFeeChainIdTo(bytes32 debridgeId, uint256 chainIdTo, uint256 fee) public {
        DebridgeFeeInfo storage info = getDebridgeFeeInfo[debridgeId];
        info.getChainFee[chainIdTo]=fee;
    }

    function mock_set_collectedFeesForDebridge(bytes32 debridgeId, uint256 amount)public {
        DebridgeFeeInfo storage info = getDebridgeFeeInfo[debridgeId];
        info.collectedFees=amount;
    }
    
    function call_internal_burn(
        bytes32 debridgeId, 
        uint256 amount,  
        uint256 chainIdTo, 
        uint256 deadline,
        bytes memory signatures, 
        bool useAssetFee
    ) public {
      // _burn(debridgeId, amount, chainIdTo, deadline, signatures, useAssetFee);
    }

    function call_internal_claim(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        SubmissionAutoParamsFrom memory _autoParams
    ) public {
        _claim(_submissionId, _debridgeId, _receiver, _amount, _autoParams);
    }

    function mock_set_is_submision_id_used(bytes32 submisionId, bool value) public {
        isSubmissionUsed[submisionId]=value;
    }

    function mock_set_is_blocked_submission_value(bytes32 submisionId, bool value) public {
        isBlockedSubmission[submisionId]=value;
    }

    function mock_set_signatureVerifier(address verifier) public {
        signatureVerifier=verifier;
    }

    function call_internal_send(
       bytes memory permit,
       address tokenAddress, 
       uint256 amount, 
       uint256 chainIdTo, 
       bool useAssetFee
    ) public payable{
        _send(permit, tokenAddress, amount, chainIdTo, useAssetFee);
    }

    function call_internal_checkAndDeployAsset(bytes32 debridgeId, address aggregator) public {
       // _checkAndDeployAsset(debridgeId, aggregator);
    }

    function call_internal_ensureReserve(bytes32 debridgeId, uint256 _amount) public {
       // DebridgeInfo storage info = getDebridge[debridgeId];
       // _ensureReserves(info, _amount);
    }


    function call_internal_mint( 
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data) public {
            //_mint(  _submissionId,
            //        _debridgeId,
            //        _receiver,
            //        _amount,
            //        _fallbackAddress,
            //        _executionFee,
            //        _data
             //   );
        }

    function mock_set_defi_controller(address _defi) public {
       // IDefiController controller = IDefiController(_defi);
       // defiController = controller;
    }

    function mock_set_weth(address wethAdrs) public {
        IWETH _weth = IWETH(wethAdrs);
        weth = _weth;
    }

    function mock_set_admin_role(address account) public {
        grantRole(DEFAULT_ADMIN_ROLE, account);
    }

    function mock_set_gov_monitoring(address account) public {
        grantRole(GOVMONITORING_ROLE, account);
    }

    function mock_set_worker(address account) public {
       // grantRole(WORKER_ROLE, account);
    }

    function mock_set_debridge_maxAmount(bytes32 debridgeId, uint256 maxAmount) public {
        getDebridge[debridgeId].maxAmount = maxAmount;
    }

    function call_internal_add_asset(bytes32 debridgeId, address token, bytes memory nativeAddress, uint256 nativeChainId) public {
        _addAsset(debridgeId, token, nativeAddress, nativeChainId);
    }

    function call_internal_checkConfirmations(bytes32 _submissionId, bytes32 _debridgeId, uint256 _amount, bytes calldata _signatures) public {
        _checkConfirmations(_submissionId,  _debridgeId, _amount, _signatures);
    }

    function mock_set_confirmationAggregator(address aggregator) public {
        confirmationAggregator = aggregator;
    }

    function mock_set_getDebridgeFeeInfo(bytes32 debridgeId, uint256 collected, uint256 chainIdTo, uint256 chainIdToFee, uint256 withdrawFee) public {
       DebridgeFeeInfo storage info =  getDebridgeFeeInfo[debridgeId];
       info.collectedFees = collected;
       info.getChainFee[chainIdTo]=chainIdToFee;
       info.withdrawnFees = withdrawFee;
    }

    function mock_set_withdrawFeeForDebridge(bytes32 debridgeId, uint256 withdrawFee) public {
       DebridgeFeeInfo storage info =  getDebridgeFeeInfo[debridgeId];
       info.withdrawnFees = withdrawFee;
    }

    function mock_set_disctounInfoFixBps(address caller, uint16 value) public {
        DiscountInfo storage info = feeDiscount[caller];
        info.discountFixBps = value;
    }

    function mock_set_native_info(address tokenAddress, bytes memory _nativeAddress, uint256 _nativeChainId) public {
        TokenInfo storage info = getNativeInfo[tokenAddress];
        info.nativeAddress = _nativeAddress;
        info.nativeChainId = _nativeChainId; 
    }

    function call_internal_validateAutoParams(bytes calldata _autoParams, uint256 _amount) public {
        _validateAutoParams(_autoParams, _amount);
    }

    function mock_get_deploy_id(
        bytes32 debridgeId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public returns(bytes32){
        bytes32 _deployId =  keccak256(abi.encodePacked(debridgeId, _name, _symbol, _decimals));
        return _deployId;
    }

    function receiveEther() external payable {}
   
}