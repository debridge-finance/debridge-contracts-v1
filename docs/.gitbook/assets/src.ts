export type DlnSrc = {
  version: "3.0.0";
  name: "dln_src";
  instructions: [
    {
      name: "initializeState";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "feeLedger";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "newState";
          type: {
            defined: "NewState";
          };
        },
      ];
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
      name: "setFixedFee";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
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
          name: "fixedFee";
          type: "u64";
        },
      ];
    },
    {
      name: "setPercentFeeBps";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
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
          name: "percentFeeBps";
          type: "u64";
        },
      ];
    },
    {
      name: "setIsFeeRefund";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
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
          name: "isFeeRefund";
          type: "bool";
        },
      ];
    },
    {
      name: "setFeeBeneficiry";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
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
          name: "feeBeneficiary";
          type: "publicKey";
        },
      ];
    },
    {
      name: "setStopTap";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
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
              docs: [
                "State account with service information",
                "There is a single state account for the entire program",
              ];
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
      name: "pauseState";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
        },
        {
          name: "stopTap";
          isMut: true;
          isSigner: true;
        },
      ];
      args: [];
    },
    {
      name: "unpauseState";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
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
      name: "updateAuthorizedNativeSender";
      accounts: [
        {
          name: "state";
          isMut: false;
          isSigner: false;
          docs: ["State account with service information", "There is a single state account for the entire program"];
        },
        {
          name: "protocolAuthority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authorizedNativeSender";
          isMut: true;
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
          name: "chainId";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "newAuthorizedNativeSender";
          type: "bytes";
        },
      ];
    },
    {
      name: "createOrder";
      docs: [
        "Create new order for dln system",
        "",
        "# Args",
        "* `order_args` - Input parameters for new order",
        "* `affiliate_fee` - Additional optional commission charged by integrators of DLN",
        "* `referral_code` - referral code, if Some then used in event",
        "",
        "# Allowed",
        "Anyone who have [`CreateOrderArgs::give_original_amount`] of [`CreatingOrder::token_mint`] token",
      ];
      accounts: [
        {
          name: "maker";
          isMut: true;
          isSigner: true;
        },
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "giveOrderState";
          isMut: true;
          isSigner: false;
          docs: [
            "Account with GiveOrderState",
            "seeds = [GiveOrderState::SEED, &order_id.to_bytes()],",
            "Will be initialized inside [`create_order`]",
          ];
        },
        {
          name: "authorizedNativeSender";
          isMut: false;
          isSigner: false;
        },
        {
          name: "makerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "giveOrderWallet";
          isMut: true;
          isSigner: false;
          docs: ["Wallet of `give_order_state`", "Will be initialized inside [`create_order`]"];
        },
        {
          name: "nonceMaster";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeLedgerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
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
      ];
      args: [
        {
          name: "orderArgs";
          type: {
            defined: "CreateOrderArgs";
          };
        },
        {
          name: "affiliateFee";
          type: {
            option: {
              defined: "AffiliateFee";
            };
          };
        },
        {
          name: "referralCode";
          type: {
            option: "u32";
          };
        },
      ];
    },
    {
      name: "createOrderWithNonce";
      docs: [
        "Create new order for dln system",
        "",
        "# Args",
        "* `order_args` - Input parameters for new order",
        "* `affiliate_fee` - Additional optional commission charged by integrators of DLN",
        "* `referral_code` - referral code, if Some then used in event",
        "* `nonce` - salt to make the order unique",
        "",
        "# Allowed",
        "Anyone who have [`CreateOrderArgs::give_original_amount`] of [`CreatingOrder::token_mint`] token",
      ];
      accounts: [
        {
          name: "maker";
          isMut: true;
          isSigner: true;
        },
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "giveOrderState";
          isMut: true;
          isSigner: false;
          docs: [
            "Account with GiveOrderState",
            "seeds = [GiveOrderState::SEED, &order_id.to_bytes()],",
            "Will be initialized inside [`create_order`]",
          ];
        },
        {
          name: "authorizedNativeSender";
          isMut: false;
          isSigner: false;
        },
        {
          name: "makerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "giveOrderWallet";
          isMut: true;
          isSigner: false;
          docs: ["Wallet of `give_order_state`", "Will be initialized inside [`create_order`]"];
        },
        {
          name: "nonceMaster";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeLedgerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
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
      ];
      args: [
        {
          name: "orderArgs";
          type: {
            defined: "CreateOrderArgs";
          };
        },
        {
          name: "affiliateFee";
          type: {
            option: {
              defined: "AffiliateFee";
            };
          };
        },
        {
          name: "referralCode";
          type: {
            option: "u32";
          };
        },
        {
          name: "nonce";
          type: "u64";
        },
        {
          name: "metadata";
          type: "bytes";
        },
      ];
    },
    {
      name: "patchOrderGive";
      accounts: [
        {
          name: "giveOrderState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "giveOrderWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "givePatchAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "givePatchAuthorityWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
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
          name: "inputAdditionToGiveAmount";
          type: "u64";
        },
      ];
    },
    {
      name: "claimUnlock";
      docs: [
        "Claim unlock from order take chain",
        "Implying that the order was fulfilled and sent unlock by taker from [`OrderState::FullFilled { taker }`]",
        "",
        "# Args",
        "* `order_id` - order id for claim",
        "",
        "# Allowed",
        "Only debridge external call executor with debridge transaction in source chain from taker of order",
      ];
      accounts: [
        {
          name: "submission";
          isMut: false;
          isSigner: false;
          docs: ["0"];
        },
        {
          name: "submissionAuthority";
          isMut: true;
          isSigner: true;
          docs: ["1"];
        },
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: [
            "2",
            "State account with service information",
            "There is a single state account for the entire program",
          ];
        },
        {
          name: "feeLedger";
          isMut: true;
          isSigner: false;
          docs: ["3"];
        },
        {
          name: "feeLedgerWallet";
          isMut: true;
          isSigner: false;
          docs: ["4"];
        },
        {
          name: "instructions";
          isMut: false;
          isSigner: false;
          docs: ["5"];
        },
        {
          name: "giveOrderState";
          isMut: true;
          isSigner: false;
          docs: ["6"];
        },
        {
          name: "actionBeneficiaryWallet";
          isMut: true;
          isSigner: false;
          docs: [
            "Action beneficiary ATA",
            "If empty, then automatically initialized ATA (determined based on [`AccountInfo::owner`])",
          ];
        },
        {
          name: "actionBeneficiary";
          isMut: true;
          isSigner: false;
          docs: ["8"];
        },
        {
          name: "giveOrderWallet";
          isMut: true;
          isSigner: false;
          docs: ["9"];
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
          docs: ["10"];
        },
        {
          name: "authorizedNativeSender";
          isMut: false;
          isSigner: false;
          docs: ["11"];
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
          docs: ["12"];
        },
      ];
      args: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "claimOrderCancel";
      docs: [
        "Claim cancel from order take chain",
        "Implying that the order was not fulfilled and sent canceled by [`Order::order_authority_address_dst`]",
        "",
        "# Args",
        "* `order_id` - order id for claim",
        "",
        "# Allowed",
        "Only debridge external call executor with debridge transaction in source chain from [`Order::order_authority_address_dst`]",
      ];
      accounts: [
        {
          name: "submission";
          isMut: false;
          isSigner: false;
          docs: ["0"];
        },
        {
          name: "submissionAuthority";
          isMut: true;
          isSigner: true;
          docs: ["1"];
        },
        {
          name: "state";
          isMut: true;
          isSigner: false;
          docs: [
            "2",
            "State account with service information",
            "There is a single state account for the entire program",
          ];
        },
        {
          name: "feeLedger";
          isMut: true;
          isSigner: false;
          docs: ["3"];
        },
        {
          name: "feeLedgerWallet";
          isMut: true;
          isSigner: false;
          docs: ["4"];
        },
        {
          name: "instructions";
          isMut: false;
          isSigner: false;
          docs: ["5"];
        },
        {
          name: "giveOrderState";
          isMut: true;
          isSigner: false;
          docs: ["6"];
        },
        {
          name: "actionBeneficiaryWallet";
          isMut: true;
          isSigner: false;
          docs: [
            "Action beneficiary ATA",
            "If empty, then automatically initialized ATA (determined based on [`AccountInfo::owner`])",
          ];
        },
        {
          name: "actionBeneficiary";
          isMut: true;
          isSigner: false;
          docs: ["8"];
        },
        {
          name: "giveOrderWallet";
          isMut: true;
          isSigner: false;
          docs: ["9"];
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
          docs: ["10"];
        },
        {
          name: "authorizedNativeSender";
          isMut: false;
          isSigner: false;
          docs: ["11"];
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
          docs: ["12"];
        },
      ];
      args: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "withdrawFixFee";
      accounts: [
        {
          name: "state";
          isMut: false;
          isSigner: false;
        },
        {
          name: "feeLedger";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeBeneficiary";
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
      name: "withdrawPercentFee";
      accounts: [
        {
          name: "withdrawFee";
          accounts: [
            {
              name: "state";
              isMut: false;
              isSigner: false;
            },
            {
              name: "feeLedger";
              isMut: true;
              isSigner: false;
            },
            {
              name: "feeBeneficiary";
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
          name: "feeLedgerWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeBeneficiaryWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "withdrawAffiliateFee";
      accounts: [
        {
          name: "affiliateFeeBeneficiary";
          isMut: false;
          isSigner: true;
        },
        {
          name: "affiliateFeeWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "giveOrderState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "giveOrderWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "splTokenProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
  ];
  accounts: [
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
            name: "fixedFee";
            docs: ["Fixed fee in native chain tokes"];
            type: "u64";
          },
          {
            name: "percentFeeBps";
            docs: ["Fee as bps of process amount"];
            type: "u64";
          },
          {
            name: "isFeeRefund";
            docs: ["If true in `claim_order_cancel` we return all fix fee back to maker"];
            type: "bool";
          },
          {
            name: "feeBeneficiary";
            docs: ["Address for transfers fees"];
            type: "publicKey";
          },
          {
            name: "bump";
            docs: ["Bump from pubkey of `State` account"];
            type: "u8";
          },
          {
            name: "stopTap";
            docs: ["Pubkey for pause program"];
            type: "publicKey";
          },
          {
            name: "isWorking";
            docs: ["Is protocol working right now"];
            type: "bool";
          },
        ];
      };
    },
    {
      name: "giveOrderState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "status";
            type: {
              defined: "GiveOrderStatus";
            };
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "walletBump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "nonceMaster";
      type: {
        kind: "struct";
        fields: [
          {
            name: "nonce";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "authorizedNativeSender";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dstAddress";
            type: "bytes";
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
      name: "NewState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "fixedFee";
            docs: ["Fixed fee in native chain tokes"];
            type: "u64";
          },
          {
            name: "percentFeeBps";
            docs: ["Fee as bps of process amount"];
            type: "u64";
          },
          {
            name: "isFeeRefund";
            docs: ["If true in `claim_order_cancel` we return fix fee back to maker"];
            type: "bool";
          },
          {
            name: "feeBeneficiary";
            docs: ["Address for transfers fees"];
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "AffiliateFee";
      type: {
        kind: "struct";
        fields: [
          {
            name: "beneficiary";
            type: "publicKey";
          },
          {
            name: "amount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "CreateOrderArgs";
      docs: ["Structure for forming a new order"];
      type: {
        kind: "struct";
        fields: [
          {
            name: "giveOriginalAmount";
            docs: [
              "Input amount for `create order` call, that will be transferred from the user's wallet.",
              "The dln commissions will be deducted from it and the resulting value will be used as [`Order::give.amount`]",
            ];
            type: "u64";
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
            name: "externalCall";
            docs: ["External call for automatically execution in target chain after execution of order"];
            type: {
              option: "bytes";
            };
          },
          {
            name: "givePatchAuthoritySrc";
            docs: ["Address in source chain", "Can call `patch_order_give` method of src program"];
            type: "publicKey";
          },
          {
            name: "allowedCancelBeneficiarySrc";
            docs: ["Address in source chain", "If the field is `Some`, then only this address can receive cancel"];
            type: {
              option: "publicKey";
            };
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
              "If the field is `Some`, then only this address can call `fulfill_order` with this",
              "order",
            ];
            type: {
              option: "bytes";
            };
          },
        ];
      };
    },
    {
      name: "GiveOrderStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Created";
            fields: [
              {
                name: "giveAmount";
                type: {
                  option: "u64";
                };
              },
              {
                name: "fix_fee";
                type: {
                  option: "u64";
                };
              },
              {
                name: "percent_fee";
                type: {
                  option: "u64";
                };
              },
              {
                name: "affiliate_fee";
                type: {
                  option: {
                    defined: "AffiliateFee";
                  };
                };
              },
              {
                name: "allowed_cancel_beneficiary";
                type: {
                  option: "publicKey";
                };
              },
              {
                name: "give_patch_authority";
                type: "publicKey";
              },
              {
                name: "takeChainId";
                type: {
                  array: ["u8", 32];
                };
              },
            ];
          },
          {
            name: "ClaimedUnlock";
            fields: [
              {
                name: "affiliate_fee";
                type: {
                  option: {
                    defined: "AffiliateFee";
                  };
                };
              },
            ];
          },
          {
            name: "ClaimedCancel";
            fields: [
              {
                name: "affiliate_fee";
                type: {
                  option: {
                    defined: "AffiliateFee";
                  };
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
      name: "CreatedOrder";
      fields: [
        {
          name: "order";
          type: {
            defined: "Order";
          };
          index: false;
        },
        {
          name: "fixFee";
          type: "u64";
          index: false;
        },
        {
          name: "percentFee";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "CreatedOrderId";
      fields: [
        {
          name: "orderId";
          type: {
            array: ["u8", 32];
          };
          index: false;
        },
      ];
    },
    {
      name: "ClaimedOrderCancel";
      fields: [];
    },
    {
      name: "ClaimedUnlock";
      fields: [];
    },
    {
      name: "IncreasedGiveAmount";
      fields: [
        {
          name: "orderGiveFinalAmount";
          type: "u64";
          index: false;
        },
        {
          name: "finalPercentFee";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "GiveOrderStateWrongPubkey";
      msg: "Order state-account have wrong pubkey. Perhaps you miscalculated order_id.";
    },
    {
      code: 6001;
      name: "GiveOrderStateWrongStatus";
      msg: "Order state-account have wrong status, for this action.";
    },
    {
      code: 6002;
      name: "GiveOrderWalletWrongPubkey";
      msg: "Order wallet-account have wrong pubkey. Perhaps you miscalculated order_id.";
    },
    {
      code: 6003;
      name: "CalculationOrderIdError";
      msg: "Can't calculate order id. Wrong input arguments.";
    },
    {
      code: 6004;
      name: "OverflowError";
      msg: "Incoming data resulted in match-overflow error.";
    },
    {
      code: 6005;
      name: "OrderAlreadyProcessed";
      msg: "Order already processed. Can't do this action.";
    },
    {
      code: 6006;
      name: "WrongPatchAmount";
      msg: "Too little patch for give amount. Please add more";
    },
    {
      code: 6007;
      name: "WrongClaimParentProgramId";
      msg: "Wrong parent ix program id. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6008;
      name: "WrongClaimParentInstruction";
      msg: "Wrong parent ix. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6009;
      name: "WrongClaimParentInstructionAccounts";
      msg: "Wrong parent ix accounts. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6010;
      name: "WrongClaimParentSubmission";
      msg: "Wrong parent ix submission. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6011;
      name: "WrongClaimParentSubmissionAuth";
      msg: "Wrong parent debridge-submission authority. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6012;
      name: "WrongClaimParentNativeSender";
      msg: "Wrong parent debridge-submission native sender. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6013;
      name: "WrongClaimParentSourceChain";
      msg: "Wrong parent debridge-submission source chain. This method must be called by debridge program in execute_external call";
    },
    {
      code: 6014;
      name: "BadReceiverDstSize";
      msg: "Wrong size of receiver address for this chain";
    },
    {
      code: 6015;
      name: "BadOrderAuthorityDstSize";
      msg: "Wrong size of order authority address for this chain";
    },
    {
      code: 6016;
      name: "BadAllowedTakerDst";
      msg: "Wrong size of allowed taker address for this chain";
    },
    {
      code: 6017;
      name: "BadFallbackAddressDstSize";
      msg: "Wrong size of fallback address address for this chain";
    },
    {
      code: 6018;
      name: "AffiliateFeeNotReadyToPay";
      msg: "Affiliate fee already paid or not exists";
    },
    {
      code: 6019;
      name: "FixFeeAlreadyPaid";
      msg: "Fix fee already paid";
    },
    {
      code: 6020;
      name: "PercentFeeAlreadyPaid";
      msg: "Percent fee already paid";
    },
    {
      code: 6021;
      name: "ExternalCallDisables";
      msg: "Orders with external call not allowed right now";
    },
    {
      code: 6022;
      name: "FeeLedgerWalletWrongKey";
      msg: "Fee ledger wallet pubkey miscalculated";
    },
    {
      code: 6023;
      name: "NotAllowedCancelBeneficiary";
      msg: "Cancel beneficiary not allowed, use cancel-beneficiary from order state-account";
    },
    {
      code: 6024;
      name: "StatePaused";
      msg: "The action cannot be continued, the program-state is on pause";
    },
    {
      code: 6025;
      name: "StateWorking";
      msg: "Can't unpause because the program is already running";
    },
    {
      code: 6026;
      name: "WrongSigner";
      msg: "Wrong signer for realloc";
    },
    {
      code: 6027;
      name: "ReallocNotNeeded";
      msg: "Realloc not needed, new space equal to old one";
    },
    {
      code: 6028;
      name: "WrongExtcallIdError";
      msg: "Failed to parse extcall program id from receiver_dst field.";
    },
  ];
};

export const IDL: DlnSrc = {
  version: "3.0.0",
  name: "dln_src",
  instructions: [
    {
      name: "initializeState",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "feeLedger",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "newState",
          type: {
            defined: "NewState",
          },
        },
      ],
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
      name: "setFixedFee",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
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
          name: "fixedFee",
          type: "u64",
        },
      ],
    },
    {
      name: "setPercentFeeBps",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
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
          name: "percentFeeBps",
          type: "u64",
        },
      ],
    },
    {
      name: "setIsFeeRefund",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
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
          name: "isFeeRefund",
          type: "bool",
        },
      ],
    },
    {
      name: "setFeeBeneficiry",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
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
          name: "feeBeneficiary",
          type: "publicKey",
        },
      ],
    },
    {
      name: "setStopTap",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
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
              docs: [
                "State account with service information",
                "There is a single state account for the entire program",
              ],
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
      name: "pauseState",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
        },
        {
          name: "stopTap",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "unpauseState",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
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
      name: "updateAuthorizedNativeSender",
      accounts: [
        {
          name: "state",
          isMut: false,
          isSigner: false,
          docs: ["State account with service information", "There is a single state account for the entire program"],
        },
        {
          name: "protocolAuthority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authorizedNativeSender",
          isMut: true,
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
          name: "chainId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "newAuthorizedNativeSender",
          type: "bytes",
        },
      ],
    },
    {
      name: "createOrder",
      docs: [
        "Create new order for dln system",
        "",
        "# Args",
        "* `order_args` - Input parameters for new order",
        "* `affiliate_fee` - Additional optional commission charged by integrators of DLN",
        "* `referral_code` - referral code, if Some then used in event",
        "",
        "# Allowed",
        "Anyone who have [`CreateOrderArgs::give_original_amount`] of [`CreatingOrder::token_mint`] token",
      ],
      accounts: [
        {
          name: "maker",
          isMut: true,
          isSigner: true,
        },
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "giveOrderState",
          isMut: true,
          isSigner: false,
          docs: [
            "Account with GiveOrderState",
            "seeds = [GiveOrderState::SEED, &order_id.to_bytes()],",
            "Will be initialized inside [`create_order`]",
          ],
        },
        {
          name: "authorizedNativeSender",
          isMut: false,
          isSigner: false,
        },
        {
          name: "makerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "giveOrderWallet",
          isMut: true,
          isSigner: false,
          docs: ["Wallet of `give_order_state`", "Will be initialized inside [`create_order`]"],
        },
        {
          name: "nonceMaster",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeLedgerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
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
      ],
      args: [
        {
          name: "orderArgs",
          type: {
            defined: "CreateOrderArgs",
          },
        },
        {
          name: "affiliateFee",
          type: {
            option: {
              defined: "AffiliateFee",
            },
          },
        },
        {
          name: "referralCode",
          type: {
            option: "u32",
          },
        },
      ],
    },
    {
      name: "createOrderWithNonce",
      docs: [
        "Create new order for dln system",
        "",
        "# Args",
        "* `order_args` - Input parameters for new order",
        "* `affiliate_fee` - Additional optional commission charged by integrators of DLN",
        "* `referral_code` - referral code, if Some then used in event",
        "* `nonce` - salt to make the order unique",
        "",
        "# Allowed",
        "Anyone who have [`CreateOrderArgs::give_original_amount`] of [`CreatingOrder::token_mint`] token",
      ],
      accounts: [
        {
          name: "maker",
          isMut: true,
          isSigner: true,
        },
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "giveOrderState",
          isMut: true,
          isSigner: false,
          docs: [
            "Account with GiveOrderState",
            "seeds = [GiveOrderState::SEED, &order_id.to_bytes()],",
            "Will be initialized inside [`create_order`]",
          ],
        },
        {
          name: "authorizedNativeSender",
          isMut: false,
          isSigner: false,
        },
        {
          name: "makerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "giveOrderWallet",
          isMut: true,
          isSigner: false,
          docs: ["Wallet of `give_order_state`", "Will be initialized inside [`create_order`]"],
        },
        {
          name: "nonceMaster",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeLedgerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
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
      ],
      args: [
        {
          name: "orderArgs",
          type: {
            defined: "CreateOrderArgs",
          },
        },
        {
          name: "affiliateFee",
          type: {
            option: {
              defined: "AffiliateFee",
            },
          },
        },
        {
          name: "referralCode",
          type: {
            option: "u32",
          },
        },
        {
          name: "nonce",
          type: "u64",
        },
        {
          name: "metadata",
          type: "bytes",
        },
      ],
    },
    {
      name: "patchOrderGive",
      accounts: [
        {
          name: "giveOrderState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "giveOrderWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "givePatchAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "givePatchAuthorityWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
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
          name: "inputAdditionToGiveAmount",
          type: "u64",
        },
      ],
    },
    {
      name: "claimUnlock",
      docs: [
        "Claim unlock from order take chain",
        "Implying that the order was fulfilled and sent unlock by taker from [`OrderState::FullFilled { taker }`]",
        "",
        "# Args",
        "* `order_id` - order id for claim",
        "",
        "# Allowed",
        "Only debridge external call executor with debridge transaction in source chain from taker of order",
      ],
      accounts: [
        {
          name: "submission",
          isMut: false,
          isSigner: false,
          docs: ["0"],
        },
        {
          name: "submissionAuthority",
          isMut: true,
          isSigner: true,
          docs: ["1"],
        },
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: [
            "2",
            "State account with service information",
            "There is a single state account for the entire program",
          ],
        },
        {
          name: "feeLedger",
          isMut: true,
          isSigner: false,
          docs: ["3"],
        },
        {
          name: "feeLedgerWallet",
          isMut: true,
          isSigner: false,
          docs: ["4"],
        },
        {
          name: "instructions",
          isMut: false,
          isSigner: false,
          docs: ["5"],
        },
        {
          name: "giveOrderState",
          isMut: true,
          isSigner: false,
          docs: ["6"],
        },
        {
          name: "actionBeneficiaryWallet",
          isMut: true,
          isSigner: false,
          docs: [
            "Action beneficiary ATA",
            "If empty, then automatically initialized ATA (determined based on [`AccountInfo::owner`])",
          ],
        },
        {
          name: "actionBeneficiary",
          isMut: true,
          isSigner: false,
          docs: ["8"],
        },
        {
          name: "giveOrderWallet",
          isMut: true,
          isSigner: false,
          docs: ["9"],
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
          docs: ["10"],
        },
        {
          name: "authorizedNativeSender",
          isMut: false,
          isSigner: false,
          docs: ["11"],
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
          docs: ["12"],
        },
      ],
      args: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
    {
      name: "claimOrderCancel",
      docs: [
        "Claim cancel from order take chain",
        "Implying that the order was not fulfilled and sent canceled by [`Order::order_authority_address_dst`]",
        "",
        "# Args",
        "* `order_id` - order id for claim",
        "",
        "# Allowed",
        "Only debridge external call executor with debridge transaction in source chain from [`Order::order_authority_address_dst`]",
      ],
      accounts: [
        {
          name: "submission",
          isMut: false,
          isSigner: false,
          docs: ["0"],
        },
        {
          name: "submissionAuthority",
          isMut: true,
          isSigner: true,
          docs: ["1"],
        },
        {
          name: "state",
          isMut: true,
          isSigner: false,
          docs: [
            "2",
            "State account with service information",
            "There is a single state account for the entire program",
          ],
        },
        {
          name: "feeLedger",
          isMut: true,
          isSigner: false,
          docs: ["3"],
        },
        {
          name: "feeLedgerWallet",
          isMut: true,
          isSigner: false,
          docs: ["4"],
        },
        {
          name: "instructions",
          isMut: false,
          isSigner: false,
          docs: ["5"],
        },
        {
          name: "giveOrderState",
          isMut: true,
          isSigner: false,
          docs: ["6"],
        },
        {
          name: "actionBeneficiaryWallet",
          isMut: true,
          isSigner: false,
          docs: [
            "Action beneficiary ATA",
            "If empty, then automatically initialized ATA (determined based on [`AccountInfo::owner`])",
          ],
        },
        {
          name: "actionBeneficiary",
          isMut: true,
          isSigner: false,
          docs: ["8"],
        },
        {
          name: "giveOrderWallet",
          isMut: true,
          isSigner: false,
          docs: ["9"],
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
          docs: ["10"],
        },
        {
          name: "authorizedNativeSender",
          isMut: false,
          isSigner: false,
          docs: ["11"],
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
          docs: ["12"],
        },
      ],
      args: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
    {
      name: "withdrawFixFee",
      accounts: [
        {
          name: "state",
          isMut: false,
          isSigner: false,
        },
        {
          name: "feeLedger",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeBeneficiary",
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
      name: "withdrawPercentFee",
      accounts: [
        {
          name: "withdrawFee",
          accounts: [
            {
              name: "state",
              isMut: false,
              isSigner: false,
            },
            {
              name: "feeLedger",
              isMut: true,
              isSigner: false,
            },
            {
              name: "feeBeneficiary",
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
          name: "feeLedgerWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeBeneficiaryWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "withdrawAffiliateFee",
      accounts: [
        {
          name: "affiliateFeeBeneficiary",
          isMut: false,
          isSigner: true,
        },
        {
          name: "affiliateFeeWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "giveOrderState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "giveOrderWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "splTokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
  ],
  accounts: [
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
            name: "fixedFee",
            docs: ["Fixed fee in native chain tokes"],
            type: "u64",
          },
          {
            name: "percentFeeBps",
            docs: ["Fee as bps of process amount"],
            type: "u64",
          },
          {
            name: "isFeeRefund",
            docs: ["If true in `claim_order_cancel` we return all fix fee back to maker"],
            type: "bool",
          },
          {
            name: "feeBeneficiary",
            docs: ["Address for transfers fees"],
            type: "publicKey",
          },
          {
            name: "bump",
            docs: ["Bump from pubkey of `State` account"],
            type: "u8",
          },
          {
            name: "stopTap",
            docs: ["Pubkey for pause program"],
            type: "publicKey",
          },
          {
            name: "isWorking",
            docs: ["Is protocol working right now"],
            type: "bool",
          },
        ],
      },
    },
    {
      name: "giveOrderState",
      type: {
        kind: "struct",
        fields: [
          {
            name: "status",
            type: {
              defined: "GiveOrderStatus",
            },
          },
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "walletBump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "nonceMaster",
      type: {
        kind: "struct",
        fields: [
          {
            name: "nonce",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "authorizedNativeSender",
      type: {
        kind: "struct",
        fields: [
          {
            name: "dstAddress",
            type: "bytes",
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
      name: "NewState",
      type: {
        kind: "struct",
        fields: [
          {
            name: "fixedFee",
            docs: ["Fixed fee in native chain tokes"],
            type: "u64",
          },
          {
            name: "percentFeeBps",
            docs: ["Fee as bps of process amount"],
            type: "u64",
          },
          {
            name: "isFeeRefund",
            docs: ["If true in `claim_order_cancel` we return fix fee back to maker"],
            type: "bool",
          },
          {
            name: "feeBeneficiary",
            docs: ["Address for transfers fees"],
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "AffiliateFee",
      type: {
        kind: "struct",
        fields: [
          {
            name: "beneficiary",
            type: "publicKey",
          },
          {
            name: "amount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "CreateOrderArgs",
      docs: ["Structure for forming a new order"],
      type: {
        kind: "struct",
        fields: [
          {
            name: "giveOriginalAmount",
            docs: [
              "Input amount for `create order` call, that will be transferred from the user's wallet.",
              "The dln commissions will be deducted from it and the resulting value will be used as [`Order::give.amount`]",
            ],
            type: "u64",
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
            name: "externalCall",
            docs: ["External call for automatically execution in target chain after execution of order"],
            type: {
              option: "bytes",
            },
          },
          {
            name: "givePatchAuthoritySrc",
            docs: ["Address in source chain", "Can call `patch_order_give` method of src program"],
            type: "publicKey",
          },
          {
            name: "allowedCancelBeneficiarySrc",
            docs: ["Address in source chain", "If the field is `Some`, then only this address can receive cancel"],
            type: {
              option: "publicKey",
            },
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
              "If the field is `Some`, then only this address can call `fulfill_order` with this",
              "order",
            ],
            type: {
              option: "bytes",
            },
          },
        ],
      },
    },
    {
      name: "GiveOrderStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Created",
            fields: [
              {
                name: "giveAmount",
                type: {
                  option: "u64",
                },
              },
              {
                name: "fix_fee",
                type: {
                  option: "u64",
                },
              },
              {
                name: "percent_fee",
                type: {
                  option: "u64",
                },
              },
              {
                name: "affiliate_fee",
                type: {
                  option: {
                    defined: "AffiliateFee",
                  },
                },
              },
              {
                name: "allowed_cancel_beneficiary",
                type: {
                  option: "publicKey",
                },
              },
              {
                name: "give_patch_authority",
                type: "publicKey",
              },
              {
                name: "takeChainId",
                type: {
                  array: ["u8", 32],
                },
              },
            ],
          },
          {
            name: "ClaimedUnlock",
            fields: [
              {
                name: "affiliate_fee",
                type: {
                  option: {
                    defined: "AffiliateFee",
                  },
                },
              },
            ],
          },
          {
            name: "ClaimedCancel",
            fields: [
              {
                name: "affiliate_fee",
                type: {
                  option: {
                    defined: "AffiliateFee",
                  },
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
      name: "CreatedOrder",
      fields: [
        {
          name: "order",
          type: {
            defined: "Order",
          },
          index: false,
        },
        {
          name: "fixFee",
          type: "u64",
          index: false,
        },
        {
          name: "percentFee",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "CreatedOrderId",
      fields: [
        {
          name: "orderId",
          type: {
            array: ["u8", 32],
          },
          index: false,
        },
      ],
    },
    {
      name: "ClaimedOrderCancel",
      fields: [],
    },
    {
      name: "ClaimedUnlock",
      fields: [],
    },
    {
      name: "IncreasedGiveAmount",
      fields: [
        {
          name: "orderGiveFinalAmount",
          type: "u64",
          index: false,
        },
        {
          name: "finalPercentFee",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "GiveOrderStateWrongPubkey",
      msg: "Order state-account have wrong pubkey. Perhaps you miscalculated order_id.",
    },
    {
      code: 6001,
      name: "GiveOrderStateWrongStatus",
      msg: "Order state-account have wrong status, for this action.",
    },
    {
      code: 6002,
      name: "GiveOrderWalletWrongPubkey",
      msg: "Order wallet-account have wrong pubkey. Perhaps you miscalculated order_id.",
    },
    {
      code: 6003,
      name: "CalculationOrderIdError",
      msg: "Can't calculate order id. Wrong input arguments.",
    },
    {
      code: 6004,
      name: "OverflowError",
      msg: "Incoming data resulted in match-overflow error.",
    },
    {
      code: 6005,
      name: "OrderAlreadyProcessed",
      msg: "Order already processed. Can't do this action.",
    },
    {
      code: 6006,
      name: "WrongPatchAmount",
      msg: "Too little patch for give amount. Please add more",
    },
    {
      code: 6007,
      name: "WrongClaimParentProgramId",
      msg: "Wrong parent ix program id. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6008,
      name: "WrongClaimParentInstruction",
      msg: "Wrong parent ix. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6009,
      name: "WrongClaimParentInstructionAccounts",
      msg: "Wrong parent ix accounts. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6010,
      name: "WrongClaimParentSubmission",
      msg: "Wrong parent ix submission. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6011,
      name: "WrongClaimParentSubmissionAuth",
      msg: "Wrong parent debridge-submission authority. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6012,
      name: "WrongClaimParentNativeSender",
      msg: "Wrong parent debridge-submission native sender. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6013,
      name: "WrongClaimParentSourceChain",
      msg: "Wrong parent debridge-submission source chain. This method must be called by debridge program in execute_external call",
    },
    {
      code: 6014,
      name: "BadReceiverDstSize",
      msg: "Wrong size of receiver address for this chain",
    },
    {
      code: 6015,
      name: "BadOrderAuthorityDstSize",
      msg: "Wrong size of order authority address for this chain",
    },
    {
      code: 6016,
      name: "BadAllowedTakerDst",
      msg: "Wrong size of allowed taker address for this chain",
    },
    {
      code: 6017,
      name: "BadFallbackAddressDstSize",
      msg: "Wrong size of fallback address address for this chain",
    },
    {
      code: 6018,
      name: "AffiliateFeeNotReadyToPay",
      msg: "Affiliate fee already paid or not exists",
    },
    {
      code: 6019,
      name: "FixFeeAlreadyPaid",
      msg: "Fix fee already paid",
    },
    {
      code: 6020,
      name: "PercentFeeAlreadyPaid",
      msg: "Percent fee already paid",
    },
    {
      code: 6021,
      name: "ExternalCallDisables",
      msg: "Orders with external call not allowed right now",
    },
    {
      code: 6022,
      name: "FeeLedgerWalletWrongKey",
      msg: "Fee ledger wallet pubkey miscalculated",
    },
    {
      code: 6023,
      name: "NotAllowedCancelBeneficiary",
      msg: "Cancel beneficiary not allowed, use cancel-beneficiary from order state-account",
    },
    {
      code: 6024,
      name: "StatePaused",
      msg: "The action cannot be continued, the program-state is on pause",
    },
    {
      code: 6025,
      name: "StateWorking",
      msg: "Can't unpause because the program is already running",
    },
    {
      code: 6026,
      name: "WrongSigner",
      msg: "Wrong signer for realloc",
    },
    {
      code: 6027,
      name: "ReallocNotNeeded",
      msg: "Realloc not needed, new space equal to old one",
    },
    {
      code: 6028,
      name: "WrongExtcallIdError",
      msg: "Failed to parse extcall program id from receiver_dst field.",
    },
  ],
};
