const API_SALT = process.env.API_SALT;
const { generateKey } = require("../utils/cryptoUtils"); // Ensure this utility exists

// Validates the request key against the calculated key
function validateKey(reqQuery, salt) {
    const receivedKey = reqQuery.key;
    const calculatedKey = generateKey(reqQuery, salt);

    console.log("[DEBUG] Received Key:", receivedKey);
    console.log("[DEBUG] Calculated Key:", calculatedKey);

    return receivedKey === calculatedKey;
}

// Middleware to validate request key
function validateRequestKey(req, res, next) {
    const { key } = req.query;

    if (!key) {
        console.warn("[WARN] Missing key in query");
        return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
    }

    const isValid = validateKey(req.query, API_SALT);
    if (!isValid) {
        console.warn("[WARN] Key validation failed");
        return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
    }

    next(); // Proceed to the next middleware or route handler if valid
}

module.exports = {
    validateRequestKey,
};
