import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import mammoth from "mammoth";
import { pipeline } from "@xenova/transformers";
import dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

/// ✅ **Extract Text from .docx**
const extractText = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

const text = await extractText("data/Doc2.docx");
console.log("Extracted Text:", text.substring(0, 500)); // Preview first 500 chars

/// ✅ **Splitting Text into Chunks (Optimized)**
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800, // Increased from 500 to retain more context
  chunkOverlap: 100, // Increased to maintain continuity
});

const chunks = await splitter.createDocuments([text]);
console.log(`✅ Total Chunks: ${chunks.length}`);

//// ✅ **Embeddings using a Better Model (all-mpnet-base-v2)**
const embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2"); // 768-dim

const embedText = async (text) => {
  try {
    const embedding = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(embedding.data);
  } catch (error) {
    console.error("❌ Error generating embedding:", error);
    return null;
  }
};

// ✅ Convert all chunks to embeddings
const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.pageContent)));
const validEmbeddings = embeddings
  .map((emb, i) => (emb ? { emb, chunk: chunks[i] } : null))
  .filter(Boolean);

console.log(`✅ Valid Embeddings: ${validEmbeddings.length}`);

/////// ✅ **PINECONE SETUP (Updated for 768-dim)**
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function ensureIndex() {
  try {
    const indexList = await pinecone.listIndexes();
    if (!indexList.indexes.some((idx) => idx.name === "chatagent-xenova")) {
      await pinecone.createIndex({
        name: "chatagent-xenova",
        dimension: 768, // Updated for new model
        metric: "dotproduct", // Changed from "cosine" to "dotproduct"
        spec: { serverless: { cloud: "aws", region: "us-east-1" } },
      });
      console.log("✅ Pinecone Index Created with Dimension 768!");
    } else {
      console.log("✅ Pinecone Index already exists.");
    }
  } catch (error) {
    console.error("❌ Error ensuring index:", error);
  }
}

await ensureIndex();

/// ✅ **Inserting Embeddings into Pinecone**
const index = pinecone.index("chatagent-xenova");

async function insertEmbeddings() {
  const vectors = validEmbeddings.map(({ emb, chunk }, i) => ({
    id: `chunk-${i}`,
    values: emb,
    metadata: { text: chunk.pageContent },
  }));

  console.log("📌 Inserting", vectors.length, "vectors into Pinecone");

  try {
    const response = await index.namespace("ns1").upsert(vectors);
    console.log("✅ Successfully inserted into Pinecone!", response);
  } catch (error) {
    console.error("❌ Error inserting embeddings:", error);
  }
}

await insertEmbeddings();

/// ✅ **Querying Pinecone with a Real User Query**
async function queryPinecone(userQuery) {
  const queryEmbedding = await embedText(userQuery); // Generate embedding for the query

  if (!queryEmbedding) {
    console.error("❌ Failed to generate query embedding");
    return;
  }

  const response = await index.namespace("ns1").query({
    topK: 5, // Increased from 2 to get more relevant results
    vector: queryEmbedding,
    includeValues: true,
    includeMetadata: true,
  });

  console.log("🔍 Query Results:", JSON.stringify(response, null, 2));
}

// ✅ **Test Search with a Sample Query**
await queryPinecone("Find information about map");
