const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");
const Transfer = require("../models/transfer");
const GameImage = require("../models/GameImage"); // Import the GameImage model

const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;
const API_SALT = process.env.API_SALT;
const BASE_URL = process.env.BASE_URL;
const PROVIDER_API_URL = process.env.PROVIDER_API_URL || "https://catch-me.bet/api";

// Helper function to generate SHA1 key
async function callProviderAPI(payload) {
  const url = "https://stage.game-program.com/api/seamless/provider";
  try {
    console.log("[DEBUG] Calling Provider API:", payload);
    const response = await axios.post(url, payload, {
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

  //geanration ssh
  // Utility function to generate SHA1 key
  function generateKey(params, providedKey) {
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
  
    // Step 4: Validate the provided key (if applicable)
    if (providedKey && providedKey !== key) {
      console.error("[ERROR] Hash Code Invalid. Provided key does not match.");
      const error = new Error("Hash Code Invalid");
      error.statusCode = 403; // Set HTTP status code to 403 (Forbidden)
      error.message = "Wrong key";
      throw error; // Throw error for handling in the calling function
    }
  
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
  
  
  
  let cachedGameList = null;
  let cacheExpiry = null;
  
  
  
  exports.getlist = async (req, res) => {
    const CACHE_DURATION_MS = 10 * 60 * 1000; // Cache for 10 minutes
    const { show_systems = 1, show_additional = true, currency = "EUR" } = req.query;
  
    // Serve cached data if available
    if (cachedGameList && Date.now() < cacheExpiry) {
      console.log("[DEBUG] Serving cached game list from cache.");
      return res.status(200).json({ success: true, data: cachedGameList });
    }
  
    try {
      const payload = {
        api_password: process.env.API_PASSWORD,
        api_login: process.env.API_USERNAME,
        method: "getGameList",
        show_systems: parseInt(show_systems, 10),
        show_additional: show_additional === "true" || show_additional === true,
        currency,
      };
  
      console.log("[DEBUG] Fetching game list with payload:", payload);
  
      const response = await callProviderAPI(payload);
  
      if (response.error !== 0) {
        console.error("[ERROR] Failed to fetch game list:", response.message);
        return res.status(500).json({
          success: false,
          message: response.message || "Failed to fetch game list",
        });
      }
  
      // Filter only mobile games
      const mobileGames = response.response.filter((game) => game.mobile === true);
  
      // Enrich games with provider data
      const providerLogos = response.response_provider_logos || {};
      const enrichedGames = enrichGamesWithProviderData(mobileGames, providerLogos);
  
      // Cache enriched games
      cachedGameList = enrichedGames;
      cacheExpiry = Date.now() + CACHE_DURATION_MS;
  
      console.log("[DEBUG] Successfully fetched, filtered, and enriched game list.");
  
      // Save enriched games to the database
      await saveGamesToDatabase(enrichedGames);
  
      res.status(200).json({ success: true, data: enrichedGames });
    } catch (error) {
      console.error("[ERROR] Unexpected error fetching game list:", error.message);
      res.status(500).json({
        success: false,
        message: "An error occurred while fetching the game list.",
      });
    }
  };
  
  
  
  // Helper function to enrich games with provider details
  function enrichGamesWithProviderData(games, providerLogos) {
    const providerMap = {};
  
    // Build a map of provider systems to provider details
    for (const category in providerLogos) {
      const providers = providerLogos[category];
      for (const provider of providers) {
        providerMap[provider.system] = {
          provider: provider.system,
          provider_name: provider.name,
          providerLogos: {
            image_black: provider.image_black,
            image_white: provider.image_white,
            image_colored: provider.image_colored,
          },
        };
      }
    }
  
    // Add provider details to games
    return games.map((game) => {
      const providerData = providerMap[game.system] || {}; // Use `game.system` for mapping
      return {
        ...game,
        provider: providerData.provider || null,
        provider_name: providerData.provider_name || null,
        providerLogos: providerData.providerLogos || null,
      };
    });
  }
  
  
  
  // Helper function to save game metadata to the database
  async function saveGamesToDatabase(gameList) {
    try {
      for (const game of gameList) {
        if (!game.name || !game.id_hash || !game.image) {
          console.warn(`[WARN] Skipping invalid game: ${JSON.stringify(game)}`);
          continue;
        }
  
        // Prevent duplicates based on `id_hash`
        const existingGame = await GameImage.findOne({ id_hash: game.id_hash });
        if (existingGame) {
          console.warn(`[WARN] Skipping duplicate game: ${game.name} (id_hash: ${game.id_hash})`);
          continue;
        }
  
        // Save or update the game in the database
        await GameImage.findOneAndUpdate(
          { id_hash: game.id_hash }, // Find by unique `id_hash`
          {
            gameId: game.id, // Add gameId if needed
            id_hash: game.id_hash,
            name: game.name,
            type: game.type,
            release_date: game.release_date,
            category: game.category,
            imageUrl: game.image,
            provider: game.provider,
            provider_name: game.provider_name,
            providerLogos: game.providerLogos,
          },
          { upsert: true, new: true }
        );
  
        console.log(`[DEBUG] Saved game: ${game.id_hash} - ${game.name}`);
      }
    } catch (error) {
      console.error("[ERROR] Failed to save games to database:", error.message);
    }
  }
  
  


  // 3. Get Game
  exports.getGame = async (req, res) => {
    try {
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
        return res.status(400).json({ status: 400, message: "Game ID and username are required" });
      }
  
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ status: 404, message: "User not found" });
      }
  
      let remote_id = user.remote_id;
  
      if (!remote_id) {
        const playerExistsPayload = {
          api_password: API_PASSWORD,
          api_login: API_USERNAME,
          method: "playerExists",
          user_username: username,
          currency,
        };
  
        const playerExistsResponse = await callProviderAPI(playerExistsPayload);
        if (playerExistsResponse.error === 0) {
          remote_id = playerExistsResponse.response.id;
          user.remote_id = remote_id;
          await user.save();
        } else {
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
            remote_id = createPlayerResponse.response.id;
            user.remote_id = remote_id;
            await user.save();
          } else {
            return res.status(400).json({ status: 400, message: createPlayerResponse.message });
          }
        }
      }
  
      const payload = {
        api_password: API_PASSWORD,
        api_login: API_USERNAME,
        method: "getGame",
        gameid,
        user_username: username,
        user_password: username,
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
        return res.status(200).json({
          success: true,
          data: {
            gameUrl,
            gamesession_id: response.gamesession_id,
            sessionid: response.sessionid,
          },
        });
      } else {
        return res.status(400).json({ status: 400, message: response.message });
      }
    } catch (error) {
      console.error("[ERROR] getGame:", error.message);
      res.status(500).json({ status: 500, message: "Internal server error" });
    }
  };
  

  exports.getGameListFromDatabase = async (req, res) => {
    const { limit = 30, offset = 0, ...filters } = req.query; 
  
    try {
      // Apply dynamic filters (e.g., category, type)
      const query = { ...filters };
  
      // Fetch games from the database with pagination
      const games = await GameImage.find(query)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .select("-_id gameId name category type release_date imageUrl");
  
      res.status(200).json({ success: true, data: games });
    } catch (error) {
      console.error("[ERROR] Fetching games from database:", error.message);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch games from the database." });
    }
  };
  
  

  exports.getAllGames = async (req, res) => {
    try {
      // Fetch all games from the database
      const games = await GameImage.find()
        .select("-_id gameId name category type release_date imageUrl"); // Ensure required fields are included
  
      // Respond with the entire dataset
      res.status(200).json({ success: true, data: games });
    } catch (error) {
      console.error("[ERROR] Fetching all games from database:", error.message);
      res.status(500).json({ success: false, message: "Failed to fetch all games from the database." });
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

    if (parseFloat(amount) < 0) {
      console.error("[ERROR] Negative amount is not allowed:", { username, amount });
      return res.status(500).json({ status: "500", message: "Negative amount not allowed!" });
    }
  
    try {
      // Generate key for provider API validation
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
  
      // Deduct the amount and update balance
      const newBalance = parseFloat(user.balance) - parseFloat(amount);
      if (newBalance < 0) {
        console.error("[ERROR] Insufficient funds for debit:", { username, amount, balance: user.balance });
        return res.status(403).json({ status: "403", message: "Insufficient funds." });
      }
  
      user.balance = newBalance;
      await user.save();

      const gameName = `Game_${game_id}`; // Replace with real game lookup if needed

  
      // Log the transaction in the database
      const transfer = new Transfer({
        senderId: user._id,
        type: "debit",
        transaction_id,
        amount: parseFloat(amount),
        gameId: game_id,
        gameName: gameName,
        balanceBefore: { sender: parseFloat(user.balance) + parseFloat(amount), receiver: null },
        balanceAfter: { sender: newBalance, receiver: null },
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
  
      // Log Axios-specific error details
      if (error.response) {
        console.error("[DEBUG] Provider Error Response Data:", error.response.data);
        console.error("[DEBUG] Provider Error Status Code:", error.response.status);
        console.error("[DEBUG] Provider Error Headers:", error.response.headers);
      } else if (error.request) {
        console.error("[DEBUG] No response received from provider. Request details:", error.request);
      } else {
        console.error("[DEBUG] General Error:", error.message);
      }
  
      // Respond with error status
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
      console.error("[ERROR] Negative amount is not allowed:", { username, amount });
      return res.status(500).json({ status: "500", message: "Negative amount not allowed!" });
    }
  
    try {
      // Fetch the user
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

      const gameName = `Game_${game_id}`; // Replace with real game lookup if needed

      // Log the transaction
      const transfer = new Transfer({
        senderId: user._id,
        type: "credit",
        transaction_id,
        amount: parseFloat(amount),
        gameId: game_id,
        gameName: gameName,
        balanceBefore: { sender: parseFloat(user.balance) - parseFloat(amount), receiver: null },
        balanceAfter: { sender: newBalance, receiver: null },
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
      console.error("[ERROR] Credit API Unexpected Error:", error.message);
      return res.status(500).json({
        status: "500",
        message: "An error occurred while processing the credit.",
      });
    }
  };
  
  
  
// 7. Rollback
// Rollback Endpoint
exports.rollback = async (req, res) => {
    const { transaction_id } = req.query;
  
    if (!transaction_id) {
      console.error("[ERROR] Missing transaction_id for rollback.");
      return res.status(400).json({ status: "400", message: "Missing transaction_id." });
    }
  
    try {
      // Find the original transaction
      const originalTransaction = await Transfer.findOne({ transaction_id });
      if (!originalTransaction) {
        console.error("[ERROR] Transaction not found for rollback:", transaction_id);
        return res.status(404).json({ status: "404", message: "Transaction not found." });
      }
  
      // Fetch the user
      const user = await User.findById(originalTransaction.senderId || originalTransaction.receiverId);
      if (!user) {
        console.error("[ERROR] User not found for rollback.");
        return res.status(404).json({ status: "404", message: "User not found." });
      }
  
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
        gameId: originalTransaction.gameId,
        gameName: originalTransaction.gameName,
        balanceBefore: { sender: user.balance, receiver: null },
        balanceAfter: { sender: updatedBalance, receiver: null },
      });
      await rollbackTransaction.save();
  
      console.log(`[INFO] Rollback processed successfully for transaction: ${transaction_id}`);
  
      // Respond with the updated balance
      return res.status(200).json({
        status: "200",
        balance: updatedBalance.toFixed(2),
      });
    } catch (error) {
      console.error("[ERROR] Rollback API Unexpected Error:", error.message);
      return res.status(500).json({
        status: "500",
        message: "An error occurred while processing the rollback.",
      });
    }
  };
  ;
  
  
  