const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transfer = require("../models/transfer");
const bcrypt = require("bcrypt");
const redisClient = require('./redisClient'); // Import or initialize your Redis client


const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;
const BASE_URL = process.env.BASE_URL;
const PROVIDER_API_URL = process.env.PROVIDER_API_URL || "https://catch-me.bet/api";

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
    // Step 1: Sort parameters alphabetically
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
          acc[key] = params[key];
        }
        return acc;
      }, {});
  
    console.log("[DEBUG] Sorted Params for Key Generation:", sortedParams);
  
    // Step 2: Create query string
    const queryString = Object.entries(sortedParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  
    console.log("[DEBUG] Query String:", queryString);
  
    // Step 3: Concatenate salt and generate hash
    const hashInput = `${process.env.API_SALT}${queryString}`;
    const key = crypto.createHash("sha1").update(hashInput).digest("hex");
  
    console.log("[DEBUG] Generated Key:", key);
    return key;
  }
  
  // Error handler function
  function handleError(res, message, statusCode = 500) {
    res.status(statusCode).json({ status: statusCode, message });
  }

  
  // 1. Check if player exists
  exports.playerExists = async (req, res) => {
    const { username, currency = "EUR" } = req.body; // Default currency to EUR if not provided
  
    if (!username) return handleError(res, "Username is required", 400);
    if (!currency) return handleError(res, "Currency is required", 400);
  
    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "playerExists",
      user_username: username,
      currency,
    };
  
    console.log("[DEBUG] playerExists Payload:", payload);
  
    try {
      const response = await callProviderAPI(payload);
  
      if (response.error === 0 && response.response) {
        console.log("[DEBUG] playerExists Response:", response.response);
        res.status(200).json({ success: true, data: response.response });
      } else {
        const errorMsg = response?.message || "Player does not exist or currency mismatch";
        console.error("[DEBUG] playerExists Error:", errorMsg);
        res.status(404).json({ success: false, message: errorMsg });
      }
    } catch (error) {
      console.error("[ERROR] playerExists:", error.message);
      handleError(res, "An unexpected error occurred while checking player existence.");
    }
  };
  
    
  // 2. Create player
  exports.createPlayer = async (req, res) => {
    const { username, password, currency = "EUR" } = req.body;
  
    if (!username || !password) {
      return handleError(res, "Username and password are required", 400);
    }
  
    try {
      // Check if the player already exists in the provider's system
      const playerExistsPayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "playerExists",
        user_username: username,
        currency,
      };
  
      const playerExistsResponse = await callProviderAPI(playerExistsPayload);
      if (playerExistsResponse.error === 0) {
        return handleError(res, "Player already exists under the provided currency.", 400);
      }
  
      // Prepare payload for createPlayer API request
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "createPlayer",
        user_username: username,
        user_password: password,
        currency,
      };
  
      console.log("[DEBUG] createPlayer Payload:", payload);
  
      // Call the provider API
      const response = await callProviderAPI(payload);
  
      if (response.error === 0) {
        // Extract the remote_id from the API response
        const { id: remote_id } = response.response;
  
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
  
        // Update local database with remote_id (or create a new user if not found)
        const user = await User.findOneAndUpdate(
          { username },
          {
            $setOnInsert: {
              password: hashedPassword,
              remote_id,
              balance: 0,
            },
          },
          { upsert: true, new: true }
        );
  
        console.log(`[DEBUG] Updated user with remote_id: ${remote_id}`);
  
        // Respond with success
        return res.status(200).json({
          success: true,
          data: {
            username: user.username,
            remote_id: user.remote_id,
            balance: user.balance,
          },
        });
      } else {
        console.error(`[ERROR] Failed to create player: ${response.message}`);
        return res.status(400).json({ success: false, message: response.message || "Unknown error" });
      }
    } catch (error) {
      console.error("[ERROR] createPlayer:", error.message);
      handleError(res, "Internal server error.", 500);
    }
  };



  
  
  const getFromCache = async (key) => {
  return new Promise((resolve, reject) => {
    redisClient.get(key, (err, data) => {
      if (err) {
        console.error(`[ERROR] Redis Get Error: ${err.message}`);
        reject(err);
      } else {
        resolve(data ? JSON.parse(data) : null);
      }
    });
  });
};

 // Route to fetch game list
 exports.getlist = async (req, res) => {
  const { show_systems = 0, show_additional = false, currency = "EUR" } = req.query;

  // Validate and normalize input
  const normalizedShowSystems = show_systems == 1 ? 1 : 0;
  const normalizedShowAdditional = show_additional === "true" || show_additional === true;

  if (!/^[A-Z]{3}$/.test(currency)) {
    return handleError(res, "Invalid currency format. Must be a 3-letter code.", 400);
  }

  const payload = {
    api_password: API_PASSWORD,
    api_login: API_USERNAME,
    method: "getGameList",
    show_systems: normalizedShowSystems,
    show_additional: normalizedShowAdditional,
    currency,
  };

  console.log("[DEBUG] Fetching game list with payload:", payload);

  try {
    // Check for cached response
    const cachedResponse = await getCachedGameList(currency);
    if (cachedResponse) {
      console.log("[DEBUG] Returning cached game list.");
      return res.status(200).json({ success: true, data: cachedResponse });
    }

    // Fetch game list from provider
    const response = await callProviderAPI(payload);

    if (response.error !== 0) {
      console.error("[ERROR] Failed to fetch game list:", response);
      return handleError(
        res,
        `Failed to fetch game list from provider: ${response.message || "Unknown error"}`,
        500
      );
    }

    console.log("[DEBUG] Game list fetched successfully:", response.response);

    // Save images locally (if applicable)
    await saveGameImages(response.response.games);

    // Cache the response for future use
    await cacheGameList(currency, response.response.games);

    res.status(200).json({ success: true, data: response.response });
  } catch (error) {
    if (error.response) {
      console.error("[ERROR] API Response Error:", error.response.data);
      handleError(res, `Provider API Error: ${error.response.data.message || "Unknown error"}`);
    } else if (error.request) {
      console.error("[ERROR] No response received from API:", error.request);
      handleError(res, "No response from provider API. Please try again.");
    } else {
      console.error("[ERROR] General Error:", error.message);
      handleError(res, "An unexpected error occurred while fetching the game list.");
    }
  }
};

