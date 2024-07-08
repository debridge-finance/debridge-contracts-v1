---
description: >-
  This document contains an overview of the deBridge Liquidity Network API
  endpoints, giving readers an expedited understanding of how to get quotes,
  place, track and manage limit orders.
---

# Quick Start Guide

The DLN API provides developers an effortless way to interact with the DLN protocol and trade across chains in seconds with deep liquidity, limit orders, and protection against slippage and MEV. The API takes the burden off of building complex and sometimes painful interactions with blockchain RPCs and smart contracts by providing a complete set of RESTful endpoints, sufficient to quote, create, and manage trades during their whole lifecycle.

{% hint style="info" %}
The **DLN API** with Swagger resides at [dln.debridge.finance](https://dln.debridge.finance)&#x20;

Additionally, a JSON representation of the API can be found here: [dln.debridge.finance/v1.0-json](https://dln.debridge.finance/v1.0-json)
{% endhint %}

The lifecycle of an order is defined as follows:

* getting a quote
* requesting a transaction that places (creates) the limit order on-chain
* submitting a transaction to the source chain
* tracking the status of the order on the destination chain
* (optional) requesting a transaction that cancels the limit order on the destination chain

This guide gives a brief step-by-step overview of how to manage limit orders using DLN API endpoints.

### A specific use case <a href="#a-specific-use-case" id="a-specific-use-case"></a>

This article assumes a specific use case: a user, who has 100 [USDC on BNB Chain](https://bscscan.com/token/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d), would like to receive a reasonable amount of [USDT on Avalanche](https://snowtrace.io/address/0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7). Additionally, an affiliate fee of 0.1% would be set during this order creation.

{% hint style="info" %}
Hereinafter, we assume that the **input token** is USDC, and the user actually **gives 100 USDC;** the source chain is BNB Chain here. The **output token** is USDT, and the user is willing to **take** an amount of USDT recommended by the API. Here, the destination chain is Avalanche.
{% endhint %}
