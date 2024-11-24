const axios = require("axios");
const User = require("../models/User");
const GameSession = require("../models/gamesession");

// Load environment variables
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;

// Helper function to call the provider's API
async function callProviderAPI(payload) {
    const url = "https://stage.game-program.com/api/seamless/provider";
    const response = await axios.post(url, payload, {
        headers: {
            "Content-Type": "application/json",
        },
    });
    return response.data;
}

exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = "en", play_for_fun = false, homeurl, username } = req.body;

        if (!gameid || typeof gameid !== "number") {
            return res.status(400).json({ success: false, message: "Invalid or missing gameid." });
        }
        if (!username) {
            return res.status(400).json({ success: false, message: "Username is required." });
        }

        // Fetch user from database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Validate the player's balance for real-money games
        if (!play_for_fun && user.balance <= 0) {
            return res.status(400).json({ success: false, message: "Insufficient balance." });
        }

        // Step 1: Check if the player exists in the provider's system
        const checkPlayerPayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "playerExists",
            user_username: username,
            currency: "EUR",
        };

        const checkPlayerResponse = await callProviderAPI(checkPlayerPayload);
        console.log("PlayerExists Response:", checkPlayerResponse);

        if (checkPlayerResponse.error !== 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to verify player existence.",
                error: checkPlayerResponse,
            });
        }

        // If the player does not exist, create the player
        if (!checkPlayerResponse.response) {
            const createPlayerPayload = {
                api_password: API_PASSWORD,
                api_login: API_USERNAME,
                method: "createPlayer",
                user_username: username,
                user_password: username, // Use a constant or hashed password
                currency: "EUR",
            };

            const createPlayerResponse = await callProviderAPI(createPlayerPayload);
            console.log("CreatePlayer Response:", createPlayerResponse);

            if (createPlayerResponse.error !== 0) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to create player.",
                    error: createPlayerResponse,
                });
            }
        }

        // Step 2: Login the player
        const loginPlayerPayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "loginPlayer",
            user_username: username,
            user_password: username, 
            currency: "EUR",
        };

        const loginPlayerResponse = await callProviderAPI(loginPlayerPayload);
        console.log("LoginPlayer Response:", loginPlayerResponse);

        if (loginPlayerResponse.error !== 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to login player.",
                error: loginPlayerResponse,
            });
        }

        const sessionId = loginPlayerResponse.response.sessionid;

        // Step 3: Fetch the game URL
        const gamePayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGame",
            gameid,
            lang,
            play_for_fun,
            user_username: username,
            user_password: username, // Use the same password
            homeurl: homeurl || "https://catch-me.bet",
            currency: "EUR",
        };

        const gameResponse = await callProviderAPI(gamePayload);
        console.log("GetGame Response:", gameResponse);

        if (gameResponse.error !== 0 || !gameResponse.response) {
            return res.status(500).json({
                success: false,
                message: "Provider did not return a valid game URL.",
                error: gameResponse,
            });
        }

        // Create a game session in your database
        const gameSession = await GameSession.create({
            userId: user._id,
            gameId: gameid,
            gamesession_id: gameResponse.gamesession_id || null,
            sessionid: sessionId || null,
            balanceBefore: user.balance,
        });

        // Return the game URL and session details
        res.status(200).json({
            success: true,
            data: {
                gameUrl: gameResponse.response,
                gamesessionId: gameSession._id,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        console.error("Error fetching game URL:", error.message);
        res.status(500).json({ success: false, message: "Error fetching game URL." });
    }
};
