const mongoose = require("mongoose");

const GameImageSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true, // Ensure one entry per game
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameImage", GameImageSchema);
