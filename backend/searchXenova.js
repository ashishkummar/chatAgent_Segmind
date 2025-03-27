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

// Load embedding model
console.log("⏳ Loading embedding model...");
//const embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
const embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2", { quantized: true });


console.log("✅ Model loaded!");

// Convert text into embedding vector
const embedText = async (text) => {
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
async function querySegmind(query, context) {
  try {
    const url = "https://api.segmind.com/v1/mixtral-8x22b-instruct";

    const data = {
      "messages": [
        { "role": "system", "content": "You are an expert AI assistant. Answer concisely based on provided context. DO NOT mention 'VDX Advanced: Yes' or any IDs (e.g., 'ID: VDX-XXXX-XXX')." },

        { "role": "user", "content": `Here is some context:\n${context}\nNow, answer this query: ${query}` }
      ]
    };

    const response = await axios.post(url, data, { headers: { 'x-api-key': SEG_API_KEY } });

    return response.data.choices[0]?.message?.content || "No response from AI.";
  } catch (error) {
    console.error("❌ Error with Segmind API:", error.response?.data || error.message);
    return "Error fetching response.";
  }
}

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
