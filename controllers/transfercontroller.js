const Transfer = require("../models/transfer");
const User = require("../models/User");
exports.makeTransfer = async (req, res) => {
    const { senderId, receiverId, type, amount, note } = req.body;

    try {
        // Vérifiez si les utilisateurs existent
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);

        if (!sender || !receiver) {
            return res.status(404).json({
                success: false,
                message: "Sender or receiver not found"
            });
        }

        if (type === 'deposit') {
            receiver.balance += amount; 
        } else if (type === 'withdraw') {
            if (receiver.balance < amount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for withdrawal"
                });
            }
            receiver.balance -= amount; 
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid transfer type"
            });
        }
        await receiver.save();
        await sender.save();


        const newTransfer = new Transfer({
            senderId,
            receiverId,
            type,
            amount,
            note
        });

        await newTransfer.save();

        res.status(201).json({
            success: true,
            data: {
                transfer: newTransfer,
                updatedSender: sender,
                updatedReceiver: receiver
            }
        });
    } catch (error) {
        console.error("Erreur lors de la création du transfert :", error);
        res.status(400).json({
            success: false,
            message: error.message || "Une erreur est survenue lors de la création du transfert"
        });
    }
};

exports.getTransferHistory = async (req, res, next) => {
    const { username } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const transfers = await Transfer.find({
            $or: [{ senderId: user._id }, { receiverId: user._id }]
        });

        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Error fetching transfer history:", error);
        return res.status(500).json({ message: "Error fetching transfer history." });
    }
};