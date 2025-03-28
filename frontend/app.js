import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers";

let embedder = null;

// Function to load model
async function loadModel() {
    console.log("⏳ Loading model...");
    embedder = await pipeline("feature-extraction", "Xenova/all-distilroberta-v1", { quantized: true });
    console.log("✅ Model loaded!");

    // Hide loading & show main UI
    document.getElementById("loading").style.display = "none";
    document.getElementById("app").style.display = "flex";
}

// Load model on page load
loadModel();

// Function to append message to chat
function addMessage(content, type) {
    const chatBox = document.getElementById("chatBox");
    const message = document.createElement("div");
    message.classList.add("message", type);
    message.innerHTML = refineMessage(content); // Use innerHTML to retain formatting
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
}

// Function to send query to backend
async function sendQueryToBackend(query) {
    const askButton = document.getElementById("askBtn");
    const inputBox = document.getElementById("query");

    try {
        if (!embedder) {
            alert("Model is still loading... Please wait.");
            return;
        }

        // Show user message
        addMessage(query, "user");

        askButton.disabled = true;
        inputBox.value = "";
        addMessage("🤔 Thinking...", "bot");

        console.log("🔎 Generating embedding...");
        const embedding = await embedder(query, { pooling: "mean", normalize: true });

        const response = await fetch("http://localhost:5000/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, embedding: Array.from(embedding.data) })
        });

        const data = await response.json();

        // Remove "Thinking..." and show response
        const chatBox = document.getElementById("chatBox");
        chatBox.removeChild(chatBox.lastChild);
        addMessage("" + data.response, "bot");
    } catch (error) {
        console.error("❌ Error:", error);

        // Remove "Thinking..." and show error
        const chatBox = document.getElementById("chatBox");
        chatBox.removeChild(chatBox.lastChild);
        addMessage("❌ Error fetching response.", "bot");
    } finally {
        askButton.disabled = false;
    }
}

// Button click event
document.getElementById("askBtn").addEventListener("click", async () => {
    const query = document.getElementById("query").value.trim();
    if (query) {
        await sendQueryToBackend(query);
    } else {
        alert("Please enter a question.");
    }
});

// Refine message to wrap JS code inside ```js ... ```
function refineMessage(msg) {
    // Extract all JS or JavaScript code blocks between ```js or ```javascript and ```
    const matches = msg.match(/```(js|javascript)([\s\S]*?)```/g);

    // If JS/JavaScript code is found, replace each occurrence
    if (matches) {
        matches.forEach(match => {
            const jsCode = match.replace(/```(js|javascript)|```/g, "").trim(); // Extract clean JS code
            const jsWrapped = `<div class="code-container"><pre><code class="language-js">${jsCode}</code></pre></div>`;
            msg = msg.replace(match, jsWrapped);
        });
    }

    // Handle inline code (`...`)
    msg = msg.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Handle line breaks properly (preserve them for regular text)
    msg = msg.replace(/\n/g, "<br>");

    return msg;
}
