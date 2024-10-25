const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.register = async (req, res, next) => {
    const { username, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ success: true, message: "Utilisateur déjà enregistré", user: existingUser });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            password: hashedPassword,
            role: role || "user"  
        });

        res.status(201).json({ success: true, message: "Utilisateur ajouté avec succès", user });
    } catch (error) {
        console.error(error);
        next(error);
        res.status(400).json({ success: false, message: "Erreur lors de l'ajout de l'utilisateur" });
    }
};

exports.updateUserByUsername = async (req, res, next) => {
    const { username, password, role } = req.body;

    console.log("Nom d'utilisateur reçu pour mise à jour:", username);

    try {
        const existingUser = await User.findOne({ username });
        console.log("Utilisateur trouvé:", existingUser);

        if (!existingUser) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        existingUser.role = role || existingUser.role;

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            existingUser.password = hashedPassword;
        }

        await existingUser.save();

        res.status(200).json({ success: true, message: "Utilisateur mis à jour avec succès", user: existingUser });
    } catch (error) {
        console.error(error);
        next(error);
        res.status(400).json({ success: false, message: "Erreur lors de la mise à jour de l'utilisateur" });
    }
};

exports.getUserByUsername = async (req, res, next) => {
    const { username } = req.body;

    try {
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        user.password = undefined;

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error(error);
        next(error);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'utilisateur" });
    }
};

exports.generateToken = (req) => {
    const { username } = req.body;

    const payload = {
        username: username
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return token;
};
