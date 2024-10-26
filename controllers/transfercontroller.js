const Transfer = require("../models/transfer");
const User = require("../models/User");

// Transfer Controller
exports.transfer = async (req, res, next) => {
    const { username, amount, type, note } = req.body;

    if (!username || !amount || !type) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur, montant et type de transfert requis" });
    }

    if (amount <= 0) {
        return res.status(400).json({ success: false, message: "Montant invalide" });
    }

    try {
        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Handle deposit
        if (type === 'deposit') {
            user.balance += amount;
        }
        // Handle withdrawal
        else if (type === 'withdraw') {
            if (user.balance < amount) {
                return res.status(400).json({ success: false, message: "Solde insuffisant" });
            }
            user.balance -= amount;
        } else {
            return res.status(400).json({ success: false, message: "Type de transfert invalide" });
        }

        // Save the user's updated balance
        await user.save();

        // Create a new transfer record in the Transfer collection
        const transfer = new Transfer({
            userId: user._id,  // Reference to the User
            type,
            amount,
            note
        });

        // Save the transfer record
        await transfer.save();

        res.status(200).json({ success: true, message: `Transfert ${type} réussi`, balance: user.balance });
    } catch (error) {
        console.error("Erreur lors du transfert :", error);
        next(error);
    }
};

// Transfer History Controller
exports.getTransferHistory = async (req, res, next) => {
    const { username } = req.body;

    try {
        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Fetch all transfers for this user
        const transfers = await Transfer.find({ userId: user._id });

        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique des transferts :", error);
        next(error);
    }
};
