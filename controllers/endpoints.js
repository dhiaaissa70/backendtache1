const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transfer = require("../models/transfer");

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
  
    if (!username || !password) {
      return handleError(res, "Username and password are required", 400);
    }
  
    try {
      // Prepare payload for API request
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "createPlayer",
        user_username: username,
        user_password: password,
        currency,
      };
  
      // Call the provider API
      const response = await callProviderAPI(payload);
  
      if (response.error === 0) {
        // Extract the remote_id from the API response
        const { id: remote_id } = response.response; // Use `response.response` instead of `response.data`
  
        // Update local database with remote_id
        let user = await User.findOneAndUpdate(
          { username }, // Search by username
          { $set: { remote_id } }, // Update the `remote_id` field
          { new: true } // Return the updated document
        );
  
        if (!user) {
          // If user doesn't exist locally, create one
          user = new User({
            username,
            password, // In production, ensure the password is hashed
            remote_id,
            balance: 0, // Default balance
          });
          await user.save();
        }
  
        console.log(`[DEBUG] Updated user with remote_id: ${remote_id}`);
  
        // Respond with success
        res.status(200).json({
          success: true,
          data: {
            username: user.username,
            remote_id: user.remote_id,
            balance: user.balance,
          },
        });
      } else {
        console.error(`[ERROR] Failed to create player: ${response.message}`);
        res.status(400).json({ success: false, message: response.message });
      }
    } catch (error) {
      console.error("[ERROR] createPlayer:", error.message);
      handleError(res, "Internal server error.", 500);
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
  
      let remote_id = user.remote_id;
      if (!remote_id) {
        console.log(`[DEBUG] No remote_id for user ${username}. Creating player...`);
  
        // Create player if `remote_id` is missing
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
          remote_id = createPlayerResponse.data.id;
          user.remote_id = remote_id;
          await user.save();
        } else {
          return handleError(res, "Failed to create player.", 400);
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

// 4. Get Balance
exports.getBalance = async (req, res) => {
  const { remote_id, session_id, currency, username } = req.query;

  if (!remote_id || !username || !currency) {
    console.error("[ERROR] Missing required parameters for getBalance.");
    return res.status(400).json({ status: "400", message: "Missing required parameters." });
  }

  try {
    // Fetch user by remote_id
    const user = await User.findOne({ remote_id });

    if (!user) {
      console.error("[ERROR] Player not found for remote_id:", remote_id);
      return res.status(404).json({ status: "404", balance: 0, message: "Player not found." });
    }

    res.status(200).json({
      status: "200",
      balance: user.balance.toFixed(2),
    });
  } catch (error) {
    console.error("[ERROR] getBalance:", error.message);
    res.status(500).json({
      status: "500",
      message: "Internal server error.",
    });
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
      round_id = "", // Optional field
      gameplay_final = 0, // Default to unfinished (0)
      is_freeround_bet = false,
      jackpot_contribution_in_amount = 0,
      gamesession_id,
      currency = "EUR", // Default to EUR
    } = req.query;
  
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
      return handleError(res, "Missing required parameters", 400);
    }
  
    try {
      // Prepare the request parameters
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
        game_id_hash,
        transaction_id,
        round_id,
        gameplay_final: gameplay_final ? 1 : 0,
        is_freeround_bet: is_freeround_bet ? 1 : 0,
        jackpot_contribution_in_amount: parseFloat(jackpot_contribution_in_amount).toFixed(6),
        gamesession_id,
        currency,
      };
  
      // Generate key and attach to parameters
      params.key = generateKey(params);
  
      console.log("[DEBUG] Debit Payload:", params);
  
      // Send the request to the provider
      const response = await axios.get(`${PROVIDER_API_URL}`, { params });
      console.log("[DEBUG] Provider Response:", response.data);
  
      if (response.data.status === "200") {
        console.log(`[INFO] Debit successful for ${username}. Remaining balance: ${response.data.balance}`);
        return res.status(200).json({
          success: true,
          balance: response.data.balance,
          transaction_id: response.data.transaction_id,
        });
      } else if (response.data.status === "403") {
        return res.status(403).json({
          success: false,
          message: response.data.msg || "Insufficient funds",
          balance: response.data.balance || 0,
        });
      } else {
        throw new Error(response.data.msg || "Debit failed");
      }
    } catch (error) {
      console.error("[ERROR] Debit API Error:", error.message);
      return handleError(res, "Internal server error", 500);
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
      gameplay_final = 1, // Default to finished
      is_freeround_bet = false,
      jackpot_contribution_in_amount = 0,
      gamesession_id,
      currency = "EUR",
    } = req.query;
  
    // Validate required fields
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
      return handleError(res, "Missing required parameters for credit", 400);
    }
  
    try {
      const params = {
        callerId: API_USERNAME,
        callerPassword: API_PASSWORD,
        action: "credit",
        remote_id,
        username,
        session_id,
        amount: parseFloat(amount).toFixed(2),
        provider,
        game_id,
        game_id_hash,
        transaction_id,
        round_id,
        gameplay_final,
        is_freeround_bet: is_freeround_bet ? 1 : 0,
        jackpot_contribution_in_amount: parseFloat(jackpot_contribution_in_amount).toFixed(6),
        gamesession_id,
        currency,
      };
  
      params.key = generateKey(params); // Generate the authentication key
  
      console.log("[DEBUG] Credit Payload:", params);
  
      const response = await axios.get(`${PROVIDER_API_URL}`, { params });
      console.log("[DEBUG] Provider Response:", response.data);
  
      if (response.data.status === "200") {
        return res.status(200).json({
          success: true,
          balance: response.data.balance,
          transaction_id: response.data.transaction_id,
        });
      } else {
        throw new Error(response.data.msg || "Credit failed");
      }
    } catch (error) {
      console.error("[ERROR] Credit API Error:", error.message);
      return handleError(res, "Internal server error during credit", 500);
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