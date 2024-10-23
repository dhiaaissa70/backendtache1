// controllers/auth.js
const { verifyToken } = require('../middleware/token');

const express = require("express");
const router = express.Router();
const AuthController =require ("../controllers/auth")

router.route("/register").post(AuthController.register);
router.route("/update").post(AuthController.updateUserByEmail);
router.route("/getuser").get(verifyToken,AuthController.getUserByEmail);


module.exports = router;
