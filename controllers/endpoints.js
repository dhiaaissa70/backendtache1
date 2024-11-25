const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const GameSession = require("../models/gamesession");
const { generateTransactionId, generateKey } = require("../utils/utils"); // Import utilities

// Load environment variables
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;

// Helper function to call the provider's API
async function callProviderAPI(payload) {
    const url = "https://stage.game-program.com/api/seamless/provider";
    try {
        console.log("Calling Provider API:", { method: payload.method, payload });
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        console.log("Provider API Response:", response.data);
        return response.data;
    } catch (error) {
        console.error("Provider API Error:", {
            method: payload.method,
            payload,
            error: error.response?.data || error.message,
        });
        throw new Error(
            `Provider API Error for method ${payload.method}: ${error.response?.data?.message || error.message}`
        );
    }
}

// Error handler function
function handleError(res, message, details = null, statusCode = 500) {
    console.error("Error:", { message, details });
    res.status(statusCode).json({ success: false, message, details });
}

// Route to fetch game list
exports.getlist = async (req, res) => {
    try {
        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGameList",
            show_systems: 0,
            show_additional: false,
            currency: "EUR",
        };

        const response = await callProviderAPI(payload);

        if (response.error !== 0) {
            return handleError(
                res,
                "Failed to fetch game list from provider.",
                response,
                500
            );
        }

        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        handleError(res, "Error fetching game list.", error.message);
    }
};

// Route to retrieve game session and synchronize wallet
exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = "en", play_for_fun = false, homeurl, username } = req.body;

        // Validate input
        if (!gameid || !username) {
            return handleError(res, "Invalid gameid or username.", null, 400);
        }

        // Fetch user
        const user = await User.findOne({ username });
        if (!user) return handleError(res, "User not found.", null, 404);

        if (!play_for_fun && user.balance <= 0) {
            return handleError(res, "Insufficient balance.", null, 400);
        }

        // Step 1: Login Player
        const loginPayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "loginPlayer",
            user_username: username,
            user_password: username,
            currency: "EUR",
        };

        const loginResponse = await callProviderAPI(loginPayload);

        const sessionId = loginResponse.response?.sessionid;
        if (!sessionId) {
            return handleError(res, "Provider login failed. Missing session ID.");
        }

        // Step 2: Get Game Session
        const gamePayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGame",
            gameid,
            lang,
            play_for_fun,
            user_username: username,
            user_password: username,
            sessionid: sessionId,
            homeurl: homeurl || "https://catch-me.bet",
            currency: "EUR",
        };

        const gameResponse = await callProviderAPI(gamePayload);

        const gameUrl = gameResponse.response;
        const gamesessionId = gameResponse.gamesession_id;

        if (!gameUrl || !gamesessionId) {
            return handleError(
                res,
                "Provider did not return a valid game session or URL.",
                gameResponse
            );
        }

        // Generate and append SHA1 `key` for the game URL
        const finalGameUrl = `${gameUrl}&key=${generateKey(gamePayload, API_SALT)}`;
        console.log(`[DEBUG] Final game URL with key: ${finalGameUrl}`);

        // Return game URL and balance
        res.status(200).json({
            success: true,
            data: {
                gameUrl: finalGameUrl,
                gamesessionId,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        console.error("[ERROR] getGame Exception:", error);
        handleError(res, "Error fetching game URL.", error.message);
    }
};

// Get user balance
exports.getuserbalance = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return handleError(res, "Username and password are required.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getPlayerBalance",
            user_username: username,
            user_password: password,
            currency: "EUR",
        };

        const response = await callProviderAPI(payload);

        if (response.error !== 0) {
            return handleError(
                res,
                "Failed to fetch user balance from the provider.",
                response,
                500
            );
        }

        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        handleError(res, "Error fetching user balance.", error.message);
    }
};

// Transfer funds to user
exports.giveMoneytoUser = async (req, res) => {
    try {
        const { username, password, amount } = req.body;

        if (!username || !password || amount == null || isNaN(amount)) {
            return handleError(res, "Invalid input. Ensure all fields are provided.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "giveMoney",
            user_username: username,
            user_password: password,
            amount,
            transactionid: generateTransactionId(),
            currency: "EUR",
        };

        const response = await callProviderAPI(payload);

        if (response.error !== 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to transfer funds to the user via the provider.",
                details: {
                    error: response.error,
                    providerMessage: response.message,
                },
            });
        }

        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        handleError(res, "Error transferring funds.", error.message);
    }
};


exports.createPlayer = async (req, res) => {
    try {
        const { user_username, user_password, currency = "EUR" } = req.body;

        // Validation des données entrantes
        if (!user_username || !user_password) {
            return handleError(res, "Username et password sont requis.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD, 
            api_login: API_USERNAME,
            method: "createPlayer",
            user_username,
            user_password,
            currency,
        };

        console.log("[DEBUG] createPlayer Payload:", payload);

        const response = await callProviderAPI(payload);

        if (response.error !== 0) {
            return handleError(
                res,
                "Échec de la création de l'utilisateur auprès du fournisseur.",
                response,
                500
            );
        }

        res.status(200).json({
            success: true,
            message: "Utilisateur créé avec succès.",
            data: response.response,
        });
    } catch (error) {
        console.error("[ERROR] createPlayer Exception:", error);
        handleError(res, "Erreur lors de la création de l'utilisateur.", error.message);
    }
};