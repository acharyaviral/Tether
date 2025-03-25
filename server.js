const path = require("node:path");
const http = require("node:http");
const express = require("express");
const socketio = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
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

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

const botName = "Tether! Bot";

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

// Handle socket connections
io.on("connection", (socket) => {
	console.log("New client connected", socket.id);

	socket.on("joinRoom", ({ username, room }) => {
		const user = userJoin(socket.id, username, room);
		socket.join(user.room);

		// Welcome current user
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

	socket.on("chatMessage", (msg) => {
		const user = getCurrentUser(socket.id);
		if (user) {
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
