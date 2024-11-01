const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Enregistrement d'un nouvel utilisateur
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

// Connexion d'un utilisateur
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

// Récupérer les utilisateurs par rôle
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

// Supprimer un utilisateur par nom d'utilisateur
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

// Récupérer tous les utilisateurs
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find({}).populate('createrid', 'username role balance userdate');

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

// Récupérer le solde d'un utilisateur
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

// Récupérer les utilisateurs par createrid
// Recursive function to get all users and their sub-users
const fetchUserHierarchy = async (userId) => {
    const users = await User.find({ createrid: userId });
    
    const userTree = await Promise.all(users.map(async (user) => {
        // Fetch children of the current user
        const children = await fetchUserHierarchy(user._id);
        
        // Exclude sensitive information
        user = user.toObject(); // Convert Mongoose document to plain JavaScript object
        user.password = undefined;
        
        return {
            ...user,
            children
        };
    }));

    return userTree;
};

// Controller function to get the full user tree from the top level
exports.getUsersByCreaterId = async (req, res, next) => {
    const { createrid } = req.params;

    try {
        // Find the root user (highest level in the hierarchy)
        const rootUser = await User.findOne({ _id: createrid });
        if (!rootUser) {
            return res.status(404).json({ success: false, message: "Créateur introuvable." });
        }

        // Fetch the full user tree from the root user
        const userHierarchy = await fetchUserHierarchy(rootUser._id);

        // Return the root user with its full hierarchy
        rootUser.password = undefined; // Exclude password for security
        res.status(200).json({ success: true, user: { ...rootUser.toObject(), children: userHierarchy } });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs par ID créateur :", error);
        next(error);
    }
};


// Mettre à jour un utilisateur
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

        // Vérification si un nouveau nom d'utilisateur est fourni
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
        user.password = undefined; // Retirer le mot de passe avant d'envoyer la réponse

        res.status(200).json({ success: true, message: "Utilisateur mis à jour avec succès", user });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur :", error);
        next(error);
    }
};

// Récupérer un utilisateur par ID
exports.getUserById = async (req, res, next) => {
    const { id } = req.params;

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        user.password = undefined; // Retirer le mot de passe avant d'envoyer la réponse

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'utilisateur :", error);
        next(error);
    }
};

// Supprimer un utilisateur par ID
exports.deleteUserById = async (req, res, next) => {
    const { id } = req.params; // Log the user ID being used
    console.log("Deleting user with ID:", id);
  
    try {
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        console.log("User not found with ID:", id); // Log if the user is not found
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
      }
  
      res.status(200).json({ success: true, message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      console.error("Erreur lors de la suppression de l'utilisateur :", error);
      next(error);
    }
  };

  exports.getProfile = async (req, res, next) => {
    const { username } = req.body; // Assume the username is passed in the request body

    if (!username) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur requis" });
    }

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        user.password = undefined; // Exclude the password from the response

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Erreur lors de la récupération du profil de l'utilisateur :", error);
        res.status(500).json({ success: false, message: "Une erreur est survenue lors de la récupération du profil" });
    }
};

exports.fetchUsersByRole = async (req, res, next) => {
    const { role } = req.params; // use req.params to accept role as URL parameter

    try {
        const users = await User.find({ role });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "No users found with this role." });
        }

        // Remove password field from each user
        const sanitizedUsers = users.map(user => {
            const userObject = user.toObject();
            delete userObject.password;
            return userObject;
        });

        res.status(200).json({ success: true, users: sanitizedUsers });
    } catch (error) {
        console.error("Error retrieving users:", error);
        next(error);
    }
};
  
  
