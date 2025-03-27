import { Pinecone } from "@pinecone-database/pinecone";

const API_KEY = "pcsk_3jcj9H_Nn5U7ixrNXy5eP98PN3e8AUXzRgS5XNSvwyPKUhmne9YGY19p7Pon5V1UnVvqq8"; // Replace with your Pinecone API key
const INDEX_NAME = "chatagent-xenova"; // Your Pinecone index name

async function checkIndex() {
  const client = new Pinecone({ apiKey: API_KEY });
  const index = client.index(INDEX_NAME);
  const description = await index.describeIndexStats();
  console.log("Index Stats:", description);
}

checkIndex();
