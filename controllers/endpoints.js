const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transfer = require("../models/transfer"); // Updated to use Transfer model

const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;

// Helper function to call the provider's API
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
    try {
        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGameList",
            show_systems: 0,
            show_additional: false,
            currency: "EUR",
        };

        console.log("[DEBUG] Fetching game list with payload:", payload);
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

// 3. Get Game
// 3. Get Game
exports.getGame = async (req, res) => {
    const { gameid, username, play_for_fun = false, lang = "en", currency = "EUR" } = req.body;
  
    if (!gameid || !username)
      return handleError(res, "Game ID and username are required", 400);
  
    try {
      let user = await User.findOne({ username });
      if (!user) return handleError(res, "User not found in local database", 404);
  
      // Step 1: Check if the player exists in the provider's system
      const playerExistsPayload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "playerExists",
        user_username: username,
        currency, // Add currency field
      };
  
      const playerExistsResponse = await callProviderAPI(playerExistsPayload);
  
      if (playerExistsResponse.error !== 0) {
        console.log(`[DEBUG] Player does not exist. Creating player: ${username}`);
  
        // Step 2: Create the player if they don't exist
        const createPlayerPayload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "createPlayer",
          user_username: username,
          user_password: username, // Use username as password (simplified logic)
          currency, // Add currency field
        };
  
        const createPlayerResponse = await callProviderAPI(createPlayerPayload);
  
        if (createPlayerResponse.error !== 0) {
          // Handle "Player already exists" error gracefully
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
  
      // Step 3: Fetch the game URL
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "getGame",
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

// 5. Debit Callback
exports.debit = async (req, res) => {
  const { username, amount, transaction_id } = req.query;

  if (!username || !amount || !transaction_id)
    return handleError(res, "Invalid parameters", 400);

  try {
    const user = await User.findOne({ username });
    if (!user) return handleError(res, "User not found", 404);

    if (user.balance < amount)
      return res.status(403).json({ status: "403", msg: "Insufficient funds" });

    // Deduct balance and track transaction
    const previousBalance = user.balance;
    user.balance -= parseFloat(amount);
    await user.save();

    await Transfer.create({
      senderId: user._id,
      receiverId: null,
      type: "debit",
      amount,
      note: `Debit for transaction ID: ${transaction_id}`,
      balancesBefore: {
        sender: previousBalance,
        receiver: 0, // No receiver for debit
      },
      balancesAfter: {
        sender: user.balance,
        receiver: 0, // No receiver for debit
      },
    });

    res.status(200).json({ status: "200", balance: user.balance });
  } catch (error) {
    handleError(res, error.message);
  }
};

// 6. Credit Callback
exports.credit = async (req, res) => {
  const { username, amount, transaction_id } = req.query;

  if (!username || !amount || !transaction_id)
    return handleError(res, "Invalid parameters", 400);

  try {
    const user = await User.findOne({ username });
    if (!user) return handleError(res, "User not found", 404);

    // Add balance and track transaction
    const previousBalance = user.balance;
    user.balance += parseFloat(amount);
    await user.save();

    await Transfer.create({
      senderId: null, // No sender for credit
      receiverId: user._id,
      type: "credit",
      amount,
      note: `Credit for transaction ID: ${transaction_id}`,
      balancesBefore: {
        sender: 0, // No sender for credit
        receiver: previousBalance,
      },
      balancesAfter: {
        sender: 0, // No sender for credit
        receiver: user.balance,
      },
    });

    res.status(200).json({ status: "200", balance: user.balance });
  } catch (error) {
    handleError(res, error.message);
  }
};

// 7. Rollback Callback
exports.rollback = async (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id)
    return handleError(res, "Transaction ID is required", 400);

  try {
    const transaction = await Transfer.findOne({ note: new RegExp(transaction_id) });
    if (!transaction) return handleError(res, "Transaction not found", 404);

    const user = transaction.type === "debit" 
      ? await User.findById(transaction.senderId)
      : await User.findById(transaction.receiverId);

    if (!user) return handleError(res, "User not found", 404);

    // Rollback transaction
    if (transaction.type === "debit") {
      user.balance += transaction.amount;
    } else if (transaction.type === "credit") {
      user.balance -= transaction.amount;
    }
    await user.save();

    res.status(200).json({ status: "200", balance: user.balance });
  } catch (error) {
    handleError(res, error.message);
  }
};
