import axios from "axios";

const API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

async function getHuggingFaceEmbeddings(text) {
    try {
        const response = await axios.post(
            API_URL,
            { inputs: text }
        );

        console.log("Hugging Face Embedding:", response.data);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

// Example Usage
getHuggingFaceEmbeddings("Hello world! This is a test.");
