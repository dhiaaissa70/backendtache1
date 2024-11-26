const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transfer = require("../models/transfer");

const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;
const BASE_URL = process.env.BASE_URL; // The base provider URL (e.g., {{urlstage}})

// Helper function to generate SHA1 key
function generateKey(params) {
  const queryString = new URLSearchParams(params).toString();
  return crypto.createHash("sha1").update(API_SALT + queryString).digest("hex");
}

// Error handler function
function handleError(res, message, statusCode = 500) {
  res.status(statusCode).json({ status: statusCode, message });
}

// Helper to call provider's API
async function callProviderAPI(payload) {
  const url = `${BASE_URL}?${new URLSearchParams(payload).toString()}`;
  try {
    console.log("[DEBUG] Calling Provider API:", url);
    const response = await axios.get(url);
    console.log("[DEBUG] Provider API Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("[ERROR] Provider API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Error communicating with provider");
  }
}

// 8. Get List of Games
exports.getlist = async (req, res) => {
    try {
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "getGameList",
        show_systems: 1, // Enable additional system details
        show_additional: true, // Include extra metadata
        currency: "EUR",
      };
  
      // Generate key for secure API communication
      payload.key = generateKey(payload);
  
      // Make the API call
      const response = await callProviderAPI(payload);
  
      if (response.error === 0) {
        // Successfully fetched game list
        res.status(200).json({ success: true, data: response.response });
      } else {
        console.error("Error fetching game list:", response.message || response.error);
        res.status(500).json({ success: false, message: "Failed to fetch game list." });
      }
    } catch (error) {
      console.error("Unexpected error fetching game list:", error);
      res.status(500).json({ success: false, message: "An internal error occurred." });
    }
  };
  


// 1. Check if player exists
exports.playerExists = async (req, res) => {
  const { username, currency = "EUR" } = req.body;

  if (!username) return handleError(res, "Username is required", 400);

  try {
    const payload = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      action: "playerExists",
      user_username: username,
      currency,
    };

    const response = await callProviderAPI(payload);

    if (response.error === 0 && response.response) {
      res.status(200).json({ success: true, data: response.response });
    } else {
      res.status(404).json({ success: false, message: "Player does not exist" });
    }
  } catch (error) {
    handleError(res, error.message);
  }
};

// 2. Create player
exports.createPlayer = async (req, res) => {
  const { username, password, currency = "EUR" } = req.body;

  if (!username || !password)
    return handleError(res, "Username and password are required", 400);

  try {
    const payload = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      action: "createPlayer",
      user_username: username,
      user_password: password,
      currency,
    };

    const response = await callProviderAPI(payload);

    if (response.error === 0) {
      res.status(200).json({ success: true, data: response.response });
    } else {
      res.status(400).json({ success: false, message: response.message });
    }
  } catch (error) {
    handleError(res, error.message);
  }
};

// 3. Get Game
exports.getGame = async (req, res) => {
  const { gameid, username, play_for_fun = false, lang = "en", currency = "EUR" } = req.body;

  if (!gameid || !username)
    return handleError(res, "Game ID and username are required", 400);

  try {
    const payload = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      action: "getGame",
      gameid,
      user_username: username,
      user_password: username,
      play_for_fun,
      lang,
      currency,
    };

    const response = await callProviderAPI(payload);

    if (response.error === 0) {
      const queryKey = generateKey(payload);
      const gameUrl = `${response.response}&key=${queryKey}`;
      res.status(200).json({ success: true, data: { gameUrl } });
    } else {
      handleError(res, response.message, 400);
    }
  } catch (error) {
    handleError(res, error.message);
  }
};

// 4. Get Balance
exports.getBalance = async (req, res) => {
  const { username, remote_id, session_id, currency, provider, game_id_hash } = req.query;

  if (!username || !remote_id || !session_id || !currency || !provider || !game_id_hash) {
    return handleError(res, "Missing required parameters", 400);
  }

  try {
    const params = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700h",
      action: "balance",
      remote_id,
      username,
      session_id,
      currency,
      provider,
      game_id_hash,
    };

    const key = generateKey(params);
    params.key = key;

    const response = await callProviderAPI(params);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error.message);
  }
};

// 5. Debit (Bet)
exports.debit = async (req, res) => {
  const {
    username,
    remote_id,
    session_id,
    amount,
    provider,
    game_id,
    game_id_hash,
    transaction_id,
    round_id,
    gameplay_final,
    is_freeround_bet,
    jackpot_contribution_in_amount,
    gamesession_id,
  } = req.query;

  if (
    !username ||
    !remote_id ||
    !session_id ||
    !amount ||
    !provider ||
    !game_id ||
    !game_id_hash ||
    !transaction_id ||
    !round_id ||
    !gamesession_id
  ) {
    return handleError(res, "Missing required parameters", 400);
  }

  try {
    const params = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      action: "debit",
      remote_id,
      username,
      session_id,
      amount,
      provider,
      game_id,
      game_id_hash,
      transaction_id,
      round_id,
      gameplay_final,
      is_freeround_bet,
      jackpot_contribution_in_amount,
      gamesession_id,
    };

    const key = generateKey(params);
    params.key = key;

    const response = await callProviderAPI(params);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error.message);
  }
};

// 6. Credit (Win)
exports.credit = async (req, res) => {
  const {
    username,
    remote_id,
    session_id,
    amount,
    provider,
    game_id,
    game_id_hash,
    transaction_id,
    round_id,
    gameplay_final,
    is_freeround_bet,
    jackpot_contribution_in_amount,
    gamesession_id,
  } = req.query;

  if (
    !username ||
    !remote_id ||
    !session_id ||
    !amount ||
    !provider ||
    !game_id ||
    !game_id_hash ||
    !transaction_id ||
    !round_id ||
    !gamesession_id
  ) {
    return handleError(res, "Missing required parameters", 400);
  }

  try {
    const params = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      action: "credit",
      remote_id,
      username,
      session_id,
      amount,
      provider,
      game_id,
      game_id_hash,
      transaction_id,
      round_id,
      gameplay_final,
      is_freeround_bet,
      jackpot_contribution_in_amount,
      gamesession_id,
    };

    const key = generateKey(params);
    params.key = key;

    const response = await callProviderAPI(params);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error.message);
  }
};

// 7. Rollback
exports.rollback = async (req, res) => {
  const {
    username,
    remote_id,
    session_id,
    amount,
    provider,
    game_id,
    game_id_hash,
    transaction_id,
    round_id,
    gameplay_final,
    gamesession_id,
  } = req.query;

  if (
    !username ||
    !remote_id ||
    !session_id ||
    !amount ||
    !provider ||
    !game_id ||
    !game_id_hash ||
    !transaction_id ||
    !round_id ||
    !gamesession_id
  ) {
    return handleError(res, "Missing required parameters", 400);
  }

  try {
    const params = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      callerPrefix: "700ha",
      action: "rollback",
      remote_id,
      username,
      session_id,
      amount,
      provider,
      game_id,
      game_id_hash,
      transaction_id,
      round_id,
      gameplay_final,
      gamesession_id,
    };

    const key = generateKey(params);
    params.key = key;

    const response = await callProviderAPI(params);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error.message);
  }
};
