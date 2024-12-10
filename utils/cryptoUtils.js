const crypto = require("crypto");

/**
 * Generates a SHA1 hash key based on the provided query parameters and salt.
 *
 * @param {Object} params - The query parameters to be included in the key generation.
 * @param {string} salt - The salt value to prepend to the parameter string.
 * @returns {string} The generated SHA1 hash key.
 */
function generateKey(params, salt) {
    if (!params || typeof params !== "object") {
        throw new Error("[ERROR] Invalid parameters provided for key generation.");
    }

    if (!salt || typeof salt !== "string") {
        throw new Error("[ERROR] Invalid salt provided for key generation.");
    }

    // Step 1: Sort the query parameters alphabetically by their keys
    const sortedParams = Object.keys(params)
        .filter((key) => key !== "key" && params[key] !== undefined && params[key] !== null && params[key] !== "") // Exclude the key parameter itself
        .sort()
        .reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
        }, {});

    // Step 2: Create a query string from the sorted parameters
    const queryString = Object.entries(sortedParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");

    // Step 3: Concatenate the salt and the query string
    const hashInput = `${salt}${queryString}`;

    // Step 4: Generate the SHA1 hash
    const hashKey = crypto.createHash("sha1").update(hashInput).digest("hex");

    console.log("[DEBUG] Generated Query String:", queryString);
    console.log("[DEBUG] Generated Key:", hashKey);

    return hashKey;
}

module.exports = {
    generateKey,
};
