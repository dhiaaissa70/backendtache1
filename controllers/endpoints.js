const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

// Ensure environment variables are available
const API_PASSWORD = process.env.API_PASSWORD || "default_password";
const API_USERNAME = process.env.API_USERNAME || "default_username";
const API_SALT = process.env.API_SALT || "default_salt";
const BASE_URL = process.env.BASE_URL || "https://stage.game-program.com/api/seamless/provider";

// Helper function to call Provider API
async function callProviderAPI(payload) {
  const url = `${BASE_URL}?${new URLSearchParams(payload).toString()}`;
  console.log("[DEBUG] Calling Provider API with URL:", url);

  try {
    const response = await axios.get(url, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("[DEBUG] Provider API Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("[ERROR] Provider API Error:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || "Error communicating with provider"
    );
  }
}

// Helper to generate SHA1 key
function generateKey(params) {
  const queryString = new URLSearchParams(params).toString();
  const rawString = `${API_SALT}${queryString}`;
  console.log("[DEBUG] Generating Key with String:", rawString);
  return crypto.createHash("sha1").update(rawString).digest("hex");
}

// Error handler
function handleError(res, message, statusCode = 500) {
  console.error(`[ERROR] ${message}`);
  res.status(statusCode).json({ status: statusCode, message });
}

// Route: Fetch Game List
exports.getlist = async (req, res) => {
  const { show_systems = 0, show_additional = false, currency = "EUR" } = req.query;

  try {
    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "getGameList",
      show_systems: show_systems == 1 ? 1 : 0,
      show_additional: show_additional === "true" || show_additional === true,
      currency,
    };

    console.log("[DEBUG] Fetching game list with payload:", payload);
    const response = await callProviderAPI(payload);

    if (response.error !== 0) {
      console.error("[ERROR] Provider returned error:", response.message);
      return handleError(res, `Failed to fetch game list: ${response.message}`, 500);
    }

    res.status(200).json({ success: true, data: response.response });
  } catch (error) {
    console.error("[ERROR] Unexpected error in getlist:", error.message);
    handleError(res, "Failed to fetch game list.", 500);
  }
};

// Route: Fetch Game URL
exports.getGame = async (req, res) => {
  const { gameid, username, play_for_fun = false, lang = "en", currency = "EUR" } = req.body;

  if (!gameid || !username) {
    return handleError(res, "Game ID and username are required.", 400);
  }

  try {
    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "getGame",
      gameid,
      user_username: username,
      user_password: username, // Simplified logic
      play_for_fun,
      lang,
      currency,
      homeurl: "https://catch-me.bet", // Adjust to your home URL
    };

    console.log("[DEBUG] Fetching game with payload:", payload);
    const response = await callProviderAPI(payload);

    if (response.error === 0) {
      const queryKey = generateKey(payload);
      const gameUrl = `${response.response}&key=${queryKey}`;
      res.status(200).json({ success: true, data: { gameUrl } });
    } else {
      handleError(res, `Failed to fetch game URL: ${response.message}`, 400);
    }
  } catch (error) {
    handleError(res, "Unexpected error occurred in getGame.", 500);
  }
};

// Route: Fetch Balance
exports.getBalance = async (req, res) => {
  const { remote_id, username, session_id, currency = "EUR", game_id_hash } = req.query;

  if (!remote_id || !username || !currency) {
    return handleError(res, "Missing required parameters for balance.", 400);
  }

  try {
    const payload = {
      action: "balance",
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      remote_id,
      username,
      session_id,
      currency,
      game_id_hash,
    };

    payload.key = generateKey(payload);
    console.log("[DEBUG] Balance payload:", payload);

    const response = await callProviderAPI(payload);

    if (response.error === 0) {
      res.status(200).json({ status: "200", balance: response.balance || "0.00" });
    } else {
      handleError(res, `Failed to fetch balance: ${response.message}`, 500);
    }
  } catch (error) {
    handleError(res, "Unexpected error occurred in getBalance.", 500);
  }
};
