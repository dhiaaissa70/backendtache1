const Transfer = require("../models/transfer");
const User = require("../models/User");

// Transfer between users (sender -> receiver)
exports.makeTransfer = async (req, res) => {
    const { senderUsername, amount, type, note } = req.body;

    try {
        // Find the sender (user performing the operation)
        const sender = await User.findOne({ username: senderUsername });

        // Check if the sender exists
        if (!sender) {
            return res.status(404).json({ message: "Sender not found." });
        }

        // Ensure the amount is valid
        if (amount <= 0) {
            return res.status(400).json({ message: "Amount must be greater than zero." });
        }

        // Handle withdrawal: Ensure sender has enough balance
        if (type === 'withdraw' && sender.balance < amount) {
            return res.status(400).json({ message: "Insufficient balance." });
        }

        // Perform the transaction: update sender's balance
        if (type === 'deposit') {
            sender.balance += amount;  // Add amount for deposits
        } else if (type === 'withdraw') {
            sender.balance -= amount;  // Subtract amount for withdrawals
        }

        // Save updated balance
        await sender.save();

        // Log the transaction
        const transfer = new Transfer({
            senderId: sender._id,
            type,
            amount,
            note
        });
        await transfer.save();

        // Return the updated balance and success message
        return res.status(200).json({
            success: true,
            senderBalance: sender.balance,
            message: `Transaction ${type} successful!`
        });
    } catch (error) {
        console.error("Transaction error:", error);
        return res.status(500).json({ message: "Transaction failed due to server error." });
    }
};

// Get Transfer History (for sender or receiver)
exports.getTransferHistory = async (req, res, next) => {
    const { username } = req.body;

    try {
        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Fetch all transfers where the user is either the sender or the receiver
        const transfers = await Transfer.find({
            $or: [{ senderId: user._id }, { receiverId: user._id }]
        });

        // Return transfer history
        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Error fetching transfer history:", error);
        return res.status(500).json({ message: "Error fetching transfer history." });
    }
};
