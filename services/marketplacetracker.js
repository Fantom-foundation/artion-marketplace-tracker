require('dotenv').config()
const ethers = require('ethers')
const mongoose = require('mongoose')

const Listing = mongoose.model('Listing')
const TradeHistory = mongoose.model('TradeHistory')
const Offer = mongoose.model('Offer')
const ERC721TOKEN = mongoose.model('ERC721TOKEN')
const ERC1155TOKEN = mongoose.model('ERC1155TOKEN')
const Category = mongoose.model('Category')
const Collection = mongoose.model('Collection')
const Account = mongoose.model('Account')

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

const sendEmail = require('../utils/mailer')

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}
const parseToFTM = (inWei) => {
  return parseFloat(inWei.toString()) / 10 ** 18
}

const getCollectionName = async (address) => {
  try {
    let collection = await Collection.findOne({
      erc721Address: toLowerCase(address),
    })
    if (collection) return collection.collectionName
    else return address
  } catch (error) {
    return address
  }
}

const getNFTItemName = async (nft, tokenID, category) => {
  if (category == 1155)
    try {
      let token = await ERC1155TOKEN.findOne({
        contractAddress: toLowerCase(nft),
        tokenID: tokenID,
      })
      if (token) return token.name ? token.name : tokenID
      else return tokenID
    } catch (error) {
      return tokenID
    }
  else if (category == 721)
    try {
      let token = await ERC721TOKEN.findOne({
        contractAddress: toLowerCase(nft),
        tokenID: tokenID,
      })
      if (token) return token.name ? token.name : tokenID
      else return tokenID
    } catch (error) {
      return tokenID
    }
  else return nft
}

const getUserAlias = async (walletAddress) => {
  try {
    let account = await Account.findOne({ address: walletAddress })
    if (account) return account.alias
    else return walletAddress
  } catch (error) {
    return walletAddress
  }
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
      // remove if the same icon list still exists
      try {
        await Listing.deleteMany({
          owner: owner,
          minter: nft,
          tokenID: tokenID,
        })
      } catch (error) {}

      try {
        let newList = new Listing()
        newList.owner = owner
        newList.minter = nft
        newList.tokenID = tokenID
        newList.quantity = quantity
        newList.price = pricePerItem
        newList.startTime = new Date(parseFloat(startingTime) * 1000)
        await newList.save()
      } catch (error) {}
    },
  )

  //   item sold
  marketplaceSC.on(
    'ItemSold',
    async (seller, buyer, nft, tokenID, quantity, price) => {
      seller = toLowerCase(seller)
      buyer = toLowerCase(buyer)
      nft = toLowerCase(nft)
      price = parseToFTM(price)
      quantity = parseInt(quantity)
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
        // send mail here to buyer first
        let account = await Account.findOne({ address: buyer })
        if (account) {
          let to = account.email
          let alias = account.alias
          let collectionName = await getCollectionName(nft)
          let tokenName = await getNFTItemName(nft, tokenID, type)
          let data = {
            type: 'sale',
            to: to,
            isBuyer: true,
            event: 'ItemSold',
            subject: 'You have purchased an NFT Item!',
            alias: alias,
            collectionName: collectionName,
            tokenName: tokenName,
            tokenID: tokenID,
            nftAddress: nft,
            price: price,
          }
          sendEmail(data)
        }
        account = await Account.findOne({ address: seller })
        if (account) {
          let to = account.email
          let alias = account.alias
          let collectionName = await getCollectionName(nft)
          let tokenName = await getNFTItemName(nft, tokenID, type)
          let data = {
            type: 'sale',
            to: to,
            isBuyer: false,
            event: 'ItemSold',
            subject: 'You have sold out an NFT Item!',
            alias: alias,
            collectionName: collectionName,
            tokenName: tokenName,
            tokenID: tokenID,
            nftAddress: nft,
            price: price,
          }
          sendEmail(data)
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
        history.value = quantity
        await history.save()
      } catch (error) {
        console.log(error)
      }
      try {
        // remove from listing
        await Listing.deleteMany({
          owner: seller,
          minter: nft,
          tokenID: tokenID,
        })
      } catch (error) {}
    },
  )

  //   item updated

  marketplaceSC.on('ItemUpdated', async (owner, nft, tokenID, price) => {
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
    // update price from listing
    let list = await Listing.findOne({
      owner: owner,
      minter: nft,
      tokenID: tokenID,
    })
    if (list) {
      list.price = price
      await list.save()
    }
  })

  //   item cancelled
  marketplaceSC.on('ItemCanceled', async (owner, nft, tokenID) => {
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
      await Listing.deleteMany({
        owner: owner,
        minter: nft,
        tokenID: tokenID,
      })
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
      // now send email to the owner
      try {
        let category = await Category.findOne({ minterAddress: nft })
        if (category) {
          let type = parseInt(category.type)
          if (type == 721) {
            let tokenOwner = await ERC721TOKEN.findOne({
              contractAddress: nft,
              tokenID: tokenID,
            })
            let owner = await Account.findOne({
              address: tokenOwner.owner,
            })
            if (owner) {
              let alias = await getUserAlias(owner.address)
              let tokenName = await getNFTItemName(nft, tokenID, 721)
              let creatorAlias = await getUserAlias(creator)
              let collectionName = await getCollectionName(nft)
              let data = {
                type: 721,
                to: owner.email,
                from: creatorAlias,
                isBuyer: false,
                event: 'OfferCreated',
                subject: 'You received an Offer!',
                alias: alias,
                collectionName: collectionName,
                tokenName: tokenName,
                tokenID: tokenID,
                nftAddress: nft,
                price: pricePerItem,
              }
              sendEmail(data)
            }
          } else if (category == 1155) {
          }
        }
      } catch (error) {
        console.log(error)
      }
    },
  )

  // offer cancelled
  marketplaceSC.on('OfferCanceled', async (creator, nft, tokenID) => {
    try {
      creator = toLowerCase(creator)
      nft = toLowerCase(nft)
      await Offer.deleteMany({
        creator: creator,
        minter: nft,
        tokenID: tokenID,
      })
    } catch (error) {}
    // now send email
    try {
      let category = await Category.findOne({ minterAddress: nft })
      if (category) {
        let type = parseInt(category.type)
        if (type == 721) {
          let tokenOwner = await ERC721TOKEN.findOne({
            contractAddress: nft,
            tokenID: tokenID,
          })
          let owner = await Account.findOne({
            address: tokenOwner.owner,
          })
          if (owner) {
            let alias = await getUserAlias(owner.address)
            let tokenName = await getNFTItemName(nft, tokenID, 721)
            let creatorAlias = await getUserAlias(creator)
            let collectionName = await getCollectionName(nft)
            let data = {
              type: 721,
              to: owner.email,
              from: creatorAlias,
              isBuyer: false,
              event: 'OfferCanceled',
              subject: 'Offer has been withdrawn for your item!',
              alias: alias,
              collectionName: collectionName,
              tokenName: tokenName,
              tokenID: tokenID,
              nftAddress: nft,
            }
            if (creatorAlias != alias) sendEmail(data)
          }
        } else if (category == 1155) {
        }
      }
    } catch (error) {
      console.log(error)
    }
  })
}

module.exports = trackMarketPlace
