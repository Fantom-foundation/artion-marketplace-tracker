require('dotenv').config()
const mongoose = require('mongoose')

require('./models/account')
require('./models/bundle')
require('./models/event')
require('./models/erc721token')
require('./models/erc721contract')
require('./models/tradehistory')
require('./models/collection')
require('./models/abi')
require('./models/listing')
require('./models/notification')
require('./models/bid')
require('./models/highestblock')
require('./models/offer')
require('./models/category')
require('./models/auction')

const trackMarketPlace = require('./services/marketplacetracker')

const uri = process.env.DB_URL

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', async () => {
  console.log('marketplace tracker has been connected to the db server')
  trackMarketPlace()
})
