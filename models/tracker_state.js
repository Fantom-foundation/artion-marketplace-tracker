const mongoose = require('mongoose')

const TRACKER_STATE = mongoose.Schema({
  contractAddress: { type: String, required: true},
  lastBlockProcessed: { type: Number, required: true },
})
TRACKER_STATE.index({ contractAddress: 1 }, { unique: true })

module.exports = TRACKER_STATE;
