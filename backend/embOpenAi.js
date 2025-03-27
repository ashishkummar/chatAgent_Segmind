const API = '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'

import axios from "axios";

const API_URL = "https://api.openai.com/v1/embeddings";
const API_KEY = API//"your_openai_api_key"; // Replace with your OpenAI API key

async function getOpenAIEmbeddings(text) {
    try {
        const response = await axios.post(
            API_URL,
            {
                input: text,
                model: "text-embedding-3-small" // Free-tier model
            },
            {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("OpenAI Embedding:", response.data.data[0].embedding);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

// Example Usage
getOpenAIEmbeddings("Hello world! This is a test.");
