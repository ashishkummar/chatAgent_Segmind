import axios from 'axios';
import dotenv from "dotenv";

dotenv.config();

const api_key = process.env.SEGMIND_API_KEY; 
 




const url = "https://api.segmind.com/v1/mixtral-8x22b-instruct";

const data = {
  "messages": [
    {
      "role": "user",
      "content": "tell me a joke on cats"
    },
    {
      "role": "assistant",
      "content": "here is a joke about cats..."
    },
    {
      "role": "user",
      "content": "now a joke on dogs"
    }
  ]
};

(async function() {
    try {
        const response = await axios.post(url, data, { headers: { 'x-api-key': api_key } });
        
        console.log('--> ',response.data.choices);


    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
})();
