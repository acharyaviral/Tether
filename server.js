const path = require("node:path");
const http = require("node:http");
const express = require("express");
const socketio = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Corrected import

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
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Initialize model

const botName = "Tether! Bot";

app.use(express.static(path.join(__dirname, "public")));

(async () => {
	try {
		const redisUrl = process.env.REDIS_URL;
		const pubClient = createClient({ url: redisUrl });
		await pubClient.connect();
		const subClient = pubClient.duplicate();
		io.adapter(createAdapter(pubClient, subClient));
		console.log("Redis adapter connected");
	} catch (error) {
		console.error("Error connecting to Redis:", error);
	}
})();

io.on("connection", (socket) => {
	console.log("New client connected", socket.id);

	socket.on("joinRoom", ({ username, room }) => {
		const user = userJoin(socket.id, username, room);
		socket.join(user.room);

		socket.emit("message", formatMessage(botName, "Welcome to Tether!"));
		socket.broadcast
			.to(user.room)
			.emit(
				"message",
				formatMessage(botName, `${user.username} has joined the chat`),
			);

		io.to(user.room).emit("roomUsers", {
			room: user.room,
			users: getRoomUsers(user.room),
		});
	});

	socket.on("chatMessage", async (msg) => {
		const user = getCurrentUser(socket.id);
		if (!user) return;

		if (msg.startsWith("@ai")) {
			try {
				const prompt = msg.replace("@ai", "").trim();
				const result = await model.generateContent(prompt);
				const response = await result.response;
				const aiResponse = response.text();

				io.to(user.room).emit(
					"message",
					formatMessage("Tether! Bot", aiResponse),
				);
			} catch (error) {
				console.error("AI response error:", error);
				io.to(user.room).emit(
					"message",
					formatMessage("Tether! Bot", "AI is unavailable right now."),
				);
			}
		} else {
			io.to(user.room).emit("message", formatMessage(user.username, msg));
		}
	});

	socket.on("disconnect", () => {
		const user = userLeave(socket.id);
		if (user) {
			io.to(user.room).emit(
				"message",
				formatMessage(botName, `${user.username} has left the chat`),
			);

			io.to(user.room).emit("roomUsers", {
				room: user.room,
				users: getRoomUsers(user.room),
			});
		}
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
