const crypto = require("crypto");

// Generate unique transaction ID
exports.generateTransactionId = () => {
    return `txn_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
};

// Generate SHA1 hash for `key`
exports.generateKey = (payload, salt) => {
    const queryString = new URLSearchParams(payload).toString();
    return crypto.createHash("sha1").update(salt + queryString).digest("hex");
};
