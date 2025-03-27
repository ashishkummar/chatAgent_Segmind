import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

 

 
const API_URL = "https://api.segmind.com/v1/embeddings";
const API_KEY = process.env.SEGMIND_API_KEY;; // Replace with your actual API key

async function getEmbeddings(inputText) {
    try {
        const response = await axios.post(
            API_URL,
            { input: inputText },  // Payload with input text
            {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Embeddings:", response.data);
    } catch (error) {
        console.error("Error fetching embeddings:", error.response ? error.response.data : error.message);
    }
}

// Example Usage
getEmbeddings("Hello world! This is a test.");
