require('dotenv').config()
const ethers = require('ethers')
const axios = require('axios')

const MarketplaceContractInfo = require('../constants/salescontractabi')

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_RPC,
  parseInt(process.env.MAINNET_CHAINID),
)

const loadMarketplaceContract = () => {
  let abi = MarketplaceContractInfo.abi
  let address = MarketplaceContractInfo.address
  let contract = new ethers.Contract(address, abi, provider)
  return contract
}

const marketplaceSC = loadMarketplaceContract()

const apiEndPoint = 'https://api0.artion.io/marketplace/'

const callAPI = async (endpoint, data) => {
  await axios({
    method: 'post',
    url: apiEndPoint + endpoint,
    data: JSON.stringify(data),
  })
}

const trackMarketPlace = () => {
  console.log('marketplace tracker has been started')

  //   item listed
  marketplaceSC.on(
    'ItemListed',
    async (
      owner,
      nft,
      tokenID,
      quantity,
      pricePerItem,
      startingTime,
      isPrivate,
      allowedAddress,
    ) => {
      await callAPI('itemListed', {
        owner,
        nft,
        tokenID,
        quantity,
        pricePerItem,
        startingTime,
        isPrivate,
        allowedAddress,
      })
    },
  )

  //   item sold
  marketplaceSC.on(
    'ItemSold',
    async (seller, buyer, nft, tokenID, quantity, price) => {
      await callAPI('itemSold', {
        seller,
        buyer,
        nft,
        tokenID,
        quantity,
        price,
      })
    },
  )

  //   item updated

  marketplaceSC.on('ItemUpdated', async (owner, nft, tokenID, price) => {
    await callAPI('itemUpdated', { owner, nft, tokenID, price })
  })

  //   item cancelled
  marketplaceSC.on('ItemCanceled', async (owner, nft, tokenID) => {
    await callAPI('itemCanceled', { owner, nft, tokenID })
  })

  // offer created
  marketplaceSC.on(
    'OfferCreated',
    async (
      creator,
      nft,
      tokenID,
      payToken,
      quantity,
      pricePerItem,
      deadline,
    ) => {
      await callAPI('offerCreated', {
        creator,
        nft,
        tokenID,
        payToken,
        quantity,
        pricePerItem,
        deadline,
      })
    },
  )

  // offer cancelled
  marketplaceSC.on('OfferCanceled', async (creator, nft, tokenID) => {
    await callAPI('offerCanceled', { creator, nft, tokenID })
  })
}

module.exports = trackMarketPlace
