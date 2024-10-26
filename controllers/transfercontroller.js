const Transfer = require("../models/transfer");
const User = require("../models/User");

// Transfer between users (sender -> receiver)
exports.makeTransfer = async (req, res) => {
    const { senderUsername, receiverUsername, amount, type, note } = req.body;

    try {
        // Find the sender and receiver in the database
        const sender = await User.findOne({ username: senderUsername });
        const receiver = await User.findOne({ username: receiverUsername });

        if (!sender || !receiver) {
            return res.status(404).json({ message: "Sender or receiver not found." });
        }

        // Check if sender has enough balance
        if (type === 'transfer' && sender.balance < amount) {
            return res.status(400).json({ message: "Insufficient balance." });
        }

        // Update the sender's balance (decrease)
        if (type === 'transfer' || type === 'withdraw') {
            sender.balance -= amount;
            await sender.save();
        }

        // Update the receiver's balance (increase for transfers and deposits)
        if (type === 'transfer' || type === 'deposit') {
            receiver.balance += amount;
            await receiver.save();
        }

        // Log the transfer in the Transfer model
        const newTransfer = new Transfer({
            senderId: sender._id,
            receiverId: receiver._id,
            type,
            amount,
            note
        });

        await newTransfer.save();

        // Respond with success and updated balances
        res.status(200).json({
            success: true,
            senderBalance: sender.balance,
            receiverBalance: receiver.balance,
            message: `Transfer of ${amount} successful.`,
        });
    } catch (error) {
        console.error("Transfer failed:", error);
        res.status(500).json({ message: "Transfer failed." });
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
