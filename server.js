// server/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/gemini.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin:['https://foodieai-1-g7lh.onrender.com','http://localhost:5173'],
    methods: "GET,POST,PUT,DELETE",
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({extended: true}))
app.use(router);

app.get('/', (req, res) => {
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
