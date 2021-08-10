require('dotenv').config()
const ethers = require('ethers')
const axios = require('axios')

const MarketplaceContractInfo = require('../constants/salescontractabi')

const provider = new ethers.providers.JsonRpcProvider(
  process.env.NETWORK_RPC,
  parseInt(process.env.NETWORK_CHAINID),
)

const loadMarketplaceContract = () => {
  let abi = MarketplaceContractInfo.abi
  let address = process.env.CONTRACTADDRESS
  let contract = new ethers.Contract(address, abi, provider)
  return contract
}

const marketplaceSC = loadMarketplaceContract()

const apiEndPoint = process.env.API_ENDPOINT

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}
const parseToFTM = (inWei) => {
  return parseFloat(inWei.toString()) / 10 ** 18
}
const convertTime = (value) => {
  return parseFloat(value) * 1000
}

const callAPI = async (endpoint, data) => {
  await axios({
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
    async (
      owner,
      nft,
      tokenID,
      quantity,
      paymentToken,
      pricePerItem,
      startingTime,
      isPrivate,
      allowedAddress,
    ) => {
      owner = toLowerCase(owner)
      nft = toLowerCase(nft)
      tokenID = parseInt(tokenID)
      quantity = parseInt(quantity)
      paymentToken = toLowerCase(paymentToken)
      pricePerItem = parseToFTM(pricePerItem)
      startingTime = convertTime(startingTime)
      await callAPI('itemListed', {
        owner,
        nft,
        tokenID,
        quantity,
        paymentToken,
        pricePerItem,
        startingTime,
      })
    },
  )

  //   item sold
  marketplaceSC.on(
    'ItemSold',
    async (
      seller,
      buyer,
      nft,
      tokenID,
      quantity,
      paymentToken,
      unitPrice,
      price,
    ) => {
      seller = toLowerCase(seller)
      buyer = toLowerCase(buyer)
      nft = toLowerCase(nft)
      tokenID = parseInt(tokenID)
      quantity = parseInt(quantity)
      price = parseToFTM(price)
      paymentToken = toLowerCase(paymentToken)
      unitPrice = parseFloat(unitPrice)
      await callAPI('itemSold', {
        seller,
        buyer,
        nft,
        tokenID,
        quantity,
        paymentToken,
        unitPrice,
        price,
      })
    },
  )

  //   item updated

  marketplaceSC.on(
    'ItemUpdated',
    async (owner, nft, tokenID, paymentToken, price) => {
      owner = toLowerCase(owner)
      nft = toLowerCase(nft)
      tokenID = parseInt(tokenID)
      price = parseToFTM(price)
      paymentToken = toLowerCase(paymentToken)
      await callAPI('itemUpdated', { owner, nft, tokenID, paymentToken, price })
    },
  )

  //   item cancelled
  marketplaceSC.on('ItemCanceled', async (owner, nft, tokenID) => {
    owner = toLowerCase(owner)
    nft = toLowerCase(nft)
    tokenID = parseInt(tokenID)
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
      paymentToken,
      pricePerItem,
      deadline,
    ) => {
      creator = toLowerCase(creator)
      nft = toLowerCase(nft)
      tokenID = parseInt(tokenID)
      quantity = parseInt(quantity)
      paymentToken = toLowerCase(paymentToken)
      pricePerItem = parseToFTM(pricePerItem)
      deadline = convertTime(deadline)
      await callAPI('offerCreated', {
        creator,
        nft,
        tokenID,
        quantity,
        paymentToken,
        pricePerItem,
        deadline,
      })
    },
  )

  // offer cancelled
  marketplaceSC.on('OfferCanceled', async (creator, nft, tokenID) => {
    creator = toLowerCase(creator)
    nft = toLowerCase(nft)
    tokenID = parseInt(tokenID)
    await callAPI('offerCanceled', { creator, nft, tokenID })
  })
}

module.exports = trackMarketPlace
