const Transfer = require("../models/transfer");
const User = require("../models/User");

exports.makeTransfer = async (req, res) => {
    const { senderId, receiverId, amount, note, type } = req.body;

    // Validation de type
    if (!['deposit', 'withdraw'].includes(type)) {
        return res.status(400).json({
            success: false,
            message: 'Type de transfert invalide. Utilisez "deposit" ou "withdraw".'
        });
    }

    try {
        const newTransfer = new Transfer({
            senderId,
            receiverId,
            amount,
            type,
            note
        });

        // Sauvegarder le transfert dans la base de données
        await newTransfer.save();
        
        res.status(201).json({
            success: true,
            message: 'Transfert effectué avec succès',
            transfer: newTransfer
        });
    } catch (error) {
        console.error("Erreur lors du transfert :", error);
        res.status(500).json({
            success: false,
            message: error.message || "Une erreur est survenue lors du transfert"
        });
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
