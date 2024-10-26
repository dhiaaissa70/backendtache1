const mongoose = require("mongoose");

// Define the TransferSchema to store each transaction (deposit/withdrawal)
const TransferSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',  // Reference to the User model
        required: true 
    },
    type: { 
        type: String, 
        enum: ["deposit", "withdraw"], 
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
