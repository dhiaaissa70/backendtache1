const Transfer = require("../models/transfer");
const User = require("../models/User");

// Transfer between users (sender -> receiver)
const makeTransfer = async (req, res) => {
    const { senderUsername, receiverUsername, amount, type, note } = req.body;

    try {
        const sender = await User.findOne({ username: senderUsername });
        const receiver = type === 'transfer' ? await User.findOne({ username: receiverUsername }) : null;

        if (!sender) {
            return res.status(404).json({ message: "Sender not found." });
        }

        if (type === 'transfer' && !receiver) {
            return res.status(404).json({ message: "Receiver not found." });
        }

        // Ensure sender has sufficient balance for withdrawals or transfers
        if ((type === 'withdraw' || type === 'transfer') && sender.balance < amount) {
            return res.status(400).json({ message: "Insufficient balance." });
        }

        // Deduct amount from sender's balance for withdraw or transfer
        if (type === 'withdraw' || type === 'transfer') {
            sender.balance -= amount;
            await sender.save();
        }

        // Add amount to receiver's balance if it's a transfer
        if (type === 'transfer' && receiver) {
            receiver.balance += amount;
            await receiver.save();
        }

        // Create and log the transfer
        const transfer = new Transfer({
            senderId: sender._id,
            receiverId: receiver ? receiver._id : null,
            type,
            amount,
            note
        });
        await transfer.save();

        return res.status(200).json({
            success: true,
            senderBalance: sender.balance,
            receiverBalance: receiver ? receiver.balance : null,
            message: `Transfer ${type} successful!`
        });
    } catch (error) {
        console.error("Transfer error:", error);
        return res.status(500).json({ message: "Transfer failed." });
    }
};


// Get Transfer History (for sender or receiver)
exports.getTransferHistory = async (req, res, next) => {
    const { username } = req.body;

    try {
        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Fetch all transfers where the user is either the sender or the receiver
        const transfers = await Transfer.find({
            $or: [{ senderId: user._id }, { receiverId: user._id }]
        });

        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique des transferts :", error);
        next(error);
    }
};
