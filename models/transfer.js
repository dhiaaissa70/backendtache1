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
    },
    balanceBefore: {
        sender: { type: Number, required: true },
        receiver: { type: Number, required: true }
    },
    balanceAfter: {
        sender: { type: Number, required: true },
        receiver: { type: Number, required: true }
    }
});

const Transfer = mongoose.model('Transfer', TransferSchema);
module.exports = Transfer;
