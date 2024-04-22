import { config } from 'dotenv'
import {
  deposit,
  packAccountGasLimits,
  packPaymasterData,
  setup,
} from './utils'
import { ENTRYPOINT_ADDRESS, PAYMASTER_ADDRESS } from './constants'
import { ethers } from 'ethers'
import { abi as EP_ABI } from '../contracts/out/EntryPoint.sol/EntryPoint.json'
import { UserOperationStruct } from './types'

config()

const ep = new ethers.Contract(ENTRYPOINT_ADDRESS, EP_ABI)

async function main() {
  const {
    provider,
    signer,
    sender,
    ep,
    executeCallData,
    initCode,
    mock,
    sw,
    maxFeePerGas,
    maxPriorityFeePerGas,
    verificationGasLimit,
    callGasLimit,
    safe,
  } = await setup()

  // Only to be used if the PM is redeployed. Deposist some ETH to the EP on behalf of
  // as well as sends some ETH to PM address

  //await deposit(ep, signer)

  console.log('BEFORE: ', await mock.balanceOf(await safe.getAddress()))

  let op: UserOperationStruct = {
    sender,
    nonce: await ep.getNonce(sender, 0),
    callData: executeCallData,
    initCode: (await provider.getCode(sender)) !== '0x' ? '0x' : initCode,
    preVerificationGas: 100_000,
    signature: '0x',
    paymasterAndData: packPaymasterData(PAYMASTER_ADDRESS, 3e5, 0, '0x'),
    accountGasLimits: packAccountGasLimits(verificationGasLimit, callGasLimit),
    gasFees: packAccountGasLimits(maxPriorityFeePerGas, maxFeePerGas),
  }

  const userOpHash = await ep.getUserOpHash(op)

  const signature = await signer.signMessage(ethers.getBytes(userOpHash))
  op.signature = signature

  const tx = await ep.handleOps([op], await safe.getAddress())
  await tx.wait()

  console.log('AFTER: ', await mock.balanceOf(await safe.getAddress()))
}

main().catch((err) => {
  console.log('Err from main: ', err)
  if (err.info && err.info.error && err.info.error.data != '0x') {
    const revertData = err.info.error.data
    const decodedError = ep.interface.parseError(revertData)?.name
    const error = ep.interface
      .decodeErrorResult(decodedError!, revertData)
      .slice(-1)[0]
    console.log('Custom Error:', error)
  }
})
