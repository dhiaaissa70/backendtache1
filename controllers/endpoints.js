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

// Utility function to generate unique transaction IDs
function generateTransactionId() {
    return `txn_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
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
        console.log("[DEBUG] loginPlayerPayload:", loginPlayerPayload);

        const loginPlayerResponse = await callProviderAPI(loginPlayerPayload);

        console.log("[DEBUG] loginPlayerResponse:", loginPlayerResponse);

        const sessionId = loginPlayerResponse.response?.sessionid;

        if (!sessionId) {
            return handleError(res, "Provider login failed. Missing session ID.");
        }

        console.log(`[DEBUG] Session ID: ${sessionId}`);

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
        console.log("[DEBUG] gamePayload:", gamePayload);

        const gameResponse = await callProviderAPI(gamePayload);

        console.log("[DEBUG] gameResponse:", gameResponse);

        const gameUrl = gameResponse.response;
        const gamesessionId = gameResponse.gamesession_id;

        if (!gameUrl || !gamesessionId) {
            return handleError(
                res,
                "Provider did not return a valid game session or URL.",
                gameResponse
            );
        }

        console.log(`[DEBUG] gameUrl from provider: ${gameUrl}`);
        console.log(`[DEBUG] gamesessionId from provider: ${gamesessionId}`);

        // Step 3: Validate and Decode gameUrl
        const decodedGameUrl = decodeURIComponent(gameUrl);
        console.log(`[DEBUG] Decoded gameUrl: ${decodedGameUrl}`);

        if (!decodedGameUrl.includes("key=") || !decodedGameUrl.includes("sessionid=")) {
            console.error("[ERROR] gameUrl missing required parameters:", decodedGameUrl);
            return handleError(
                res,
                "Game URL is missing required parameters. Please check the provider response.",
                gameResponse,
                400
            );
        }

        // Optional: Extract and log key query parameters from the URL for debugging
        const urlParams = new URLSearchParams(decodedGameUrl.split("?")[1]);
        console.log("[DEBUG] Extracted URL Parameters:");
        for (const [key, value] of urlParams.entries()) {
            console.log(`  ${key}: ${value}`);
        }

        // Append additional parameters if required
        const finalGameUrl = `${gameUrl}&sessionid=${sessionId}`;
        console.log(`[DEBUG] Final gameUrl: ${finalGameUrl}`);

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


exports.getuserbalance = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation des données entrantes
        if (!username || !password) {
            return handleError(res, "Username et password sont requis.", null, 400);
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
                "Échec de la récupération du solde utilisateur auprès du fournisseur.",
                response,
                500
            );
        }

        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        handleError(res, "Erreur lors de la récupération du solde utilisateur.", error.message);
    }
};



exports.giveMoneytoUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation des données entrantes
        if (!username || !password) {
            return handleError(res, "Username et password sont requis.", null, 400);
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
                "Échec de la récupération du solde utilisateur auprès du fournisseur.",
                response,
                500
            );
        }

        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        handleError(res, "Erreur lors de la récupération du solde utilisateur.", error.message);
    }
};

exports.giveMoneytoUser = async (req, res) => {
    try {
        const { username, password, amount, transactionid } = req.body;

        // Validation des données entrantes
        if (!username || !password) {
            return handleError(res, "Username et password sont requis.", null, 400);
        }
        if (amount == null || isNaN(amount)) {
            return handleError(res, "Un montant valide est requis.", null, 400);
        }
        if (!transactionid) {
            return handleError(res, "Transaction ID est requis.", null, 400);
        }

        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "giveMoney",
            user_username: username,
            user_password: password,
            amount,
            transactionid,
            currency: "EUR",
        };

        const response = await callProviderAPI(payload);

        if (response.error !== 0) {
            return res.status(500).json({
                success: false,
                message: "Échec de la transmission de fonds à l'utilisateur auprès du fournisseur.",
                details: {
                    error: response.error,
                    providerMessage: response.message,
                },
            });
        }
        

        res.status(200).json({ success: true, data: response.response });
    } catch (error) {
        handleError(res, "Erreur lors de la transmission de fonds.", error.message);
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
