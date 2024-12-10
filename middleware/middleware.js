
const API_SALT = process.env.API_SALT;


function validateKey(reqQuery, salt) {
    const receivedKey = reqQuery.key;
    const calculatedKey = generateKey(reqQuery, salt);

    console.log("[DEBUG] Received Key:", receivedKey);
    console.log("[DEBUG] Calculated Key:", calculatedKey);

    
    return receivedKey === calculatedKey;
  }




  
function validateRequestKey(req, res, next) {
    const { key } = req.query;

    if (!key) {
        return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
    }

    const isValid = validateKey(req.query, API_SALT);
    if (!isValid) {
        return res.status(403).json({ status: "403", msg: "Hash Code Invalid" });
    }

    next(); // Proceed to the next middleware or endpoint if valid
}

module.exports = {
    validateRequestKey,
};
