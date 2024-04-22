// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IAccount} from "account-abstraction/interfaces/IAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntrypoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Safe} from "safe-smart-account/contracts/Safe.sol";
import {Enum} from "safe-smart-account/contracts/common/Enum.sol";
import {CompatibilityFallbackHandler} from "safe-smart-account/contracts/handler/CompatibilityFallbackHandler.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title Safe Smart Wallet
/// @notice This contract acts as an account abstraction layer that integrates with the Safe contract,
/// allowing for signature validation and execution of transactions via Safe Module Pattern.
/// @dev Implements the IAccount interface for integration with account abstraction patterns.
contract SafeSmartContract is IAccount, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    // keccak256("SafeMessage(bytes message)");
    bytes32 private constant SAFE_MSG_TYPEHASH =
        0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;

    /// @notice Initializes the contract with an owner.
    /// @param _owner The address of the owner, a Safe contract.
    constructor(address _owner) Ownable(_owner) {}

    /// @notice Validates a user operation including signature verification.
    /// @dev Uses ECDSA signature recovery to ensure the operation is signed by one of the Safe's owner.
    /// @param userOp The user operation struct containing the operation data and signature.
    /// @param userOpHash The hash of the user operation, used to recover the signer address.
    /// @return Always returns 0 indicating successful validation.
    function validateUserOp(
        PackedUserOperation memory userOp,
        bytes32 userOpHash,
        uint256
    ) external view override returns (uint256) {
        address o = ECDSA.recover( // 0 == recovered address from signature
                userOpHash.toEthSignedMessageHash(),
                userOp.signature
            );
        // owner == Safe Contract Address
        Safe safe = Safe(payable(owner()));
        require(safe.isOwner(o), "not signed by the owner");
        return 0;
    }

    /// @notice Executes a transaction via the Safe contract.
    /// @dev Delegates transaction execution to the Safe contract's `execTransactionFromModule` method.
    /// @param to The recipient address of the transaction.
    /// @param data The data payload of the transaction.
    function execute(address to, bytes memory data) external {
        Safe safe = Safe(payable(owner()));
        safe.execTransactionFromModule(to, 0, data, Enum.Operation.Call);
    }
}
