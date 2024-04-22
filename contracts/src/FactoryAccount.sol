// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {SafeSmartContract} from "./SafeSmartAccount.sol";
import {console2} from "forge-std/console2.sol";

/// @title A Factory for creating Safe Smart Wallet instances deterministically using CREATE2.
/// @notice This contract deploys new Safe Smart Wallet instances with predetermined addresses.
/// @notice If the SW is already deployed, it will just return the address
contract FactoryAccount {
    /// @notice Creates and deploys a SafeSmartContract for a specified Gnosis Safe
    /// @dev Uses the CREATE2 opcode for deterministic address generation
    /// @param _owner The address of the owner Gnosis Safe
    /// @return addr The address of the newly created Safe Smart Wallet
    function createAccount(address _owner) external returns (address) {
        bytes32 salt = bytes32(uint256(uint160(_owner)));
        bytes memory bytecode = abi.encodePacked(
            type(SafeSmartContract).creationCode,
            abi.encode(_owner)
        );

        address addr = computeAddress(salt, keccak256(bytecode));

        if (addr.code.length > 0) {
            return addr;
        }

        address a = deploy(salt, bytecode);
        return a;
    }

    /// @notice Deploys a new contract
    /// @dev Deploys a contract using the EVM's CREATE2
    /// @param salt The salt used to create the address
    /// @param bytecode The bytecode of the contract to deploy
    /// @return addr The address of the deployed contract
    function deploy(
        bytes32 salt,
        bytes memory bytecode
    ) internal returns (address addr) {
        /// @solidity memory-safe-assembly
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
    }

    /// @notice Computes the expected address for a contract created via CREATE2.
    /// @dev The computed address is derived based on the salt, the bytecode hash of the contract,
    ///      and the address of this deployer contract. This address calculation uses Ethereum's
    ///      defined formula for CREATE2: keccak256(0xff ++ deployer address ++ salt ++ keccak256(bytecode)).
    /// @param salt A bytes32 value used as part of the address generation process.
    /// @param bytecodeHash The keccak256 hash of the contract's creation bytecode.
    /// @return addr The computed address where the contract will be deployed using CREATE2.
    function computeAddress(
        bytes32 salt,
        bytes32 bytecodeHash
    ) public view returns (address addr) {
        address deployer = address(this);
        assembly {
            let ptr := mload(0x40)

            mstore(add(ptr, 0x40), bytecodeHash)
            mstore(add(ptr, 0x20), salt)
            mstore(ptr, deployer)
            let start := add(ptr, 0x0b)
            mstore8(start, 0xff)
            addr := and(
                keccak256(start, 85),
                0xffffffffffffffffffffffffffffffffffffffff
            )
        }
    }
}
