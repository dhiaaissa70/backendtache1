const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/auth");
const { verifyToken } = require("../middleware/token");

router.route("/register").post(AuthController.register);
router.route("/login").post(AuthController.login);

// Apply verifyToken middleware to protect these routes
router.route("/usersByRole").post(verifyToken, AuthController.getUsersByRole); 
router.route("/delete_user").delete(verifyToken, AuthController.deleteUserByUsername);

module.exports = router;
