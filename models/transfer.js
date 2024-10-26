const mongoose = require("mongoose");

// Define the TransferSchema to store each transaction (deposit/withdrawal)
const TransferSchema = new mongoose.Schema({
    senderId: {  // User initiating the transfer
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',  // Reference to the User model
        required: true 
    },
    receiverId: {  // User receiving the transfer
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',  // Reference to the User model
        required: true 
    },
    type: {  // Transfer type, can be deposit or withdraw
        type: String, 
        enum: ["deposit", "withdraw", "transfer"],  // Adding "transfer" for transfers between users
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    note: { 
        type: String 
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
});

const Transfer = mongoose.model("Transfer", TransferSchema);
module.exports = Transfer;
