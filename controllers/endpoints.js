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
        const response = await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        console.log("Provider API Call Success:", {
            method: payload.method,
            response: response.data,
        });
        return response.data;
    } catch (error) {
        console.error("Provider API Call Failed:", {
            method: payload.method,
            error: error.response?.data || error.message,
        });
        throw new Error("Failed to communicate with provider.");
    }
}

exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = "en", play_for_fun = false, homeurl, username } = req.body;

        if (!gameid || typeof gameid !== "number") {
            return handleError(res, "Invalid or missing gameid.", null, 400);
        }
        if (!username) {
            return handleError(res, "Username is required.", null, 400);
        }

        const user = await User.findOne({ username });
        if (!user) {
            return handleError(res, "User not found.", null, 404);
        }

        if (!play_for_fun && user.balance <= 0) {
            return handleError(res, "Insufficient balance.", null, 400);
        }

        // Ensure player exists in the provider system
        await ensurePlayerExists(username);

        // Log in the player
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

        const sessionId = loginPlayerResponse.response?.sessionid;
        if (!sessionId) {
            return handleError(res, "Failed to log in player. Missing session ID.");
        }

        // Fetch the game URL
        const gamePayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGame",
            gameid,
            lang,
            play_for_fun,
            user_username: username,
            user_password: username,
            homeurl: homeurl || "https://catch-me.bet",
            currency: "EUR",
        };
        const gameResponse = await callProviderAPI(gamePayload);
        console.log("GetGame Response:", gameResponse);

        const gameUrl = gameResponse.response;
        const gamesessionId = gameResponse.gamesession_id;
        if (!gameUrl || !gamesessionId) {
            return handleError(res, "Provider did not return a valid game session or URL.");
        }

        // Create a game session
        const gameSession = await GameSession.create({
            userId: user._id,
            gameId: gameid,
            gamesession_id: gamesessionId,
            sessionid: sessionId,
            balanceBefore: user.balance,
        });

        // Return the game session and URL
        res.status(200).json({
            success: true,
            data: {
                gameUrl,
                gamesessionId: gameSession._id,
                userBalance: user.balance,
            },
        });
    } catch (error) {
        handleError(res, "Error fetching game URL.", error.message);
    }
};

