require('dotenv').config()
const ethers = require('ethers')
const axios = require('axios')

const mongoose = require('mongoose')
const TrackerState = mongoose.model('TRACKER_STATE');
const EVENT_DEAD_LETTER_QUEUE = require('../models/event_deadletter_queue');
const EventDeadLetterQueue = mongoose.model('EVENT_DEAD_LETTER_QUEUE', EVENT_DEAD_LETTER_QUEUE);

const MarketplaceContractInfo = require('../constants/salescontractabi')
const provider = new ethers.providers.JsonRpcProvider(
  process.env.NETWORK_RPC,
  parseInt(process.env.NETWORK_CHAINID),
)
const decoder = new ethers.utils.AbiCoder();

const loadMarketplaceContract = () => {
  const abi = MarketplaceContractInfo.abi
  const address = process.env.CONTRACTADDRESS
  return new ethers.Contract(address, abi, provider)
}
const marketplaceSc = loadMarketplaceContract()

const apiEndPoint = process.env.API_ENDPOINT
const callAPI = async (endpoint, data) => {
  try {
    await axios({
      method: 'post',
      url: apiEndPoint + endpoint,
      data,
    })
  } catch(err) {
    // If bad request save to dead letter queue
    if (err?.response?.status === 400) {
      console.warn(`[bad-request] add event to dead-letter-queue, txHash: ${data.transactionHash}`);
      await EventDeadLetterQueue.create({contract: process.env.CONTRACTADDRESS, event: data})
      return;
    }
    // If other reasons (server unreachable for example) throw and block;
    throw err;
  }
}

const processMarketplaceEvents = async (startFromBlock) => {
  const currentBlock = await provider.getBlockNumber();
  let lastBlockProcessed = currentBlock;

  console.info(`Tracking block: ${startFromBlock} - ${currentBlock}`)

  const handleItemListed = async (event) => {
    return callAPI('itemListed', event)
  }
  const handleItemSold = async (event) => {
    return callAPI('ItemSold', event)
  }
  const handleItemUpdated = async (event) => {
    return callAPI('itemUpdated', event)
  }
  const handleItemCancelled = async (event) => {
    return callAPI('itemCanceled', event)
  }

  const handleOfferCreated = async (event) => {
    return callAPI('offerCreated', event)
  }
  const handleOfferCanceled = async (event) => {
    return callAPI('offerCanceled', event)
  }


  async function handleEvents(events) {
    let count = 0
    for (const event of events) {
      // Item lifecycle events
      if (event.event === "ItemListed") {
        console.log(`[ItemListed] tx: ${event.transactionHash}, block: ${event.blockNumber}`)
        await handleItemListed(event);
      }

      // TODO: FIX event is not being send by contract with [buy item] method call and remove workaround
      // if (event.event === "ItemSold") {
      //   await handleItemSold(event);
      //   console.log("SOLD ITEM");
      //   break;
      // }
      // temp ItemSold event workaround
      if (!event.event) {
        const ItemSoldEvent = "0x949d1413";

        if (event?.topics?.length && event.topics[0].slice(0, 10) === ItemSoldEvent) {
          console.log(`[ItemSold] tx: ${event.transactionHash}, block: ${event.blockNumber}`)

          const decodedData = decoder.decode([ 'uint256', 'uint256', 'address', 'uint256', 'uint256' ], event.data);
          const seller = decoder.decode(["address"], event.topics[1])[0];
          const buyer = decoder.decode(["address"], event.topics[2])[0];
          const nft = decoder.decode(["address"], event.topics[3])[0];
          const args = [seller, buyer, nft, ...decodedData];

          await handleItemSold({...event, event: "ItemSold", args});
        }
      }

      if (event.event === "ItemCanceled") {
        console.log(`[ItemCancelled] tx: ${event.transactionHash}, block: ${event.blockNumber}`)
        await handleItemCancelled(event);
      }
      if (event.event === "ItemUpdated") {
        console.log(`[ItemUpdated] tx: ${event.transactionHash}, block: ${event.blockNumber}`)
        await handleItemUpdated(event)
      }

      // Offer events
      if (event.event === "OfferCreated") {
        console.log(`[OfferCreated] tx: ${event.transactionHash}, block: ${event.blockNumber}`)
        await handleOfferCreated(event)
      }
      if (event.event === "OfferCanceled") {
        console.log(`[OfferCanceled] tx: ${event.transactionHash}, block: ${event.blockNumber}`)
        await handleOfferCanceled(event)
      }



      lastBlockProcessed = event.blockNumber + 1;
    }
  }

  try {
    const pastEvents = await marketplaceSc.queryFilter('*', startFromBlock, currentBlock);
    await handleEvents(pastEvents);

    if (!pastEvents.length) {
      lastBlockProcessed = currentBlock;
    }

    return TrackerState.updateOne({contractAddress: process.env.CONTRACTADDRESS}, {lastBlockProcessed})
  } catch (err) {
    console.error(err.message);
  }
}

module.exports = processMarketplaceEvents
