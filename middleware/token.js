// middleware/token.js
const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(403).json({ success: false, message: "No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;  // Store user info in the request object
        next();  // Proceed to the next middleware or controller
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid token." });
    }
};
