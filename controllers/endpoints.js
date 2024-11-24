const axios = require("axios");
const GameSession = require("../models/gamesession"); // Import GameSession model
const User = require("../models/User"); // Import User model

// Load environment variables
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;

// Fetch game list
exports.getlist = async (req, res) => {
    try {
        const url = "https://stage.game-program.com/api/seamless/provider";
        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGameList",
            show_systems: 0,
            show_additional: false,
            currency: "EUR",
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.data.error !== 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch game list from provider.",
                error: response.data,
            });
        }

        res.status(200).json({ success: true, data: response.data.response });
    } catch (error) {
        console.error("Error fetching game list:", error.message);
        res.status(500).json({ success: false, message: "Error fetching game list." });
    }
};


exports.handleGameResults = async (req, res) => {
    const { gamesession_id, result, amount } = req.body;

    if (!gamesession_id || !result) {
        return res.status(400).json({ success: false, message: "Missing gamesession_id or result." });
    }

    try {
        // Find the game session
        const gameSession = await GameSession.findOne({ gamesession_id });
        if (!gameSession) {
            return res.status(404).json({ success: false, message: "Game session not found." });
        }

        // Fetch the associated user
        const user = await User.findById(gameSession.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Adjust the user's balance based on the result
        if (result === "win") {
            user.balance += amount; // Add winnings
        } else if (result === "loss") {
            user.balance -= amount; // Deduct losses
        }

        // Save the updated balance to the user
        await user.save();

        // Update the game session with results
        gameSession.result = result;
        gameSession.amount = amount;
        gameSession.balanceAfter = user.balance; // Track balance after the session
        await gameSession.save();

        res.status(200).json({ success: true, message: "Game results processed successfully." });
    } catch (error) {
        console.error("Error processing game results:", error.message);
        res.status(500).json({ success: false, message: "Error processing game results." });
    }
};

// Fetch game embed URL and manage game sessions
exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = 'en', play_for_fun = false, homeurl, username } = req.body;

        // Validate input
        if (!gameid || typeof gameid !== 'number') {
            return res.status(400).json({ success: false, message: "Invalid or missing gameid." });
        }
        if (!username) {
            return res.status(400).json({ success: false, message: "Username is required." });
        }

        // Fetch user from the database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Ensure sufficient balance for real-money games
        if (!play_for_fun && user.balance <= 0) {
            return res.status(400).json({ success: false, message: "Insufficient balance." });
        }

        // Build the API request payload
        const url = "https://stage.game-program.com/api/seamless/provider";
        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGame",
            gameid,
            lang,
            play_for_fun,
            user_username: username,
            homeurl: homeurl || "https://catch-me.bet",
            currency: "EUR",
        };

        // Fetch the game URL
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const gameData = response.data;
        if (gameData.error !== 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch game URL.",
                error: gameData,
            });
        }

        // Create a new game session in the database
        const gameSession = await GameSession.create({
            userId: user._id,
            gameId: gameid,
            gamesession_id: gameData.data.gamesession_id,
            sessionid: gameData.data.sessionid,
            balanceBefore: user.balance,
        });

        // Respond with the game URL and session data
        res.status(200).json({
            success: true,
            data: {
                gameUrl: gameData.data.response,
                gamesessionId: gameSession._id,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        console.error("Error fetching game URL:", error.message);
        res.status(500).json({ success: false, message: "Error fetching game URL." });
    }
};
