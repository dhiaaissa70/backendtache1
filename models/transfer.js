const mongoose = require('mongoose');
const TransferSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdraw'], 
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

const Transfer = mongoose.model('Transfer', TransferSchema);
module.exports = Transfer;
