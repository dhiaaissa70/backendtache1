const axios = require("axios");

// Fonction contrôleur
exports.getlist = async (req, res) => {
    try {
        const url = "https://stage.game-program.com/api/seamless/provider";
        const payload = {
            api_password: "5t0damXaAEdPmORycm",
            api_login: "bemyguide_mc_s",
            method: "getGameList",
            show_systems: 0,
            show_additional: false,
            currency: "EUR"
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Répondre avec les données récupérées
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error('Erreur lors de la récupération des données :', error.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des données.' });
    }
};
