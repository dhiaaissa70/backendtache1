const Transfer = require("../models/transfer");
const User = require("../models/User");

// Transfer between users (sender -> receiver)
exports.transfer = async (req, res, next) => {
    const { senderUsername, receiverUsername, amount, type, note } = req.body;

    if (!senderUsername || !receiverUsername || !amount || !type) {
        return res.status(400).json({ success: false, message: "Les informations du transfert sont incomplètes" });
    }

    if (amount <= 0) {
        return res.status(400).json({ success: false, message: "Montant invalide" });
    }

    try {
        // Find the sender and receiver users by their usernames
        const sender = await User.findOne({ username: senderUsername });
        const receiver = await User.findOne({ username: receiverUsername });

        if (!sender) {
            return res.status(404).json({ success: false, message: "Expéditeur non trouvé" });
        }
        if (!receiver) {
            return res.status(404).json({ success: false, message: "Destinataire non trouvé" });
        }

        // Ensure sender has enough balance to perform the transfer
        if (type === 'transfer' && sender.balance < amount) {
            return res.status(400).json({ success: false, message: "Solde insuffisant pour l'expéditeur" });
        }

        // Handle sender's balance update (withdraw)
        if (type === 'transfer') {
            sender.balance -= amount;
        }

        // Handle receiver's balance update (deposit)
        receiver.balance += amount;

        // Save updated balances
        await sender.save();
        await receiver.save();

        // Create a new transfer record
        const transfer = new Transfer({
            senderId: sender._id,
            receiverId: receiver._id,
            type,
            amount,
            note
        });

        // Save the transfer record
        await transfer.save();

        res.status(200).json({ 
            success: true, 
            message: `Transfert ${type} réussi`, 
            senderBalance: sender.balance, 
            receiverBalance: receiver.balance 
        });
    } catch (error) {
        console.error("Erreur lors du transfert :", error);
        next(error);
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
