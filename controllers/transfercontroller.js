const Transfer = require("../models/transfer");
const User = require("../models/User");
const moment = require('moment');
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

const getDateFilter = (dateOption) => {
    let start, end;

    switch (dateOption) {
        case 'today':
            start = moment().startOf('day').toDate();
            end = moment().endOf('day').toDate();
            break;
        case 'yesterday':
            start = moment().subtract(1, 'days').startOf('day').toDate();
            end = moment().subtract(1, 'days').endOf('day').toDate();
            break;
        case '7days':
            start = moment().subtract(7, 'days').startOf('day').toDate();
            end = moment().endOf('day').toDate();
            break;
        case 'month':
            start = moment().startOf('month').toDate();
            end = moment().endOf('month').toDate();
            break;
        default:
            // Custom date (Assume the dateOption is in YYYY-MM-DD format for custom dates)
            start = moment(dateOption).startOf('day').toDate();
            end = moment(dateOption).endOf('day').toDate();
            break;
    }

    return { start, end };
};

// Controller function
exports.getTransferHistory = async (req, res, next) => {
    const { username, date } = req.query;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Apply date filter
        const dateFilter = getDateFilter(date);

        const transfers = await Transfer.find({
            senderId: user._id,
            date: { $gte: dateFilter.start, $lte: dateFilter.end }
        });

        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Error fetching transfer history:", error);
        return res.status(500).json({ message: "Error fetching transfer history." });
    }
};