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

const decimalStore = new Map()

const marketplaceSC = loadMarketplaceContract()

const apiEndPoint = process.env.API_ENDPOINT

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}
const parseToken = async (inWei, paymentToken) => {
  paymentToken = toLowerCase(paymentToken)
  let tokenDecimals = decimalStore.get(paymentToken)
  console.log(tokenDecimals)
  if (tokenDecimals > 0)
    return parseFloat(inWei.toString()) / 10 ** tokenDecimals
  let decimals = await axios({
    method: 'get',
    url: process.env.DECIMAL_ENDPOINT + paymentToken,
  })
  decimals = parseInt(decimals.data.data)
  decimalStore.set(paymentToken, decimals)
  return parseFloat(inWei.toString()) / 10 ** decimals
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
    ) => {
      owner = toLowerCase(owner)
      nft = toLowerCase(nft)
      tokenID = parseInt(tokenID)
      quantity = parseInt(quantity)
      paymentToken = toLowerCase(paymentToken)
      pricePerItem = await parseToken(pricePerItem, paymentToken)
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
      price = await parseToken(price, paymentToken)
      paymentToken = toLowerCase(paymentToken)
      await callAPI('itemSold', {
        seller,
        buyer,
        nft,
        tokenID,
        quantity,
        paymentToken,
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
      price = await parseToken(price, paymentToken)
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
      pricePerItem = await parseToken(pricePerItem, paymentToken)
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
