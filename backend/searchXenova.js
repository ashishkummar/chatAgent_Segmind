import express from "express";
import cors from "cors";
import { pipeline } from "@xenova/transformers";
import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Allow multiple origins dynamically
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "https://creative.exponential.com"
 
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: "GET,POST",
    allowedHeaders: "Content-Type",
    credentials: true, // Allow credentials if needed
}));

app.use(express.json());

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index("chatagent-xenova");

let embedder;

const loadModel = async () => {
    if (!embedder) {
        console.log("⏳ Loading embedding model...");
        embedder = await pipeline("feature-extraction", "Xenova/all-distilroberta-v1", { quantized: true });
        console.log("✅ Model loaded!");
    }
};

const embedText = async (text) => {
    await loadModel();
    const embedding = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(embedding.data);
};

const searchEmbedding = async (query) => {
    try {
        const queryEmbedding = await embedText(query);
        const response = await index.namespace("ns1").query({
            topK: 5,
            vector: queryEmbedding,
            includeValues: true,
            includeMetadata: true,
        });

        const context = response.matches.map(match => match.metadata.text).join("\n");
        return context;
    } catch (error) {
        console.error("❌ Error searching embeddings:", error);
        return "";
    }
};

const querySegmind = async (query, context) => {
    try {
        const API_URL = "https://api.segmind.com/v1/mixtral-8x22b-instruct";
        const SEG_API_KEY = process.env.SEGMIND_API_KEY;

        const payload = {
            messages: [
                { role: "system", content: "You are an AI assistant. Answer based on the given context." },
                { role: "user", content: `${query}\n\nContext: ${context}` }
            ]
        };

        console.log("🔵 Sending request to Segmind:", API_URL, payload);

        const response = await axios.post(API_URL, payload, {
            headers: {
                "x-api-key": SEG_API_KEY,
                "Content-Type": "application/json"
            }
        });

        console.log("✅ Segmind Response:", response.data);
        return response.data.choices?.[0]?.message?.content?.trim() || "No response from AI.";
    } catch (error) {
        console.error("❌ Error querying Segmind:", error.response?.data || error.message);
        return "An error occurred while processing your request.";
    }
};

app.post("/query", async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    console.log("🔎 Searching Pinecone...");
    const context = await searchEmbedding(query);

    console.log("🤖 Querying Segmind AI...");
    const finalResponse = await querySegmind(query, context);

    return res.json({ response: finalResponse });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
