const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transaction = require("../models/Transaction"); // A model to track transactions in your DB

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
  const { username } = req.body;

  if (!username) return handleError(res, "Username is required", 400);

  try {
    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "playerExists",
      user_username: username,
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

// 3. Get Game
exports.getGame = async (req, res) => {
  const { gameid, username, play_for_fun = false, lang = "en" } = req.body;

  if (!gameid || !username)
    return handleError(res, "Game ID and username are required", 400);

  try {
    const user = await User.findOne({ username });
    if (!user) return handleError(res, "User not found", 404);

    const payload = {
      api_password: API_PASSWORD,
      api_login: API_USERNAME,
      method: "getGame",
      gameid,
      user_username: username,
      user_password: username,
      play_for_fun,
      lang,
      currency: "EUR",
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

    // Deduct balance
    user.balance -= parseFloat(amount);
    await user.save();

    // Save transaction
    await Transaction.create({ username, amount, transaction_id, type: "debit" });

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

    // Add balance
    user.balance += parseFloat(amount);
    await user.save();

    // Save transaction
    await Transaction.create({ username, amount, transaction_id, type: "credit" });

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
    const transaction = await Transaction.findOne({ transaction_id });
    if (!transaction) return handleError(res, "Transaction not found", 404);

    const user = await User.findOne({ username: transaction.username });
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
