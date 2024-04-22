import axios from 'axios'
import { SERVER_URL } from './constants'
import { ethers } from 'ethers'

export const login = async (
  address: string,
  wallet: ethers.Wallet
): Promise<string> => {
  const { payload } = await axios
    .get(`${SERVER_URL}/auth/message/${address}`)
    .then((res) => res.data)
  const msg = payload['Message']

  return await wallet.signMessage(msg)
}
