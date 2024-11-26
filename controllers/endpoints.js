const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

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
function generateKey(salt, params) {
    // Construct the query string (unsorted, as per provider's requirement)
    const queryString = new URLSearchParams(params).toString();
    console.log("[DEBUG] Query String for SHA1 Key:", queryString);

    // Combine the salt and query string, then hash
    const sha1Key = crypto.createHash("sha1").update(salt + queryString).digest("hex");
    console.log("[DEBUG] Generated Key (SHA1):", sha1Key);
    return sha1Key;
}

// Error handler function
function handleError(res, message, details = null, statusCode = 500) {
    console.error("[ERROR]", { message, details });
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

        console.log("[DEBUG] Fetching game list with payload:", payload);
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

        if (!gameid || !username) {
            return handleError(res, "Invalid gameid or username.", null, 400);
        }

        console.log("[DEBUG] Retrieving Game Session for User:", username);

        // Fetch user
        const user = await User.findOne({ username });
        if (!user) return handleError(res, "User not found.", null, 404);

        console.log("[DEBUG] User found. Current balance:", user.balance);

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

        console.log("[DEBUG] Login Player Payload:", loginPayload);

        const loginResponse = await callProviderAPI(loginPayload);

        console.log("[DEBUG] Login Player Response:", loginResponse);

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

        console.log("[DEBUG] Game Session Payload:", gamePayload);

        const gameResponse = await callProviderAPI(gamePayload);

        console.log("[DEBUG] Game Session Response:", gameResponse);

        const gameUrl = gameResponse.response;
        const gamesessionId = gameResponse.gamesession_id;

        if (!gameUrl || !gamesessionId) {
            return handleError(
                res,
                "Provider did not return a valid game session or URL.",
                gameResponse
            );
        }

        console.log("[DEBUG] Raw Game URL from Provider:", gameUrl);

        // Generate and append SHA1 `key` for the game URL
        const keyPayload = {
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

        const generatedKey = generateKey(API_SALT, keyPayload);
        console.log("[DEBUG] Generated Key (SHA1):", generatedKey);

        const finalGameUrl = `${gameUrl}&key=${generatedKey}`;
        console.log("[DEBUG] Final Game URL with Key:", finalGameUrl);

        res.status(200).json({
            success: true,
            data: {
                gameUrl: finalGameUrl,
                gamesessionId,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        console.error("[ERROR] Exception in getGame:", error);
        handleError(res, "Error fetching game URL.", error.message);
    }
};
