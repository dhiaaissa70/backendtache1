const crypto = require("crypto");

function generateKey(params, salt) {
    const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
                acc[key] = params[key];
            }
            return acc;
        }, {});

    const queryString = Object.entries(sortedParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");

    console.log("[DEBUG] Generated Query String:", queryString);
    console.log("[DEBUG] API Salt Used:", salt);

    const hashInput = `${salt}${queryString}`;
    return crypto.createHash("sha1").update(hashInput).digest("hex");
}

module.exports = {
    generateKey,
};
