// controllers/auth.js
const bcrypt = require("bcrypt");
const User = require("../models/User");

exports.register = async (req, res, next) => {
    const {
        nom,
        prenom,
        email,
        datenaissance,
        telephone,
        adresse,
    } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(200).json({ success: true, message: "Utilisateur déjà enregistré", user: existingUser });
        }

        const user = await User.create({
            nom,
            prenom,
            email,
            datenaissance,
            telephone,
            adresse,
        });

        res.status(201).json({ success: true, message: "Utilisateur ajouté avec succès", user });
    } catch (error) {
        console.error(error); 
        next(error);
        res.status(400).json({ success: false, message: "Erreur lors de l'ajout de l'utilisateur" });
    }
};

exports.updateUserByEmail = async (req, res, next) => {
    const { email, nom, prenom, datenaissance, telephone, adresse, mot_passe } = req.body; 

    console.log("Email reçu pour mise à jour:", email); 

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() }); 
        console.log("Utilisateur trouvé:", existingUser); 

        if (!existingUser) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        existingUser.nom = nom || existingUser.nom;
        existingUser.prenom = prenom || existingUser.prenom;
        existingUser.datenaissance = datenaissance || existingUser.datenaissance;
        existingUser.telephone = telephone || existingUser.telephone;
        existingUser.adresse = adresse || existingUser.adresse;

        if (mot_passe) {
            const hashedPassword = await bcrypt.hash(mot_passe, saltRounds);
            existingUser.mot_passe = hashedPassword;
        }

        await existingUser.save();

        res.status(200).json({ success: true, message: "Utilisateur mis à jour avec succès", user: existingUser });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

exports.getUserByEmail = async (req, res, next) => {
    const { email } = req.body; 

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        user.mot_passe = undefined; 

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error(error);
        next(error);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'utilisateur" });
    }
};


//tokens


exports.generateToken = (req) => {
    const { email } = req.body; 

    const payload = {
      email: email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return token; 
};
