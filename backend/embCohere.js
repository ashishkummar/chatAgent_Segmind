import axios from "axios";

const API_URL = "https://api.cohere.ai/v1/embed";
const API_KEY = "vntbZWbUK22UpmEgfR4E7kUIjNP9nCipOMluU0vk"; // Your Cohere API key

async function getCohereEmbeddings(text) {
    try {
        const response = await axios.post(
            API_URL,
            {
                texts: [text], // Supports batch requests
                model: "embed-english-v3.0",
                input_type: "search_document" // OR "search_query"
            },
            {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Cohere Embedding:", response.data.embeddings[0]);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

// Example Usage
getCohereEmbeddings("Hello world! This is a test.");
