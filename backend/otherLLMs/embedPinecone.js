import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import mammoth from "mammoth";
import dotenv from "dotenv";
import axios from "axios";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

/// Function to Extract Text from .docx
const extractText = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

const text = await extractText("data/Doc1.docx");
console.log("Extracted Text:", text.substring(0, 500)); // Preview first 500 chars

/// Splitting Text into Chunks
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

const chunks = await splitter.createDocuments([text]);
console.log(`✅ Total Chunks: ${chunks.length}`);

//// EMBEDDINGS (Using Segmind API)
const SEG_API_KEY = process.env.SEGMIND_API_KEY;
const SEG_URL =  "https://api.segmind.com/v1/embeddings";
 ;

/**
 * Generate embeddings using Segmind API
 * @param {string} text
 * @returns {Promise<number[]>}
 */
const embedText = async (text) => {
  try {
    const response = await axios.post(
      SEG_URL,
      { input: text },
      {
        headers: {
          "x-api-key": SEG_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data || !Array.isArray(response.data.embedding)) {
      throw new Error("Embedding failed: Invalid response");
    }

    return response.data.embedding; // ✅ Returns embedding vector
  } catch (error) {
    console.error("❌ Error generating embedding:", error.response?.data || error.message);
    return null;
  }
};

// Convert all chunks to embeddings
const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.pageContent)));

// ✅ Filter out null embeddings
const validEmbeddings = embeddings
  .map((emb, i) => (emb ? { emb, chunk: chunks[i] } : null))
  .filter(Boolean);

console.log(`✅ Valid Embeddings: ${validEmbeddings.length}`);

/////// PINECONE_

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function ensureIndex() {
  try {
    const indexList = await pinecone.listIndexes();
    if (!indexList.indexes.some((idx) => idx.name === "chatagent-segmind")) {
      await pinecone.createIndex({
        name: "chatagent-segmind",
        dimension: 4096, // ✅ Adjusted to Segmind embedding dimension
        metric: "cosine",
        spec: {
          serverless: { cloud: "aws", region: "us-east-1" },
        },
      });
      console.log("✅ Pinecone Index Created with Dimension 4096!");
    } else {
      console.log("✅ Pinecone Index already exists.");
    }
  } catch (error) {
    console.error("❌ Error ensuring index:", error);
  }
}

await ensureIndex();

/// Inserting Embeddings into Pinecone

const index = pinecone.index("chatagent-segmind");

async function insertEmbeddings() {
  const index = pinecone.index("chatagent-segmind");

  if (!Array.isArray(validEmbeddings) || validEmbeddings.length === 0) {
    console.error("❌ No valid embeddings found.");
    return;
  }

  const vectors = validEmbeddings.map((item, i) => ({
    id: `chunk-${i}`,
    values: item.emb, // ✅ Ensure correct format
    metadata: { text: item.chunk.pageContent },
  }));

  console.log("📌 First vector sample:", JSON.stringify(vectors[0], null, 2));

  try {
    const response = await index.namespace("ns1").upsert(vectors);
    console.log("✅ Successfully inserted into Pinecone!", response);
  } catch (error) {
    console.error("❌ Error inserting embeddings:", error);
  }
}

await insertEmbeddings();

// Querying Pinecone
const queryVector = embeddings[0]; // Ensure a valid 4096-dimension vector

if (queryVector) {
  const response = await index.namespace("ns1").query({
    topK: 2,
    vector: queryVector,
    includeValues: true,
    includeMetadata: true,
  });

  console.log("🔍 Query Results:", JSON.stringify(response, null, 2));
} else {
  console.error("❌ No valid query vector found.");
}
