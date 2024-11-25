const axios = require("axios");
const User = require("../models/User");
const GameSession = require("../models/gamesession");

// Load environment variables
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;

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

// Route to retrieve game session and synchronize balance
exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = "en", play_for_fun = false, homeurl, username } = req.body;

        // Validate input
        if (!gameid || typeof gameid !== "number") {
            return handleError(res, "Invalid or missing gameid.", null, 400);
        }
        if (!username) {
            return handleError(res, "Username is required.", null, 400);
        }

        // Fetch user
        const user = await User.findOne({ username });
        if (!user) {
            return handleError(res, "User not found.", null, 404);
        }

        console.log(`User balance before API call: ${user.balance}`);

        // Ensure sufficient balance for real-money play
        if (!play_for_fun && user.balance <= 0) {
            return handleError(res, "Insufficient balance.", null, 400);
        }

        // Step 1: Login Player
        const loginPlayerPayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "loginPlayer",
            user_username: username,
            user_password: username,
            currency: "EUR",
        };
        const loginPlayerResponse = await callProviderAPI(loginPlayerPayload);

        const sessionId = loginPlayerResponse.response?.sessionid;
        const providerBalance = loginPlayerResponse.response?.balance;

        if (!sessionId) {
            return handleError(res, "Provider login failed. Missing session ID.");
        }

        console.log(`Session ID: ${sessionId}`);
        console.log(`Provider balance from login response: ${providerBalance}`);

        // Update balance only if valid
        if (providerBalance !== undefined && providerBalance >= 0) {
            console.log(`Updating user balance to provider's balance: ${providerBalance}`);
            user.balance = providerBalance;
            await user.save();
        } else {
            console.log(`Provider balance is invalid (${providerBalance}). Retaining existing user balance.`);
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

        console.log(`Final user balance before returning response: ${user.balance}`);

        // Return game URL and balance
        res.status(200).json({
            success: true,
            data: {
                gameUrl: `${gameUrl}&sessionid=${sessionId}`,
                gamesessionId,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        console.error("Error in getGame:", error);
        handleError(res, "Error fetching game URL.", error.message);
    }
};
