const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");


exports.register = async (req, res, next) => {
    let { username, password, role, id } = req.body;

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
            role: role || "user",
            createrid: id,
        });

        await user.save();
        user.password = undefined;

        res.status(201).json({ success: true, message: "Utilisateur ajouté avec succès", user });
    } catch (error) {
        console.error("Erreur lors de l'enregistrement :", error);
        next(error);
    }
};


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
        const users = await User.find({})
            .populate('createrid', 'username role balance userdate'); 

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Aucun utilisateur trouvé." });
        }

        const formattedUsers = users.map(user => ({
            _id: user._id,
            username: user.username,
            role: user.role,
            balance: user.balance,
            createrid: user.createrid ? user.createrid._id : null, 
            creatorInfo: user.createrid ? {  
                username: user.createrid.username,
                role: user.createrid.role,
                balance: user.createrid.balance,
                userdate: user.createrid.userdate
            } : null,
            userdate: user.userdate,
            __v: user.__v
        }));
        

        res.status(200).json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs :", error);
        next(error);
    }
};



exports.getBalance = async (req, res, next) => {
    const { username } = req.body; 

    if (!username) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur requis" });
    }

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        res.status(200).json({ success: true, balance: user.balance });
    } catch (error) {
        console.error("Erreur lors de la récupération du solde :", error);
        next(error);
    }
};


// Get Users by CreaterId Controller
exports.getUsersByCreaterId = async (req, res, next) => {
    const { createrid } = req.params; // Extract createrid from URL parameters

    try {
        // Find users with the provided createrid
        const users = await User.find({ createrid });

        // If no users are found, return 404
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "No users found for this creater ID." });
        }

        // Hide passwords before sending the response
        users.forEach(user => {
            user.password = undefined;
        });

        // Return the list of users with the given createrid
        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Error fetching users by createrid:", error);
        return res.status(500).json({ success: false, message: "Error fetching users." });
    }
};

exports.updateUser = async (req, res, next) => {
    const { userId, username, role, balance } = req.body; 

    if (!userId) {
        return res.status(400).json({ success: false, message: "ID utilisateur requis" });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris" });
            }
            user.username = username;
        }

        if (role) user.role = role;
        if (balance !== undefined) user.balance = balance; 

        await user.save();

        user.password = undefined;

        res.status(200).json({ success: true, message: "Utilisateur mis à jour avec succès", user });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur :", error);
        next(error);
    }
};
