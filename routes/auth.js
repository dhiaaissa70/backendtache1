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
router.route('/usersByCreater/:createrid').get(AuthController.getUsersByCreaterId);
router.route("/delete_user/:id").delete(AuthController.deleteUserById); // New route for deleting user by ID
router.route("/update_user/:id").put(AuthController.updateUserById); // New route for updating user by ID
router.route("/user/:id").get(AuthController.getUserById); // New route to get user by ID

module.exports = router;
