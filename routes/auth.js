// controllers/auth.js
const { verifyToken } = require('../middleware/token');

const express = require("express");
const router = express.Router();
const AuthController =require ("../controllers/auth")

router.route("/register").post(AuthController.register);
router.route("/login").post(AuthController.login);
router.route("/users_Role").post(AuthController.getUsersByRole); 
router.route("/delete_user").delete(AuthController.deleteUserByUsername);

module.exports = router;
