const mongoose = require('mongoose')

const Listing = mongoose.model('Listing')
const TradeHistory = mongoose.model('TradeHistory')
const Account = mongoose.model('Account')
const Offer = mongoose.model('Offer')

const MailService = require('../utils/mailer')

const contractUtils = require('../utils/contracts.utils')
const Mail = require('nodemailer/lib/mailer')

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

const trackMarketPlace = () => {
  const marketplaceSC = contractUtils.loadContractFromAddress()
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
      console.log('item listed')
      console.log(
        owner,
        nft,
        tokenID,
        quantity,
        pricePerItem,
        startingTime,
        isPrivate,
        allowedAddress,
      )
      owner = toLowerCase(owner)
      nft = toLowerCase(nft)
      allowedAddress = toLowerCase(allowedAddress)

      try {
        let list = await Listing.findOne({
          minter: nft,
          tokenID: tokenID,
        })
        if (!list) {
          let newList = new Listing()
          newList.owner = owner
          newList.minter = nft
          newList.tokenID = tokenID
          newList.price = pricePerItem
          await newList.save()
        } else {
          list.quantity = list.quantity + quantity
          await list.save()
        }
      } catch (error) {}
    },
  )

  //   item sold
  marketplaceSC.on('ItemSold', async (seller, buyer, nft, tokenID, price) => {
    console.log('item sold')
    console.log(seller, buyer, nft, tokenID, price)
    seller = toLowerCase(seller)
    buyer = toLowerCase(buyer)
    nft = toLowerCase(nft)
    try {
      // add new trade history
      let history = new TradeHistory()
      history.collectionAddress = nft
      history.from = seller
      history.to = buyer
      history.tokenID = tokenID
      history.price = price
      await history.save()
      // remove from listing
      let list = await Listing.findOne({
        owner: seller,
        minter: nft,
        tokenID: tokenID,
      })
      if (list.quantity < 1) {
      } else if (list.quantity == 1) {
        await Listing.deleteOne({
          owner: seller,
          minter: nft,
          tokenID: tokenID,
        })
      } else {
        list.quantity = list.quantity - 1
        await list.save()
      }
      // send an email notification to the seller
      let seller = await Account.findOne({ address: seller })
      if (seller) {
        await MailService.sendEmail(
          seller.email,
          'Your item has been sold out!',
          `{Dear ${seller.alias}, you are getting this email because your NFT item with id of ${tokenID} has been sold out at the price of ${price} by ${buyer}}`,
        )
      }
    } catch (error) {}
  })

  //   item updated

  marketplaceSC.on('ItemUpdated', async (owner, nft, tokenID, price) => {
    console.log('item updated')
    console.log(owner, nft, tokenID, price)
    owner = toLowerCase(owner)
    nft = toLowerCase(nft)
  })

  //   item cancelled
  marketplaceSC.on('ItemCanceled', async (owner, nft, tokenID) => {
    console.log('item cancelled')
    console.log(owner, nft, tokenID)
    owner = toLowerCase(owner)
    nft = toLowerCase(nft)
    try {
      // remove from listing
      let list = await Listing.findOne({
        owner: owner,
        minter: nft,
        tokenID: tokenID,
      })
      if (list.quantity < 1) {
      } else if (list.quantity == 1) {
        await Listing.deleteOne({
          owner: owner,
          minter: nft,
          tokenID: tokenID,
        })
      } else {
        list.quantity = list.quantity - 1
        await list.save()
      }
    } catch (error) {}
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
      console.log('offer created')
      console.log(
        creator,
        nft,
        tokenID,
        payToken,
        quantity,
        pricePerItem,
        deadline,
      )
      creator = toLowerCase(creator)
      nft = toLowerCase(nft)
      await Offer.deleteMany({
        creator: creator,
        minter: nft,
        tokenID: tokenID,
      })
      let offer = new Offer()
      offer.creator = creator
      offer.minter = nft
      offer.tokenID = tokenID
      offer.quantity = quantity
      offer.pricePerItem = pricePerItem
      offer.deadline = new Date(deadline)
      await offer.save()
      // let account = Account.findOne({})
    },
  )

  // offer cancelled
  marketplaceSC.on('OfferCanceled', async (creator, nft, tokenID) => {
    console.log('offer canceled')
    console.log(creator, nft, tokenID)
    creator = toLowerCase(creator)
    nft = toLowerCase(nft)
    await Offer.deleteMany({
      creator: creator,
      minter: nft,
      tokenID: tokenID,
    })
  })
}

module.exports = trackMarketPlace
