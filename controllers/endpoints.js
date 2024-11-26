const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const GameSession = require("../models/gamesession");
const { generateTransactionId } = require("../utils/utils");

// Load environment variables
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;

// Helper function to call the provider's API
async function callProviderAPI(payload) {
    const url = "https://stage.game-program.com/api/seamless/provider";
    try {
        console.log("[DEBUG] Calling Provider API with payload:", payload);
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        console.log("[DEBUG] Provider API Response:", response.data);
        return response.data;
    } catch (error) {
        console.error("[ERROR] Provider API Error:", {
            method: payload.method,
            payload,
            error: error.response?.data || error.message,
        });
        throw new Error(
            `Provider API Error for method ${payload.method}: ${error.response?.data?.message || error.message}`
        );
    }
}

// Utility function to generate the SHA1 key
function generateKey(params, salt) {
    const queryString = new URLSearchParams(params).toString(); // Converts params to a query string
    const hash = crypto.createHash("sha1").update(salt + queryString).digest("hex");
    console.log("[DEBUG] Generated Key (SHA1):", hash);
    return hash;
}

// Error handler function
function handleError(res, message, details = null, statusCode = 500) {
    console.error("[ERROR] Handling Error:", { message, details });
    res.status(statusCode).json({ success: false, message, details });
}

// Route to fetch game list
exports.getlist = async (req, res) => {
    try {
        console.log("[DEBUG] Fetching Game List...");

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGameList",
            show_systems: 0,
            show_additional: false,
            currency: "EUR",
        };

        console.log("[DEBUG] Game List Payload:", payload);
        const response = await callProviderAPI(payload);

        if (response.error !== 0) {
            console.log("[ERROR] Game List Response Error:", response);
            return handleError(
                res,
                "Failed to fetch game list from provider.",
                response,
                500
            );
        }

        console.log("[DEBUG] Game List Response Data:", response.response);
        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        console.error("[ERROR] Exception Fetching Game List:", error.message);
        handleError(res, "Error fetching game list.", error.message);
    }
};

// Route to retrieve game session and synchronize wallet
exports.getGame = async (req, res) => {
    try {
        console.log("[DEBUG] Retrieving Game Session...");
        const { gameid, lang = "en", play_for_fun = false, homeurl, username } = req.body;

        // Validate input
        if (!gameid || !username) {
            console.log("[ERROR] Invalid gameid or username.");
            return handleError(res, "Invalid gameid or username.", null, 400);
        }

        // Fetch user
        console.log(`[DEBUG] Fetching user by username: ${username}`);
        const user = await User.findOne({ username });
        if (!user) {
            console.log("[ERROR] User not found:", username);
            return handleError(res, "User not found.", null, 404);
        }

        console.log(`[DEBUG] User found. Current balance: ${user.balance}`);
        if (!play_for_fun && user.balance <= 0) {
            console.log("[ERROR] Insufficient balance for real-money play.");
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

        console.log("[DEBUG] Login Player Payload:", loginPayload);
        const loginResponse = await callProviderAPI(loginPayload);

        console.log("[DEBUG] Login Player Response:", loginResponse);
        const sessionId = loginResponse.response?.sessionid;
        if (!sessionId) {
            console.log("[ERROR] Missing session ID in login response.");
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

        console.log("[DEBUG] Game Session Payload:", gamePayload);
        const gameResponse = await callProviderAPI(gamePayload);

        console.log("[DEBUG] Game Session Response:", gameResponse);
        const gameUrl = gameResponse.response;
        const gamesessionId = gameResponse.gamesession_id;

        if (!gameUrl || !gamesessionId) {
            console.log("[ERROR] Invalid Game URL or Game Session ID:", gameResponse);
            return handleError(
                res,
                "Provider did not return a valid game session or URL.",
                gameResponse
            );
        }

        // Generate and append SHA1 `key` for the game URL
        const finalGameUrl = `${gameUrl}&key=${generateKey(gamePayload, API_SALT)}`;
        console.log(`[DEBUG] Final Game URL with Key: ${finalGameUrl}`);

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
        console.error("[ERROR] Exception Retrieving Game Session:", error.message);
        handleError(res, "Error fetching game URL.", error.message);
    }
};

// Get user balance
exports.getuserbalance = async (req, res) => {
    try {
        const { username } = req.body;

        console.log("[DEBUG] Fetching User Balance for username:", username);
        if (!username) {
            console.log("[ERROR] Username is required.");
            return handleError(res, "Username is required.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getPlayerBalance",
            user_username: username,
            currency: "EUR",
        };

        console.log("[DEBUG] Get User Balance Payload:", payload);
        const response = await callProviderAPI(payload);

        console.log("[DEBUG] User Balance Response:", response);
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
        console.error("[ERROR] Exception Fetching User Balance:", error.message);
        handleError(res, "Error fetching user balance.", error.message);
    }
};

// Transfer funds to user
exports.giveMoneytoUser = async (req, res) => {
    try {
        const { username, amount } = req.body;

        console.log("[DEBUG] Transferring Funds to User:", { username, amount });
        if (!username || amount == null || isNaN(amount)) {
            console.log("[ERROR] Invalid input for fund transfer.");
            return handleError(res, "Invalid input. Ensure all fields are provided.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "giveMoney",
            user_username: username,
            amount,
            transactionid: generateTransactionId(),
            currency: "EUR",
        };

        console.log("[DEBUG] Give Money Payload:", payload);
        const response = await callProviderAPI(payload);

        console.log("[DEBUG] Give Money Response:", response);
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
        console.error("[ERROR] Exception Transferring Funds:", error.message);
        handleError(res, "Error transferring funds.", error.message);
    }
};

// Create Player
exports.createPlayer = async (req, res) => {
    try {
        const { user_username, user_password, currency = "EUR" } = req.body;

        console.log("[DEBUG] Creating Player:", { user_username, currency });
        if (!user_username || !user_password) {
            console.log("[ERROR] Username and Password are required for creating a player.");
            return handleError(res, "Username and password are required.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "createPlayer",
            user_username,
            user_password,
            currency,
        };

        console.log("[DEBUG] Create Player Payload:", payload);
        const response = await callProviderAPI(payload);

        console.log("[DEBUG] Create Player Response:", response);
        if (response.error !== 0) {
            return handleError(
                res,
                "Failed to create user via provider.",
                response,
                500
            );
        }

        res.status(200).json({
            success: true,
            message: "User successfully created.",
            data: response.response,
        });
    } catch (error) {
        console.error("[ERROR] Exception Creating Player:", error.message);
        handleError(res, "Error creating user.", error.message);
    }
};
