const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Registration Controller
exports.register = async (req, res, next) => {
    let { username, password, role } = req.body;

    // Trim input values to avoid issues due to spaces
    username = username.trim();
    password = password.trim();

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Utilisateur déjà enregistré" });
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Hashed Password during registration:", hashedPassword);  // Log for debugging

        // Create and save the new user
        const user = await User.create({
            username,
            password: hashedPassword,
            role: role || "user"  // Default to "user" if no role is provided
        });

        // Exclude password before returning user data
        user.password = undefined;

        res.status(201).json({ success: true, message: "Utilisateur ajouté avec succès", user });
    } catch (error) {
        console.error("Erreur lors de l'enregistrement :", error);
        next(error);  // Pass the error to middleware for handling
    }
};

// Login Controller
exports.login = async (req, res, next) => {
    let { username, password } = req.body;

    // Trim input values to avoid issues due to spaces
    username = username.trim();
    password = password.trim();

    try {
        // Check if the user exists
        const user = await User.findOne({ username });
        console.log("User found in DB:", user);  // Log the user for debugging

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Log both passwords for debugging
        console.log("Password entered for login:", password);
        console.log("Stored hashed password in DB:", user.password);

        // Compare the entered password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log("Is password valid:", isPasswordValid);  // Log the comparison result

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Mot de passe incorrect" });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { username: user.username, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        // Exclude the password from the returned user object
        user.password = undefined;

        // Return the token and user info
        res.status(200).json({
            success: true,
            message: "Connexion réussie",
            token,
            user
        });
    } catch (error) {
        console.error("Erreur lors de la connexion :", error);
        next(error);  // Pass the error to middleware for handling
    }
};

// Update User Controller (Optional, if you need it)
exports.updateUserByUsername = async (req, res, next) => {
    let { username, password, role } = req.body;

    // Trim input values to avoid issues due to spaces
    username = username.trim();
    if (password) {
        password = password.trim();
    }

    try {
        // Find the user by username
        const existingUser = await User.findOne({ username });
        if (!existingUser) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Update user role if provided
        if (role) {
            existingUser.role = role;
        }

        // Update password if provided
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            existingUser.password = hashedPassword;
        }

        // Save the updated user
        await existingUser.save();

        // Exclude the password from the returned user object
        existingUser.password = undefined;

        res.status(200).json({ success: true, message: "Utilisateur mis à jour avec succès", user: existingUser });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur :", error);
        next(error);  // Pass the error to middleware for handling
    }
};

// Utility: Manually reset password (Optional)
exports.resetPassword = async (req, res, next) => {
    const { username, newPassword } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Hash the new password and update the user
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        await user.save();
        res.status(200).json({ success: true, message: "Mot de passe réinitialisé avec succès" });
    } catch (error) {
        console.error("Erreur lors de la réinitialisation du mot de passe :", error);
        next(error);  // Pass the error to middleware for handling
    }
};
