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

const callAPI = (endpoint, data) => {
  axios({
    method: 'post',
    url: apiEndPoint + endpoint,
    data,
  })
}

const trackMarketPlace = () => {
  console.log('marketplace tracker has been started')

  //   item listed
  marketplaceSC.on(
    'ItemListed',
    (
      owner,
      nft,
      tokenID,
      quantity,
      pricePerItem,
      startingTime,
      isPrivate,
      allowedAddress,
    ) => {
      callAPI('itemListed', {
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
    (seller, buyer, nft, tokenID, quantity, price) => {
      callAPI('itemSold', { seller, buyer, nft, tokenID, quantity, price })
    },
  )

  //   item updated

  marketplaceSC.on('ItemUpdated', (owner, nft, tokenID, price) => {
    callAPI('itemUpdated', { owner, nft, tokenID, price })
  })

  //   item cancelled
  marketplaceSC.on('ItemCanceled', (owner, nft, tokenID) => {
    callAPI('itemCanceled', { owner, nft, tokenID })
  })

  // offer created
  marketplaceSC.on(
    'OfferCreated',
    (creator, nft, tokenID, payToken, quantity, pricePerItem, deadline) => {
      callAPI('offerCreated', {
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
  marketplaceSC.on('OfferCanceled', (creator, nft, tokenID) => {
    callAPI('offerCanceled', { creator, nft, tokenID })
  })
}

module.exports = trackMarketPlace
