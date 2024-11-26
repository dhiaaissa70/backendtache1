const express = require('express');
const cors = require('cors'); 
const connectDB = require("./config/db");
require('dotenv').config(); // Load environment variables
const app = express();
const port = 3001;
const AuthRoute = require("./routes/auth");
const TranferRoute = require("./routes/transfer");
const EndpointRoute = require("./routes/endpoints")

connectDB();

app.use(cors());
app.use(express.json());

// Route de base
app.get('/', (req, res) => {
  res.send('le serveur est en marche');
});


////
app.use("/tr",TranferRoute)
app.use("/auth",AuthRoute)
app.use("/api",EndpointRoute)



// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution à http://localhost:${port}`);
});
