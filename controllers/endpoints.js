import axios from 'axios';

export async function fetchDataFromEndpoint() {
    try {
        const url = "https://stage.game-program.com/api/seamless/provider";
        const payload = {
            api_password: "xapitest",
            api_login: "xapitest",
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

        // Retourner les données récupérées
        return response.data;
    } catch (error) {
        console.error('Erreur lors de la récupération des données :', error.message);
        throw new Error('Impossible de récupérer les données depuis l\'endpoint.');
    }
}

// Exemple d'utilisation de la fonction
(async () => {
    try {
        const data = await fetchDataFromEndpoint();
        console.log('Données récupérées :', data);
    } catch (error) {
        console.error('Erreur :', error.message);
    }
})();
