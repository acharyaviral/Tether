const path = require("node:path");
const http = require("node:http");
const express = require("express");
const socketio = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const formatMessage = require("./utils/messages");
const {
	userJoin,
	getCurrentUser,
	userLeave,
	getRoomUsers,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Use Gemini AI model

const botName = "Tether! Bot";

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

(async () => {
	try {
		const redisUrl = process.env.REDIS_URL;
		const pubClient = createClient({ url: redisUrl });
		await pubClient.connect();
		const subClient = pubClient.duplicate();

		// Use Redis adapter for Socket.IO
		io.adapter(createAdapter(pubClient, subClient));
		console.log("Redis adapter connected");
	} catch (error) {
		console.error("Error connecting to Redis:", error);
	}
})();

// Handle new client connection
io.on("connection", (socket) => {
	console.log("New client connected:", socket.id);

	// Handle user joining a chat room
	socket.on("joinRoom", ({ username, room }) => {
		const user = userJoin(socket.id, username, room);
		socket.join(user.room);

		// Welcome the user
		socket.emit("message", formatMessage(botName, "Welcome to Tether!"));

		// Notify others in the room
		socket.broadcast
			.to(user.room)
			.emit(
				"message",
				formatMessage(botName, `${user.username} has joined the chat`),
			);

		// Update room users list
		io.to(user.room).emit("roomUsers", {
			room: user.room,
			users: getRoomUsers(user.room),
		});
	});

	// Handle chat messages
	socket.on("chatMessage", async (msg) => {
		const user = getCurrentUser(socket.id);
		if (!user) return;

		// Check if the message is an AI request
		if (msg.startsWith("@ai")) {
			try {
				const userMessage = msg.replace("@ai", "").trim();

				// Instruction to make AI always respond like an anime character
				const animeInstruction = `
          You are an anime character, always speaking with excitement, energy, and a fun personality.
          Use honorifics  and sprinkle in some Japanese words 
          Example:
          User: "Tell me about programming."
          You: "honorifics Programming is like a grand adventure, You get to create magical worlds with just a few keystrokes! \(≧▽≦)/"
  
          User: ${userMessage}
        `;

				const result = await model.generateContent(animeInstruction);
				const response = await result.response;
				const aiResponse = response.text();

				// Send AI response in an anime character style
				io.to(user.room).emit(
					"message",
					formatMessage("Tether! Bot", aiResponse),
				);
			} catch (error) {
				console.error("AI response error:", error);
				io.to(user.room).emit(
					"message",
					formatMessage(
						"Tether! Bot",
						"Gomenasai! My AI circuits are overloaded right now! (╥﹏╥)",
					),
				);
			}
		} else {
			// Send user message to the chat
			io.to(user.room).emit("message", formatMessage(user.username, msg));
		}
	});

	// Handle user disconnection
	socket.on("disconnect", () => {
		const user = userLeave(socket.id);
		if (user) {
			io.to(user.room).emit(
				"message",
				formatMessage(botName, `${user.username} has left the chat`),
			);

			// Update room users list
			io.to(user.room).emit("roomUsers", {
				room: user.room,
				users: getRoomUsers(user.room),
			});
		}
	});
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
