const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    }, // Link to the user who initiated the session
    gameId: { 
        type: Number, 
        required: true 
    }, // ID of the game being played
    gamesession_id: { 
        type: String, 
        required: false // Change to optional
    }, // Unique game session ID from the gaming provider
    sessionid: { 
        type: String 
    }, // Optional: session ID for tracking player logins
    balanceBefore: { 
        type: Number, 
        required: true 
    }, // User's balance before the game session
    balanceAfter: { 
        type: Number 
    }, // User's balance after the game session
    result: { 
        type: String, 
        enum: ["win", "loss", "pending"], 
        default: "pending" 
    }, // Outcome of the game session
    amount: { 
        type: Number, 
        default: 0 
    }, // Amount won or lost during the session
    createdAt: { 
        type: Date, 
        default: Date.now 
    } // Timestamp for when the session started
});

const GameSession = mongoose.model("GameSession", gameSessionSchema);
module.exports = GameSession;