// Helper function to save game images locally
async function saveGameImages(games) {
  for (const game of games) {
    if (game.image_url) {
      await saveImageLocally(game.image_url); // Implement this to save images to storage
    }
  }
}

// Helper function to cache game list
async function cacheGameList(currency, games) {
  // Implement caching logic, e.g., store in Redis or database
  console.log("[DEBUG] Caching game list for currency:", currency);
  await saveToCache(`game_list_${currency}`, games, 3600); // Cache for 1 hour
}

// Helper function to get cached game list
async function getCachedGameList(currency) {
  return await getFromCache(`game_list_${currency}`); // Fetch from cache
}


  // 3. Get Game
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
  
    if (!/^[A-Z]{3}$/.test(currency)) {
      return handleError(res, "Invalid currency format. Must be a 3-letter code.", 400);
    }
  
    try {
      // Check if user exists in local database
      const user = await User.findOne({ username });
      if (!user) {
        console.log(`[DEBUG] User ${username} not found in the local database.`);
        return handleError(res, "User not found in local database", 404);
      }
  
      // Check player existence with provider
      const playerExistsPayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "playerExists",
        user_username: username,
        currency,
      };
  
      const playerExistsResponse = await callProviderAPI(playerExistsPayload);
  
      if (playerExistsResponse.error !== 0) {
        console.log("[DEBUG] Player does not exist in provider's system. Creating player...");
        const createPlayerPayload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "createPlayer",
          user_username: username,
          user_password: user.password,
          currency,
        };
  
        const createPlayerResponse = await callProviderAPI(createPlayerPayload);
  
        if (createPlayerResponse.error === 0) {
          user.remote_id = createPlayerResponse.response.id;
          await user.save();
        } else {
          return handleError(res, "Failed to create player.", 400);
        }
      }
  
      // Fetch game URL
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "getGame",
        gameid,
        user_username: username,
        user_password: user.password,
        play_for_fun: !!play_for_fun,
        lang,
        currency,
        homeurl,
        cashierurl,
      };
  
      const response = await callProviderAPI(payload);
  
      if (response.error === 0) {
        const queryKey = generateKey(payload);
        const gameUrl = `${response.response}&key=${queryKey}`;
        console.log("[DEBUG] Generated game URL:", gameUrl);
  
        const { gamesession_id, sessionid } = response;
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
      if (error.response) {
        console.error("[ERROR] API Response Error:", error.response.data);
        handleError(res, `Provider API Error: ${error.response.data.message || "Unknown error"}`);
      } else if (error.request) {
        console.error("[ERROR] No response received from API:", error.request);
        handleError(res, "No response from provider API. Please try again.");
      } else {
        console.error("[ERROR] General Error:", error.message);
        handleError(res, "An unexpected error occurred while fetching the game URL.", 500);
      }
    }
  };
  

