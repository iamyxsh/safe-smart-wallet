import { ethers } from 'ethers'

export type UserOperationStruct = {
  sender: string
  nonce: ethers.BigNumberish
  initCode: ethers.BytesLike
  callData: ethers.BytesLike
  preVerificationGas: ethers.BigNumberish
  paymasterAndData: ethers.BytesLike
  signature: ethers.BytesLike
  accountGasLimits: ethers.BytesLike
  gasFees: ethers.BytesLike
}
