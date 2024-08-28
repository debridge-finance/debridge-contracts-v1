export type DlnDst = {
  version: "1.2.1";
  name: "dln_dst";
  instructions: [
    {
      name: "initializeState";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
        },
        {
          name: "protocolAuthority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authorizedDstNativeSender";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorizedDstNativeSenderWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "nativeTokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedSplTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "reallocState";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
        },
        {
          name: "protocolAuthority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "setStopTap";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
        },
        {
          name: "protocolAuthority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "stopTap";
          type: "publicKey";
        },
      ];
    },
    {
      name: "setProtocolAuthority";
      accounts: [
        {
          name: "updateState";
          accounts: [
            {
              name: "state";
              isMut: true;
              isSigner: false;
            },
            {
              name: "protocolAuthority";
              isMut: true;
              isSigner: true;
            },
            {
              name: "systemProgram";
              isMut: false;
              isSigner: false;
            },
          ];
        },
        {
          name: "newProtocolAuthority";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [];
    },
    {
      name: "initializeSrcContractAddress";
      accounts: [
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authorizedSrcContract";
          isMut: true;
          isSigner: false;
        },
        {
          name: "protocolAuthority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "chainId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "srcContract";
          type: "bytes";
        },
      ];
    },
    {
      name: "updateSrcContractAddress";
      accounts: [
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authorizedSrcContract";
          isMut: true;
          isSigner: false;
        },
        {
          name: "protocolAuthority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "chainId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "srcContract";
          type: "bytes";
        },
      ];
    },
    {
      name: "unpauseSrcContractAddress";
      accounts: [
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authorizedSrcContract";
          isMut: true;
          isSigner: false;
        },
        {
          name: "protocolAuthority";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: "chainId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "pauseSrcContractAddress";
      accounts: [
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authorizedSrcContract";
          isMut: true;
          isSigner: false;
        },
        {
          name: "stopTap";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: "chainId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "cancelOrder";
      docs: [
        "Send cancel order in [`Order::give.chain_id`]",
        "",
        "If the order was not filled or canceled earlier,",
        "[`Order::order_authority_address_dst`] can cancel it and get back the give part in [`Order::give.chain_id`] chain",
        "In the receive chain, the `dln_src::claim_order_cancel` will be called",
        "",
        "# Args",
        "* `unvalidated_order` - not fulfillied order only for cancel",
        "* `order_id` - identificator of order",
        "",
        "# Allowed",
        "By [`Order::order_authority_address_dst`] only",
      ];
      accounts: [
        {
          name: "takeOrderState";
          isMut: true;
          isSigner: false;
          docs: [
            "Take Order State-Account",
            "Not exists at moment of call, will inititlize in `cancel_order`",
            'Seeds: `[b"TAKE_ORDER_STATE", &order_id]`',
          ];
        },
        {
          name: "authorizedSrcContract";
          isMut: false;
          isSigner: false;
          docs: [
            "Account with address of dln::src contract in [`Order::give.chain_id`] chain",
            "Using here for validate supporting of order give chain and size of addresses",
            'Seeds: `[b"AUTHORIZED_SRC_CONTRACT", order.give.chain_id]`',
          ];
        },
        {
          name: "canceler";
          isMut: true;
          isSigner: true;
          docs: ["Must be equal to [`Order::order_authority_address_dst`]"];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "unvalidatedOrder";
          type: {
            defined: "Order";
          };
        },
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "prepareSend";
      accounts: [
        {
          name: "takeOrderState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sendFrom";
          isMut: true;
          isSigner: false;
          docs: ["👤 User Authority"];
        },
        {
          name: "sendFromWallet";
          isMut: true;
          isSigner: false;
          docs: ["👤 User token account from which money is sent"];
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "payerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "chainSupportInfo";
          isMut: false;
          isSigner: false;
          docs: ["The account that stores support and fee information for a specific chain"];
        },
        {
          name: "debridgeState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
          docs: ["Solana system program"];
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
          docs: ["System spl token program"];
        },
        {
          name: "instructions";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "fulfillOrder";
      docs: [
        "Full filled order from other chain",
        "",
        "During the execution of this method, the [`dln_core::Order::take.amount`] of [`Order::take.token_address`] from the `taker` (minus patch amount if [`patch_take_order`] called previously)",
        "will be sent to the [`Order::receiver_dst`]. After that, the `taker` will have the right to call `send_unlock` and receive the [`Order::give`] part in the [`Order::give.chain_id`] chain",
        "",
        "If an [`Order::external_call`] is presented, then this balance will be redirected to a special wallet, for subsequent use within the external call execution",
        "",
        "# Args",
        "* `unvalidated_order` - Full order for fullfill",
        "* `order_id` - identificator of order",
        "",
        "# Allowed",
        "* If [`Order::allowed_taker_dst`] is None then anyone who have [`Order::take.amount`] of [`Order::take.token_mint`] token",
        "* If [`Order::allowed_taker_dst`] is Some then only itself",
      ];
      accounts: [
        {
          name: "takeOrderState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "taker";
          isMut: true;
          isSigner: true;
        },
        {
          name: "takerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiverDst";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorizedSrcContract";
          isMut: false;
          isSigner: false;
        },
        {
          name: "takeOrderPatch";
          isMut: false;
          isSigner: false;
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "unvalidatedOrder";
          type: {
            defined: "Order";
          };
        },
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "unlockAuthority";
          type: {
            option: "publicKey";
          };
        },
      ];
    },
    {
      name: "patchTakeOrder";
      accounts: [
        {
          name: "takeOrderPatch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorizedSrcContract";
          isMut: false;
          isSigner: false;
        },
        {
          name: "patcher";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "unvalidatedOrder";
          type: {
            defined: "Order";
          };
        },
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "newSubtrahend";
          type: "u64";
        },
      ];
    },
    {
      name: "sendOrderCancel";
      accounts: [
        {
          name: "takeOrderState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "canceler";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authorizedSrcContract";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sending";
          accounts: [
            {
              name: "nonceStorage";
              isMut: true;
              isSigner: false;
              docs: [
                "The task of this account is to store the Nonce, which is necessary for the uniqueness of each Send",
                "Initialized on the fly, if needed",
              ];
            },
            {
              name: "sendFrom";
              isMut: true;
              isSigner: false;
              docs: ["👤 User Authority"];
            },
            {
              name: "sendFromWallet";
              isMut: true;
              isSigner: false;
              docs: ["👤 User token account from which money is sent"];
            },
            {
              name: "systemProgram";
              isMut: false;
              isSigner: false;
              docs: ["Solana system program"];
            },
            {
              name: "externalCallStorage";
              isMut: true;
              isSigner: false;
              docs: ["Storage for unlock\\cancel external call"];
            },
            {
              name: "externalCallMeta";
              isMut: true;
              isSigner: false;
              docs: [
                "The account that stores information about external call current state.",
                "",
                "It has [`ExternalCallMeta'] structure and is initialized when `submission_params` is not None.",
                "If `submission_params` is None this account is ignored",
              ];
            },
            {
              name: "discount";
              isMut: false;
              isSigner: false;
              docs: ["The account allows the user to get a discount when using the bridge"];
            },
            {
              name: "bridgeFee";
              isMut: false;
              isSigner: false;
              docs: [
                "The account determines whether it is possible to take fix fee from sending tokens",
                "and the percentage of these tokens. Otherwise fix fee in SOL is taken",
              ];
            },
            {
              name: "bridge";
              isMut: true;
              isSigner: false;
              docs: [
                "The account contains all the information about the operation of the bridge",
                "",
                "There are the address of the token with which the bridge works,",
                "the amount of liquidity stored, the collected fee amount and",
                "the settings for the operation of the bridge",
              ];
            },
            {
              name: "tokenMint";
              isMut: true;
              isSigner: false;
              docs: ["The mint account of the token with which the bridge works"];
            },
            {
              name: "stakingWallet";
              isMut: true;
              isSigner: false;
              docs: ["The account stores the user's staking tokens and the fee collected by the bridge in tokens"];
            },
            {
              name: "mintAuthority";
              isMut: false;
              isSigner: false;
              docs: [
                "The PDA that is the authorization for the transfer of tokens to the user",
                "",
                "It's wrapper token mint authority account for mint bridge,",
                "staking token account owner for send bridge and changing",
                "balance in bridge_data",
              ];
            },
            {
              name: "chainSupportInfo";
              isMut: false;
              isSigner: false;
              docs: ["The account that stores support and fee information for a specific chain"];
            },
            {
              name: "settingsProgram";
              isMut: false;
              isSigner: false;
              docs: ["Debridge settings  program"];
            },
            {
              name: "splTokenProgram";
              isMut: false;
              isSigner: false;
              docs: ["System spl token program"];
            },
            {
              name: "state";
              isMut: true;
              isSigner: false;
              docs: [
                "State account with service information",
                "",
                "This account from settings program is also a unique state for debridge program.",
              ];
            },
            {
              name: "feeBeneficiary";
              isMut: true;
              isSigner: false;
              docs: [
                "Beneficiary of the commission in the system",
                "",
                "The unique value of this account is stored in the state account",
                "Implied that this will be an account belonging to another program (FeeProxy),",
                "which will be responsible for the distribution of commissions",
              ];
            },
            {
              name: "debridgeProgram";
              isMut: false;
              isSigner: false;
            },
          ];
        },
      ];
      args: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "cancelBeneficiary";
          type: "bytes";
        },
        {
          name: "executionFee";
          type: "u64";
        },
      ];
    },
    {
      name: "sendUnlock";
      docs: [
        "Send unlock order in [`Order::give.chain_id`]",
        "",
        "If the order was filled and not unlocked yet, unlock authority from [`OrderState::FullFilled { unlock_authority }`] can unlock it and get the give part in [`Order::give.chain_id`] chain",
        "In the receive chain, the `dln_src::claim_unlock` will be called",
        "",
        "# Args",
        "* `order_id` - identificator of order",
        "* `beneficiary` - Any address in [`Order::take.chain_id`] chain",
        "* `execution_fee` - reward for executor in other chain, for auto-execute `dln_src::claim_unlock`",
        "",
        "# Allowed",
        "By unlock authority stored in [`OrderTakeStatus#variant.Fulfilled`] only",
      ];
      accounts: [
        {
          name: "takeOrderState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "unlocker";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authorizedSrcContract";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sending";
          accounts: [
            {
              name: "nonceStorage";
              isMut: true;
              isSigner: false;
              docs: [
                "The task of this account is to store the Nonce, which is necessary for the uniqueness of each Send",
                "Initialized on the fly, if needed",
              ];
            },
            {
              name: "sendFrom";
              isMut: true;
              isSigner: false;
              docs: ["👤 User Authority"];
            },
            {
              name: "sendFromWallet";
              isMut: true;
              isSigner: false;
              docs: ["👤 User token account from which money is sent"];
            },
            {
              name: "systemProgram";
              isMut: false;
              isSigner: false;
              docs: ["Solana system program"];
            },
            {
              name: "externalCallStorage";
              isMut: true;
              isSigner: false;
              docs: ["Storage for unlock\\cancel external call"];
            },
            {
              name: "externalCallMeta";
              isMut: true;
              isSigner: false;
              docs: [
                "The account that stores information about external call current state.",
                "",
                "It has [`ExternalCallMeta'] structure and is initialized when `submission_params` is not None.",
                "If `submission_params` is None this account is ignored",
              ];
            },
            {
              name: "discount";
              isMut: false;
              isSigner: false;
              docs: ["The account allows the user to get a discount when using the bridge"];
            },
            {
              name: "bridgeFee";
              isMut: false;
              isSigner: false;
              docs: [
                "The account determines whether it is possible to take fix fee from sending tokens",
                "and the percentage of these tokens. Otherwise fix fee in SOL is taken",
              ];
            },
            {
              name: "bridge";
              isMut: true;
              isSigner: false;
              docs: [
                "The account contains all the information about the operation of the bridge",
                "",
                "There are the address of the token with which the bridge works,",
                "the amount of liquidity stored, the collected fee amount and",
                "the settings for the operation of the bridge",
              ];
            },
            {
              name: "tokenMint";
              isMut: true;
              isSigner: false;
              docs: ["The mint account of the token with which the bridge works"];
            },
            {
              name: "stakingWallet";
              isMut: true;
              isSigner: false;
              docs: ["The account stores the user's staking tokens and the fee collected by the bridge in tokens"];
            },
            {
              name: "mintAuthority";
              isMut: false;
              isSigner: false;
              docs: [
                "The PDA that is the authorization for the transfer of tokens to the user",
                "",
                "It's wrapper token mint authority account for mint bridge,",
                "staking token account owner for send bridge and changing",
                "balance in bridge_data",
              ];
            },
            {
              name: "chainSupportInfo";
              isMut: false;
              isSigner: false;
              docs: ["The account that stores support and fee information for a specific chain"];
            },
            {
              name: "settingsProgram";
              isMut: false;
              isSigner: false;
              docs: ["Debridge settings  program"];
            },
            {
              name: "splTokenProgram";
              isMut: false;
              isSigner: false;
              docs: ["System spl token program"];
            },
            {
              name: "state";
              isMut: true;
              isSigner: false;
              docs: [
                "State account with service information",
                "",
                "This account from settings program is also a unique state for debridge program.",
              ];
            },
            {
              name: "feeBeneficiary";
              isMut: true;
              isSigner: false;
              docs: [
                "Beneficiary of the commission in the system",
                "",
                "The unique value of this account is stored in the state account",
                "Implied that this will be an account belonging to another program (FeeProxy),",
                "which will be responsible for the distribution of commissions",
              ];
            },
            {
              name: "debridgeProgram";
              isMut: false;
              isSigner: false;
            },
          ];
        },
      ];
      args: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "beneficiary";
          type: "bytes";
        },
        {
          name: "executionFee";
          type: "u64";
        },
      ];
    },
    {
      name: "sendBatchUnlock";
      docs: [
        "Send batch unlock order in [`Order::give.chain_id`]",
        "",
        "If the order was filled and not unlocked yet, unlock authority from [`OrderState::FullFilled { unlock_authority }`] can unlock it and get the give part in [`Order::give.chain_id`] chain",
        "In the receive chain, the `dln_src::claim_unlock` will be called",
        "",
        "# Args",
        "* `beneficiary` - Any address in [`Order::take.chain_id`] chain",
        "* `execution_fee` - reward for executor in other chain, for auto-execute `dln_src::claim_unlock`",
        "",
        "# Allowed",
        "By unlock authority stored in [`OrderTakeStatus#variant.Fulfilled`] only",
      ];
      accounts: [
        {
          name: "unlocker";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authorizedSrcContract";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sending";
          accounts: [
            {
              name: "nonceStorage";
              isMut: true;
              isSigner: false;
              docs: [
                "The task of this account is to store the Nonce, which is necessary for the uniqueness of each Send",
                "Initialized on the fly, if needed",
              ];
            },
            {
              name: "sendFrom";
              isMut: true;
              isSigner: false;
              docs: ["👤 User Authority"];
            },
            {
              name: "sendFromWallet";
              isMut: true;
              isSigner: false;
              docs: ["👤 User token account from which money is sent"];
            },
            {
              name: "systemProgram";
              isMut: false;
              isSigner: false;
              docs: ["Solana system program"];
            },
            {
              name: "externalCallStorage";
              isMut: true;
              isSigner: false;
              docs: ["Storage for unlock\\cancel external call"];
            },
            {
              name: "externalCallMeta";
              isMut: true;
              isSigner: false;
              docs: [
                "The account that stores information about external call current state.",
                "",
                "It has [`ExternalCallMeta'] structure and is initialized when `submission_params` is not None.",
                "If `submission_params` is None this account is ignored",
              ];
            },
            {
              name: "discount";
              isMut: false;
              isSigner: false;
              docs: ["The account allows the user to get a discount when using the bridge"];
            },
            {
              name: "bridgeFee";
              isMut: false;
              isSigner: false;
              docs: [
                "The account determines whether it is possible to take fix fee from sending tokens",
                "and the percentage of these tokens. Otherwise fix fee in SOL is taken",
              ];
            },
            {
              name: "bridge";
              isMut: true;
              isSigner: false;
              docs: [
                "The account contains all the information about the operation of the bridge",
                "",
                "There are the address of the token with which the bridge works,",
                "the amount of liquidity stored, the collected fee amount and",
                "the settings for the operation of the bridge",
              ];
            },
            {
              name: "tokenMint";
              isMut: true;
              isSigner: false;
              docs: ["The mint account of the token with which the bridge works"];
            },
            {
              name: "stakingWallet";
              isMut: true;
              isSigner: false;
              docs: ["The account stores the user's staking tokens and the fee collected by the bridge in tokens"];
            },
            {
              name: "mintAuthority";
              isMut: false;
              isSigner: false;
              docs: [
                "The PDA that is the authorization for the transfer of tokens to the user",
                "",
                "It's wrapper token mint authority account for mint bridge,",
                "staking token account owner for send bridge and changing",
                "balance in bridge_data",
              ];
            },
            {
              name: "chainSupportInfo";
              isMut: false;
              isSigner: false;
              docs: ["The account that stores support and fee information for a specific chain"];
            },
            {
              name: "settingsProgram";
              isMut: false;
              isSigner: false;
              docs: ["Debridge settings  program"];
            },
            {
              name: "splTokenProgram";
              isMut: false;
              isSigner: false;
              docs: ["System spl token program"];
            },
            {
              name: "state";
              isMut: true;
              isSigner: false;
              docs: [
                "State account with service information",
                "",
                "This account from settings program is also a unique state for debridge program.",
              ];
            },
            {
              name: "feeBeneficiary";
              isMut: true;
              isSigner: false;
              docs: [
                "Beneficiary of the commission in the system",
                "",
                "The unique value of this account is stored in the state account",
                "Implied that this will be an account belonging to another program (FeeProxy),",
                "which will be responsible for the distribution of commissions",
              ];
            },
            {
              name: "debridgeProgram";
              isMut: false;
              isSigner: false;
            },
          ];
        },
      ];
      args: [
        {
          name: "beneficiary";
          type: "bytes";
        },
        {
          name: "executionFee";
          type: "u64";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "takeOrderPatch";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderTakeFinalAmount";
            type: {
              option: "u64";
            };
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "authorizedSrcContract";
      type: {
        kind: "struct";
        fields: [
          {
            name: "srcContract";
            type: "bytes";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "isWorking";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "takeOrderState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "orderState";
            type: {
              defined: "OrderTakeStatus";
            };
          },
          {
            name: "sourceChainId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "state";
      type: {
        kind: "struct";
        fields: [
          {
            name: "protocolAuthority";
            type: "publicKey";
          },
          {
            name: "stopTap";
            type: "publicKey";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
  ];
  types: [
    {
      name: "Order";
      type: {
        kind: "struct";
        fields: [
          {
            name: "makerOrderNonce";
            docs: [
              "Unique nonce number for each maker",
              "Together with the maker, it forms the uniqueness for the order,",
              "which is important for calculating the order id",
            ];
            type: "u64";
          },
          {
            name: "makerSrc";
            docs: ["Order maker address", "Address in source chain"];
            type: "bytes";
          },
          {
            name: "give";
            docs: ["Offer given on source chain"];
            type: {
              defined: "Offer";
            };
          },
          {
            name: "take";
            docs: ["Offer to take in destination chain"];
            type: {
              defined: "Offer";
            };
          },
          {
            name: "receiverDst";
            docs: [
              "Address in dst chain",
              "Address of receiver_dst of tokens in target chain",
              "or",
              "address of external call executor if `external_call` presented",
            ];
            type: "bytes";
          },
          {
            name: "givePatchAuthoritySrc";
            docs: ["Address in source chain", "Can `patch_order_give`"];
            type: "bytes";
          },
          {
            name: "orderAuthorityAddressDst";
            docs: [
              "Address in destination chain",
              "Can `send_order_cancel`, `process_fallback` and `patch_order_take`",
            ];
            type: "bytes";
          },
          {
            name: "allowedTakerDst";
            docs: [
              "Address in destination chain",
              "If the field is `Some`, then only this address can call `full_fill_order` with this",
              "order",
            ];
            type: {
              option: "bytes";
            };
          },
          {
            name: "allowedCancelBeneficiarySrc";
            docs: ["Address in source chain", "If the field is `Some`, then only this address can receive cancel"];
            type: {
              option: "bytes";
            };
          },
          {
            name: "externalCall";
            docs: ["External call for automatically execution in target chain after execution of order"];
            type: {
              option: {
                defined: "ExternalCallParams";
              };
            };
          },
        ];
      };
    },
    {
      name: "ExternalCallParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "externalCallShortcut";
            type: {
              array: ["u8", 32];
            };
          },
        ];
      };
    },
    {
      name: "Offer";
      type: {
        kind: "struct";
        fields: [
          {
            name: "chainId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "tokenAddress";
            type: "bytes";
          },
          {
            name: "amount";
            type: {
              array: ["u8", 32];
            };
          },
        ];
      };
    },
    {
      name: "EvmClaimInstruction";
      type: {
        kind: "enum";
        variants: [
          {
            name: "ClaimOrderCancel";
          },
          {
            name: "ClaimUnlock";
          },
        ];
      };
    },
    {
      name: "EvmClaimBatchInstruction";
      type: {
        kind: "enum";
        variants: [
          {
            name: "ClaimBatchUnlock";
          },
        ];
      };
    },
    {
      name: "OrderTakeStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "OldFulfilled";
            fields: [
              {
                name: "unlockAuthority";
                type: "publicKey";
              },
            ];
          },
          {
            name: "SentUnlock";
            fields: [
              {
                name: "unlocker";
                type: "publicKey";
              },
            ];
          },
          {
            name: "Cancelled";
            fields: [
              {
                name: "canceler";
                type: "publicKey";
              },
              {
                name: "allowed_cancel_beneficiary_src";
                type: {
                  option: "bytes";
                };
              },
            ];
          },
          {
            name: "SentCancel";
            fields: [
              {
                name: "canceler";
                type: "publicKey";
              },
            ];
          },
          {
            name: "Fulfilled";
            fields: [
              {
                name: "unlockAuthority";
                type: "publicKey";
              },
              {
                name: "orderId";
                type: {
                  array: ["u8", 32];
                };
              },
            ];
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "StateInitialized";
      fields: [
        {
          name: "protocolAuthority";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "Fulfilled";
      fields: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
          index: false;
        },
        {
          name: "taker";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "SentUnlock";
      fields: [];
    },
    {
      name: "SentOrderCancel";
      fields: [];
    },
    {
      name: "OrderCancelled";
      fields: [];
    },
    {
      name: "DecreaseTakeAmount";
      fields: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
          index: false;
        },
        {
          name: "orderTakeFinalAmount";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "WrongAmount";
    },
    {
      code: 6001;
      name: "WrongBeneficiarySize";
    },
    {
      code: 6002;
      name: "WrongChainId";
    },
    {
      code: 6003;
      name: "WrongMint";
    },
    {
      code: 6004;
      name: "WrongOrderId";
    },
    {
      code: 6005;
      name: "WrongPrepareSendNextIxDiscriminator";
    },
    {
      code: 6006;
      name: "WrongPrepareSendNextIxProgramId";
    },
    {
      code: 6007;
      name: "WrongReceiverWalletOwner";
    },
    {
      code: 6008;
      name: "WrongTakerAta";
    },
    {
      code: 6009;
      name: "WrongReceiverAta";
    },
    {
      code: 6010;
      name: "WrongTakeTokenAddress";
    },
    {
      code: 6011;
      name: "WrongNativeTaker";
    },
    {
      code: 6012;
      name: "WrongNativeDst";
    },
    {
      code: 6013;
      name: "WrongTakeOrderPatch";
    },
    {
      code: 6014;
      name: "WrongAuthorizedSrcContract";
    },
    {
      code: 6015;
      name: "CalculationOrderIdError";
    },
    {
      code: 6016;
      name: "UnlockNotAllowed";
    },
    {
      code: 6017;
      name: "FixedFeeCalculationError";
    },
    {
      code: 6018;
      name: "NotAllowedEmptyBatch";
    },
    {
      code: 6019;
      name: "NotAllowedCancelBeneficiary";
    },
    {
      code: 6020;
      name: "NotAllowedTaker";
    },
    {
      code: 6021;
      name: "InvalidAllowedCancelBeneficiarySrcSize";
    },
    {
      code: 6022;
      name: "InvalidMakerSrcSize";
    },
    {
      code: 6023;
      name: "InvalidGivePatchAuthoritySrcSize";
    },
    {
      code: 6024;
      name: "InvalidReceiverDstSize";
    },
    {
      code: 6025;
      name: "InvalidOrderAuthorityDstSize";
    },
    {
      code: 6026;
      name: "InvalidAllowedTakerDst";
    },
    {
      code: 6027;
      name: "InvalidTakeOfferAmount";
    },
    {
      code: 6028;
      name: "MatchOverflowWhileCalculateInputAmount";
    },
    {
      code: 6029;
      name: "OverflowWhileApplyTakeOrderPatch";
    },
    {
      code: 6030;
      name: "ChainPaused";
    },
    {
      code: 6031;
      name: "WrongSigner";
    },
    {
      code: 6032;
      name: "ReallocNotNeeded";
    },
    {
      code: 6033;
      name: "OverflowError";
    },
  ];
};

export const IDL: DlnDst = {
  version: "1.2.1",
  name: "dln_dst",
  instructions: [
    {
      name: "initializeState",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
        },
        {
          name: "protocolAuthority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authorizedDstNativeSender",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorizedDstNativeSenderWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "nativeTokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedSplTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "reallocState",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
        },
        {
          name: "protocolAuthority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setStopTap",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
        },
        {
          name: "protocolAuthority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "stopTap",
          type: "publicKey",
        },
      ],
    },
    {
      name: "setProtocolAuthority",
      accounts: [
        {
          name: "updateState",
          accounts: [
            {
              name: "state",
              isMut: true,
              isSigner: false,
            },
            {
              name: "protocolAuthority",
              isMut: true,
              isSigner: true,
            },
            {
              name: "systemProgram",
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: "newProtocolAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "initializeSrcContractAddress",
      accounts: [
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authorizedSrcContract",
          isMut: true,
          isSigner: false,
        },
        {
          name: "protocolAuthority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "chainId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "srcContract",
          type: "bytes",
        },
      ],
    },
    {
      name: "updateSrcContractAddress",
      accounts: [
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authorizedSrcContract",
          isMut: true,
          isSigner: false,
        },
        {
          name: "protocolAuthority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "chainId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "srcContract",
          type: "bytes",
        },
      ],
    },
    {
      name: "unpauseSrcContractAddress",
      accounts: [
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authorizedSrcContract",
          isMut: true,
          isSigner: false,
        },
        {
          name: "protocolAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "chainId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
    {
      name: "pauseSrcContractAddress",
      accounts: [
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authorizedSrcContract",
          isMut: true,
          isSigner: false,
        },
        {
          name: "stopTap",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "chainId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
    {
      name: "cancelOrder",
      docs: [
        "Send cancel order in [`Order::give.chain_id`]",
        "",
        "If the order was not filled or canceled earlier,",
        "[`Order::order_authority_address_dst`] can cancel it and get back the give part in [`Order::give.chain_id`] chain",
        "In the receive chain, the `dln_src::claim_order_cancel` will be called",
        "",
        "# Args",
        "* `unvalidated_order` - not fulfillied order only for cancel",
        "* `order_id` - identificator of order",
        "",
        "# Allowed",
        "By [`Order::order_authority_address_dst`] only",
      ],
      accounts: [
        {
          name: "takeOrderState",
          isMut: true,
          isSigner: false,
          docs: [
            "Take Order State-Account",
            "Not exists at moment of call, will inititlize in `cancel_order`",
            'Seeds: `[b"TAKE_ORDER_STATE", &order_id]`',
          ],
        },
        {
          name: "authorizedSrcContract",
          isMut: false,
          isSigner: false,
          docs: [
            "Account with address of dln::src contract in [`Order::give.chain_id`] chain",
            "Using here for validate supporting of order give chain and size of addresses",
            'Seeds: `[b"AUTHORIZED_SRC_CONTRACT", order.give.chain_id]`',
          ],
        },
        {
          name: "canceler",
          isMut: true,
          isSigner: true,
          docs: ["Must be equal to [`Order::order_authority_address_dst`]"],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "unvalidatedOrder",
          type: {
            defined: "Order",
          },
        },
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
    {
      name: "prepareSend",
      accounts: [
        {
          name: "takeOrderState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sendFrom",
          isMut: true,
          isSigner: false,
          docs: ["👤 User Authority"],
        },
        {
          name: "sendFromWallet",
          isMut: true,
          isSigner: false,
          docs: ["👤 User token account from which money is sent"],
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "payerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "chainSupportInfo",
          isMut: false,
          isSigner: false,
          docs: ["The account that stores support and fee information for a specific chain"],
        },
        {
          name: "debridgeState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          docs: ["Solana system program"],
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
          docs: ["System spl token program"],
        },
        {
          name: "instructions",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "fulfillOrder",
      docs: [
        "Full filled order from other chain",
        "",
        "During the execution of this method, the [`dln_core::Order::take.amount`] of [`Order::take.token_address`] from the `taker` (minus patch amount if [`patch_take_order`] called previously)",
        "will be sent to the [`Order::receiver_dst`]. After that, the `taker` will have the right to call `send_unlock` and receive the [`Order::give`] part in the [`Order::give.chain_id`] chain",
        "",
        "If an [`Order::external_call`] is presented, then this balance will be redirected to a special wallet, for subsequent use within the external call execution",
        "",
        "# Args",
        "* `unvalidated_order` - Full order for fullfill",
        "* `order_id` - identificator of order",
        "",
        "# Allowed",
        "* If [`Order::allowed_taker_dst`] is None then anyone who have [`Order::take.amount`] of [`Order::take.token_mint`] token",
        "* If [`Order::allowed_taker_dst`] is Some then only itself",
      ],
      accounts: [
        {
          name: "takeOrderState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "taker",
          isMut: true,
          isSigner: true,
        },
        {
          name: "takerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiverDst",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorizedSrcContract",
          isMut: false,
          isSigner: false,
        },
        {
          name: "takeOrderPatch",
          isMut: false,
          isSigner: false,
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "unvalidatedOrder",
          type: {
            defined: "Order",
          },
        },
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "unlockAuthority",
          type: {
            option: "publicKey",
          },
        },
      ],
    },
    {
      name: "patchTakeOrder",
      accounts: [
        {
          name: "takeOrderPatch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorizedSrcContract",
          isMut: false,
          isSigner: false,
        },
        {
          name: "patcher",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "unvalidatedOrder",
          type: {
            defined: "Order",
          },
        },
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "newSubtrahend",
          type: "u64",
        },
      ],
    },
    {
      name: "sendOrderCancel",
      accounts: [
        {
          name: "takeOrderState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "canceler",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authorizedSrcContract",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sending",
          accounts: [
            {
              name: "nonceStorage",
              isMut: true,
              isSigner: false,
              docs: [
                "The task of this account is to store the Nonce, which is necessary for the uniqueness of each Send",
                "Initialized on the fly, if needed",
              ],
            },
            {
              name: "sendFrom",
              isMut: true,
              isSigner: false,
              docs: ["👤 User Authority"],
            },
            {
              name: "sendFromWallet",
              isMut: true,
              isSigner: false,
              docs: ["👤 User token account from which money is sent"],
            },
            {
              name: "systemProgram",
              isMut: false,
              isSigner: false,
              docs: ["Solana system program"],
            },
            {
              name: "externalCallStorage",
              isMut: true,
              isSigner: false,
              docs: ["Storage for unlock\\cancel external call"],
            },
            {
              name: "externalCallMeta",
              isMut: true,
              isSigner: false,
              docs: [
                "The account that stores information about external call current state.",
                "",
                "It has [`ExternalCallMeta'] structure and is initialized when `submission_params` is not None.",
                "If `submission_params` is None this account is ignored",
              ],
            },
            {
              name: "discount",
              isMut: false,
              isSigner: false,
              docs: ["The account allows the user to get a discount when using the bridge"],
            },
            {
              name: "bridgeFee",
              isMut: false,
              isSigner: false,
              docs: [
                "The account determines whether it is possible to take fix fee from sending tokens",
                "and the percentage of these tokens. Otherwise fix fee in SOL is taken",
              ],
            },
            {
              name: "bridge",
              isMut: true,
              isSigner: false,
              docs: [
                "The account contains all the information about the operation of the bridge",
                "",
                "There are the address of the token with which the bridge works,",
                "the amount of liquidity stored, the collected fee amount and",
                "the settings for the operation of the bridge",
              ],
            },
            {
              name: "tokenMint",
              isMut: true,
              isSigner: false,
              docs: ["The mint account of the token with which the bridge works"],
            },
            {
              name: "stakingWallet",
              isMut: true,
              isSigner: false,
              docs: ["The account stores the user's staking tokens and the fee collected by the bridge in tokens"],
            },
            {
              name: "mintAuthority",
              isMut: false,
              isSigner: false,
              docs: [
                "The PDA that is the authorization for the transfer of tokens to the user",
                "",
                "It's wrapper token mint authority account for mint bridge,",
                "staking token account owner for send bridge and changing",
                "balance in bridge_data",
              ],
            },
            {
              name: "chainSupportInfo",
              isMut: false,
              isSigner: false,
              docs: ["The account that stores support and fee information for a specific chain"],
            },
            {
              name: "settingsProgram",
              isMut: false,
              isSigner: false,
              docs: ["Debridge settings  program"],
            },
            {
              name: "splTokenProgram",
              isMut: false,
              isSigner: false,
              docs: ["System spl token program"],
            },
            {
              name: "state",
              isMut: true,
              isSigner: false,
              docs: [
                "State account with service information",
                "",
                "This account from settings program is also a unique state for debridge program.",
              ],
            },
            {
              name: "feeBeneficiary",
              isMut: true,
              isSigner: false,
              docs: [
                "Beneficiary of the commission in the system",
                "",
                "The unique value of this account is stored in the state account",
                "Implied that this will be an account belonging to another program (FeeProxy),",
                "which will be responsible for the distribution of commissions",
              ],
            },
            {
              name: "debridgeProgram",
              isMut: false,
              isSigner: false,
            },
          ],
        },
      ],
      args: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "cancelBeneficiary",
          type: "bytes",
        },
        {
          name: "executionFee",
          type: "u64",
        },
      ],
    },
    {
      name: "sendUnlock",
      docs: [
        "Send unlock order in [`Order::give.chain_id`]",
        "",
        "If the order was filled and not unlocked yet, unlock authority from [`OrderState::FullFilled { unlock_authority }`] can unlock it and get the give part in [`Order::give.chain_id`] chain",
        "In the receive chain, the `dln_src::claim_unlock` will be called",
        "",
        "# Args",
        "* `order_id` - identificator of order",
        "* `beneficiary` - Any address in [`Order::take.chain_id`] chain",
        "* `execution_fee` - reward for executor in other chain, for auto-execute `dln_src::claim_unlock`",
        "",
        "# Allowed",
        "By unlock authority stored in [`OrderTakeStatus#variant.Fulfilled`] only",
      ],
      accounts: [
        {
          name: "takeOrderState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "unlocker",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authorizedSrcContract",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sending",
          accounts: [
            {
              name: "nonceStorage",
              isMut: true,
              isSigner: false,
              docs: [
                "The task of this account is to store the Nonce, which is necessary for the uniqueness of each Send",
                "Initialized on the fly, if needed",
              ],
            },
            {
              name: "sendFrom",
              isMut: true,
              isSigner: false,
              docs: ["👤 User Authority"],
            },
            {
              name: "sendFromWallet",
              isMut: true,
              isSigner: false,
              docs: ["👤 User token account from which money is sent"],
            },
            {
              name: "systemProgram",
              isMut: false,
              isSigner: false,
              docs: ["Solana system program"],
            },
            {
              name: "externalCallStorage",
              isMut: true,
              isSigner: false,
              docs: ["Storage for unlock\\cancel external call"],
            },
            {
              name: "externalCallMeta",
              isMut: true,
              isSigner: false,
              docs: [
                "The account that stores information about external call current state.",
                "",
                "It has [`ExternalCallMeta'] structure and is initialized when `submission_params` is not None.",
                "If `submission_params` is None this account is ignored",
              ],
            },
            {
              name: "discount",
              isMut: false,
              isSigner: false,
              docs: ["The account allows the user to get a discount when using the bridge"],
            },
            {
              name: "bridgeFee",
              isMut: false,
              isSigner: false,
              docs: [
                "The account determines whether it is possible to take fix fee from sending tokens",
                "and the percentage of these tokens. Otherwise fix fee in SOL is taken",
              ],
            },
            {
              name: "bridge",
              isMut: true,
              isSigner: false,
              docs: [
                "The account contains all the information about the operation of the bridge",
                "",
                "There are the address of the token with which the bridge works,",
                "the amount of liquidity stored, the collected fee amount and",
                "the settings for the operation of the bridge",
              ],
            },
            {
              name: "tokenMint",
              isMut: true,
              isSigner: false,
              docs: ["The mint account of the token with which the bridge works"],
            },
            {
              name: "stakingWallet",
              isMut: true,
              isSigner: false,
              docs: ["The account stores the user's staking tokens and the fee collected by the bridge in tokens"],
            },
            {
              name: "mintAuthority",
              isMut: false,
              isSigner: false,
              docs: [
                "The PDA that is the authorization for the transfer of tokens to the user",
                "",
                "It's wrapper token mint authority account for mint bridge,",
                "staking token account owner for send bridge and changing",
                "balance in bridge_data",
              ],
            },
            {
              name: "chainSupportInfo",
              isMut: false,
              isSigner: false,
              docs: ["The account that stores support and fee information for a specific chain"],
            },
            {
              name: "settingsProgram",
              isMut: false,
              isSigner: false,
              docs: ["Debridge settings  program"],
            },
            {
              name: "splTokenProgram",
              isMut: false,
              isSigner: false,
              docs: ["System spl token program"],
            },
            {
              name: "state",
              isMut: true,
              isSigner: false,
              docs: [
                "State account with service information",
                "",
                "This account from settings program is also a unique state for debridge program.",
              ],
            },
            {
              name: "feeBeneficiary",
              isMut: true,
              isSigner: false,
              docs: [
                "Beneficiary of the commission in the system",
                "",
                "The unique value of this account is stored in the state account",
                "Implied that this will be an account belonging to another program (FeeProxy),",
                "which will be responsible for the distribution of commissions",
              ],
            },
            {
              name: "debridgeProgram",
              isMut: false,
              isSigner: false,
            },
          ],
        },
      ],
      args: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "beneficiary",
          type: "bytes",
        },
        {
          name: "executionFee",
          type: "u64",
        },
      ],
    },
    {
      name: "sendBatchUnlock",
      docs: [
        "Send batch unlock order in [`Order::give.chain_id`]",
        "",
        "If the order was filled and not unlocked yet, unlock authority from [`OrderState::FullFilled { unlock_authority }`] can unlock it and get the give part in [`Order::give.chain_id`] chain",
        "In the receive chain, the `dln_src::claim_unlock` will be called",
        "",
        "# Args",
        "* `beneficiary` - Any address in [`Order::take.chain_id`] chain",
        "* `execution_fee` - reward for executor in other chain, for auto-execute `dln_src::claim_unlock`",
        "",
        "# Allowed",
        "By unlock authority stored in [`OrderTakeStatus#variant.Fulfilled`] only",
      ],
      accounts: [
        {
          name: "unlocker",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authorizedSrcContract",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sending",
          accounts: [
            {
              name: "nonceStorage",
              isMut: true,
              isSigner: false,
              docs: [
                "The task of this account is to store the Nonce, which is necessary for the uniqueness of each Send",
                "Initialized on the fly, if needed",
              ],
            },
            {
              name: "sendFrom",
              isMut: true,
              isSigner: false,
              docs: ["👤 User Authority"],
            },
            {
              name: "sendFromWallet",
              isMut: true,
              isSigner: false,
              docs: ["👤 User token account from which money is sent"],
            },
            {
              name: "systemProgram",
              isMut: false,
              isSigner: false,
              docs: ["Solana system program"],
            },
            {
              name: "externalCallStorage",
              isMut: true,
              isSigner: false,
              docs: ["Storage for unlock\\cancel external call"],
            },
            {
              name: "externalCallMeta",
              isMut: true,
              isSigner: false,
              docs: [
                "The account that stores information about external call current state.",
                "",
                "It has [`ExternalCallMeta'] structure and is initialized when `submission_params` is not None.",
                "If `submission_params` is None this account is ignored",
              ],
            },
            {
              name: "discount",
              isMut: false,
              isSigner: false,
              docs: ["The account allows the user to get a discount when using the bridge"],
            },
            {
              name: "bridgeFee",
              isMut: false,
              isSigner: false,
              docs: [
                "The account determines whether it is possible to take fix fee from sending tokens",
                "and the percentage of these tokens. Otherwise fix fee in SOL is taken",
              ],
            },
            {
              name: "bridge",
              isMut: true,
              isSigner: false,
              docs: [
                "The account contains all the information about the operation of the bridge",
                "",
                "There are the address of the token with which the bridge works,",
                "the amount of liquidity stored, the collected fee amount and",
                "the settings for the operation of the bridge",
              ],
            },
            {
              name: "tokenMint",
              isMut: true,
              isSigner: false,
              docs: ["The mint account of the token with which the bridge works"],
            },
            {
              name: "stakingWallet",
              isMut: true,
              isSigner: false,
              docs: ["The account stores the user's staking tokens and the fee collected by the bridge in tokens"],
            },
            {
              name: "mintAuthority",
              isMut: false,
              isSigner: false,
              docs: [
                "The PDA that is the authorization for the transfer of tokens to the user",
                "",
                "It's wrapper token mint authority account for mint bridge,",
                "staking token account owner for send bridge and changing",
                "balance in bridge_data",
              ],
            },
            {
              name: "chainSupportInfo",
              isMut: false,
              isSigner: false,
              docs: ["The account that stores support and fee information for a specific chain"],
            },
            {
              name: "settingsProgram",
              isMut: false,
              isSigner: false,
              docs: ["Debridge settings  program"],
            },
            {
              name: "splTokenProgram",
              isMut: false,
              isSigner: false,
              docs: ["System spl token program"],
            },
            {
              name: "state",
              isMut: true,
              isSigner: false,
              docs: [
                "State account with service information",
                "",
                "This account from settings program is also a unique state for debridge program.",
              ],
            },
            {
              name: "feeBeneficiary",
              isMut: true,
              isSigner: false,
              docs: [
                "Beneficiary of the commission in the system",
                "",
                "The unique value of this account is stored in the state account",
                "Implied that this will be an account belonging to another program (FeeProxy),",
                "which will be responsible for the distribution of commissions",
              ],
            },
            {
              name: "debridgeProgram",
              isMut: false,
              isSigner: false,
            },
          ],
        },
      ],
      args: [
        {
          name: "beneficiary",
          type: "bytes",
        },
        {
          name: "executionFee",
          type: "u64",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "takeOrderPatch",
      type: {
        kind: "struct",
        fields: [
          {
            name: "orderTakeFinalAmount",
            type: {
              option: "u64",
            },
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "authorizedSrcContract",
      type: {
        kind: "struct",
        fields: [
          {
            name: "srcContract",
            type: "bytes",
          },
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "isWorking",
            type: "bool",
          },
        ],
      },
    },
    {
      name: "takeOrderState",
      type: {
        kind: "struct",
        fields: [
          {
            name: "orderState",
            type: {
              defined: "OrderTakeStatus",
            },
          },
          {
            name: "sourceChainId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "state",
      type: {
        kind: "struct",
        fields: [
          {
            name: "protocolAuthority",
            type: "publicKey",
          },
          {
            name: "stopTap",
            type: "publicKey",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "Order",
      type: {
        kind: "struct",
        fields: [
          {
            name: "makerOrderNonce",
            docs: [
              "Unique nonce number for each maker",
              "Together with the maker, it forms the uniqueness for the order,",
              "which is important for calculating the order id",
            ],
            type: "u64",
          },
          {
            name: "makerSrc",
            docs: ["Order maker address", "Address in source chain"],
            type: "bytes",
          },
          {
            name: "give",
            docs: ["Offer given on source chain"],
            type: {
              defined: "Offer",
            },
          },
          {
            name: "take",
            docs: ["Offer to take in destination chain"],
            type: {
              defined: "Offer",
            },
          },
          {
            name: "receiverDst",
            docs: [
              "Address in dst chain",
              "Address of receiver_dst of tokens in target chain",
              "or",
              "address of external call executor if `external_call` presented",
            ],
            type: "bytes",
          },
          {
            name: "givePatchAuthoritySrc",
            docs: ["Address in source chain", "Can `patch_order_give`"],
            type: "bytes",
          },
          {
            name: "orderAuthorityAddressDst",
            docs: [
              "Address in destination chain",
              "Can `send_order_cancel`, `process_fallback` and `patch_order_take`",
            ],
            type: "bytes",
          },
          {
            name: "allowedTakerDst",
            docs: [
              "Address in destination chain",
              "If the field is `Some`, then only this address can call `full_fill_order` with this",
              "order",
            ],
            type: {
              option: "bytes",
            },
          },
          {
            name: "allowedCancelBeneficiarySrc",
            docs: ["Address in source chain", "If the field is `Some`, then only this address can receive cancel"],
            type: {
              option: "bytes",
            },
          },
          {
            name: "externalCall",
            docs: ["External call for automatically execution in target chain after execution of order"],
            type: {
              option: {
                defined: "ExternalCallParams",
              },
            },
          },
        ],
      },
    },
    {
      name: "ExternalCallParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "externalCallShortcut",
            type: {
              array: ["u8", 32],
            },
          },
        ],
      },
    },
    {
      name: "Offer",
      type: {
        kind: "struct",
        fields: [
          {
            name: "chainId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "tokenAddress",
            type: "bytes",
          },
          {
            name: "amount",
            type: {
              array: ["u8", 32],
            },
          },
        ],
      },
    },
    {
      name: "EvmClaimInstruction",
      type: {
        kind: "enum",
        variants: [
          {
            name: "ClaimOrderCancel",
          },
          {
            name: "ClaimUnlock",
          },
        ],
      },
    },
    {
      name: "EvmClaimBatchInstruction",
      type: {
        kind: "enum",
        variants: [
          {
            name: "ClaimBatchUnlock",
          },
        ],
      },
    },
    {
      name: "OrderTakeStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "OldFulfilled",
            fields: [
              {
                name: "unlockAuthority",
                type: "publicKey",
              },
            ],
          },
          {
            name: "SentUnlock",
            fields: [
              {
                name: "unlocker",
                type: "publicKey",
              },
            ],
          },
          {
            name: "Cancelled",
            fields: [
              {
                name: "canceler",
                type: "publicKey",
              },
              {
                name: "allowed_cancel_beneficiary_src",
                type: {
                  option: "bytes",
                },
              },
            ],
          },
          {
            name: "SentCancel",
            fields: [
              {
                name: "canceler",
                type: "publicKey",
              },
            ],
          },
          {
            name: "Fulfilled",
            fields: [
              {
                name: "unlockAuthority",
                type: "publicKey",
              },
              {
                name: "orderId",
                type: {
                  array: ["u8", 32],
                },
              },
            ],
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "StateInitialized",
      fields: [
        {
          name: "protocolAuthority",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "Fulfilled",
      fields: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
          index: false,
        },
        {
          name: "taker",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "SentUnlock",
      fields: [],
    },
    {
      name: "SentOrderCancel",
      fields: [],
    },
    {
      name: "OrderCancelled",
      fields: [],
    },
    {
      name: "DecreaseTakeAmount",
      fields: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
          index: false,
        },
        {
          name: "orderTakeFinalAmount",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "WrongAmount",
    },
    {
      code: 6001,
      name: "WrongBeneficiarySize",
    },
    {
      code: 6002,
      name: "WrongChainId",
    },
    {
      code: 6003,
      name: "WrongMint",
    },
    {
      code: 6004,
      name: "WrongOrderId",
    },
    {
      code: 6005,
      name: "WrongPrepareSendNextIxDiscriminator",
    },
    {
      code: 6006,
      name: "WrongPrepareSendNextIxProgramId",
    },
    {
      code: 6007,
      name: "WrongReceiverWalletOwner",
    },
    {
      code: 6008,
      name: "WrongTakerAta",
    },
    {
      code: 6009,
      name: "WrongReceiverAta",
    },
    {
      code: 6010,
      name: "WrongTakeTokenAddress",
    },
    {
      code: 6011,
      name: "WrongNativeTaker",
    },
    {
      code: 6012,
      name: "WrongNativeDst",
    },
    {
      code: 6013,
      name: "WrongTakeOrderPatch",
    },
    {
      code: 6014,
      name: "WrongAuthorizedSrcContract",
    },
    {
      code: 6015,
      name: "CalculationOrderIdError",
    },
    {
      code: 6016,
      name: "UnlockNotAllowed",
    },
    {
      code: 6017,
      name: "FixedFeeCalculationError",
    },
    {
      code: 6018,
      name: "NotAllowedEmptyBatch",
    },
    {
      code: 6019,
      name: "NotAllowedCancelBeneficiary",
    },
    {
      code: 6020,
      name: "NotAllowedTaker",
    },
    {
      code: 6021,
      name: "InvalidAllowedCancelBeneficiarySrcSize",
    },
    {
      code: 6022,
      name: "InvalidMakerSrcSize",
    },
    {
      code: 6023,
      name: "InvalidGivePatchAuthoritySrcSize",
    },
    {
      code: 6024,
      name: "InvalidReceiverDstSize",
    },
    {
      code: 6025,
      name: "InvalidOrderAuthorityDstSize",
    },
    {
      code: 6026,
      name: "InvalidAllowedTakerDst",
    },
    {
      code: 6027,
      name: "InvalidTakeOfferAmount",
    },
    {
      code: 6028,
      name: "MatchOverflowWhileCalculateInputAmount",
    },
    {
      code: 6029,
      name: "OverflowWhileApplyTakeOrderPatch",
    },
    {
      code: 6030,
      name: "ChainPaused",
    },
    {
      code: 6031,
      name: "WrongSigner",
    },
    {
      code: 6032,
      name: "ReallocNotNeeded",
    },
    {
      code: 6033,
      name: "OverflowError",
    },
  ],
};
