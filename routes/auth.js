// controllers/auth.js
const { verifyToken } = require('../middleware/token');

const express = require("express");
const router = express.Router();
const AuthController =require ("../controllers/auth")

router.route("/register").post(AuthController.register);

router.route("/users_Role").post(AuthController.getUsersByRole); 

module.exports = router;
