const Transfer = require("../models/transfer");
const User = require("../models/User");
const moment = require('moment');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId

const FEE_RATE = 0.02; // 2% fee for the transaction

// Calculate the transaction fee
const calculateFee = (amount, userRole) => {
    // Define special conditions for fee exemption or discounts
    if (userRole === 'SuperPartner') return 0; // No fee for SuperPartners
    return amount * FEE_RATE;
};

exports.makeTransfer = async (req, res) => {
    const { senderId, receiverId, type, amount, note } = req.body;

    try {
        // Convert amount to a number
        const transferAmount = Number(amount);

        // Validate the amount
        if (isNaN(transferAmount) || transferAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount specified"
            });
        }

        const senderObjectId = new mongoose.Types.ObjectId(senderId);
        const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

        // Fetch sender and receiver
        const sender = await User.findById(senderObjectId);
        const receiver = await User.findById(receiverObjectId);

        if (!sender || !receiver) {
            return res.status(404).json({
                success: false,
                message: "Sender or receiver not found"
            });
        }

        // Determine the fee and final transfer amount
        const transactionFee = calculateFee(transferAmount, sender.role);
        const totalAmount = transferAmount + transactionFee;

        // Check balances based on transaction type
        if (type === 'deposit') {
            if (sender.balance < totalAmount && sender.role !== 'SuperPartner') {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for deposit including fees"
                });
            }
            receiver.balance += transferAmount;
            if (sender.role !== 'SuperPartner') sender.balance -= totalAmount;
        } else if (type === 'withdraw') {
            if (receiver.balance < totalAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance for withdrawal including fees"
                });
            }
            receiver.balance -= transferAmount;
            if (sender.role !== 'SuperPartner') sender.balance += transferAmount - transactionFee;
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid transfer type"
            });
        }

        // Capture balances after transaction
        const senderBalanceAfter = sender.balance;
        const receiverBalanceAfter = receiver.balance;

        // Save updated balances
        await sender.save();
        await receiver.save();

        // Create a new transfer record
        const newTransfer = new Transfer({
            senderId: sender._id,
            receiverId: receiver._id,
            type,
            amount: transferAmount,
            fee: transactionFee,
            note,
            balanceBefore: {
                sender: sender.balance + totalAmount, // Add totalAmount to get initial balance
                receiver: receiver.balance - transferAmount
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




