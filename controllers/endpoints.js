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
        console.log("Calling Provider API:", { method: payload.method });
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        console.log("Provider API Success:", {
            method: payload.method,
            response: response.data,
        });
        return response.data;
    } catch (error) {
        console.error("Provider API Error:", {
            method: payload.method,
            error: error.response?.data || error.message,
        });
        throw new Error(
            `Provider API Error for method ${payload.method}: ${error.response?.data?.message || error.message}`
        );
    }
}

// Error handler
function handleError(res, message, details = null, statusCode = 500) {
    console.error("Error:", { message, details });
    res.status(statusCode).json({ success: false, message, details });
}

// Get Game List Handler
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

// Get Game Handler
exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = "en", play_for_fun = false, homeurl, username } = req.body;

        if (!gameid || typeof gameid !== "number") {
            return handleError(res, "Invalid or missing gameid.", null, 400);
        }
        if (!username) {
            return handleError(res, "Username is required.", null, 400);
        }

        // Step 1: Fetch user
        const user = await User.findOne({ username });
        if (!user) {
            return handleError(res, "User not found.", null, 404);
        }

        // Step 2: Check user balance for real mode
        if (!play_for_fun && user.balance <= 0) {
            return handleError(res, "Insufficient balance.", null, 400);
        }

        // Step 3: Log in the player
        const loginPlayerPayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "loginPlayer",
            user_username: username,
            user_password: username, // Ensure the password matches the provider's requirements
            currency: "EUR",
        };

        console.log("Login Player Payload:", loginPlayerPayload);
        const loginPlayerResponse = await callProviderAPI(loginPlayerPayload);

        const sessionId = loginPlayerResponse.response?.sessionid;
        if (!sessionId) {
            console.error("Login Player Response:", loginPlayerResponse);
            return handleError(res, "Provider login failed. Missing session ID.", loginPlayerResponse, 500);
        }

        console.log("Login Player Response:", loginPlayerResponse);

        // Step 4: Fetch game session
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

        console.log("Get Game Payload:", gamePayload);
        const gameResponse = await callProviderAPI(gamePayload);

        const gameUrl = gameResponse.response;
        const gamesessionId = gameResponse.gamesession_id;
        if (!gameUrl || !gamesessionId) {
            console.error("Get Game Response:", gameResponse);
            return handleError(
                res,
                "Provider did not return a valid game session or URL.",
                gameResponse,
                500
            );
        }

        console.log("Get Game Response:", gameResponse);

        // Step 5: Return game URL with session info
        res.status(200).json({
            success: true,
            data: {
                gameUrl: `${gameUrl}&sessionid=${sessionId}`,
                gamesessionId,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        handleError(res, "Error fetching game URL.", error.message);
    }
};

