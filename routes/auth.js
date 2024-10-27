// controllers/auth.js
const { verifyToken } = require('../middleware/token');

const express = require("express");
const router = express.Router();
const AuthController =require ("../controllers/auth")

router.route("/register").post(AuthController.register);
router.route("/usersByRole").post(AuthController.getUsersByRole); 
router.route("/getallusers").get(AuthController.getAllUsers); 
router.route("/delete_user").delete(AuthController.deleteUserByUsername);
router.route("/login").post(AuthController.login);
router.route('/getbalance').post(AuthController.getBalance);
router.route('/getuserbycreater').get(AuthController.getUsersByCreaterId);


module.exports = router;
