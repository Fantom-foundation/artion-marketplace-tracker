const mongoose = require('mongoose')

const Listing = mongoose.model('Listing')
const TradeHistory = mongoose.model('TradeHistory')
const Offer = mongoose.model('Offer')
const ERC721TOKEN = mongoose.model('ERC721TOKEN')
const ERC1155TOKEN = mongoose.model('ERC1155TOKEN')
const Category = mongoose.model('Category')

const contractUtils = require('../utils/contracts.utils')

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}
const parseToFTM = (inWei) => {
  return parseFloat(inWei.toString()) / 10 ** 18
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
      owner = toLowerCase(owner)
      nft = toLowerCase(nft)
      allowedAddress = toLowerCase(allowedAddress)
      pricePerItem = parseToFTM(pricePerItem)
      // first update the token price
      let category = await Category.findOne({ minterAddress: nft })
      if (category) {
        let type = parseInt(category.type)
        if (type == 721) {
          let token = await ERC721TOKEN.findOne({
            contractAddress: nft,
            tokenID: tokenID,
          })
          if (token) {
            token.price = parseFloat(pricePerItem)
            token.listedAt = new Date() // set listed date
            await token.save()
          }
        } else if (type == 1155) {
          let token = await ERC1155TOKEN.findOne({
            contractAddress: nft,
            tokenID: tokenID,
          })
          if (token) {
            token.price = parseFloat(pricePerItem)
            token.listedAt = new Date() // set listed date
            await token.save()
          }
        }
      }

      try {
        let list = await Listing.findOne({
          minter: nft,
          tokenID: tokenID,
          owner: owner,
        })
        if (!list) {
          let newList = new Listing()
          newList.owner = owner
          newList.minter = nft
          newList.tokenID = tokenID
          newList.price = pricePerItem
          await newList.save()
        } else {
          list.quantity = parseInt(list.quantity) + parseInt(quantity)
          await list.save()
        }
      } catch (error) {}
    },
  )

  //   item sold
  marketplaceSC.on('ItemSold', async (seller, buyer, nft, tokenID, price) => {
    seller = toLowerCase(seller)
    buyer = toLowerCase(buyer)
    nft = toLowerCase(nft)
    price = parseToFTM(price)
    // update last sale price
    // first update the token price
    let category = await Category.findOne({ minterAddress: nft })
    if (category) {
      let type = parseInt(category.type)
      if (type == 721) {
        let token = await ERC721TOKEN.findOne({
          contractAddress: nft,
          tokenID: tokenID,
        })
        if (token) {
          token.price = parseFloat(price)
          token.lastSalePrice = parseFloat(price)
          token.soldAt = new Date() //set recently sold date
          token.listedAt = new Date(1970, 1, 1) //remove listed date
          await token.save()
        }
      } else if (type == 1155) {
        let token = await ERC1155TOKEN.findOne({
          contractAddress: nft,
          tokenID: tokenID,
        })
        if (token) {
          token.price = parseFloat(price)
          token.lastSalePrice = parseFloat(price)
          token.soldAt = new Date() //set recently sold date
          token.listedAt = new Date(1970, 1, 1) //remove listed date
          await token.save()
        }
      }
    }
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
      if (parseInt(list.quantity) < 1) {
      } else if (parseInt(list.quantity) == 1) {
        await Listing.deleteOne({
          owner: seller,
          minter: nft,
          tokenID: tokenID,
        })
      } else {
        list.quantity = parseInt(list.quantity) - 1
        await list.save()
      }
    } catch (error) {
      console.log(error)
    }
  })

  //   item updated

  marketplaceSC.on('ItemUpdated', async (owner, nft, tokenID, price) => {
    console.log('item updated')
    console.log(owner, nft, tokenID, price)
    owner = toLowerCase(owner)
    nft = toLowerCase(nft)
    price = parseToFTM(price)
    // update the price of the nft here
    // first update the token price
    let category = await Category.findOne({ minterAddress: nft })
    if (category) {
      let type = parseInt(category.type)
      if (type == 721) {
        let token = await ERC721TOKEN.findOne({
          contractAddress: nft,
          tokenID: tokenID,
        })
        if (token) {
          token.price = parseFloat(price)
          await token.save()
        }
      } else if (type == 1155) {
        let token = await ERC1155TOKEN.findOne({
          contractAddress: nft,
          tokenID: tokenID,
        })
        if (token) {
          token.price = parseFloat(price)
          await token.save()
        }
      }
    }
  })

  //   item cancelled
  marketplaceSC.on('ItemCanceled', async (owner, nft, tokenID) => {
    console.log('item cancelled')
    console.log(owner, nft, tokenID)
    owner = toLowerCase(owner)
    nft = toLowerCase(nft)

    let category = await Category.findOne({ minterAddress: nft })
    if (category) {
      let type = parseInt(category.type)
      if (type == 721) {
        let token = await ERC721TOKEN.findOne({
          contractAddress: nft,
          tokenID: tokenID,
        })
        if (token) {
          token.listedAt = new Date(1970, 1, 1) //remove listed date
          await token.save()
        }
      } else if (type == 1155) {
        let token = await ERC1155TOKEN.findOne({
          contractAddress: nft,
          tokenID: tokenID,
        })
        if (token) {
          token.listedAt = new Date(1970, 1, 1) //remove listed date
          await token.save()
        }
      }
    }

    try {
      // remove from listing
      let list = await Listing.findOne({
        owner: owner,
        minter: nft,
        tokenID: tokenID,
      })
      if (parseInt(list.quantity) < 1) {
      } else if (parseInt(list.quantity) == 1) {
        await Listing.deleteOne({
          owner: owner,
          minter: nft,
          tokenID: tokenID,
        })
      } else {
        list.quantity = parseInt(list.quantity) - 1
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
      creator = toLowerCase(creator)
      nft = toLowerCase(nft)
      pricePerItem = parseToFTM(pricePerItem)

      try {
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
        offer.deadline = deadline
        await offer.save()
      } catch (error) {}
    },
  )

  // offer cancelled
  marketplaceSC.on('OfferCanceled', async (creator, nft, tokenID) => {
    console.log('offer canceled')
    try {
      console.log(creator, nft, tokenID)
      creator = toLowerCase(creator)
      nft = toLowerCase(nft)
      await Offer.deleteMany({
        creator: creator,
        minter: nft,
        tokenID: tokenID,
      })
    } catch (error) {}
  })
}

module.exports = trackMarketPlace
