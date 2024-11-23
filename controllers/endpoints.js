const axios = require("axios");

// Load environment variables
const API_PASSWORD = process.env.API_PASSWORD;
const API_USERNAME = process.env.API_USERNAME;

// Fetch game list
exports.getlist = async (req, res) => {
    try {
        const url = "https://stage.game-program.com/api/seamless/provider";
        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGameList",
            show_systems: 0,
            show_additional: false,
            currency: "EUR",
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error('Erreur lors de la récupération des données :', error.message);
        res.status(500).json({ success: false, message: 'Impossible de récupérer les données depuis l\'endpoint.' });
    }
};

// Fetch game embed URL
exports.getGame = async (req, res) => {
    try {
        const { gameid, lang = 'en', play_for_fun = false, homeurl } = req.body;

        if (!gameid || typeof gameid !== 'number') {
            return res.status(400).json({ success: false, message: "Invalid or missing gameid." });
        }

        const url = "https://stage.game-program.com/api/seamless/provider";
        const payload = {
            api_password: API_PASSWORD,
            api_login: API_USERNAME,
            method: "getGame",
            gameid,
            lang,
            play_for_fun,
            homeurl: homeurl || "https://catch-me.bet",
            currency: "EUR",
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error('Erreur lors de la récupération du jeu :', error.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération du jeu.' });
    }
};
