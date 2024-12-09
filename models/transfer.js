const mongoose = require("mongoose");

const TransferSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return this.type === 'withdraw'; // Required only for withdrawals
    },
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return this.type === 'deposit'; // Required only for deposits
    },
  },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'debit', 'credit', 'rollback'], // Include rollback
    required: true,
  },
  transaction_id: {
    type: String,
    unique: true, // Ensures rollback works correctly by matching transaction_id
  },
  amount: {
    type: Number,
    required: true,
  },
  gameId: { 
    type: String, 
    required: false, // Not required for non-game transactions
  },
  gameName: { 
    type: String, 
    required: false, // Not required for non-game transactions
  },
  note: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  balanceBefore: {
    sender: { type: Number }, // Nullable if senderId is not applicable
    receiver: { type: Number }, // Nullable if receiverId is not applicable
  },
  balanceAfter: {
    sender: { type: Number }, // Nullable if senderId is not applicable
    receiver: { type: Number }, // Nullable if receiverId is not applicable
  },
});

const Transfer = mongoose.model('Transfer', TransferSchema);
module.exports = Transfer;
