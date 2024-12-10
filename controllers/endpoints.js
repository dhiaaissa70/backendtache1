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

  
  // Utility function to generate SHA1 key







function handleInvalidKey(res) {
  return res.status(403).json({ status: "403", message: "Hash Code Invalid" });
}

async function getPreviousResponse(transaction_id) {
  const previousTransaction = await Transfer.findOne({ transaction_id });
  if (previousTransaction && previousTransaction.response) {
      return previousTransaction.response; // Return stored response
  }
  return null;
}

async function saveTransactionResponse(transaction_id, response) {
  await Transfer.findOneAndUpdate(
      { transaction_id },
      { response },
      { upsert: true, new: true }
  );
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
      remote_id,
      amount,
      provider,
      game_id,
      session_id,
      gamesession_id,
      currency = "EUR",
      transaction_id,
      key,
  } = req.query;

  // Validate Key
  if (!validateKey(req.query, API_SALT)) {
      return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
  }

  // Validate Required Parameters
  if (
      !remote_id ||
      !amount ||
      !provider ||
      !game_id ||
      !session_id ||
      !gamesession_id ||
      !transaction_id
  ) {
      return res.status(400).json({
          status: "400",
          msg: "Missing required parameters.",
      });
  }

  // Handle Negative Amount
  if (parseFloat(amount) < 0) {
      return res.status(500).json({ status: "500", msg: "Negative amount not allowed!" });
  }

  try {
      // Check for previous transaction
      const previousResponse = await getPreviousResponse(transaction_id);
      if (previousResponse) {
          return res.status(200).json(previousResponse); // Return the same response for retries
      }

      // Fetch user
      const user = await User.findOne({ remote_id });
      if (!user) {
          return res.status(404).json({ status: "404", msg: "User not found." });
      }

      // Check balance
      const newBalance = parseFloat(user.balance) - parseFloat(amount);
      if (newBalance < 0) {
          return res.status(403).json({ status: "403", msg: "Insufficient funds." });
      }

      // Update balance
      user.balance = newBalance;
      await user.save();

      // Build response
      const response = {
          status: "200",
          balance: newBalance.toFixed(2),
          transaction_id,
      };

      // Save transaction details
      await saveTransactionResponse(transaction_id, {
          ...response,
          provider,
          game_id,
          session_id,
          gamesession_id,
          currency,
      });

      return res.status(200).json(response);
  } catch (error) {
      console.error("[ERROR] Debit Error:", error.message);
      return res.status(500).json({
          status: "500",
          msg: "An error occurred while processing the debit.",
      });
  }
};

exports.credit = async (req, res) => {
  const {
      remote_id,
      amount,
      provider,
      game_id,
      session_id,
      gamesession_id,
      currency = "EUR",
      transaction_id,
      key,
  } = req.query;

  // Validate Key
  if (!validateKey(req.query, API_SALT)) {
      return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
  }

  // Validate Required Parameters
  if (
      !remote_id ||
      !amount ||
      !provider ||
      !game_id ||
      !session_id ||
      !gamesession_id ||
      !transaction_id
  ) {
      return res.status(400).json({
          status: "400",
          msg: "Missing required parameters.",
      });
  }

  // Handle Negative Amount
  if (parseFloat(amount) < 0) {
      return res.status(500).json({ status: "500", msg: "Negative amount not allowed!" });
  }

  try {
      // Check for previous transaction
      const previousResponse = await getPreviousResponse(transaction_id);
      if (previousResponse) {
          return res.status(200).json(previousResponse); // Return the same response for retries
      }

      // Fetch user
      const user = await User.findOne({ remote_id });
      if (!user) {
          return res.status(404).json({ status: "404", msg: "User not found." });
      }

      // Update balance
      const newBalance = parseFloat(user.balance) + parseFloat(amount);
      user.balance = newBalance;
      await user.save();

      // Build response
      const response = {
          status: "200",
          balance: newBalance.toFixed(2),
          transaction_id,
      };

      // Save transaction details
      await saveTransactionResponse(transaction_id, {
          ...response,
          provider,
          game_id,
          session_id,
          gamesession_id,
          currency,
      });

      return res.status(200).json(response);
  } catch (error) {
      console.error("[ERROR] Credit Error:", error.message);
      return res.status(500).json({
          status: "500",
          msg: "An error occurred while processing the credit.",
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
  
  
  