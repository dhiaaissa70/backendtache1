const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User"); // User model for DB operations

// Load API configuration
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;

// Utility: Generate SHA1 Key
function generateKey(params) {
  const queryString = new URLSearchParams(params).toString();
  return crypto.createHash("sha1").update(API_SALT + queryString).digest("hex");
}

// Utility: Call Provider API
async function callProviderAPI(payload) {
  const url = "https://stage.game-program.com/api/seamless/provider";
  try {
    console.log("Calling Provider API with payload:", payload);
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Provider API Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Provider API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Error communicating with provider");
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
      return handleError(res, `Failed to fetch game list from provider: ${response.message || "Unknown error"}`, 500);
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
          // Sync balance in the provider system
          const updateBalancePayload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "credit", // Using credit to sync balance
            remote_id: response.response.id, // Provider's remote_id
            amount: player.balance, // Your database balance
            action: "credit",
          };
  
          await callProviderAPI(updateBalancePayload);
        }
  
        return res.status(200).json({ success: true, data: response.response });
      } else {
        // If the player does not exist, return response
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
  
      // Step 1: Check if the player exists in the provider system
      const playerExistsPayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "playerExists",
        user_username: username,
        currency,
      };
  
      const playerExistsResponse = await callProviderAPI(playerExistsPayload);
  
      if (playerExistsResponse.error === 0 && playerExistsResponse.response) {
        // Sync balance to the provider system
        const updateBalancePayload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "credit", // Sync balance using credit
          remote_id: playerExistsResponse.response.id,
          amount: user.balance, // Balance from your database
          action: "credit",
        };
        await callProviderAPI(updateBalancePayload);
      } else {
        // Create player if not exists
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
  
      // Step 2: Launch the game
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
  
  
  

// 4. Handle Balance Callback
exports.getBalance = async (req, res) => {
    const {
      remote_id, // Unique player ID in the provider's system
      session_id,
      currency,
      username,
      game_id_hash,
      gamesession_id,
    } = req.query;
  
    // Validate required parameters
    if (!remote_id || !username || !currency) {
      console.error("[ERROR] Missing required parameters for getBalance.");
      return res.status(400).json({ status: "400", message: "Missing required parameters." });
    }
  
    try {
      // Fetch the player from your database using the username or remote_id
      const player = await User.findOne({ username });
  
      if (!player) {
        console.error(`[ERROR] Player not found for username: ${username}`);
        return res.status(404).json({ status: "404", message: "Player not found." });
      }
  
      // Return the player's balance from your database
      return res.status(200).json({
        status: "200",
        balance: player.balance.toFixed(2), // Ensure balance is a 2-decimal string
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
  const { remote_id, amount } = req.query;

  if (!remote_id || !amount) return handleError(res, "Missing required parameters", 400);

  try {
    const user = await User.findOne({ remote_id });
    if (!user) return res.status(404).json({ status: "404", balance: 0, message: "User not found" });

    user.balance -= parseFloat(amount);
    await user.save();

    res.status(200).json({ status: "200", balance: user.balance.toFixed(2) });
  } catch (error) {
    console.error("Error in debit:", error.message);
    handleError(res, "Internal server error");
  }
};

// 6. Handle Credit (Win)
exports.credit = async (req, res) => {
  const { remote_id, amount } = req.query;

  if (!remote_id || !amount) return handleError(res, "Missing required parameters", 400);

  try {
    const user = await User.findOne({ remote_id });
    if (!user) return res.status(404).json({ status: "404", balance: 0, message: "User not found" });

    user.balance += parseFloat(amount);
    await user.save();

    res.status(200).json({ status: "200", balance: user.balance.toFixed(2) });
  } catch (error) {
    console.error("Error in credit:", error.message);
    handleError(res, "Internal server error");
  }
};

// 7. Handle Rollback
exports.rollback = async (req, res) => {
  const { remote_id, transaction_id } = req.query;

  if (!remote_id || !transaction_id) return handleError(res, "Missing required parameters", 400);

  try {
    const user = await User.findOne({ remote_id });
    if (!user) return res.status(404).json({ status: "404", balance: 0, message: "User not found" });

    // Implement rollback logic
    res.status(200).json({ status: "200", balance: user.balance.toFixed(2) });
  } catch (error) {
    console.error("Error in rollback:", error.message);
    handleError(res, "Internal server error");
  }
};
