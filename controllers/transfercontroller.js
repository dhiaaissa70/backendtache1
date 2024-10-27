const Transfer = require("../models/transfer");
const User = require("../models/User");

// Transfer between users (sender -> receiver)
exports.makeTransfer = async (req, res) => {
    const { senderId, receiverId, amount, note } = req.body;

    // Vérification des paramètres requis
    if (!senderId || !receiverId || !amount) {
        return res.status(400).json({
            success: false,
            message: "Les paramètres 'senderId', 'receiverId' et 'amount' sont requis."
        });
    }

    try {
        // Trouver l'expéditeur et le destinataire
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);

        if (!sender || !receiver) {
            return res.status(404).json({
                success: false,
                message: "L'expéditeur ou le destinataire n'a pas été trouvé."
            });
        }

        // Vérifiez si l'expéditeur a suffisamment de fonds (ajoutez votre logique ici)
        if (sender.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Solde insuffisant pour effectuer le transfert."
            });
        }

        // Effectuer le transfert
        const transfer = new Transfer({
            senderId,
            receiverId,
            type: 'transfer', // ou 'deposit', selon votre logique
            amount,
            note
        });

        await transfer.save();

        // Mettre à jour les soldes des utilisateurs
        sender.balance -= amount; // Déduire le montant du solde de l'expéditeur
        receiver.balance += amount; // Ajouter le montant au solde du destinataire

        await sender.save();
        await receiver.save();

        return res.status(201).json({
            success: true,
            message: "Transfert effectué avec succès.",
            transfer
        });
    } catch (error) {
        console.error("Erreur lors de l'exécution du transfert :", error);
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de l'exécution du transfert."
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
