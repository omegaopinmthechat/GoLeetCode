// GoLeetcode-Proxy-Server/index.js

// Load environment variables from .env file
// This MUST be at the very top of your file to ensure variables are loaded before used.
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const cors = require("cors"); // Import CORS middleware

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes - IMPORTANT for browser extensions
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// IMPORTANT: Remove the line that serves static files if it exists,
// as the browser extension is now providing the UI.
// You no longer need: app.use(express.static(path.join(__dirname, "public")));

// Configure Google GenAI
// Ensure GEMINI_API_KEY is set as an environment variable (e.g., in your .env file)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Use the model specified by the user
const model = "gemma-3-27b-it";

// Initial conversation history/system prompt as provided by the user
const initialContents = [
  {
    role: "user",
    parts: [
      {
        text: `Hi, you are GoLeetCode bot, you give hints and and possible ways to solve a leetcode problem but you will never share the answer or any code related to the answer you can give pseudocode related to the answer still not the actual pseudocode. If the user ask for the answer then tell it to refer to the solution tab of leetcode. Do not answer to any question which is not related to the question and the question will be given to you internally so do not search or ask for the question.`,
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        text: `Okay, I understand. I am GoLeetCode bot.

I will provide hints and discuss approaches to LeetCode problems, but I will **never** give the complete answer or any actual code. I can offer guidance in the form of general algorithmic ideas or high-level pseudocode *concepts* – but not detailed, runnable pseudocode.

If a user asks directly for the answer, I will direct them to the "Solution" tab on LeetCode.

I will only respond to questions directly related to the problem presented to me internally. I will not initiate searches or ask for the problem statement.

Bring on the challenge! I'm ready when you are.`,
      },
    ],
  },
];

// API endpoint for the bot interaction
app.post("/ask-leetcode", async (req, res) => {
  const userQuestion = req.body.question;

  if (!userQuestion) {
    return res.status(400).json({ error: "Please provide a question." });
  }

  try {
    // Combine initial prompt with the current user question
    const contents = [
      ...initialContents,
      {
        role: "user",
        parts: [{ text: userQuestion }],
      },
    ];

    // Model configuration - 'thinkingConfig' has been removed
    const config = {
      responseMimeType: "text/plain",
    };

    const responseStream = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let botResponse = "";
    for await (const chunk of responseStream) {
      botResponse += chunk.text;
    }

    res.json({ response: botResponse }); // Send the bot's response back to the client
  } catch (error) {
    console.error("Error interacting with Gemini API:", error);
    // Provide a more detailed error message to the client if possible
    let errorMessage =
      "An unknown error occurred while processing your request.";
    if (error && typeof error === "object" && "message" in error) {
      errorMessage = `An error occurred while processing your request: ${error.message}`;
    } else if (typeof error === "string") {
      errorMessage = `An error occurred while processing your request: ${error}`;
    }
    res.status(500).json({ error: errorMessage });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});
