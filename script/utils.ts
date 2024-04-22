import { BigNumberish, Contract, Signer, ethers } from 'ethers'
import Safe, {
  SafeAccountConfig,
  SigningMethod,
} from '@safe-global/protocol-kit'
import { SafeFactory } from '@safe-global/protocol-kit'
import {
  ENTRYPOINT_ADDRESS,
  FACTORY_ADDRESS,
  MOCK_ADDRESS,
  PAYMASTER_ADDRESS,
} from './constants'
import { abi as EP_ABI } from '../contracts/out/EntryPoint.sol/EntryPoint.json'
import { abi as FA_ABI } from '../contracts/out/FactoryAccount.sol/FactoryAccount.json'
import { abi as SW_ABI } from '../contracts/out/SafeSmartAccount.sol/SafeSmartContract.json'
import { abi as MOCK_ABI } from '../contracts/out/Mock.sol/Mock.json'
import { EthersAdapter } from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { UserOperationStruct } from './types'

export const setup = async () => {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!)
  const provider = new ethers.JsonRpcProvider('http://localhost:8545')
  const signer = wallet.connect(provider)

  const ep = new ethers.Contract(ENTRYPOINT_ADDRESS, EP_ABI, signer)
  const fa = new ethers.Contract(FACTORY_ADDRESS, FA_ABI, signer)
  const mock = new ethers.Contract(MOCK_ADDRESS, MOCK_ABI, signer)

  const ethAdapterOwner1 = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  })

  const apiKit = new SafeApiKit({
    chainId: ethers.toBigInt(1),
    txServiceUrl: 'http://localhost:8000/txs/api',
  })

  const safeAccountConfig: SafeAccountConfig = {
    owners: [await signer.getAddress()],
    threshold: 1,
  }

  // Checking if Safe is already deployed
  const { safes } = await apiKit.getSafesByOwner(await signer.getAddress())

  // An instance of on-chain Safe.
  let safe: Safe

  // If a safe is already deployed, that will be used else
  // a new safe will be deployed
  if (safes.length === 0) {
    const safeFactory = await SafeFactory.create({
      ethAdapter: ethAdapterOwner1,
    })
    safe = await safeFactory.deploySafe({ safeAccountConfig })
  } else {
    const safeAddress = safes[0]

    safe = await Safe.create({
      ethAdapter: ethAdapterOwner1,
      safeAddress: safeAddress,
    })
  }

  // Checking if the safe has MOCK tokens,
  // if not, mint some tokens
  const balance = await mock.balanceOf(await safe.getAddress())
  if (balance == 0) {
    const tx = await mock.mint(
      await safe.getAddress(),
      ethers.parseEther('100')
    )
    await tx.wait()
  }

  const initCode =
    FACTORY_ADDRESS +
    fa.interface
      .encodeFunctionData('createAccount', [await safe.getAddress()])
      .slice(2)

  // This is the counter-factual address of the SW
  const sender = await ep.getSenderAddress(initCode).catch((err) => {
    return '0x' + err.data.slice(-40)
  })

  // On-Chain Safe SW Instance
  const sw = new ethers.Contract(sender, SW_ABI, wallet.connect(provider))

  const data = mock.interface.encodeFunctionData('transfer', [
    '0xe98cEf1748d2874F09dfFbeC69Dd571A0c02C050',
    ethers.parseEther('1'),
  ])

  // Checking if SW is added to the module
  // if not, add the SW as a module
  if (!(await safe.isModuleEnabled(sender))) {
    let tx = await safe.createEnableModuleTx(sender)
    tx = await safe.signTransaction(tx, SigningMethod.ETH_SIGN_TYPED_DATA_V4)
    await safe.executeTransaction(tx)
    console.log('Module Enabled')
  }

  const executeCallData = sw.interface.encodeFunctionData('execute', [
    MOCK_ADDRESS,
    data,
  ])

  const maxFeePerGas = ethers.parseUnits('10', 'gwei')
  const maxPriorityFeePerGas = ethers.parseUnits('5', 'gwei')
  const verificationGasLimit = ethers.parseUnits('10', 'gwei')
  const callGasLimit = 200_000

  return {
    wallet,
    signer,
    provider,
    ep,
    executeCallData,
    sender,
    initCode,
    sw,
    mock,
    maxFeePerGas,
    maxPriorityFeePerGas,
    verificationGasLimit,
    callGasLimit,
    safe,
  }
}

export const deposit = async (ep: Contract, signer: Signer) => {
  const despoitTx = await ep.depositTo(PAYMASTER_ADDRESS, {
    value: ethers.parseEther('100'),
  })
  await despoitTx.wait()

  const sendTx = await signer.sendTransaction({
    to: PAYMASTER_ADDRESS,
    value: ethers.parseEther('100'),
    data: '0x',
  })
  await sendTx.wait()
}

export function packAccountGasLimits(
  verificationGasLimit: BigNumberish,
  callGasLimit: BigNumberish
): string {
  return ethers.concat([
    ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16),
  ])
}

export function packPaymasterData(
  paymaster: string,
  paymasterVerificationGasLimit: BigNumberish,
  postOpGasLimit: BigNumberish,
  paymasterData: string
): string {
  return ethers.concat([
    paymaster,
    ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
    paymasterData,
  ])
}

const EIP712_SAFE_OPERATION_TYPE = {
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'uint256', name: 'nonce' },
    { type: 'bytes', name: 'initCode' },
    { type: 'bytes', name: 'callData' },
    { type: 'bytes', name: 'gasFees' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'bytes', name: 'accountGasLimits' },
    { type: 'bytes', name: 'paymasterAndData' },
  ],
}

// export const signUserOperation = async (
//   userOperation: UserOperationStruct,
//   safe: string
// ) => {
//   const signatures = {
//     signer: await signer.getAddress(),
//     data: await signer.signTypedData(
//       {
//         chainId: 1,
//         verifyingContract: safe,
//       },
//       EIP712_SAFE_OPERATION_TYPE,
//       {
//         safe: userOperation.sender,
//         nonce: userOperation.nonce,
//         initCode: userOperation.initCode,
//         callData: userOperation.callData,
//         gasFees: userOperation.gasFees,
//         preVerificationGas: userOperation.preVerificationGas,
//         accountGasLimits: userOperation.accountGasLimits,
//         paymasterAndData: userOperation.paymasterAndData,
//         validAfter: '0x000000000000',
//         validUntil: '0x000000000000',
//         entryPoint: ENTRYPOINT_ADDRESS,
//       }
//     ),
//   }

//   return signatures.data
// }

export const returnTypedData = (
  userOperation: UserOperationStruct,
  safe: string
) => {
  return {
    types: EIP712_SAFE_OPERATION_TYPE,
    domain: {
      chainId: 1,
      verifyingContract: safe,
    },
    message: {
      safe: userOperation.sender,
      nonce: userOperation.nonce,
      initCode: userOperation.initCode,
      callData: userOperation.callData,
      gasFees: userOperation.gasFees,
      preVerificationGas: userOperation.preVerificationGas,
      accountGasLimits: userOperation.accountGasLimits,
      paymasterAndData: userOperation.paymasterAndData,
    },
  }
}
