const express = require('express');
const cors = require('cors'); 
const connectDB = require("./config/db");
const app = express();
const port = 3001;
const AuthRoute = require("./routes/auth");

connectDB();

app.use(cors());
app.use(express.json());

// Route de base
app.get('/', (req, res) => {
  res.send('le serveur est en marche');
});

app.use("/auth",AuthRoute)

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution à http://localhost:${port}`);
});
