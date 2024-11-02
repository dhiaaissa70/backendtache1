const Transfer = require("../models/transfer");
const User = require("../models/User");
const moment = require('moment');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId


exports.makeTransfer = async (req, res) => {
    const { senderId, receiverId, type, amount, note } = req.body;

    try {
        // Convertir amount en nombre
        const transferAmount = Number(amount);

        // Vérifier si la conversion a réussi
        if (isNaN(transferAmount) || transferAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount specified"
            });
        }

        const senderObjectId = new mongoose.Types.ObjectId(senderId);
        const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

        // Check if sender and receiver exist
        const sender = await User.findById(senderObjectId);
        const receiver = await User.findById(receiverObjectId);

        if (!sender || !receiver) {
            return res.status(404).json({
                success: false,
                message: "Sender or receiver not found"
            });
        }

        // Capture balances before transaction
        const senderBalanceBefore = sender.balance;
        const receiverBalanceBefore = receiver.balance;

        const senderIsSuperPartner = sender.role === 'SuperPartner';

        // Process the transfer
        if (type === 'deposit') {
            receiver.balance += transferAmount;

            if (!senderIsSuperPartner) {
                sender.balance -= transferAmount;
            }
        } else if (type === 'withdraw') {
            if (receiver.balance < transferAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for withdrawal"
                });
            }

            receiver.balance -= transferAmount;

            if (!senderIsSuperPartner) {
                sender.balance += transferAmount;
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid transfer type"
            });
        }

        // Capture balances after transaction
        const senderBalanceAfter = sender.balance;
        const receiverBalanceAfter = receiver.balance;

        // Save the updated balances
        await sender.save();
        await receiver.save();

        // Create the transfer record with balanceBefore and balanceAfter
        const newTransfer = new Transfer({
            senderId: sender._id,
            receiverId: receiver._id,
            type,
            amount: transferAmount, // Utiliser transferAmount ici
            note,
            balanceBefore: {
                sender: senderBalanceBefore,
                receiver: receiverBalanceBefore
            },
            balanceAfter: {
                sender: senderBalanceAfter,
                receiver: receiverBalanceAfter
            }
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
        console.error("Error during transfer creation:", error);
        res.status(400).json({
            success: false,
            message: error.message || "An error occurred during the transfer"
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


exports.getAllTransfers = async (req, res) => {
    try {
        // Find all transfers and populate sender and receiver details
        const transfers = await Transfer.find({})
            .populate('senderId', 'username role') // Populate sender's username and role
            .populate('receiverId', 'username role') // Populate receiver's username and role
            .sort({ date: -1 }); // Sort by most recent transfers (you can adjust sorting if needed)

        // Return the transfers with the populated details
        res.status(200).json({
            success: true,
            transfers,
        });
    } catch (error) {
        console.error("Error fetching all transfers:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching all transfers.",
        });
    }
};




