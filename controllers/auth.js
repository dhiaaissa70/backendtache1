const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Registration Controller
exports.register = async (req, res, next) => {
    let { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }

    username = username.trim();
    password = password.trim();

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Utilisateur déjà enregistré" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            username,
            password: hashedPassword,
            role: role || "user"
        });

        await user.save();
        user.password = undefined;

        res.status(201).json({ success: true, message: "Utilisateur ajouté avec succès", user });
    } catch (error) {
        console.error("Erreur lors de l'enregistrement :", error);
        next(error);
    }
};

// Login Controller
exports.login = async (req, res, next) => {
    let { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }

    username = username.trim();
    password = password.trim();

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Mot de passe incorrect" });
        }

        const token = jwt.sign(
            { username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        user.password = undefined;

        res.status(200).json({ success: true, message: "Connexion réussie", token, user });
    } catch (error) {
        console.error("Erreur lors de la connexion :", error);
        next(error);
    }
};

// Get Users by Role Controller
exports.getUsersByRole = async (req, res, next) => {
    const { role } = req.body;

    try {
        const users = await User.find({ role });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun utilisateur trouvé avec ce rôle." });
        }

        users.forEach(user => {
            user.password = undefined;
        });

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs :", error);
        next(error);
    }
};

// Delete User by Username Controller
exports.deleteUserByUsername = async (req, res, next) => {
    const { username } = req.body;

    try {
        const user = await User.findOneAndDelete({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        res.status(200).json({ success: true, message: "Utilisateur supprimé avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'utilisateur :", error);
        next(error);
    }
};
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find({});

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun utilisateur trouvé." });
        }

        // Masque le mot de passe pour chaque utilisateur
        users.forEach(user => {
            user.password = undefined;
        });

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs :", error);
        next(error);
    }
};
