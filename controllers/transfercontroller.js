const Transfer = require("../models/transfer");
const User = require("../models/User");
const moment = require('moment');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId

exports.makeTransfer = async (req, res) => {
    const { senderId, receiverId, type, amount, note } = req.body;

    try {
        // Convert senderId and receiverId to ObjectId (if they are passed as strings)
        const senderObjectId = mongoose.Types.ObjectId(senderId);
        const receiverObjectId = mongoose.Types.ObjectId(receiverId);

        // Vérifiez si les utilisateurs existent
        const sender = await User.findById(senderObjectId);
        const receiver = await User.findById(receiverObjectId);

        if (!sender || !receiver) {
            return res.status(404).json({
                success: false,
                message: "Sender or receiver not found"
            });
        }

        // Check the role of the sender
        const senderIsSuperAdmin = sender.role === 'SuperPartner';

        // Processing transfer type
        if (type === 'deposit') {
            receiver.balance += amount;

            // Deduct from sender only if the sender is not a SuperAdmin
            if (!senderIsSuperAdmin) {
                sender.balance -= amount;
            }
        } else if (type === 'withdraw') {
            // Ensure receiver has enough balance to withdraw
            if (receiver.balance < amount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for withdrawa"
                });
            }

            receiver.balance -= amount;

            // Add to sender's balance only if the sender is not a SuperAdmin
            if (!senderIsSuperAdmin) {
                sender.balance += amount;
            }

        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid transfer type"
            });
        }

        // Save the updated balances for both users
        await receiver.save();
        await sender.save();

        // Create the transfer record
        const newTransfer = new Transfer({
            senderId: sender._id, // Store actual ObjectId
            receiverId: receiver._id, // Store actual ObjectId
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

// Helper function to generate the start and end date ranges based on input
const getDateFilter = (dateOption) => {
    let start, end;
    
    console.log("getDateFilter called with dateOption:", dateOption); // Log the input dateOption

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
            // Assuming the dateOption is a custom date in YYYY-MM-DD format
            start = moment(dateOption).startOf('day').toDate();
            end = moment(dateOption).endOf('day').toDate();
            break;
    }

    console.log("Generated start date:", start);
    console.log("Generated end date:", end);

    return { start, end };
};

// Controller function to get transfer history
exports.getTransferHistory = async (req, res, next) => {
    const { username, date } = req.query;

    try {
        console.log("Fetching transfer history for user:", username, "with date:", date);

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Apply the date filter
        const dateFilter = getDateFilter(date);
        console.log("Date filter applied:", dateFilter);

        // Find transfers and populate senderId and receiverId with usernames and roles
        const transfers = await Transfer.find({
            $or: [
                { senderId: user._id },
                { receiverId: user._id }
            ],
            date: { $gte: dateFilter.start, $lte: dateFilter.end }
        })
        .populate('senderId', 'username role')  // Populate both username and role for senderId
        .populate('receiverId', 'username role'); // Populate both username and role for receiverId

        console.log("Fetched transfers:", transfers);

        res.status(200).json({ success: true, transferHistory: transfers });
    } catch (error) {
        console.error("Error fetching transfer history:", error);
        return res.status(500).json({ message: "Error fetching transfer history." });
    }
};




