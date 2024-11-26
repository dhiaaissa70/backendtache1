const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transfer = require("../models/transfer");

const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;
const BASE_URL = process.env.BASE_URL; // The base provider URL (e.g., {{urlstage}})

// Helper function to generate SHA1 key
async function callProviderAPI(payload) {
    const url = "https://stage.game-program.com/api/seamless/provider";
    try {
      console.log("Calling Provider API:", payload);
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("Provider API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Provider API Error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || "Error communicating with provider"
      );
    }
  }
  
  // Utility function to generate SHA1 key
  function generateKey(params) {
    const queryString = new URLSearchParams(params).toString();
    return crypto.createHash("sha1").update(API_SALT + queryString).digest("hex");
  }
  
  // Error handler function
  function handleError(res, message, statusCode = 500) {
    res.status(statusCode).json({ status: statusCode, message });
  }
  
  // 1. Check if player exists
  exports.playerExists = async (req, res) => {
      const { username, currency = "EUR" } = req.body; // Default currency to EUR if not provided
    
      if (!username) return handleError(res, "Username is required", 400);
    
      try {
        const payload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "playerExists",
          user_username: username,
          currency, // Include currency in the request
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
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "createPlayer",
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
  

 // Route to fetch game list
exports.getlist = async (req, res) => {
    const { show_systems = 0, show_additional = false, currency = "EUR" } = req.query;
  
    try {
      // Validate and normalize input
      const normalizedShowSystems = show_systems == 1 ? 1 : 0; // Only accept 0 or 1
      const normalizedShowAdditional = show_additional === "true" || show_additional === true; // Accept boolean or "true"
  
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "getGameList",
        show_systems: normalizedShowSystems,
        show_additional: normalizedShowAdditional,
        currency,
      };
  
      console.log("[DEBUG] Fetching game list with payload:", payload);
  
      // Call Provider API
      const response = await callProviderAPI(payload);
  
      if (response.error !== 0) {
        // Handle provider-side errors
        console.error(`[ERROR] Failed to fetch game list. Details:`, response);
        return handleError(
          res,
          `Failed to fetch game list from provider: ${response.message || "Unknown error"}`,
          500
        );
      }
  
      // Successful Response
      console.log("[DEBUG] Game list fetched successfully:", response.response);
      res.status(200).json({ success: true, data: response.response });
    } catch (error) {
      // Handle unexpected errors
      console.error("[ERROR] Unexpected error fetching game list:", error.message);
      handleError(res, "Error fetching game list.", 500);
    }
  };
  
  

  // 3. Get Game
  exports.getGame = async (req, res) => {
    const {
      gameid,
      username,
      play_for_fun = false,
      lang = "en",
      currency = "EUR",
      homeurl = "https://catch-me.bet", // Replace with your homepage URL
      cashierurl = "https://catch-me.bet", // Replace with your cashier page URL
    } = req.body;
  
    if (!gameid || !username) {
      return handleError(res, "Game ID and username are required", 400);
    }
  
    try {
      // Step 1: Check if user exists in the local database
      const user = await User.findOne({ username });
      if (!user) {
        return handleError(res, "User not found in local database", 404);
      }
  
      // Step 2: Check if the player exists in the provider's system
      const playerExistsPayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "playerExists",
        user_username: username,
        currency, // Include currency field
      };
  
      const playerExistsResponse = await callProviderAPI(playerExistsPayload);
  
      if (playerExistsResponse.error !== 0) {
        console.log(`[DEBUG] Player does not exist. Attempting to create player: ${username}`);
  
        // Step 3: Create the player if they don't exist
        const createPlayerPayload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "createPlayer",
          user_username: username,
          user_password: username, // Use username as password (only for simplicity in dev/testing)
          currency,
        };
  
        const createPlayerResponse = await callProviderAPI(createPlayerPayload);
  
        if (createPlayerResponse.error !== 0) {
          if (createPlayerResponse.message.includes("Player already exists")) {
            console.log(`[DEBUG] Player already exists in the provider system.`);
          } else {
            return handleError(
              res,
              `Failed to create player: ${createPlayerResponse.message}`,
              400
            );
          }
        }
      }
  
      // Step 4: Fetch the game URL
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "getGame",
        gameid,
        user_username: username,
        user_password: username,
        play_for_fun: !!play_for_fun, // Ensure boolean
        lang,
        currency,
        homeurl, // Optional Home URL
        cashierurl, // Optional Cashier URL
      };
  
      const response = await callProviderAPI(payload);
  
      if (response.error === 0) {
        const queryKey = generateKey(payload);
        const gameUrl = `${response.response}&key=${queryKey}`;
  
        // Provide game session tracking details (optional for debug)
        const { gamesession_id, sessionid } = response;
        console.log(`[DEBUG] Game session: ${gamesession_id}, Player session: ${sessionid}`);
  
        res.status(200).json({
          success: true,
          data: {
            gameUrl,
            gamesession_id,
            sessionid,
          },
        });
      } else {
        handleError(res, response.message || "Failed to fetch game URL", 400);
      }
    } catch (error) {
      console.error(`[ERROR] Unexpected error in getGame: ${error.message}`);
      handleError(res, "An error occurred while fetching the game URL.", 500);
    }
  };
  
    
    
  
  // 4. Balance Callback
  exports.getBalance = async (req, res) => {
    const { username } = req.query;
  
    if (!username) return handleError(res, "Username is required", 400);
  
    try {
      const user = await User.findOne({ username });
      if (!user) return handleError(res, "User not found", 404);
  
      res.status(200).json({ status: "200", balance: user.balance });
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
