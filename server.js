const express = require("express");
const http = require("node:http");
const path = require("node:path");
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

//Set static folder
app.use(express.static(path.join(__dirname, "public")));

//Run when client connects
io.on("connection", (socket) => {
	console.log("New client connected");
});

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
