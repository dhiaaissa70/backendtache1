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

const getDateFilter = (dateOption) => {
    const now = new Date();
    let startDate, endDate;

    switch (dateOption) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0)); // Today, 00:00
            endDate = new Date(now.setHours(23, 59, 59, 999)); // Today, 23:59
            break;
        case 'yesterday':
            startDate = new Date(now.setDate(now.getDate() - 1));
            startDate.setHours(0, 0, 0, 0); // Yesterday, 00:00
            endDate = new Date(now.setHours(23, 59, 59, 999)); // Yesterday, 23:59
            break;
        case '7days':
            endDate = new Date(now.setHours(23, 59, 59, 999)); // Current date, 23:59
            startDate = new Date(now.setDate(now.getDate() - 7)); // 7 days ago, 00:00
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of the month
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of the month
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            // Custom or full range if not matched
            startDate = new Date('1970-01-01'); // Beginning of time
            endDate = new Date(); // Current date
            break;
    }

    return { start: startDate, end: endDate };
};


exports.getTransferHistory = async (req, res, next) => {
    const { username, date } = req.query;

    try {
        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Apply date filter using the getDateFilter helper
        const dateFilter = getDateFilter(date);

        // Fetch transfers where the user is either the sender or the receiver, within the date range
        const transfers = await Transfer.find({
            $or: [{ senderId: user._id }, { receiverId: user._id }],
            date: { $gte: dateFilter.start, $lte: dateFilter.end }
        });

        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Error fetching transfer history:", error);
        return res.status(500).json({ message: "Error fetching transfer history." });
    }
};