// 4. Get Balance
exports.getBalance = async (req, res) => {
  const { remote_id, session_id, currency, username } = req.query;

  if (!remote_id || !username || !currency) {
    console.error("[ERROR] Missing required parameters for getBalance.");
    return res.status(400).json({ status: "400", message: "Missing required parameters." });
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    console.error("[ERROR] Invalid currency format.");
    return res.status(400).json({ status: "400", message: "Invalid currency format. Must be a 3-letter code." });
  }

  try {
    console.log(`[DEBUG] Looking up user with remote_id: ${remote_id} and username: ${username}`);

    // Fetch user by remote_id
    const user = await User.findOne({ remote_id });

    if (!user) {
      console.error("[ERROR] Player not found for remote_id:", remote_id);
      return res.status(404).json({ status: "404", balance: 0, message: "Player not found." });
    }

    console.log(`[DEBUG] Found user with balance: ${user.balance}`);

    // Return the user's balance
    res.status(200).json({
      status: "200",
      balance: user.balance.toFixed(2),
    });
  } catch (error) {
    if (error.name === "MongoError") {
      console.error("[ERROR] Database Error:", error.message);
      return res.status(500).json({ status: "500", message: "Database error occurred." });
    } else {
      console.error("[ERROR] General Error:", error.message);
      return res.status(500).json({ status: "500", message: "Internal server error." });
    }
  }
};


  

// 5. Debit (Bet)
// Debit (Bet) Endpoint
exports.debit = async (req, res) => {
  const {
    username,
    remote_id,
    session_id,
    amount,
    provider,
    game_id,
    transaction_id,
    gamesession_id,
    currency = "EUR",
  } = req.query;

  // Validate required parameters
  if (
    !username ||
    !remote_id ||
    !session_id ||
    !amount ||
    !provider ||
    !game_id ||
    !transaction_id ||
    !gamesession_id
  ) {
    console.error("[ERROR] Missing required parameters for debit:", req.query);
    return res.status(400).json({ status: "400", message: "Missing required parameters." });
  }

  if (parseFloat(amount) <= 0) {
    console.error("[ERROR] Invalid amount for debit:", amount);
    return res.status(400).json({ status: "400", message: "Invalid amount. Must be greater than 0." });
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ status: "400", message: "Invalid currency format. Must be a 3-letter code." });
  }

  try {
    // Generate key for provider API validation (if applicable)
    const params = {
      callerId: API_USERNAME,
      callerPassword: API_PASSWORD,
      action: "debit",
      remote_id,
      username,
      session_id,
      amount: parseFloat(amount).toFixed(2),
      provider,
      game_id,
      transaction_id,
      gamesession_id,
      currency,
    };
    params.key = generateKey(params);

    console.log("[DEBUG] Debit Request Parameters:", params);

    // Fetch the user from the local database
    const user = await User.findOne({ username, remote_id });
    if (!user) {
      console.error("[ERROR] User not found for debit:", { username, remote_id });
      return res.status(404).json({ status: "404", message: "User not found." });
    }

    // Check if the transaction already exists (idempotency check)
    const existingTransaction = await Transfer.findOne({ transaction_id });
    if (existingTransaction) {
      console.log("[INFO] Repeated transaction, returning previous response:", transaction_id);
      return res.status(200).json({
        status: "200",
        balance: user.balance.toFixed(2),
        transaction_id,
      });
    }

    // Deduct the amount and update balance atomically
    const newBalance = parseFloat(user.balance) - parseFloat(amount);
    if (newBalance < 0) {
      console.error("[ERROR] Insufficient funds for debit:", { username, amount, balance: user.balance });
      return res.status(403).json({ status: "403", message: "Insufficient funds." });
    }

    // Use a transaction if database supports it (e.g., MongoDB transactions)
    user.balance = newBalance;
    await user.save();

    // Log the transaction in the database
    const transfer = new Transfer({
      senderId: user._id,
      type: "debit",
      transaction_id,
      amount: parseFloat(amount),
      balanceBefore: { sender: parseFloat(user.balance) + parseFloat(amount), receiver: null },
      balanceAfter: { sender: newBalance, receiver: null },
      provider,
    });
    await transfer.save();

    console.log("[INFO] Debit transaction processed successfully:", transaction_id);

    // Respond to the provider
    return res.status(200).json({
      status: "200",
      balance: newBalance.toFixed(2),
      transaction_id,
    });
  } catch (error) {
    console.error("[ERROR] Debit API Unexpected Error:", error.message);
    return res.status(500).json({
      status: "500",
      message: "An error occurred while processing the debit.",
    });
  }
};


