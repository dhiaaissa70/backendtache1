const mongoose = require("mongoose");

const GameImageSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true, // Ensure every game has a gameId
    unique: false,  // `gameId` is not unique because duplicates are possible
  },
  id_hash: {
    type: String,
    required: true,
    unique: true, // Use id_hash as the unique identifier
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  release_date: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    required: false, // Abbreviation of the provider (e.g., 'ha')
  },
  provider_name: {
    type: String,
    required: false, // Full name of the provider (e.g., 'Habanero')
  },
  providerLogos: {
    type: Object, // Stores logos from `response_provider_logos`
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameImage", GameImageSchema);
