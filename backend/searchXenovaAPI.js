import express from "express";
import { pipeline } from "@xenova/transformers";
import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json()); // Middleware to parse JSON requests

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index("chatagent-xenova");
const SEG_API_KEY = process.env.SEGMIND_API_KEY;

let embedder; // Define outside
const loadModel = async () => {
  if (!embedder) {
    console.log("⏳ Loading embedding model...");
   // embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2", { quantized: true });
     embedder = await pipeline("feature-extraction", "Xenova/all-distilroberta-v1", { quantized: true });

    console.log("✅ Model loaded!");
  }
};

const embedText = async (text) => {
  await loadModel(); // Ensure model is loaded
  const embedding = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(embedding.data);
};


// 1️⃣ Retrieve relevant context from Pinecone
async function searchEmbedding(query) {
  try {
    const queryEmbedding = await embedText(query);
    const response = await index.namespace("ns1").query({
      topK: 5, // Get top 5 relevant matches
      vector: queryEmbedding,
      includeValues: true,
      includeMetadata: true,
    });

    // Extract top search results as context
    const context = response.matches.map(match => match.metadata.text).join("\n");

    return context;
  } catch (error) {
    console.error("❌ Error searching embeddings:", error);
    return "";
  }
}

// 2️⃣ Query Segmind for better response
const querySegmind = async (query, context) => {
  try {
      const SEG_API_KEY = process.env.SEGMIND_API_KEY;
      const API_URL = "https://api.segmind.com/v1/chat/completions";

      const response = await axios.post(
          API_URL,
          {
              model: "llama3-8b-chat",
              messages: [
                  { role: "system", content: "You are an AI assistant. Answer based on the given context." },
                  { role: "user", content: `${query}\n\nContext: ${context}` }
              ]
          },
          {
              headers: {
                  "Authorization": `Bearer ${SEG_API_KEY}`,
                  "Content-Type": "application/json"
              }
          }
      );

      return response.data.choices[0].message.content.trim();
  } catch (error) {
      console.error("❌ Segmind API Error:", error.response?.data || error.message);
      return `Error from Segmind: ${error.response?.data?.error || error.message}`;
  }
};


// 3️⃣ API Endpoint for Frontend
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

// Start the Express server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