// Credit (Win) Endpoint
exports.credit = async (req, res) => {
  const {
    username,
    remote_id,
    session_id,
    amount,
    provider,
    game_id,
    transaction_id,
    gamesession_id,
    currency = "EUR",
  } = req.query;

  // Validate required parameters
  if (
    !username ||
    !remote_id ||
    !session_id ||
    !amount ||
    !provider ||
    !game_id ||
    !transaction_id ||
    !gamesession_id
  ) {
    console.error("[ERROR] Missing required parameters for credit:", req.query);
    return res.status(400).json({ status: "400", message: "Missing required parameters." });
  }

  if (parseFloat(amount) < 0) {
    console.error("[ERROR] Invalid amount for credit:", amount);
    return res.status(400).json({ status: "400", message: "Invalid amount. Must be 0 or greater." });
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ status: "400", message: "Invalid currency format. Must be a 3-letter code." });
  }

  try {
    console.log(`[DEBUG] Processing credit for transaction_id: ${transaction_id}`);

    // Fetch the user from the local database
    const user = await User.findOne({ username, remote_id });
    if (!user) {
      console.error("[ERROR] User not found for credit:", { username, remote_id });
      return res.status(404).json({ status: "404", message: "User not found." });
    }

    // Check if the transaction already exists
    const existingTransaction = await Transfer.findOne({ transaction_id });
    if (existingTransaction) {
      console.log("[INFO] Repeated transaction, returning previous response:", transaction_id);
      return res.status(200).json({
        status: "200",
        balance: user.balance.toFixed(2),
        transaction_id,
      });
    }

    // Credit the amount
    const newBalance = parseFloat(user.balance) + parseFloat(amount);
    user.balance = newBalance;
    await user.save();

    // Log the transaction
    const transfer = new Transfer({
      senderId: user._id,
      type: "credit",
      transaction_id,
      amount: parseFloat(amount),
      balanceBefore: { sender: parseFloat(user.balance) - parseFloat(amount), receiver: null },
      balanceAfter: { sender: newBalance, receiver: null },
      provider,
    });
    await transfer.save();

    console.log("[INFO] Credit transaction processed successfully:", transaction_id);

    // Respond to the provider
    return res.status(200).json({
      status: "200",
      balance: newBalance.toFixed(2),
      transaction_id,
    });
  } catch (error) {
    if (error.name === "MongoError") {
      console.error("[ERROR] Database Error:", error.message);
      return res.status(500).json({ status: "500", message: "Database error occurred." });
    } else {
      console.error("[ERROR] General Error:", error.message);
      return res.status(500).json({ status: "500", message: "An unexpected error occurred." });
    }
  }
};
;
  
  
  
// 7. Rollback
// Rollback Endpoint
exports.rollback = async (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id) {
    console.error("[ERROR] Missing transaction_id for rollback.");
    return res.status(400).json({ status: "400", message: "Missing transaction_id." });
  }

  try {
    console.log("[DEBUG] Attempting rollback for transaction_id:", transaction_id);

    // Find the original transaction
    const originalTransaction = await Transfer.findOne({ transaction_id });
    if (!originalTransaction) {
      console.error("[ERROR] Transaction not found for rollback:", transaction_id);
      return res.status(404).json({ status: "404", message: "Transaction not found." });
    }

    console.log("[DEBUG] Original transaction found:", originalTransaction);

    // Fetch the user
    const user = await User.findById(originalTransaction.senderId || originalTransaction.receiverId);
    if (!user) {
      console.error("[ERROR] User not found for rollback.");
      return res.status(404).json({ status: "404", message: "User not found." });
    }

    console.log("[DEBUG] User found for rollback:", user.username);

    // Calculate the updated balance
    const updatedBalance =
      originalTransaction.type === "debit"
        ? parseFloat(user.balance) + parseFloat(originalTransaction.amount)
        : parseFloat(user.balance) - parseFloat(originalTransaction.amount);

    user.balance = updatedBalance;
    await user.save();

    // Log the rollback transaction
    const rollbackTransaction = new Transfer({
      senderId: originalTransaction.senderId,
      receiverId: originalTransaction.receiverId,
      type: "rollback",
      transaction_id: `${transaction_id}_rollback`,
      amount: originalTransaction.amount,
      balanceBefore: { sender: user.balance, receiver: null },
      balanceAfter: { sender: updatedBalance, receiver: null },
      reason: `Rollback of transaction ${transaction_id}`,
    });
    await rollbackTransaction.save();

    console.log(`[INFO] Rollback processed successfully for transaction: ${transaction_id}`);

    // Respond with the updated balance
    return res.status(200).json({
      status: "200",
      balance: updatedBalance.toFixed(2),
    });
  } catch (error) {
    if (error.name === "MongoError") {
      console.error("[ERROR] Database Error:", error.message);
      return res.status(500).json({ status: "500", message: "Database error occurred." });
    } else {
      console.error("[ERROR] General Error:", error.message);
      return res.status(500).json({ status: "500", message: "An unexpected error occurred." });
    }
  }
};

  
  
  