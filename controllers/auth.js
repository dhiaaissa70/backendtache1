const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.register = async (req, res, next) => {
    const { username, password, role } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Utilisateur déjà enregistré" });
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create and save the new user with the role
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

exports.login = async (req, res, next) => {
    const { username, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Compare the entered password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);
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

exports.updateUserByUsername = async (req, res, next) => {
    const { username, password, role } = req.body;

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

exports.getUserByUsername = async (req, res, next) => {
    const { username } = req.body;

    try {
        // Find the user by username
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Exclude the password from the returned user object
        user.password = undefined;

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'utilisateur :", error);
        next(error);  // Pass the error to middleware for handling
    }
};

exports.getUsersByRole = async (req, res, next) => {
    const { role } = req.body;

    try {
        // Find users by role
        const users = await User.find({ role });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun utilisateur trouvé avec ce rôle." });
        }

        // Exclude password from each user object
        users.forEach(user => {
            user.password = undefined;
        });

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs :", error);
        next(error);  // Pass the error to middleware for handling
    }
};

exports.deleteUserByUsername = async (req, res, next) => {
    const { username } = req.body;

    try {
        // Find and delete user by username
        const user = await User.findOneAndDelete({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        res.status(200).json({ success: true, message: "Utilisateur supprimé avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'utilisateur :", error);
        next(error);  // Pass the error to middleware for handling
    }
};
