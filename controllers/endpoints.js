const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User"); // User model for DB operations
const { generateKeys } = require("../utils/utils"); // Ensure the generateKey function is available

// Load API configuration
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;

// Utility: Call Provider API
async function callProviderAPI(payload) {
  const url = "https://stage.game-program.com/api/seamless/provider";
  try {
    console.log("Payload Sent to Provider:", JSON.stringify(payload, null, 2)); // Log the payload
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

// Utility: Handle errors
function handleError(res, message, statusCode = 500) {
  res.status(statusCode).json({ status: statusCode, message });
}

// 1. Get Game List
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
      console.error(`[ERROR] Failed to fetch game list. Details:`, response);
      return handleError(
        res,
        `Failed to fetch game list from provider: ${response.message || "Unknown error"}`,
        500
      );
    }

    console.log("[DEBUG] Game list fetched successfully:", response.response);
    res.status(200).json({ success: true, data: response.response });
  } catch (error) {
    console.error("[ERROR] Unexpected error fetching game list:", error.message);
    handleError(res, "Error fetching game list.", 500);
  }
};

// 2. Check Player Exists
exports.playerExists = async (req, res) => {
  const { username, currency = "EUR" } = req.body;

  if (!username) return handleError(res, "Username is required", 400);

  try {
    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "playerExists",
      user_username: username,
      currency,
    };

    const response = await callProviderAPI(payload);

    if (response.error === 0 && response.response) {
      // If the player exists in the provider system, sync the balance
      const player = await User.findOne({ username });
      if (player) {
        const updateBalancePayload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "credit", // Using credit to sync balance
          remote_id: response.response.id, // Provider's remote_id
          amount: player.balance, // Your database balance
          action: "credit",
          currency,
        };

        await callProviderAPI(updateBalancePayload);
      }

      return res.status(200).json({ success: true, data: response.response });
    } else {
      return res.status(404).json({ success: false, message: "Player does not exist" });
    }
  } catch (error) {
    console.error("[ERROR] Player Exists Error:", error.message);
    handleError(res, error.message);
  }
};

// 3. Create Player
exports.createPlayer = async (req, res) => {
  const { username, currency = "EUR" } = req.body;

  if (!username) return handleError(res, "Username is required", 400);

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: "User not found in local database" });

    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "createPlayer",
      user_username: username,
      user_password: "securePassword123",
      currency,
    };

    const providerResponse = await callProviderAPI(payload);

    if (providerResponse.error === 0) {
      user.remote_id = providerResponse.response.id;
      await user.save();
      res.status(200).json({ success: true, data: providerResponse.response });
    } else {
      res.status(400).json({ success: false, message: providerResponse.message });
    }
  } catch (error) {
    console.error("Error in createPlayer:", error.message);
    handleError(res, "Internal server error");
  }
};

// 4. Get Game
exports.getGame = async (req, res) => {
  const {
    gameid,
    username,
    play_for_fun = false,
    lang = "en",
    currency = "EUR",
    homeurl = "https://catch-me.bet",
    cashierurl = "https://catch-me.bet",
  } = req.body;

  if (!gameid || !username) {
    return handleError(res, "Game ID and username are required", 400);
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return handleError(res, "User not found in local database", 404);
    }

    const playerExistsPayload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "playerExists",
      user_username: username,
      currency,
    };

    const playerExistsResponse = await callProviderAPI(playerExistsPayload);

    if (playerExistsResponse.error === 0 && playerExistsResponse.response) {
      const updateBalancePayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "credit",
        remote_id: playerExistsResponse.response.id,
        amount: user.balance,
        action: "credit",
        currency,
      };
      await callProviderAPI(updateBalancePayload);
    } else {
      const createPlayerPayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "createPlayer",
        user_username: username,
        user_password: "securePassword123",
        currency,
      };

      const createPlayerResponse = await callProviderAPI(createPlayerPayload);
      if (createPlayerResponse.error !== 0) {
        return handleError(res, "Failed to create player", 400);
      }
    }

    const getGamePayload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "getGame",
      gameid,
      user_username: username,
      user_password: "securePassword123",
      play_for_fun: play_for_fun ? 1 : 0,
      lang,
      currency,
      homeurl,
      cashierurl,
    };

    const gameResponse = await callProviderAPI(getGamePayload);

    if (gameResponse.error === 0) {
      return res.status(200).json({
        success: true,
        data: {
          gameUrl: gameResponse.response,
          gamesession_id: gameResponse.gamesession_id,
          sessionid: gameResponse.sessionid,
          balance: user.balance.toFixed(2),
        },
      });
    } else {
      return handleError(res, gameResponse.message || "Failed to launch game", 400);
    }
  } catch (error) {
    console.error("[ERROR] Unexpected error in getGame:", error.message);
    handleError(res, "An error occurred while fetching the game URL.", 500);
  }
};

