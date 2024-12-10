const API_SALT = process.env.API_SALT;
const { generateKey } = require("../utils/cryptoUtils");

function validateKey(reqQuery, salt) {
    const receivedKey = reqQuery.key;
    const calculatedKey = generateKey(reqQuery, salt);

    console.log("[DEBUG] Received Key:", receivedKey);
    console.log("[DEBUG] Calculated Key:", calculatedKey);

    if (receivedKey !== calculatedKey) {
        console.warn("[WARN] Key validation failed");
        console.log("[DEBUG] Raw Params from Client:", reqQuery);
    }

    return receivedKey === calculatedKey;
}

function validateRequestKey(req, res, next) {
    const { key } = req.query;

    if (!key) {
        console.warn("[WARN] Missing key in query");
        return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
    }

    const isValid = validateKey(req.query, API_SALT);
    if (!isValid) {
        return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
    }

    next(); // Proceed if the key is valid
}

module.exports = {
    validateRequestKey,
};