// (Remaining methods unchanged)
// 4. Handle Balance Callback
exports.getBalance = async (req, res) => {
    try {
      const {
        callerId, // Caller authentication username
        callerPassword, // Caller authentication password
        remote_id, // Unique player id
        username, // Player username
        session_id, // Game session ID
        currency, // Player's currency
        gamesession_id, // Session ID from the game provider
        key, // SHA1 validation key
      } = req.query;
  
      // Validate required fields
      if (!remote_id || !username || !currency) {
        console.error("[ERROR] Missing required parameters for balance request.");
        return res.status(400).json({ status: "400", message: "Missing required parameters." });
      }
  
      // Step 1: Verify the key (recommended for validation)
      const queryParams = {
        callerId,
        callerPassword,
        remote_id,
        username,
        session_id,
        currency,
        gamesession_id,
        action: "balance",
      };
  
      const expectedKey = generateKeys(queryParams); // Generate the expected key
      if (expectedKey !== key) {
        console.error("[ERROR] Invalid key for balance request.");
        return res.status(400).json({ status: "400", message: "Invalid key." });
      }
  
      // Step 2: Fetch the player's balance from the database
      const user = await User.findOne({ username }); // Find the user by username
      if (!user) {
        console.error("[ERROR] Player not found:", username);
        return res.status(404).json({ status: "404", balance: 0, message: "Player not found." });
      }
  
      // Step 3: Return the player's balance in the required format
      console.log(`[INFO] Balance request successful for user: ${username}, balance: ${user.balance}`);
      return res.status(200).json({
        status: "200", // Always return status 200 for success
        balance: user.balance.toFixed(2), // Balance as a two-decimal number
      });
    } catch (error) {
      console.error("[ERROR] Unexpected error in getBalance:", error.message);
      return res.status(500).json({
        status: "500",
        message: "Internal server error. Please try again later.",
      });
    }
  };
  
  // 5. Handle Debit (Bet)
  exports.debit = async (req, res) => {
    const {
      username,
      remote_id,
      session_id,
      amount,
      provider,
      game_id,
      transaction_id,
      round_id,
      gameplay_final,
      gamesession_id,
      currency = "EUR", // Default currency to EUR
    } = req.query;
  
    if (
      !username ||
      !remote_id ||
      !session_id ||
      !amount ||
      !provider ||
      !game_id ||
      !transaction_id ||
      !round_id ||
      !gamesession_id ||
      !currency
    ) {
      return handleError(res, "Missing required parameters", 400);
    }
  
    try {
      const user = await User.findOne({ username });
      if (!user) {
        console.error("[ERROR] Player not found:", username);
        return res.status(404).json({ status: "404", balance: 0, message: "Player not found." });
      }
  
      if (user.balance < amount) {
        console.error("[ERROR] Insufficient balance for debit.");
        return res.status(400).json({ status: "403", message: "Insufficient balance" });
      }
  
      // Deduct the amount from the user's balance
      user.balance -= parseFloat(amount);
      await user.save();
  
      console.log(`[INFO] Debit successful for user: ${username}, new balance: ${user.balance}`);
  
      // Respond with updated balance
      return res.status(200).json({
        status: "200",
        balance: user.balance.toFixed(2),
      });
    } catch (error) {
      console.error("[ERROR] Debit API Error:", error.message);
      handleError(res, "Internal server error", 500);
    }
  };
  
  // 6. Handle Credit (Win)
  exports.credit = async (req, res) => {
    const {
      username,
      remote_id,
      session_id,
      amount,
      provider,
      game_id,
      transaction_id,
      round_id,
      gameplay_final,
      is_freeround_bet,
      jackpot_contribution_in_amount,
      gamesession_id,
      currency = "EUR", // Default currency
    } = req.query;
  
    if (
      !username ||
      !remote_id ||
      !session_id ||
      !amount ||
      !provider ||
      !game_id ||
      !transaction_id ||
      !round_id ||
      !gamesession_id ||
      !currency // Validate currency field
    ) {
      return res.status(400).json({ status: 400, message: "Missing required parameters" });
    }
  
    try {
      const user = await User.findOne({ username });
      if (!user) {
        console.error("[ERROR] Player not found:", username);
        return res.status(404).json({ status: "404", balance: 0, message: "Player not found." });
      }
  
      // Add the credit amount to the user's balance
      user.balance += parseFloat(amount);
      await user.save();
  
      console.log(`[INFO] Credit successful for user: ${username}, new balance: ${user.balance}`);
  
      // Respond with updated balance
      return res.status(200).json({
        status: "200",
        balance: user.balance.toFixed(2),
      });
    } catch (error) {
      console.error("[ERROR] Credit API Error:", error.message);
      res.status(500).json({ status: 500, message: error.message });
    }
  };
  
  // 7. Handle Rollback
  exports.rollback = async (req, res) => {
    const { remote_id, transaction_id, username } = req.query;
  
    if (!remote_id || !transaction_id || !username) {
      return handleError(res, "Missing required parameters", 400);
    }
  
    try {
      const user = await User.findOne({ username });
      if (!user) {
        console.error("[ERROR] Player not found:", username);
        return res.status(404).json({ status: "404", balance: 0, message: "Player not found" });
      }
  
      // Rollback logic (In this case, simply return the current balance)
      console.log(`[INFO] Rollback successful for user: ${username}, balance: ${user.balance}`);
      res.status(200).json({
        status: "200",
        balance: user.balance.toFixed(2),
      });
    } catch (error) {
      console.error("[ERROR] Rollback API Error:", error.message);
      handleError(res, "Internal server error", 500);
    }
  };
  